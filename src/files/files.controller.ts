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
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadFileDto,
  ) {
    return this.filesService.upload(file, body);
  }

  @Delete('/:id')
  deleteFile(@Param('id') id: string, @Query() query: UserDto) {
    return this.filesService.delete(id, query.userId);
  }

  //Update a file content
  @Patch('/:fileId')
  async updateFile(
    @Param('fileId') fileId: string,
    @Body() body: UpdateFileDto,
  ) {
    return this.filesService.updateFile(fileId, body);
  }

  @Get('/download/:id')
  async downloadFile(@Param('id') id: string, @Res() res: Response) {
    return this.filesService.downloadFile(id, res);
  }
}
