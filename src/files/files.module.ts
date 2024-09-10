import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Files, FilesSchema } from 'src/schemas/files.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Files.name, schema: FilesSchema }]),
  ],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
