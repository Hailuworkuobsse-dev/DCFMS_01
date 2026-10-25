import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { OtpService } from '../auth/otp.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, SignatureMethod } from '@prisma/client';

@Injectable()
export class SignatureService {
  constructor(
    private prisma: PrismaService,
    private otp: OtpService,
    private audit: AuditService,
  ) {}

  /** Request an OTP before signing. */
  async requestSigningOtp(contractId: string, signerId: string) {
    const sig = await this.prisma.signature.findFirst({
      where: { contractId, signerId, status: 'PENDING' },
    });
    if (!sig) throw new BadRequestException('No pending signature for this user');

    // Issues a 6-digit OTP (SHA-256-hashed at rest, TTL from OTP_TTL_SECONDS).
    // TODO(integration): real SMS delivery via Ethio Telecom / Twilio gateway.
    await this.otp.issue(signerId, 'SIGN');
    return { message: 'OTP issued', deliveredVia: 'SMS' };
  }

  /** Sign a contract using OTP (primary path per ToR). */
  async signWithOtp(
    contractId: string, signerId: string, otpCode: string,
    meta: { ip?: string; userAgent?: string },
  ) {
    const sig = await this.prisma.signature.findFirst({
      where: { contractId, signerId, status: 'PENDING' },
    });
    if (!sig) throw new BadRequestException('No pending signature');

    await this.otp.verify(signerId, 'SIGN', otpCode);

    const contract = await this.prisma.contract.findUniqueOrThrow({
      where: { id: contractId },
    });
    const signatureHash = createHash('sha256')
      .update(`${contract.contentHash || ''}:${signerId}:${new Date().toISOString()}`)
      .digest('hex');

    await this.prisma.signature.update({
      where: { id: sig.id },
      data: {
        status: 'SIGNED',
        method: SignatureMethod.OTP,
        signedAt: new Date(),
        signatureHash,
        ipAddress: meta.ip,
        deviceInfo: meta.userAgent,
      },
    });

    await this.audit.log({
      actorId: signerId, action: AuditAction.SIGN,
      entity: 'Contract', entityId: contractId,
      after: { signatureHash }, ipAddress: meta.ip, userAgent: meta.userAgent,
    });

    // If all signatures complete → advance contract lifecycle
    const remaining = await this.prisma.signature.count({
      where: { contractId, status: 'PENDING' },
    });
    if (remaining === 0) {
      await this.prisma.contract.update({
        where: { id: contractId },
        data: { status: 'SIGNED' },
      });
    }

    return { status: 'SIGNED', signatureHash };
  }

  /** TODO(integration): FaydaPass verifiable-credential signing. */
  async signWithFaydaPass(_contractId: string, _vc: string) {
    throw new BadRequestException('FaydaPass integration pending');
  }
}
