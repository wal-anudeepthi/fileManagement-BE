import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { Files } from 'src/schemas/files.schema';

@Injectable()
export class FilesService {
  constructor(
    @InjectModel(Files.name) private fileModel: mongoose.Model<Files>,
  ) {}

  getFileById(fileId: any) {
    const objectId = new Types.ObjectId(fileId);
    return this.fileModel.find({ _id: objectId });
  }

  updateFile(fileId: string, userId: string) {
    const objectId = new Types.ObjectId(fileId);
    const userObjectId = new Types.ObjectId(userId);
    return this.fileModel.updateOne(
      { _id: objectId },
      { $set: { updatedBy: userObjectId } },
    );
  }
}
