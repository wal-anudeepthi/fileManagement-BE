import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dtos/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private userService: UsersService) {}

  @Post()
  async createUser(@Body() body: CreateUserDto) {
    return this.userService.create(body);
  }

  @Get()
  async findAllUsers() {
    return this.userService.findAll();
  }

  @Get('/:id')
  async findUser(@Param('id') id: string) {
    return this.userService.findOne(id);
  }
}
