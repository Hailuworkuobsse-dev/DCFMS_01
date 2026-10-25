import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AdminLevel } from '../common/enums';
import { JwtUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async dashboard(actor: JwtUser) {
    const scope = this.scope(actor);
    const [contracts, farmers, grievances, loans] = await Promise.all([
      this.prisma.contract.groupBy({
        by: ['status'],
        where: scope,
        _count: { _all: true },
      }),
      // Farmers are scoped through their linked user's region/woreda
      this.prisma.farmer.count({
        where: { user: { region: scope.region, woreda: scope.woreda } },
      }),
      this.prisma.grievance.groupBy({
        by: ['status'], _count: { _all: true },
      }),
      this.prisma.loan.aggregate({
        _sum: { approvedAmt: true },
        _count: { _all: true },
      }),
    ]);

    return {
      contractsByStatus: contracts.map((c) => ({ status: c.status, count: c._count._all })),
      farmersReached: farmers,
      grievancesByStatus: grievances.map((g) => ({ status: g.status, count: g._count._all })),
      finance: {
        totalApprovedETB: loans._sum.approvedAmt || 0,
        loanCount: loans._count._all,
      },
    };
  }

  async contractPerformance(actor: JwtUser) {
    const scope = this.scope(actor);
    const total = await this.prisma.contract.count({ where: scope });
    const completed = await this.prisma.contract.count({
      where: { ...scope, status: 'COMPLETED' },
    });
    const rejected = await this.prisma.contract.count({
      where: { ...scope, status: 'REJECTED' },
    });
    return {
      total,
      completed,
      rejected,
      completionRate: total ? +(completed / total * 100).toFixed(1) : 0,
      breachRate: total ? +(rejected / total * 100).toFixed(1) : 0,
    };
  }

  private scope(actor: JwtUser): { region?: string; woreda?: string } {
    const s: { region?: string; woreda?: string } = {};
    if (actor.adminLevel === AdminLevel.REGIONAL) s.region = actor.region;
    if (actor.adminLevel === AdminLevel.WOREDA) s.woreda = actor.woreda;
    return s;
  }
}
