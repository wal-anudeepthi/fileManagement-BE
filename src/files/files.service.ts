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
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { UpdateFileDto } from './dtos/update-file.dto';
import { s3Config } from 'src/files/config/s3-config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FilesService {
  private readonly s3 = s3Config;

  constructor(
    @InjectModel(Files.name) private filesModel: mongoose.Model<Files>,
  ) {}

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

  //Upload to localStorage
  async upload(file: Express.Multer.File, body: UploadFileDto) {
    try {
      const userIdObject = new Types.ObjectId(body.userId);
      const uploadPayload = {
        fileName: file.filename,
        filePath: file.destination,
        fileType: file.originalname?.split('.')[1],
        targettedStorage: body.targettedStorage,
        userId: userIdObject,
        createdBy: userIdObject,
      };
      return this.filesModel.create(uploadPayload);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  //Upload to AWS S3
  async uploadToS3(file: Express.Multer.File, body: UploadFileDto) {
    try {
      const userIdObject = new Types.ObjectId(body.userId);
      const fileName = `${file.originalname.split('.')[0]}-${uuidv4().split('-')[0]}${extname(file.originalname)}`;
      // Define S3 upload parameters
      const s3Params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      };
      // Upload the file to S3
      await this.s3.upload(s3Params).promise();
      // Save file details in the database
      const uploadPayload = {
        fileName: fileName,
        filePath: fileName,
        fileType: file.mimetype.split('/')[1],
        targettedStorage: body.targettedStorage,
        userId: userIdObject,
        createdBy: userIdObject,
      };

      return this.filesModel.create(uploadPayload);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateFile(fileId: string, body: UpdateFileDto) {
    try {
      const [file] = await this.getFileById(fileId);
      const fileName = file.fileName;
      const targettedStorage = file.targettedStorage;
      if (!file) {
        throw new NotFoundException('File not found!!');
      }
      if (targettedStorage === 'LocalStorage') {
        const filePath = join(__dirname, '../..', 'uploads', fileName);
        // Check if file exists
        if (!existsSync(filePath)) {
          throw new NotFoundException('File not found in Local storage');
        }
        await fs.writeFile(filePath, body.content);
      } else if (targettedStorage === 'Aws') {
        // AWS S3 file update
        const params = {
          Bucket: process.env.AWS_S3_BUCKET,
          Key: fileName,
          Body: body.content,
        };
        // Upload new content to S3, overwriting the existing file
        await this.s3.upload(params).promise();
      }
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

  async downloadFile(id: string, targettedStorage: string, res: Response) {
    try {
      const [file] = await this.getFileById(id);
      if (!file) {
        throw new NotFoundException('File not found!!');
      }
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      if (targettedStorage === 'LocalStorage') {
        //Local Storage file download
        const filePath = path.resolve(`${file.filePath}/${file.fileName}`);
        if (!existsSync(filePath)) {
          throw new NotFoundException('File not found on local storage!');
        }
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${file.fileName}"`,
        );
        res.download(filePath);
      } else if (targettedStorage === 'Aws') {
        // AWS S3 file download
        const params = {
          Bucket: process.env.AWS_S3_BUCKET,
          Key: file.fileName,
        };
        const s3Stream = this.s3.getObject(params).createReadStream();
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${file.fileName}"`,
        );
        s3Stream.on('error', (error) => {
          throw new HttpException(
            error.message,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        });
        s3Stream.pipe(res);
      }
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
