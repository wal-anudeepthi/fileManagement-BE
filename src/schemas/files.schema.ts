import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Date, Types } from 'mongoose';

export enum Storage {
  LOCALSTORAGE = 'LocalStorage',
  AWS = 'Aws',
  AZURE = 'Azure',
}

@Schema({
  timestamps: true,
})
export class Files {
  @Prop({ required: true })
  fileName: string;

  @Prop()
  filePath: string;

  @Prop()
  fileType: string;

  @Prop()
  targettedStorage: Storage;

  @Prop({ type: Types.ObjectId, ref: 'Users', required: true })
  userId: Types.ObjectId;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date })
  deletedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'Users' })
  deletedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Users' })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Users' })
  updatedBy: Types.ObjectId;
}

export const FilesSchema = SchemaFactory.createForClass(Files);
