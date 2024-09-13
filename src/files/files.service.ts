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
import { extname, join } from 'node:path';
import * as fs from 'fs';
import { Response } from 'express';
import { UpdateFileDto } from './dtos/update-file.dto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { s3Client } from 'src/s3Client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FilesService {
  private readonly s3Client;
  constructor(
    @InjectModel(Files.name) private filesModel: mongoose.Model<Files>,
    private readonly configService: ConfigService,
  ) {
    this.s3Client = s3Client(configService);
  }

  async getFileById(fileId: string) {
    const objectId = new Types.ObjectId(fileId);
    const file = await this.filesModel.find({
      _id: objectId,
      isDeleted: false,
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  async getFiles(userId: string) {
    const userIdObject = new Types.ObjectId(userId);
    return this.filesModel.find({ userId: userIdObject, isDeleted: false });
  }

  async getFile(id: string) {
    try {
      const [file] = await this.getFileById(id);
      const fileData = await open(`${file.filePath}/${file.fileName}`);
      const content = await fileData.readFile();
      await fileData.close();
      return content.toString();
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async upload(file: Express.Multer.File, body: UploadFileDto) {
    try {
      const userIdObject = new Types.ObjectId(body.userId);
      const targettedStorage = body.targettedStorage;
      const prefix = `${file.originalname.split('.')[0]}-${uuidv4().split('-')[0]}`;
      const fileExt = extname(file.originalname);
      const fileName = `${prefix}${fileExt}`;

      const uploadPayload = {
        fileName: fileName,
        fileType: file.originalname?.split('.')[1],
        targettedStorage: targettedStorage,
        userId: userIdObject,
        createdBy: userIdObject,
        filePath: null,
      };
      // //Upload file to local
      if (targettedStorage === 'LocalStorage') {
        const uploadPath = `${process.env.UPLOADS_FOLDER_PATH}`;
        const filePath = join(__dirname, '../../', uploadPath, fileName);
        uploadPayload[filePath] = filePath;
        await fs.promises.writeFile(filePath, file.buffer);
      }

      //Upload the file to S3 bucket
      if (targettedStorage === 'Aws') {
        const uploadPath = `s3://${process.env.S3_BUCKET_NAM}/${fileName}`;
        uploadPayload.filePath = uploadPath;
        const uploadParams = {
          Bucket: this.configService.getOrThrow('S3_BUCKET_NAME'),
          Key: fileName,
          Body: file.buffer,
        };
        await this.s3Client.send(new PutObjectCommand(uploadParams));
      }

      // Insert into DB
      return this.filesModel.create(uploadPayload);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateFile(fileId: string, body: UpdateFileDto) {
    try {
      const [file] = await this.getFileById(fileId);
      const fileName = file.fileName;
      const filePath = join(__dirname, '../..', 'uploads', fileName);
      //Check file exists or not
      await fs.promises.access(filePath);

      // Overwriting the file content
      await fs.promises.writeFile(filePath, body.content);
      const objectId = new Types.ObjectId(fileId);
      const userObjectId = new Types.ObjectId(body.userId);
      const updatedValue = this.filesModel.updateOne(
        { _id: objectId },
        { $set: { updatedBy: userObjectId } },
      );
      return updatedValue;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
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
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${file.fileName}"`,
      );
      res.download(`${file.filePath}/${file.fileName}`);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
