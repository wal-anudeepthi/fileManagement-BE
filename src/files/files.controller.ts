import { Controller, Body, Get, Param, Patch } from '@nestjs/common';
import { join } from 'path';
import { FilesService } from './files.service';
import { promises as fs } from 'fs';

@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  //Reading file by id
  @Get('/:fileId')
  async getFileById(@Param('fileId') fileId: string) {
    const file = await this.filesService.getFileById(fileId);
    return file;
  }

  //Update a file content
  @Patch('/:fileId')
  async updateFile(@Body() body: any, @Param('fileId') fileId: string) {
    const [file] = await this.getFileById(fileId);
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
