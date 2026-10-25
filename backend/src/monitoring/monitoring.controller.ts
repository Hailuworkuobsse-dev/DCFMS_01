import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { CreateMonitoringDto } from './dto';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';

@Controller('monitoring')
export class MonitoringController {
  constructor(private svc: MonitoringService) {}

  @Post()
  @Roles(Role.FIELD_AGENT, Role.WBOA_OFFICER)
  create(@Body() dto: CreateMonitoringDto, @CurrentUser() user: JwtUser) {
    return this.svc.create(dto, user);
  }

  @Get()
  list(@Query('contractId') contractId?: string, @Query('agentId') agentId?: string) {
    return this.svc.list({ contractId, agentId });
  }
}
