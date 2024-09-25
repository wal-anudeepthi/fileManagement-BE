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
import * as sharp from 'sharp';
import { AzureService } from './azure.service';

@Injectable()
export class FilesService {
  private readonly s3 = s3Config;

  constructor(
    @InjectModel(Files.name) private filesModel: mongoose.Model<Files>,
    private azureService: AzureService,
  ) {}

  async getFileById(fileId: string) {
    const objectId = new Types.ObjectId(fileId);
    const file = await this.filesModel.find({
      _id: objectId,
      isDeleted: false,
    });
    if (!file.length) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  async getFiles(userId: string) {
    const userIdObject = new Types.ObjectId(userId);
    return this.filesModel.find({ userId: userIdObject, isDeleted: false });
  }

  async getLocalStorageFileContent(file: Files) {
    const fileData = await open(`${file.filePath}/${file.fileName}`);
    const content = await fileData.readFile();
    await fileData.close();
    return content.toString();
  }

  async getAwsFileContent(file: Files) {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: file.filePath,
    };
    const fileData = await this.s3.getObject(params).promise();
    return fileData.Body.toString();
  }

  async updateLocalFile(fileName: string, content: string) {
    const filePath = join(__dirname, '../..', 'uploads', fileName);
    // Check if file exists
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found in Local storage');
    }
    await fs.writeFile(filePath, content);
  }

  async updateAwsFile(fileName: string, content: string) {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileName,
      Body: content,
    };
    await this.s3.upload(params).promise();
  }

  async downloadLocalFile(file: Files, res: Response) {
    const filePath = path.resolve(`${file.filePath}/${file.fileName}`);
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found on local storage!');
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.download(filePath);
  }

  async downloadAwsFile(file: Files, res: Response) {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: file.filePath,
    };
    const s3Stream = this.s3.getObject(params).createReadStream();
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    s3Stream.on('error', (error) => {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    });
    s3Stream.pipe(res);
  }

  async getFile(id: string) {
    try {
      const [file] = await this.getFileById(id);
      let res: string;
      switch (file.targettedStorage) {
        case 'LOCALSTORAGE':
          res = await this.getLocalStorageFileContent(file);
          break;
        case 'AWS':
          res = await this.getAwsFileContent(file);
          break;
        case 'AZURE':
          res = await this.azureService.getFileContent(file);
          break;
        default:
          throw new HttpException(
            'No specified targetted storage',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
      }
      return res;
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Upload to localStorage
  async uploadFileLocally(file: Express.Multer.File, body: UploadFileDto) {
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

  async uploadImageLocally(file: Express.Multer.File, body: UploadFileDto) {
    const userIdObject = new Types.ObjectId(body.userId);
    const originalFilePath = `${file.destination}/${file.filename}`;

    const uploadPayload = {
      fileName: file.filename,
      filePath: file.destination,
      fileType: file.mimetype,
      targettedStorage: body.targettedStorage,
      userId: userIdObject,
      createdBy: userIdObject,
    };
    await this.filesModel.create(uploadPayload);
    // Create thumbnail sizes
    const thumbnailSizes = [
      { wh: 200, label: 'small' },
      { wh: 400, label: 'medium' },
      { wh: 900, label: 'large' },
    ];

    // Generate and save thumbnails
    const thumbnailPromises = thumbnailSizes.map(async (size) => {
      const thumbnailBuffer = await sharp(originalFilePath)
        .resize(size.wh, size.wh, {
          fit: 'inside',
        })
        .toBuffer();

      const thumbnailFileName = `${file.filename.split('.')[0]}-${size.label}${extname(file.originalname)}`;
      const thumbnailFilePath = `${file.destination}/${thumbnailFileName}`;

      // Save the thumbnail to local storage
      fs.writeFile(thumbnailFilePath, thumbnailBuffer);
    });

    await Promise.all(thumbnailPromises);
  }

  async uploadToLocal(file: Express.Multer.File, body: UploadFileDto) {
    try {
      const isImage = file.mimetype.split('/')[0] === 'image';
      if (isImage) {
        await this.uploadImageLocally(file, body);
      } else {
        await this.uploadFileLocally(file, body);
      }
      return {
        message: 'File uploaded successfully',
        fileName: file.filename,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async uploadImageToS3(
    folderName: string,
    originalFileName: string,
    file: Express.Multer.File,
    fileName: string,
  ) {
    // Upload original file to S3
    const uploadOriginalImage = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `${folderName}/${originalFileName}`,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'private',
    };
    await this.s3.upload(uploadOriginalImage).promise();
    // Generate and upload thumbnails
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

      const thumbnailFileName = `${fileName}-${size.label}${extname(originalFileName)}`;
      const thumbnailParams = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: `${folderName}/${thumbnailFileName}`,
        Body: thumbnailBuffer,
        ContentType: file.mimetype,
        ACL: 'private',
      };
      return this.s3.upload(thumbnailParams).promise();
    });
    await Promise.all(thumbnailPromises);
  }

  async uploadFileToS3(file: Express.Multer.File, fileName: string) {
    // Define S3 upload parameters
    const s3Params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    };
    // Upload the file to S3
    await this.s3.upload(s3Params).promise();
  }

  //Upload to AWS S3
  async uploadToS3(file: Express.Multer.File, body: UploadFileDto) {
    try {
      const isImage = file.mimetype.split('/')[0] === 'image';
      const userIdObject = new Types.ObjectId(body.userId);
      const originalFileName = `${file.originalname.split('.')[0]}-${uuidv4().split('-')[0]}${extname(file.originalname)}`;
      const fileName = originalFileName.split('.').slice(0, -1).join('.');
      const folderName = fileName;
      if (isImage) {
        await this.uploadImageToS3(
          folderName,
          originalFileName,
          file,
          fileName,
        );
      } else {
        await this.uploadFileToS3(file, originalFileName);
      }
      // Save file details in the database
      const uploadPayload = {
        fileName: originalFileName,
        filePath: isImage
          ? `${folderName}/${originalFileName}`
          : originalFileName,
        fileType: file.mimetype.split('/')[1],
        targettedStorage: body.targettedStorage,
        userId: userIdObject,
        createdBy: userIdObject,
      };
      await this.filesModel.create(uploadPayload);
      return {
        message: 'File uploaded successfully',
        fileName: fileName,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateFile(fileId: string, body: UpdateFileDto) {
    try {
      const [file] = await this.getFileById(fileId);
      const fileName = file.fileName;
      const targettedStorage = file.targettedStorage;
      switch (targettedStorage) {
        case 'LOCALSTORAGE':
          this.updateLocalFile(fileName, body.content);
          break;
        case 'AWS':
          this.updateAwsFile(fileName, body.content);
          break;
        case 'AZURE':
          this.azureService.updateAzureFile(fileName, body.content);
          break;
        default:
          throw new HttpException(
            'No specified targetted storage',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
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
      const [file] = await this.getFileById(id);
      switch (file.targettedStorage) {
        case 'AWS':
          const awsParams = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: file.filePath,
          };
          await this.s3.deleteObject(awsParams).promise();
          break;
        case 'AZURE':
          await this.azureService.deleteFileFromAzure(file.fileName);
          break;
        default:
          throw new Error('Unsupported storage type');
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
      switch (file.targettedStorage) {
        case 'LOCALSTORAGE':
          this.downloadLocalFile(file, res);
          break;
        case 'AWS':
          this.downloadAwsFile(file, res);
          break;
        case 'AZURE':
          this.azureService.downloadAzureFile(file, res);
          break;
        default:
          throw new HttpException(
            'No specified targetted storage',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
      }
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async downloadWithSignature(id: string) {
    try {
      const [file] = await this.getFileById(id);

      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: file.filePath,
        Expires: 3600,
      };

      const url = await this.s3.getSignedUrlPromise('getObject', params);
      return { url };
    } catch (error) {
      throw new HttpException(
        `failed to download file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getLocalThumbnails(file: Files) {
    const fileName = file.fileName.split('.')[0];
    const ext = extname(file.fileName);
    const sizes = ['small', 'medium', 'large'];
    const filePath = sizes.map(
      (size) => `${process.env.IMAGE_PATH}/${fileName}-${size}${ext}`,
    );
    return filePath;
  }

  async getAwsThumbails(file: Files) {
    const ext = extname(file.fileName);
    const sizes = ['small', 'medium', 'large'];
    const urls = sizes.map((size) => {
      const fileKey = `${file.filePath.split('.')[0]}-${size}${ext}`;
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileKey,
        Expires: 3600,
      };

      return this.s3.getSignedUrlPromise('getObject', params);
    });
    const urlPromises = await Promise.all(urls);
    return urlPromises;
  }

  async getThumbnails(id: string) {
    const [file] = await this.getFileById(id);
    let urls;
    switch (file.targettedStorage) {
      case 'LOCALSTORAGE':
        urls = await this.getLocalThumbnails(file);
        break;
      case 'AWS':
        urls = await this.getAwsThumbails(file);
        break;
      default:
        throw new HttpException(
          'No specified targetted storage',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
    return urls;
  }

  async getLocalImages(file: Files) {
    return `${process.env.IMAGE_PATH}/${file.fileName}`;
  }

  async getAwsImages(file: Files) {
    // const fileKey = `${file.filePath.split('.')[0]}`;
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: file.filePath,
      Expires: 3600,
    };

    return this.s3.getSignedUrlPromise('getObject', params);
  }

  async getImages(id: string) {
    const [file] = await this.getFileById(id);
    let urls;
    switch (file.targettedStorage) {
      case 'LOCALSTORAGE':
        urls = await this.getLocalImages(file);
        break;
      case 'AWS':
        urls = await this.getAwsImages(file);
        break;
      default:
        throw new HttpException(
          'No specified targetted storage',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
    return urls;
  }
}
