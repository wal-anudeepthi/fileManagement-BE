import { IsString } from 'class-validator';

export class UploadFileDto {
  @IsString()
  userId: string;

  @IsString()
  targettedStorage: string;
}
