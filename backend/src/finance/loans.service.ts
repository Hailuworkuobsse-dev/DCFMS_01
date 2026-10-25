import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLoanDto, DecideLoanDto } from './dto';
import { AuditAction, LoanStatus } from '@prisma/client';
import { JwtUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class LoansService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateLoanDto, actor: JwtUser) {
    const loanNo = `LN-${Date.now()}`;
    const loan = await this.prisma.loan.create({
      data: {
        loanNo, farmerId: dto.farmerId, contractId: dto.contractId,
        fiId: dto.fiId, requestedAmt: dto.requestedAmt, purpose: dto.purpose,
        status: LoanStatus.SUBMITTED,
      },
    });
    await this.audit.log({
      actorId: actor.sub, action: AuditAction.CREATE,
      entity: 'Loan', entityId: loan.id, after: { loanNo },
    });
    return loan;
  }

  async decide(id: string, dto: DecideLoanDto, actor: JwtUser) {
    const loan = await this.prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException();
    if (loan.status !== LoanStatus.SUBMITTED && loan.status !== LoanStatus.UNDER_REVIEW) {
      throw new BadRequestException('Loan not in reviewable state');
    }
    const status = dto.decision === 'APPROVE' ? LoanStatus.APPROVED : LoanStatus.REJECTED;
    const updated = await this.prisma.loan.update({
      where: { id },
      data: {
        status,
        approvedAmt: dto.approvedAmt,
        interestRate: dto.interestRate,
        decisionNote: dto.note,
        decidedAt: new Date(),
      },
    });
    await this.audit.log({
      actorId: actor.sub, action: dto.decision === 'APPROVE' ? AuditAction.APPROVE : AuditAction.REJECT,
      entity: 'Loan', entityId: id, after: { status },
    });
    return updated;
  }

  async list(filter: { status?: LoanStatus; fiId?: string; farmerId?: string }) {
    return this.prisma.loan.findMany({
      where: filter, orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  async disburse(id: string, actor: JwtUser) {
    const loan = await this.prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException();
    if (loan.status !== LoanStatus.APPROVED) {
      throw new BadRequestException('Only an approved loan can be disbursed');
    }
    const updated = await this.prisma.loan.update({
      where: { id },
      data: { status: LoanStatus.DISBURSED },
    });
    await this.audit.log({
      actorId: actor.sub, action: AuditAction.PAYOUT,
      entity: 'Loan', entityId: id, after: { status: 'DISBURSED' },
    });
    return updated;
  }
}
