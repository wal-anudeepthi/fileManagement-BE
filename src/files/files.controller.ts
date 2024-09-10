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
} from '@nestjs/common';
import { extname, join } from 'path';
import { FilesService } from './files.service';
import { promises as fs } from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { UploadFileDto } from './dtos/upload-file.dto';

@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Get()
  getFiles(@Query() query: UploadFileDto) {
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
          const prefix = `${file.originalname.split('.')[0]}-${uuidv4()}`;
          const fileExt = extname(file.originalname);
          const fileName = `${prefix}${fileExt}`;
          callback(null, fileName);
        },
      }),
    }),
  )
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadFileDto,
  ) {
    return this.filesService.upload(file, body);
  }

  @Delete('/:id')
  deleteFile(@Param('id') id: string, @Query() query: UploadFileDto) {
    return this.filesService.delete(id, query.userId);
  }

  //Update a file content
  @Patch('/:fileId')
  async updateFile(@Body() body: any, @Param('fileId') fileId: string) {
    const [file] = await this.filesService.getFileById(fileId);
    const fileName = file.fileName;
    const filePath = join(__dirname, '../..', 'uploads', fileName);
    try {
      //Check file exists or not
      await fs.access(filePath);

      // Overwriting the file content
      await fs.writeFile(filePath, body.content);
      return this.filesService.updateFile(fileId, body.userId);
    } catch (error) {
      console.log(error);
    }
  }
}
