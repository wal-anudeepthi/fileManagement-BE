import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { Files } from 'src/schemas/files.schema';
import { UploadFileDto } from './dtos/upload-file.dto';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { promises as fs } from 'fs';
import { Response } from 'express';

@Injectable()
export class FilesService {
  constructor(
    @InjectModel(Files.name) private filesModel: mongoose.Model<Files>,
  ) {}

  getFileById(fileId: string) {
    const objectId = new Types.ObjectId(fileId);
    return this.filesModel.find({ _id: objectId, isDeleted: false });
  }

  async getFiles(userId: string) {
    const userIdObject = new Types.ObjectId(userId);
    return this.filesModel.find({ userId: userIdObject, isDeleted: false });
  }

  async upload(file: any, body: UploadFileDto) {
    try {
      const userIdObject = new Types.ObjectId(body.userId);
      const uploadPayload = {
        fileName: file.filename,
        filePath: file.destination,
        fileType: file.originalname?.split('.')[1],
        targettedStorage: 'LocalStorage',
        userId: userIdObject,
        createdBy: userIdObject,
      };
      return this.filesModel.create(uploadPayload);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateFile(fileId: string, userId: string, content: string) {
    const [file] = await this.getFileById(fileId);
    const fileName = file.fileName;
    const filePath = join(__dirname, '../..', 'uploads', fileName);
    try {
      //Check file exists or not
      await fs.access(filePath);

      // Overwriting the file content
      await fs.writeFile(filePath, content);
      const objectId = new Types.ObjectId(fileId);
      const userObjectId = new Types.ObjectId(userId);
      return this.filesModel.updateOne(
        { _id: objectId },
        { $set: { updatedBy: userObjectId } },
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getFile(id: string) {
    const fileIdObject = new Types.ObjectId(id);
    const file = await this.filesModel.findOne({
      _id: fileIdObject,
      isDeleted: false,
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    const fileData = await open(`${file.filePath}/${file.fileName}`);
    const content = await fileData.readFile();
    await fileData.close();
    return content.toString();
  }

  async delete(id: string, userId: string) {
    try {
      const fileIdObject = new Types.ObjectId(id);
      const userIdObject = new Types.ObjectId(userId);
      const file = await this.filesModel.findById(fileIdObject);
      if (!file) {
        throw new NotFoundException('File not found');
      }
      const updatedValue = await this.filesModel.updateOne(
        { _id: fileIdObject },
        { isDeleted: true, deletedBy: userIdObject, deletedAt: new Date() },
      );
      return updatedValue;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async downloadFile(id: string, res: Response) {
    try {
      const [file] = await this.getFileById(id);
      if (!file) {
        throw new NotFoundException('File not found!!');
      }
      res.download(`${file.filePath}/${file.fileName}`);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
