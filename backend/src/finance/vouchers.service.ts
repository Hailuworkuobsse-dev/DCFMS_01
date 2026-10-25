import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IssueVoucherDto, RedeemVoucherDto } from './dto';
import { AuditAction, VoucherStatus } from '@prisma/client';
import { JwtUser } from '../common/decorators/current-user.decorator';
import { randomUUID } from 'crypto';

@Injectable()
export class VouchersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async issue(dto: IssueVoucherDto, actor: JwtUser) {
    const voucherNo = `VC-${randomUUID().slice(0, 8).toUpperCase()}`;
    const voucher = await this.prisma.voucher.create({
      data: {
        voucherNo, farmerId: dto.farmerId, contractId: dto.contractId,
        inputType: dto.inputType, amount: dto.amount,
        expiresAt: new Date(dto.expiresAt), status: VoucherStatus.ISSUED,
      },
    });
    await this.audit.log({
      actorId: actor.sub, action: AuditAction.CREATE,
      entity: 'Voucher', entityId: voucher.id, after: { voucherNo },
    });
    // TODO(integration): SMS notify farmer with voucher code
    return voucher;
  }

  async redeem(dto: RedeemVoucherDto, actor: JwtUser) {
    const v = await this.prisma.voucher.findUnique({ where: { voucherNo: dto.voucherNo } });
    if (!v) throw new BadRequestException('Voucher not found');
    if (v.status !== VoucherStatus.ISSUED) throw new BadRequestException('Voucher not redeemable');
    if (v.expiresAt < new Date()) {
      await this.prisma.voucher.update({ where: { id: v.id }, data: { status: VoucherStatus.EXPIRED } });
      throw new BadRequestException('Voucher expired');
    }
    const updated = await this.prisma.voucher.update({
      where: { id: v.id },
      data: {
        status: VoucherStatus.REDEEMED,
        redeemedAt: new Date(),
        agroDealerId: dto.agroDealerId,
      },
    });
    await this.audit.log({
      actorId: actor.sub, action: AuditAction.UPDATE,
      entity: 'Voucher', entityId: v.id, after: { status: 'REDEEMED' },
    });
    return updated;
  }

  async list(filter: { farmerId?: string; status?: VoucherStatus }) {
    return this.prisma.voucher.findMany({
      where: filter, orderBy: { createdAt: 'desc' }, take: 200,
    });
  }
}
