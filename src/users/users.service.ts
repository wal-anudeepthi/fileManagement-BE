import {
  Injectable,
  ConflictException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Users } from 'src/schemas/users.schema';
import mongoose, { Types } from 'mongoose';
import { CreateUserDto } from './dtos/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(Users.name)
    private userModel: mongoose.Model<Users>,
  ) {}

  //creation of user
  async create(body: CreateUserDto) {
    try {
      const existingUser = await this.userModel.findOne({ email: body.email });
      if (existingUser) {
        throw new ConflictException('Email has already been registered');
      }
      const user = await this.userModel.create(body);
      return user;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  //Get all users
  async findAll() {
    try {
      const users = await this.userModel.find();
      return users;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Get user by Id
  async findOne(id: string) {
    try {
      const userIdObject = new Types.ObjectId(id);
      const user = await this.userModel.findById(userIdObject);
      if (!user) {
        throw new NotFoundException(`User not found`);
      }
      return user;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
