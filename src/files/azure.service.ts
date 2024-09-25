import {
  ContainerClient,
  BlobSASPermissions,
  BlobSASSignatureValues,
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

  async uploadImage(
    file: Express.Multer.File,
    fileName: string,
    originalFileName: string,
  ) {
    const folderName = fileName;
    // this.uploadFile(file, `${folderName}/${originalFileName}`);
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
    const thumbnailSizes = [
      { wh: 200, label: 'small' },
      { wh: 400, label: 'medium' },
      { wh: 900, label: 'large' },
    ];
    const thumbnailPromises = thumbnailSizes.map(async (size) => {
      const thumbnailBuffer = await sharp(file.buffer)
        .resize(size.wh, size.wh, {
          fit: 'inside',
        })
        .toBuffer();
      const thumbnailBlobName = `${folderName}/${fileName}-${size.label}${extname(originalFileName)}`;
      const thumbnailBlockBlobClient =
        this.containerClient.getBlockBlobClient(thumbnailBlobName);
      return thumbnailBlockBlobClient.uploadData(thumbnailBuffer, {
        blobHTTPHeaders: {
          blobContentType: contentType,
        },
      });
    });
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
    const filePath = isImage ? `${fileName}/${originalFileName}` : fileName;
    const uploadPayload = {
      fileName: originalFileName,
      filePath: filePath,
      fileType: file.originalname?.split('.')[1],
      targettedStorage: body.targettedStorage,
      userId: userIdObject,
      createdBy: userIdObject,
    };
    return this.filesModel.create(uploadPayload);
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
}
