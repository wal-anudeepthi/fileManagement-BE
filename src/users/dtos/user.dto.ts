import { IsString } from 'class-validator';

export class UserDto {
  @IsString()
  userId: string;
}
