import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AssignGrievanceDto, CreateGrievanceDto, EscalateGrievanceDto, ResolveGrievanceDto } from './dto';
import { AuditAction, GrievanceStatus } from '@prisma/client';
import { JwtUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class GrievancesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateGrievanceDto, actor: JwtUser) {
    const ticketNo = `GR-${Date.now()}`;
    const grievance = await this.prisma.grievance.create({
      data: {
        ticketNo, category: dto.category, description: dto.description,
        title: dto.title,
        severity: dto.severity,
        contractId: dto.contractId,
        raisedById: actor.sub,
        raisedByFarmerId: dto.raisedByFarmerId,
        status: GrievanceStatus.OPEN,
        slaDueAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });
    await this.audit.log({
      actorId: actor.sub, action: AuditAction.CREATE,
      entity: 'Grievance', entityId: grievance.id, after: { ticketNo },
    });
    return grievance;
  }

  async list(filter: { status?: GrievanceStatus; assignedToId?: string }) {
    return this.prisma.grievance.findMany({
      where: filter, orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  async findOne(id: string) {
    const g = await this.prisma.grievance.findUnique({ where: { id } });
    if (!g) throw new NotFoundException();
    return g;
  }

  async assign(id: string, dto: AssignGrievanceDto, actor: JwtUser) {
    const g = await this.findOne(id);
    if (g.status !== GrievanceStatus.OPEN && g.status !== GrievanceStatus.IN_REVIEW) {
      throw new BadRequestException('Cannot reassign a closed grievance');
    }
    return this.prisma.grievance.update({
      where: { id },
      data: {
        assignedToId: dto.assignedToId,
        slaDueAt: new Date(dto.slaDueAt),
        status: GrievanceStatus.IN_REVIEW,
      },
    });
  }

  async escalate(id: string, dto: EscalateGrievanceDto, actor: JwtUser) {
    await this.findOne(id);
    const updated = await this.prisma.grievance.update({
      where: { id }, data: { status: GrievanceStatus.ESCALATED },
    });
    await this.audit.log({
      actorId: actor.sub, action: AuditAction.ESCALATE,
      entity: 'Grievance', entityId: id, after: { reason: dto.reason },
    });
    return updated;
  }

  async resolve(id: string, dto: ResolveGrievanceDto, actor: JwtUser) {
    const g = await this.findOne(id);
    if (g.status === GrievanceStatus.CLOSED) throw new BadRequestException('Already closed');
    const updated = await this.prisma.grievance.update({
      where: { id },
      data: {
        status: GrievanceStatus.RESOLVED,
        resolutionNote: dto.resolutionNote,
        resolvedAt: new Date(),
      },
    });
    await this.audit.log({
      actorId: actor.sub, action: AuditAction.UPDATE,
      entity: 'Grievance', entityId: id, after: { status: 'RESOLVED' },
    });
    return updated;
  }
}
