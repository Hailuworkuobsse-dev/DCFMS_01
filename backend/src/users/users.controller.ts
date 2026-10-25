import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { ScopeGuard } from '../common/guards/scope.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
@UseGuards(ScopeGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.MOA_OFFICER, Role.RBOA_OFFICER, Role.WBOA_OFFICER)
  list(@Query('role') role?: Role, @Query('region') region?: string, @Query('woreda') woreda?: string) {
    return this.users.list({ role, region, woreda });
  }

  @Get(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.MOA_OFFICER, Role.RBOA_OFFICER, Role.WBOA_OFFICER, Role.AUDITOR)
  findOne(@Param('id') id: string) { return this.users.findById(id); }

  @Post()
  @Roles(Role.SYSTEM_ADMIN)
  create(@Body() dto: CreateUserDto) { return this.users.create(dto); }

  @Patch(':id/deactivate')
  @Roles(Role.SYSTEM_ADMIN)
  deactivate(@Param('id') id: string) { return this.users.deactivate(id); }
}
