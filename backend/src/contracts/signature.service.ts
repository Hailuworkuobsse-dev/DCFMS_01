import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { OtpService } from '../auth/otp.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, SignatureMethod } from '@prisma/client';
import { canonicalJson } from './contracts.service';

@Injectable()
export class SignatureService {
  constructor(
    private prisma: PrismaService,
    private otp: OtpService,
    private audit: AuditService,
  ) {}

  async requestSigningOtp(contractId: string, signerId: string) {
    const sig = await this.prisma.signature.findFirst({
      where: { contractId, signerId, status: 'PENDING' },
      include: { contract: { include: { parties: { include: { farmer: { include: { user: true } } } } } } },
    });
    if (!sig) throw new BadRequestException('No pending signature for this user');
    if (sig.contract.status !== 'PENDING_SIGNATURES') throw new BadRequestException('Contract is not open for signing');
    await this.assertSignerAuthority(sig.contract, sig.signerId, sig.role);
    const code = await this.otp.issue(signerId, 'SIGN');
    const response: { message: string; deliveredVia: string; devOtp?: string } = {
      message: 'Signing OTP dispatched to the registered phone number',
      deliveredVia: process.env.SMS_GATEWAY_URL ? 'SMS_GATEWAY' : 'DEVELOPMENT_LOG',
    };
    if (process.env.NODE_ENV !== 'production') response.devOtp = code;
    return response;
  }

  async signWithOtp(
    contractId: string, signerId: string, otpCode: string,
    meta: { ip?: string; userAgent?: string },
  ) {
    const sig = await this.prisma.signature.findFirst({
      where: { contractId, signerId, status: 'PENDING' },
      include: { contract: { include: { parties: { include: { farmer: { include: { user: true } } } } } } },
    });
    if (!sig) throw new BadRequestException('No pending signature for this user');
    if (sig.contract.status !== 'PENDING_SIGNATURES') throw new BadRequestException('Contract is not open for signing');
    const authority = await this.assertSignerAuthority(sig.contract, signerId, sig.role);
    await this.otp.verify(signerId, 'SIGN', otpCode);

    const signedAt = new Date();
    const otpVerifiedAt = signedAt;
    const recomputedContentHash = createHash('sha256').update(canonicalJson(sig.contract.content)).digest('hex');
    if (!sig.contract.contentHash || sig.contract.contentHash !== recomputedContentHash) {
      throw new BadRequestException('Contract content integrity check failed; signing is blocked until the draft is reconciled');
    }
    const contentHash = recomputedContentHash;
    const signatureHash = createHash('sha256').update([
      'DCFMS-SIGNATURE-EVIDENCE-V1', sig.contract.id, sig.id, signerId,
      sig.role, sig.method === 'OTP' ? 'OTP' : sig.method, contentHash,
      signedAt.toISOString(), meta.ip || '', meta.userAgent || '', authority.basis,
    ].join(':')).digest('hex');

    await this.prisma.$transaction(async (tx: any) => {
      await tx.signature.update({
        where: { id: sig.id },
        data: {
          status: 'SIGNED', method: SignatureMethod.OTP, signedAt, signatureHash,
          contentHashAtSigning: contentHash, otpVerifiedAt, authorityVerified: true,
          ipAddress: meta.ip, deviceInfo: meta.userAgent,
        },
      });
      await tx.signatureEvidence.create({
        data: {
          signatureId: sig.id, contractId: sig.contract.id, signerId,
          signerRole: sig.role, method: SignatureMethod.OTP, contentHash,
          signatureHash, authorityBasis: authority.basis,
          authorityReference: authority.reference, otpVerifiedAt, signedAt,
          ipAddress: meta.ip, userAgent: meta.userAgent,
        },
      });
      const remaining = await tx.signature.count({ where: { contractId, status: 'PENDING' } });
      if (remaining === 0) {
        await tx.contract.update({ where: { id: contractId }, data: { status: 'SIGNED' } });
      }
    });

    await this.audit.log({
      actorId: signerId, action: AuditAction.SIGN, entity: 'Contract', entityId: contractId,
      after: { signatureHash, contentHash, authorityBasis: authority.basis, signedAt: signedAt.toISOString() },
      ipAddress: meta.ip, userAgent: meta.userAgent,
    });
    return { status: 'SIGNED', signatureHash, contentHash, signedAt, authorityVerified: true };
  }

  async listSignatureEvidence(contractId: string, actor: { sub: string; role: string; adminLevel?: string; region?: string; woreda?: string; kebele?: string }) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { parties: { include: { farmer: true } }, createdBy: true },
    });
    if (!contract) throw new BadRequestException('Contract not found');
    const isParty = contract.createdById === actor.sub ||
      contract.parties.some((p: any) => p.farmer?.userId === actor.sub);
    const isScopedOfficer = ['WBOA_OFFICER', 'RBOA_OFFICER', 'MOA_OFFICER', 'MOTRI_OFFICER', 'ECC_OFFICER', 'EAA_OFFICER'].includes(actor.role) &&
      (!actor.region || actor.region === contract.region) && (!actor.woreda || actor.woreda === contract.woreda);
    if (!isParty && !isScopedOfficer && actor.role !== 'SYSTEM_ADMIN' && actor.role !== 'AUDITOR') {
      throw new ForbiddenException('You are not authorized to view this contract evidence');
    }
    return this.prisma.signatureEvidence.findMany({
      where: { contractId }, orderBy: { signedAt: 'asc' },
      select: { id: true, signerId: true, signerRole: true, method: true, contentHash: true, signatureHash: true, authorityBasis: true, authorityReference: true, otpVerifiedAt: true, signedAt: true, ipAddress: true, userAgent: true, createdAt: true },
    });
  }

  private async assertSignerAuthority(contract: any, signerId: string, role: string): Promise<{ basis: string; reference?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: signerId },
      select: { id: true, role: true, isActive: true, phone: true, fullName: true },
    });
    if (!user?.isActive || !user.phone) throw new ForbiddenException('Signer must have an active account and registered phone number');
    if (role === 'CONTRACTOR') {
      if (contract.createdById !== signerId || user.role !== 'CONTRACTOR') {
        throw new ForbiddenException('Only the registered contractor who created this contract may sign for the contractor');
      }
      const contractor = await this.prisma.contractor.findUnique({ where: { userId: signerId } });
      if (!contractor || contractor.approvalStatus !== 'APPROVED' || !contractor.licenseNo || !contractor.tin) {
        throw new ForbiddenException('Contractor signatory authority cannot be verified: approved registration, licence and TIN are required');
      }
      return { basis: 'APPROVED_CONTRACTOR_ACCOUNT_AND_LICENSE', reference: contractor.licenseNo };
    }
    if (role === 'FARMER') {
      const party = contract.parties?.find((p: any) => p.role === 'FARMER' && p.farmer?.userId === signerId);
      if (!party || user.role !== 'FARMER') throw new ForbiddenException('Signer is not the registered producer for this contract');
      return { basis: 'REGISTERED_FARMER_CONTRACT_PARTY' };
    }
    throw new ForbiddenException('This signatory role is not authorized for OTP signing');
  }

  async signWithFaydaPass(_contractId: string, _vc: string) {
    throw new BadRequestException('FaydaPass cryptographic verification is not configured; OTP signing is the only enabled method');
  }
}
