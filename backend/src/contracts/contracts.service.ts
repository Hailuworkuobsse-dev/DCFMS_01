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
    // The current schema stores producer parties only; the buyer is the creator.
    // Do not let a cooperative impersonate a buyer until organization-party linkage
    // is modeled explicitly in ContractParty.
    if (actor.role !== Role.CONTRACTOR) {
      throw new ForbiddenException('Only a registered contractor may create a contract');
    }
    if (!dto.parties?.length) throw new BadRequestException('At least one producer party is required');

    const contractor = await this.prisma.contractor.findUnique({ where: { userId: actor.sub } });
    if (!contractor || contractor.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException('An approved contractor account is required to create contracts');
    }
    if (dto.parties.some((p) => p.role === 'CONTRACTOR' || !p.farmerId)) {
      throw new BadRequestException('Select valid producer parties; contractor identity is derived from your account');
    }

    const farmerIds = [...new Set(dto.parties.map((p) => p.farmerId).filter((id): id is string => Boolean(id)))];
    let contractRegion = dto.region;
    let contractWoreda = dto.woreda;
    if (farmerIds.length) {
      const existing = await this.prisma.farmer.findMany({ where: { id: { in: farmerIds } }, select: { id: true, user: { select: { region: true, woreda: true } } } });
      if (existing.length !== farmerIds.length) throw new BadRequestException('One or more producer records do not exist');
      if (existing.some((farmer: any) => !farmer.user?.region || !farmer.user?.woreda)) {
        throw new BadRequestException('Every selected producer must have a registered region and woreda');
      }
      const regions = new Set(existing.map((farmer: any) => farmer.user.region));
      const woredas = new Set(existing.map((farmer: any) => farmer.user.woreda));
      if (regions.size > 1 || woredas.size > 1) throw new BadRequestException('A contract cannot mix producers from different regional or woreda jurisdictions');
      const producerRegion = existing[0].user.region as string;
      const producerWoreda = existing[0].user.woreda as string;
      if (dto.region && dto.region !== producerRegion) throw new ForbiddenException('Contract region must match the selected producer');
      if (dto.woreda && dto.woreda !== producerWoreda) throw new ForbiddenException('Contract woreda must match the selected producer');
      contractRegion = producerRegion;
      contractWoreda = producerWoreda;
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
        content: dto.content, contentHash, region: contractRegion, woreda: contractWoreda,
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
    const requestedScope: Prisma.ContractWhereInput[] = [];
    if (filter.region) requestedScope.push({ region: filter.region });
    if (filter.woreda) requestedScope.push({ woreda: filter.woreda });
    if (requestedScope.length) where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), ...requestedScope];
    return this.prisma.contract.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 200,
      include: { parties: true, signatures: { select: { role: true, status: true, signerId: true } } },
    });
  }

  async findOne(id: string, actor: JwtUser) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { parties: { include: { farmer: { select: { id: true, userId: true, cooperativeId: true, user: { select: { id: true, region: true, zone: true, woreda: true, kebele: true } }, cooperative: { select: { userId: true } } } } } },
        signatures: true, versions: { orderBy: { version: 'desc' } }, payments: true, loans: true, vouchers: true },
    });
    // Return 404 for both missing and unauthorized records to avoid ID enumeration.
    if (!contract || !(await this.canReadContract(contract, actor))) throw new NotFoundException('Contract not found');
    this.filterRelatedRecords(contract, actor);
    return contract;
  }

  private applyActorScope(where: Prisma.ContractWhereInput, actor: JwtUser) {
    if (actor.role === Role.SYSTEM_ADMIN || actor.role === Role.AUDITOR) return;
    if (actor.adminLevel === AdminLevel.FEDERAL && [Role.MOA_OFFICER, Role.MOTRI_OFFICER, Role.ECC_OFFICER, Role.EAA_OFFICER, Role.RESOLUTION_OFFICER].some((role) => role === actor.role)) return;
    if (this.hasAdministrativeContractScope(actor) && actor.adminLevel === AdminLevel.REGIONAL) {
      if (!actor.region) { where.id = '__no_scope__'; return; }
      where.region = actor.region;
      return;
    }
    if (this.hasAdministrativeContractScope(actor) && actor.adminLevel === AdminLevel.WOREDA) {
      if (!actor.woreda || !actor.region) { where.id = '__no_scope__'; return; }
      where.region = actor.region;
      where.woreda = actor.woreda;
      return;
    }
    if (this.hasAdministrativeContractScope(actor) && actor.adminLevel === AdminLevel.ZONAL) {
      if (!actor.region || !actor.zone) { where.id = '__no_scope__'; return; }
      const userScope: Prisma.ContractWhereInput = { parties: { some: { farmer: { user: {
        region: actor.region, zone: actor.zone,
      } } } } };
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), userScope];
      return;
    }
    if (this.hasAdministrativeContractScope(actor) && actor.adminLevel === AdminLevel.KEBELE) {
      if (!actor.region || !actor.woreda || !actor.kebele) { where.id = '__no_scope__'; return; }
      const userScope: Prisma.ContractWhereInput = { parties: { some: { farmer: { user: {
        region: actor.region, woreda: actor.woreda, kebele: actor.kebele,
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

  /**
   * A contract may cover multiple producers. Access to the shared agreement
   * does not grant access to another producer's individual finance/input records.
   */
  private filterRelatedRecords(contract: any, actor: JwtUser): void {
    if (actor.role === Role.SYSTEM_ADMIN || actor.role === Role.AUDITOR ||
      (this.hasAdministrativeContractScope(actor) && actor.adminLevel === AdminLevel.FEDERAL)) return;

    if (actor.role === Role.FARMER) {
      const farmerIds = new Set((contract.parties || [])
        .filter((party: any) => party.farmer?.userId === actor.sub)
        .map((party: any) => party.farmerId));
      contract.loans = (contract.loans || []).filter((loan: any) => farmerIds.has(loan.farmerId));
      contract.vouchers = (contract.vouchers || []).filter((voucher: any) => farmerIds.has(voucher.farmerId));
      contract.payments = (contract.payments || []).filter((payment: any) =>
        payment.payerId === actor.sub || payment.payeeId === actor.sub);
      return;
    }

    if (actor.role === Role.COOPERATIVE) {
      const memberParties = (contract.parties || []).filter((party: any) => party.farmer?.cooperative?.userId === actor.sub);
      const memberIds = new Set(memberParties.map((party: any) => party.farmerId));
      const memberUserIds = new Set(memberParties.map((party: any) => party.farmer?.userId));
      contract.loans = (contract.loans || []).filter((loan: any) => memberIds.has(loan.farmerId));
      contract.vouchers = (contract.vouchers || []).filter((voucher: any) => memberIds.has(voucher.farmerId));
      contract.payments = (contract.payments || []).filter((payment: any) =>
        memberUserIds.has(payment.payerId) || memberUserIds.has(payment.payeeId));
      return;
    }

    if (actor.role === Role.FI_OFFICER) {
      contract.loans = (contract.loans || []).filter((loan: any) => loan.fiId === actor.sub);
      contract.payments = [];
      contract.vouchers = [];
      return;
    }

    if (actor.role === Role.AGRO_DEALER) {
      contract.vouchers = (contract.vouchers || []).filter((voucher: any) => voucher.agroDealerId === actor.sub);
      contract.loans = [];
      contract.payments = [];
    }
  }

  private hasAdministrativeContractScope(actor: JwtUser): boolean {
    return [
      Role.MOA_OFFICER, Role.RBOA_OFFICER, Role.WBOA_OFFICER,
      Role.MOTRI_OFFICER, Role.ECC_OFFICER, Role.EAA_OFFICER,
      Role.RESOLUTION_OFFICER,
    ].some((role) => role === actor.role);
  }

  private async canReadContract(contract: any, actor: JwtUser): Promise<boolean> {
    if (actor.role === Role.SYSTEM_ADMIN || actor.role === Role.AUDITOR) return true;
    if (actor.adminLevel === AdminLevel.FEDERAL && [Role.MOA_OFFICER, Role.MOTRI_OFFICER, Role.ECC_OFFICER, Role.EAA_OFFICER].includes(actor.role as Role)) return true;
    if (this.hasAdministrativeContractScope(actor) && actor.adminLevel === AdminLevel.REGIONAL) return Boolean(actor.region && contract.region === actor.region);
    if (this.hasAdministrativeContractScope(actor) && actor.adminLevel === AdminLevel.WOREDA) return Boolean(actor.region && actor.woreda && contract.region === actor.region && contract.woreda === actor.woreda);
    if (this.hasAdministrativeContractScope(actor) && actor.adminLevel === AdminLevel.ZONAL) {
      return Boolean(actor.region && actor.zone && contract.parties?.some((p: any) => p.farmer?.user?.region === actor.region && p.farmer.user.zone === actor.zone));
    }
    if (this.hasAdministrativeContractScope(actor) && actor.adminLevel === AdminLevel.KEBELE) {
      return Boolean(actor.region && actor.woreda && actor.kebele && contract.parties?.some((p: any) =>
        p.farmer?.user?.region === actor.region && p.farmer.user.woreda === actor.woreda && p.farmer.user.kebele === actor.kebele));
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
    if (contract.createdById !== actor.sub || actor.role !== Role.CONTRACTOR) {
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
    if (parties.some((party) => !party.farmer?.userId)) {
      throw new BadRequestException('Every producer party must have a registered farmer account before signing');
    }

    return this.prisma.contract.update({
      where: { id },
      data: {
        status: 'PENDING_SIGNATURES',
        signatures: {
          create: [
            ...parties.map((p) => ({
              signerId: p.farmer!.userId,
              role: p.role,
              status: SignatureStatus.PENDING,
            })),
            // The authenticated contractor is a legal party and must sign too.
            { signerId: actor.sub, role: 'CONTRACTOR', status: SignatureStatus.PENDING },
          ],
        },
      },
      include: { signatures: true },
    });
  }

  async submitForApproval(id: string, actor: JwtUser) {
    const contract = await this.findOne(id, actor);
    if (contract.createdById !== actor.sub || (actor.role !== Role.CONTRACTOR && actor.role !== Role.COOPERATIVE)) {
      throw new ForbiddenException('Only the contract creator may submit it for approval');
    }
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

  async verifyIntegrity(id: string, actor: JwtUser) {
    await this.findOne(id, actor);
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

}
