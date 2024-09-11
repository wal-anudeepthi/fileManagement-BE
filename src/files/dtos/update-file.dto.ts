import { IsString } from 'class-validator';

export class UpdateFileDto {
  @IsString()
  userId: string;

  @IsString()
  content: string;
}
