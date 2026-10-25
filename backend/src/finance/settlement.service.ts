import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSettlementDto } from './dto';
import { AuditAction, PaymentStatus } from '@prisma/client';
import { JwtUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class SettlementService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateSettlementDto, actor: JwtUser) {
    const deduction = dto.loanDeduction || 0;
    if (deduction > dto.grossAmount) throw new BadRequestException('Deduction exceeds gross');
    const netAmount = dto.grossAmount - deduction;
    const paymentNo = `PM-${Date.now()}`;

    const payment = await this.prisma.payment.create({
      data: {
        paymentNo, contractId: dto.contractId,
        payerId: dto.payerId, payeeId: dto.payeeId,
        grossAmount: dto.grossAmount, loanDeduction: deduction,
        netAmount, channel: dto.channel,
        status: PaymentStatus.PENDING,
      },
    });

    // TODO(integration): call payment gateway. On success update status.
    // Simulating success for dev:
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.COMPLETED, processedAt: new Date() },
    });

    await this.audit.log({
      actorId: actor.sub, action: AuditAction.PAYOUT,
      entity: 'Payment', entityId: payment.id,
      after: { paymentNo, netAmount },
    });

    return { ...payment, status: 'COMPLETED' };
  }

  async list(filter: { contractId?: string; status?: PaymentStatus }) {
    return this.prisma.payment.findMany({
      where: filter, orderBy: { createdAt: 'desc' }, take: 200,
    });
  }
}
