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
    // Only the actual contracting parties may initiate a contract. Government
    // approval roles must use the review/approval workflow, never impersonate a party.
    if (actor.role !== Role.CONTRACTOR && actor.role !== Role.COOPERATIVE) {
      throw new ForbiddenException('Only a registered contractor or cooperative may create a contract');
    }
    if (!dto.parties?.length) throw new BadRequestException('At least one producer party is required');

    if (actor.role === Role.CONTRACTOR) {
      const contractor = await this.prisma.contractor.findUnique({ where: { userId: actor.sub } });
      if (!contractor || contractor.approvalStatus !== 'APPROVED') {
        throw new ForbiddenException('An approved contractor account is required to create contracts');
      }
      if (dto.parties.some((p) => p.role === 'CONTRACTOR' || !p.farmerId)) {
        throw new BadRequestException('Select valid producer parties; contractor identity is derived from your account');
      }
    } else {
      const cooperative = await this.prisma.cooperative.findUnique({ where: { userId: actor.sub } });
      if (!cooperative) throw new ForbiddenException('A registered cooperative account is required');
      if (dto.parties.some((p) => !p.farmerId)) {
        throw new BadRequestException('Every cooperative contract party must reference a registered producer');
      }
      const farmerIds = [...new Set(dto.parties.map((p) => p.farmerId as string))];
      const members = await this.prisma.farmer.findMany({
        where: { id: { in: farmerIds }, cooperativeId: cooperative.id },
        select: { id: true },
      });
      if (members.length !== farmerIds.length) {
        throw new ForbiddenException('A cooperative may only contract its registered members');
      }
    }

    const farmerIds = [...new Set(dto.parties.map((p) => p.farmerId).filter((id): id is string => Boolean(id)))];
    if (farmerIds.length) {
      const existing = await this.prisma.farmer.findMany({ where: { id: { in: farmerIds } }, select: { id: true } });
      if (existing.length !== farmerIds.length) throw new BadRequestException('One or more producer records do not exist');
    }
    if (dto.parcelIds?.length) {
      const parcels = await this.prisma.parcel.findMany({
        where: { id: { in: dto.parcelIds }, farmerId: { in: farmerIds } },
        select: { id: true },
      });
      if (parcels.length !== new Set(dto.parcelIds).size) {
        throw new ForbiddenException('Every parcel must belong to a selected producer');
      }
    }

    const contractNo = await this.nextContractNo();
    const contentHash = createHash('sha256').update(canonicalJson(dto.content)).digest('hex');
    const contract = await this.prisma.contract.create({
      data: {
        contractNo, commodity: dto.commodity, quantity: dto.quantity,
        unit: dto.unit || 'quintal', quality: dto.quality,
        priceMechanism: dto.priceMechanism, fixedPrice: dto.fixedPrice,
        deliveryStart: dto.deliveryStart ? new Date(dto.deliveryStart) : null,
        deliveryEnd: dto.deliveryEnd ? new Date(dto.deliveryEnd) : null,
        content: dto.content, contentHash, region: dto.region, woreda: dto.woreda,
        createdById: actor.sub, status: 'DRAFT',
        parties: { create: dto.parties.map((p) => ({ role: 'FARMER', farmerId: p.farmerId })) },
        versions: { create: [{ version: 1, content: dto.content, hash: contentHash, createdById: actor.sub }] },
      },
      include: { parties: true, versions: true },
    });

    if (dto.parcelIds?.length) {
      const locked = await this.prisma.parcel.updateMany({
        where: { id: { in: dto.parcelIds }, farmerId: { in: farmerIds }, isLocked: false },
        data: { isLocked: true, contractId: contract.id },
      });
      if (locked.count !== new Set(dto.parcelIds).size) {
        throw new BadRequestException('One or more parcels are already under contract');
      }
    }

    await this.audit.log({
      actorId: actor.sub, action: AuditAction.CREATE,
      entity: 'Contract', entityId: contract.id, after: { contractNo },
    });
    return contract;
  }

  async list(actor: JwtUser, filter: { status?: ContractStatus; commodity?: string; region?: string; woreda?: string }) {
    const where: Prisma.ContractWhereInput = { status: filter.status, commodity: filter.commodity };
    this.applyActorScope(where, actor);
    // Caller-provided scope filters may narrow results, never widen their authority.
    if (filter.region) where.region = filter.region;
    if (filter.woreda) where.woreda = filter.woreda;
    return this.prisma.contract.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 200,
      include: { parties: true, signatures: { select: { role: true, status: true, signerId: true } } },
    });
  }

  async findOne(id: string, actor: JwtUser) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { parties: { include: { farmer: { include: { cooperative: true } } } },
        signatures: true, versions: { orderBy: { version: 'desc' } }, payments: true, loans: true, vouchers: true },
    });
    // Return 404 for both missing and unauthorized records to avoid ID enumeration.
    if (!contract || !(await this.canReadContract(contract, actor))) throw new NotFoundException('Contract not found');
    return contract;
  }

  private applyActorScope(where: Prisma.ContractWhereInput, actor: JwtUser) {
    if (actor.role === Role.SYSTEM_ADMIN || actor.role === Role.AUDITOR) return;
    if (actor.adminLevel === AdminLevel.REGIONAL) {
      if (!actor.region) { where.id = '__no_scope__'; return; }
      where.region = actor.region;
      return;
    }
    if (actor.adminLevel === AdminLevel.WOREDA) {
      if (!actor.woreda) { where.id = '__no_scope__'; return; }
      where.woreda = actor.woreda;
      return;
    }
    if (actor.adminLevel === AdminLevel.ZONAL || actor.adminLevel === AdminLevel.KEBELE) {
      // Contract schema has no zone/kebele fields. Restrict to contracts linked
      // to producers in the actor's exact geography instead of trusting query params.
      const userScope: Prisma.ContractWhereInput = { parties: { some: { farmer: { user: {
        ...(actor.region ? { region: actor.region } : {}),
        ...(actor.woreda ? { woreda: actor.woreda } : {}),
        ...(actor.adminLevel === AdminLevel.KEBELE && actor.kebele ? { kebele: actor.kebele } : {}),
      } } } } };
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), userScope];
      return;
    }
    switch (actor.role) {
      case Role.CONTRACTOR:
        where.createdById = actor.sub;
        return;
      case Role.COOPERATIVE:
        where.OR = [
          { createdById: actor.sub },
          { parties: { some: { farmer: { cooperative: { userId: actor.sub } } } } },
        ];
        return;
      case Role.FARMER:
        where.parties = { some: { farmer: { userId: actor.sub } } };
        return;
      case Role.FI_OFFICER:
        where.loans = { some: { fiId: actor.sub } };
        return;
      case Role.AGRO_DEALER:
        where.vouchers = { some: { agroDealerId: actor.sub } };
        return;
      default:
        // No relationship model exists for these roles yet. Deny by default.
        where.id = '__no_scope__';
    }
  }

  private async canReadContract(contract: any, actor: JwtUser): Promise<boolean> {
    if (actor.role === Role.SYSTEM_ADMIN || actor.role === Role.AUDITOR) return true;
    if (actor.adminLevel === AdminLevel.REGIONAL) return Boolean(actor.region && contract.region === actor.region);
    if (actor.adminLevel === AdminLevel.WOREDA) return Boolean(actor.woreda && contract.woreda === actor.woreda &&
      (!actor.region || !contract.region || actor.region === contract.region));
    if (actor.adminLevel === AdminLevel.ZONAL || actor.adminLevel === AdminLevel.KEBELE) {
      return contract.parties?.some((p: any) => p.farmer?.user &&
        (!actor.region || p.farmer.user.region === actor.region) &&
        (!actor.woreda || p.farmer.user.woreda === actor.woreda) &&
        (actor.adminLevel !== AdminLevel.KEBELE || !actor.kebele || p.farmer.user.kebele === actor.kebele)) ?? false;
    }
    if (contract.createdById === actor.sub) return actor.role === Role.CONTRACTOR || actor.role === Role.COOPERATIVE;
    if (actor.role === Role.FARMER) return contract.parties?.some((p: any) => p.farmer?.userId === actor.sub) ?? false;
    if (actor.role === Role.COOPERATIVE) return contract.parties?.some((p: any) => p.farmer?.cooperative?.userId === actor.sub) ?? false;
    if (actor.role === Role.FI_OFFICER) return contract.loans?.some((loan: any) => loan.fiId === actor.sub) ?? false;
    if (actor.role === Role.AGRO_DEALER) return contract.vouchers?.some((v: any) => v.agroDealerId === actor.sub) ?? false;
    return false;
  }

  private assertInScope(contract: any, actor: JwtUser) {
    if (actor.adminLevel === AdminLevel.REGIONAL && (!actor.region || contract.region !== actor.region)) {
      throw new ForbiddenException('Out of regional scope');
    }
    if (actor.adminLevel === AdminLevel.WOREDA && (!actor.woreda || contract.woreda !== actor.woreda)) {
      throw new ForbiddenException('Out of woreda scope');
    }
  }

  async sendForSignatures(id: string, actor: JwtUser) {
    const contract = await this.findOne(id, actor);
    if (contract.createdById !== actor.sub || ![Role.CONTRACTOR, Role.COOPERATIVE].includes(actor.role as Role)) {
      throw new ForbiddenException('Only the contract creator may submit this contract for signature');
    }
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
    if (actor.adminLevel === AdminLevel.REGIONAL && (!actor.region || contract.region !== actor.region)) {
      throw new ForbiddenException('Out of regional approval scope');
    }
    if (actor.adminLevel === AdminLevel.WOREDA && (!actor.woreda || contract.woreda !== actor.woreda)) {
      throw new ForbiddenException('Out of woreda approval scope');
    }
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
