import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMonitoringDto } from './dto';
import { JwtUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class MonitoringService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateMonitoringDto, actor: JwtUser) {
    return this.prisma.monitoringReport.create({
      data: {
        contractId: dto.contractId,
        type: dto.type,
        agentId: actor.sub,
        farmerId: dto.farmerId,
        gpsLat: dto.gpsLat,
        gpsLng: dto.gpsLng,
        findings: dto.findings,
        score: dto.score,
      },
    });
  }

  list(filter: { contractId?: string; agentId?: string }) {
    return this.prisma.monitoringReport.findMany({
      where: filter, orderBy: { createdAt: 'desc' }, take: 200,
    });
  }
}
