import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtUser } from '../common/decorators/current-user.decorator';
import { AdminLevel } from '../common/enums';
import { Prisma } from '@prisma/client';

/**
 * Lightweight read-only directory of ecosystem actors (farmers, contractors,
 * cooperatives). Used by clients (e.g. the frontend BFF) to resolve display
 * names, Fayda FINs and party ids when composing contracts, vouchers, loans,
 * etc. Any authenticated user may read it; regional/woreda admins only see
 * their own scope.
 */
@Injectable()
export class DirectoryService {
  constructor(private prisma: PrismaService) {}

  async farmers(actor: JwtUser) {
    const where: Prisma.FarmerWhereInput = {};
    if (actor.adminLevel === AdminLevel.REGIONAL && actor.region) {
      where.user = { region: actor.region };
    } else if (actor.adminLevel === AdminLevel.WOREDA && actor.woreda) {
      where.user = { woreda: actor.woreda };
    }

    const farmers = await this.prisma.farmer.findMany({
      where,
      include: {
        user: {
          select: {
            id: true, fullName: true, phone: true,
            region: true, woreda: true, kebele: true,
          },
        },
        cooperative: { select: { id: true, registrationNo: true } },
      },
      take: 1000,
      orderBy: { createdAt: 'asc' },
    });

    return farmers.map((f) => ({
      farmerId: f.id,
      userId: f.userId,
      faydaFin: f.faydaFin,
      name: f.user.fullName,
      phone: f.user.phone,
      region: f.user.region,
      woreda: f.user.woreda,
      kebele: f.user.kebele,
      cooperativeId: f.cooperativeId,
      cooperativeName: f.cooperative?.registrationNo ?? null,
    }));
  }

  async orgs() {
    const [contractors, cooperatives] = await Promise.all([
      this.prisma.contractor.findMany({
        include: {
          user: {
            select: { id: true, fullName: true, phone: true, region: true, woreda: true },
          },
        },
        take: 500,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.cooperative.findMany({
        include: {
          user: { select: { id: true, fullName: true, phone: true } },
          _count: { select: { members: true } },
        },
        take: 500,
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return [
      ...contractors.map((c) => ({
        type: 'CONTRACTOR' as const,
        orgId: c.id,
        userId: c.userId,
        name: c.user.fullName,
        phone: c.user.phone,
        region: c.user.region,
        woreda: c.user.woreda,
        licenseNo: c.licenseNo,
        tin: c.tin,
        approvalStatus: c.approvalStatus,
      })),
      ...cooperatives.map((co) => ({
        type: 'COOPERATIVE' as const,
        orgId: co.id,
        userId: co.userId,
        name: co.user.fullName,
        phone: co.user.phone,
        region: co.region,
        woreda: co.woreda,
        registrationNo: co.registrationNo,
        memberCount: co._count.members,
      })),
    ];
  }
}
