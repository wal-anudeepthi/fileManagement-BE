import { IsString } from 'class-validator';

export class UploadFileDto {
  @IsString()
  userId: string;

  //TODO: Need to create one more dto
  // @IsString()
  // targettedStorage: string;
}
