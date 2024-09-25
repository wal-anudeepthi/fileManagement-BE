import { ContainerClient } from '@azure/storage-blob';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { Files } from 'src/schemas/files.schema';
import { getContainerClient } from './config/azure-config';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';
import { UploadFileDto } from './dtos/upload-file.dto';

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

  async uploadFileToAzure(file: Express.Multer.File, body: UploadFileDto) {
    const originalFileName = `${file.originalname.split('.')[0]}-${uuidv4().split('-')[0]}${extname(file.originalname)}`;
    const fileName = originalFileName.split('.').slice(0, -1).join('.');
    const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.uploadData(file.buffer);
    const userIdObject = new Types.ObjectId(body.userId);
    const uploadPayload = {
      fileName: fileName,
      filePath: fileName,
      fileType: file.originalname?.split('.')[1],
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
}
