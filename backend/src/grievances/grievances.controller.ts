import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { GrievancesService } from './grievances.service';
import { AssignGrievanceDto, CreateGrievanceDto, EscalateGrievanceDto, ResolveGrievanceDto } from './dto';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { GrievanceStatus } from '@prisma/client';

@Controller('grievances')
export class GrievancesController {
  constructor(private svc: GrievancesService) {}

  @Post()
  create(@Body() dto: CreateGrievanceDto, @CurrentUser() user: JwtUser) {
    return this.svc.create(dto, user);
  }

  @Get()
  list(@Query('status') status?: GrievanceStatus, @Query('assignedToId') assignedToId?: string) {
    return this.svc.list({ status, assignedToId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Patch(':id/assign')
  @Roles(Role.RESOLUTION_OFFICER, Role.WBOA_OFFICER)
  assign(@Param('id') id: string, @Body() dto: AssignGrievanceDto, @CurrentUser() user: JwtUser) {
    return this.svc.assign(id, dto, user);
  }

  @Patch(':id/escalate')
  @Roles(Role.RESOLUTION_OFFICER, Role.WBOA_OFFICER)
  escalate(@Param('id') id: string, @Body() dto: EscalateGrievanceDto, @CurrentUser() user: JwtUser) {
    return this.svc.escalate(id, dto, user);
  }

  @Patch(':id/resolve')
  @Roles(Role.RESOLUTION_OFFICER)
  resolve(@Param('id') id: string, @Body() dto: ResolveGrievanceDto, @CurrentUser() user: JwtUser) {
    return this.svc.resolve(id, dto, user);
  }
}
