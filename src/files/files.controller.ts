import {
  Controller,
  Body,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
  UploadedFile,
  Delete,
  Query,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { extname } from 'path';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { UploadFileDto } from './dtos/upload-file.dto';
import { Response } from 'express';
import { UpdateFileDto } from './dtos/update-file.dto';
import { UserDto } from 'src/users/dtos/user.dto';

@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Get()
  getFiles(@Query() query: UserDto) {
    return this.filesService.getFiles(query.userId);
  }

  @Get('/:id')
  getFileContent(@Param('id') id: string) {
    return this.filesService.getFile(id);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const prefix = `${file.originalname.split('.')[0]}-${uuidv4().split('-')[0]}`;
          const fileExt = extname(file.originalname);
          const fileName = `${prefix}${fileExt}`;
          callback(null, fileName);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadFileDto,
  ) {
    return this.filesService.uploadToLocal(file, body);
  }

  @Post('aws')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024,
      },
    }),
  )
  uploadAwsFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadFileDto,
  ) {
    if (body.targettedStorage === 'AWS') {
      return this.filesService.uploadToS3(file, body);
    } else {
      throw new HttpException(
        'Invalid targettedStorage',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete('/:id')
  deleteFile(@Param('id') id: string, @Query() query: UserDto) {
    return this.filesService.delete(id, query.userId);
  }

  //Update a file content
  @Patch('/:fileId')
  updateFile(@Param('fileId') fileId: string, @Body() body: UpdateFileDto) {
    return this.filesService.updateFile(fileId, body);
  }

  @Get('/download/:id')
  downloadFile(@Param('id') id: string, @Res() res: Response) {
    return this.filesService.downloadFile(id, res);
  }

  @Get('download-with-signature/:id')
  downloadWithSignature(@Param('id') id: string) {
    return this.filesService.downloadWithSignature(id);
  }

  @Get('thumbnails/:id')
  getThumbnails(@Param('id') id: string) {
    return this.filesService.getThumbnails(id);
  }

  @Get('/images/:id')
  getImages(@Param('id') id: string) {
    return this.filesService.getImages(id);
  }
}
