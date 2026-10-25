import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(entry: {
    actorId?: string;
    action: AuditAction;
    entity: string;
    entityId?: string;
    before?: any;
    after?: any;
    ipAddress?: string;
    userAgent?: string;
    result?: string;
  }) {
    if (process.env.AUDIT_ENABLED === 'false') return;
    await this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: entry.before as Prisma.InputJsonValue,
        after: entry.after as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        result: entry.result || 'SUCCESS',
      },
    });
  }

  async query(filters: {
    entity?: string;
    entityId?: string;
    action?: AuditAction;
    actorId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }) {
    return this.prisma.auditLog.findMany({
      where: {
        entity: filters.entity,
        entityId: filters.entityId,
        action: filters.action,
        actorId: filters.actorId,
        createdAt: {
          gte: filters.from,
          lte: filters.to,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100,
      include: { actor: { select: { id: true, fullName: true, role: true } } },
    });
  }
}
