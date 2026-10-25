import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LifecycleService } from './lifecycle.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { AuditAction, ContractStatus, SignatureStatus, Prisma } from '@prisma/client';
import { JwtUser } from '../common/decorators/current-user.decorator';
import { AdminLevel, APPROVER_ROLES, Role } from '../common/enums';

/**
 * Canonical JSON serializer (sorted keys, recursive).
 * PostgreSQL JSONB does not preserve key order, so tamper-evidence hashes
 * must be computed over a canonical form to remain stable across reads.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(v: any): any {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.keys(v)
      .sort()
      .reduce((acc: Record<string, any>, k) => {
        acc[k] = sortKeys(v[k]);
        return acc;
      }, {});
  }
  return v;
}

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private lifecycle: LifecycleService,
  ) {}

  async create(dto: CreateContractDto, actor: JwtUser) {
    const contractNo = await this.nextContractNo();
    const contentHash = createHash('sha256').update(canonicalJson(dto.content)).digest('hex');

    const contract = await this.prisma.contract.create({
      data: {
        contractNo,
        commodity: dto.commodity,
        quantity: dto.quantity,
        unit: dto.unit || 'quintal',
        quality: dto.quality,
        priceMechanism: dto.priceMechanism,
        fixedPrice: dto.fixedPrice,
        deliveryStart: dto.deliveryStart ? new Date(dto.deliveryStart) : null,
        deliveryEnd: dto.deliveryEnd ? new Date(dto.deliveryEnd) : null,
        content: dto.content,
        contentHash,
        region: dto.region,
        woreda: dto.woreda,
        createdById: actor.sub,
        status: 'DRAFT',
        parties: {
          create: dto.parties.map((p) => ({
            role: p.role,
            farmerId: p.farmerId,
          })),
        },
        versions: {
          create: [{ version: 1, content: dto.content, hash: contentHash, createdById: actor.sub }],
        },
      },
      include: { parties: true, versions: true },
    });

    // Lock parcels and mark them as part of this contract (prevents double-contracting)
    if (dto.parcelIds?.length) {
      const locked = await this.prisma.parcel.updateMany({
        where: { id: { in: dto.parcelIds }, isLocked: false },
        data: { isLocked: true, contractId: contract.id },
      });
      if (locked.count !== dto.parcelIds.length) {
        throw new BadRequestException('One or more parcels are already under contract');
      }
    }

    await this.audit.log({
      actorId: actor.sub, action: AuditAction.CREATE,
      entity: 'Contract', entityId: contract.id, after: { contractNo },
    });

    return contract;
  }

  async list(actor: JwtUser, filter: { status?: ContractStatus; commodity?: string }) {
    const where: Prisma.ContractWhereInput = {
      status: filter.status,
      commodity: filter.commodity,
    };
    // Enforce scope
    if (actor.adminLevel === AdminLevel.REGIONAL) where.region = actor.region;
    if (actor.adminLevel === AdminLevel.WOREDA) where.woreda = actor.woreda;
    if (actor.role === Role.CONTRACTOR) {
      where.parties = { some: { role: 'CONTRACTOR' } };
      // TODO(integration): filter by contractor's user ID via contractor record
    }

    return this.prisma.contract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        parties: true,
        signatures: { select: { role: true, status: true, signerId: true } },
      },
    });
  }

  async findOne(id: string, actor: JwtUser) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        parties: true,
        signatures: true,
        versions: { orderBy: { version: 'desc' } },
        payments: true,
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    this.assertInScope(contract, actor);
    return contract;
  }

  async sendForSignatures(id: string, actor: JwtUser) {
    const contract = await this.findOne(id, actor);
    if (contract.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT contracts can be sent for signature');
    }
    if (!this.lifecycle.canTransition(contract.status, 'PENDING_SIGNATURES')) {
      throw new BadRequestException('Invalid transition');
    }

    // Resolve each party to the *user* that must sign:
    // - farmer parties  -> the farmer's linked user account
    // - other parties   -> the actor sending the contract (e.g. the contractor)
    const parties = await this.prisma.contractParty.findMany({
      where: { contractId: id },
      include: { farmer: true },
    });

    return this.prisma.contract.update({
      where: { id },
      data: {
        status: 'PENDING_SIGNATURES',
        signatures: {
          create: parties.map((p) => ({
            signerId: p.farmer?.userId ?? actor.sub,
            role: p.role,
            status: SignatureStatus.PENDING,
          })),
        },
      },
      include: { signatures: true },
    });
  }

  async submitForApproval(id: string, actor: JwtUser) {
    const contract = await this.findOne(id, actor);
    if (contract.status !== 'SIGNED') {
      throw new BadRequestException('Contract must be fully signed');
    }
    return this.prisma.contract.update({
      where: { id }, data: { status: 'PENDING_APPROVAL' },
    });
  }

  async approve(id: string, decision: 'APPROVE' | 'REJECT', note: string | undefined, actor: JwtUser) {
    if (!APPROVER_ROLES.includes(actor.role as Role)) {
      throw new ForbiddenException('Only government approvers can approve contracts');
    }
    const contract = await this.findOne(id, actor);
    if (contract.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Contract is not pending approval');
    }
    const newStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        status: newStatus,
        approvedById: actor.sub,
        approvedAt: new Date(),
        rejectionNote: decision === 'REJECT' ? note : null,
      },
    });

    await this.audit.log({
      actorId: actor.sub,
      action: decision === 'APPROVE' ? AuditAction.APPROVE : AuditAction.REJECT,
      entity: 'Contract', entityId: id,
      after: { status: newStatus, note },
    });
    return updated;
  }

  async verifyIntegrity(id: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (!contract) throw new NotFoundException();
    const recomputed = createHash('sha256')
      .update(canonicalJson(contract.content))
      .digest('hex');
    return {
      stored: contract.contentHash,
      recomputed,
      intact: contract.contentHash === recomputed,
    };
  }

  private async nextContractNo(): Promise<string> {
    const count = await this.prisma.contract.count();
    const year = new Date().getFullYear();
    return `DCF-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private assertInScope(contract: any, actor: JwtUser) {
    if (actor.adminLevel === AdminLevel.REGIONAL && contract.region && contract.region !== actor.region) {
      throw new ForbiddenException('Out of scope');
    }
    if (actor.adminLevel === AdminLevel.WOREDA && contract.woreda && contract.woreda !== actor.woreda) {
      throw new ForbiddenException('Out of scope');
    }
  }
}
