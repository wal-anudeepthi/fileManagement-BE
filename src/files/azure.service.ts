import {
  ContainerClient,
  BlobSASSignatureValues,
  BlobSASPermissions,
} from '@azure/storage-blob';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { Files } from 'src/schemas/files.schema';
import { getContainerClient } from './config/azure-config';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';
import { UploadFileDto } from './dtos/upload-file.dto';
import * as sharp from 'sharp';
import { Response } from 'express';

@Injectable()
export class AzureService {
  private containerClient: ContainerClient;
  constructor(
    @InjectModel(Files.name) private filesModel: mongoose.Model<Files>,
  ) {
    this.azureInitialize();
  }

  //Azure connection
  async azureInitialize() {
    this.containerClient = await getContainerClient();
  }

  async generateThumbnails(
    file: Express.Multer.File,
    fileName: string,
    originalFileName: string,
    folderName: string,
  ) {
    const thumbnailSizes = [
      { wh: 200, label: 'small' },
      { wh: 400, label: 'medium' },
      { wh: 900, label: 'large' },
    ];
    const thumbNails: { buffer: Buffer; fileName: string }[] = [];
    await Promise.all(
      thumbnailSizes.map(async (size) => {
        const thumbnailBuffer = await sharp(file.buffer)
          .resize(size.wh, size.wh, {
            fit: 'inside',
          })
          .toBuffer();

        const thumbnailFileName = `${folderName}/${fileName}-${size.label}${extname(originalFileName)}`;
        thumbNails.push({
          buffer: thumbnailBuffer,
          fileName: thumbnailFileName,
        });
      }),
    );
    return thumbNails;
  }

  async generateImageThumbNails(
    file: Express.Multer.File,
    fileName: string,
    originalFileName: string,
    folderName: string,
  ) {
    const thumbNails = await this.generateThumbnails(
      file,
      fileName,
      originalFileName,
      folderName,
    );
    const contentType = file.mimetype;
    const thumbnailPromises = thumbNails.map((thumbNail) => {
      const thumbnailBlockBlobClient = this.containerClient.getBlockBlobClient(
        thumbNail.fileName,
      );
      return thumbnailBlockBlobClient.uploadData(thumbNail.buffer, {
        blobHTTPHeaders: {
          blobContentType: contentType,
        },
      });
    });
    return thumbnailPromises;
  }

  async uploadImage(
    file: Express.Multer.File,
    fileName: string,
    originalFileName: string,
  ) {
    const folderName = fileName;
    const blockBlobClient = this.containerClient.getBlockBlobClient(
      `${folderName}/${originalFileName}`,
    );
    const contentType = file.mimetype;
    // Upload the original image
    const originalImageUpload = blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    });
    const thumbnailPromises = await this.generateImageThumbNails(
      file,
      fileName,
      originalFileName,
      folderName,
    );
    await Promise.all([originalImageUpload, ...thumbnailPromises]);
  }

  async uploadFile(file: Express.Multer.File, fileName: string) {
    const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.uploadData(file.buffer);
  }

  async uploadFileToAzure(file: Express.Multer.File, body: UploadFileDto) {
    const isImage = file.mimetype.split('/')[0] === 'image';
    const originalFileName = `${file.originalname.split('.')[0]}-${uuidv4().split('-')[0]}${extname(file.originalname)}`;
    const fileName = originalFileName.split('.').slice(0, -1).join('.');
    if (isImage) {
      await this.uploadImage(file, fileName, originalFileName);
    } else {
      await this.uploadFile(file, originalFileName);
    }

    const userIdObject = new Types.ObjectId(body.userId);
    const filePath = isImage
      ? `${fileName}/${originalFileName}`
      : originalFileName;
    const uploadPayload = {
      fileName: originalFileName,
      filePath: filePath,
      fileType: file.mimetype,
      targettedStorage: body.targettedStorage,
      userId: userIdObject,
      createdBy: userIdObject,
    };
    return this.filesModel.create(uploadPayload);
  }

  // Delete file from Azure
  async deleteFileFromAzure(fileName: string) {
    const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.deleteIfExists();
  }

  // Update File in Azure
  async updateAzureFile(fileName: string, content: string) {
    const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
    // Convert the string content to a Buffer
    const contentBuffer = Buffer.from(content, 'utf-8');
    await blockBlobClient.uploadData(contentBuffer);
  }

  async getFileContent(file: Files) {
    const blockBlobClient = this.containerClient.getBlockBlobClient(
      file.filePath,
    );
    const downloadResponse = await blockBlobClient.downloadToBuffer(0);
    return downloadResponse.toString('utf-8');
  }

  //Download file from Azure
  async downloadAzureFile(file: Files, res: Response) {
    const blobClient = this.containerClient.getBlockBlobClient(file.filePath);
    const fileBuffer = await blobClient.downloadToBuffer(0);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );

    res.send(fileBuffer);
  }

  // Generate SAS URL for Azure Blob
  async generateAzureSasUrl(fileName: string) {
    const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
    const expiresOn = new Date(new Date().valueOf() + 3600 * 1000); // Expiration time
    const permissions = BlobSASPermissions.parse('r');

    const sasOptions: BlobSASSignatureValues = {
      expiresOn,
      permissions,
      containerName: this.containerClient.containerName,
      blobName: fileName,
    };

    const sasUrl = await blockBlobClient.generateSasUrl(sasOptions);
    return sasUrl;
  }

  // Get URLs for Azure thumbnails
  async getAzureThumbnails(file: Files) {
    const ext = extname(file.fileName);
    const sizes = ['small', 'medium', 'large'];

    const urls = sizes.map(async (size) => {
      const fileKey = `${file.filePath.split('.')[0]}-${size}${ext}`;
      return this.generateAzureSasUrl(fileKey);
    });

    return Promise.all(urls);
  }

  async getAzureImage(file: Files) {
    const sasurl = await this.generateAzureSasUrl(file.filePath);
    return sasurl;
  }
}
