import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuditService } from './audit.service';
import { AuditAction } from '@prisma/client';

@Controller('audit')
@Roles(Role.AUDITOR, Role.SYSTEM_ADMIN, Role.MOA_OFFICER)
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  async list(
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: AuditAction,
    @Query('actorId') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.query({
      entity, entityId, action, actorId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? Number(limit) : 100,
    });
  }
}
