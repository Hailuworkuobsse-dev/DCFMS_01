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
    if (!dto.templateId) throw new BadRequestException('An approved contract template is required');
    if (dto.templateId) {
      const template = await this.prisma.contractTemplate.findUnique({ where: { id: dto.templateId } });
      if (!template || template.status !== 'APPROVED') throw new BadRequestException('Select an approved contract template');
      this.validateTemplateClauses(template.clauses, dto.content);
    }

    const farmerIds = [...new Set(dto.parties.map((p) => p.farmerId).filter((id): id is string => Boolean(id)))];
    if (farmerIds.length !== dto.parties.length) throw new BadRequestException('Duplicate or missing producer parties are not allowed');
    if (!dto.parcelIds?.length) throw new BadRequestException('Select at least one registered, available parcel');
    if (new Set(dto.parcelIds).size !== dto.parcelIds.length) throw new BadRequestException('Duplicate parcel selections are not allowed');
    let contractRegion = dto.region;
    let contractWoreda = dto.woreda;
    if (farmerIds.length) {
      const existing = await this.prisma.farmer.findMany({ where: { id: { in: farmerIds } }, select: { id: true, userId: true, user: { select: { role: true, isActive: true, region: true, woreda: true } } } });
      if (existing.length !== farmerIds.length) throw new BadRequestException('One or more producer records do not exist');
      if (existing.some((farmer: any) => !farmer.userId || !farmer.user?.isActive || farmer.user?.role !== Role.FARMER)) {
        throw new BadRequestException('Every selected producer must have an active registered farmer account');
      }
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
        where: { id: { in: dto.parcelIds }, farmerId: { in: farmerIds }, isLocked: false },
        select: { id: true, farmerId: true },
      });
      if (parcels.length !== new Set(dto.parcelIds).size) {
        throw new ForbiddenException('Every selected parcel must belong to a selected producer and remain available');
      }
      const parcelOwners = new Set(parcels.map((parcel: any) => parcel.farmerId));
      if (farmerIds.some((farmerId) => !parcelOwners.has(farmerId))) {
        throw new BadRequestException('Each selected producer must have at least one parcel in this contract');
      }
    }

    const contractNo = await this.nextContractNo();
    const contentHash = createHash('sha256').update(canonicalJson(dto.content)).digest('hex');
    const contract = await this.prisma.$transaction(async (tx: any) => {
      const created = await tx.contract.create({
        data: {
          contractNo, commodity: dto.commodity, quantity: dto.quantity,
          unit: dto.unit || 'quintal', quality: dto.quality,
          priceMechanism: dto.priceMechanism, fixedPrice: dto.fixedPrice, templateId: dto.templateId,
          deliveryStart: dto.deliveryStart ? new Date(dto.deliveryStart) : null,
          deliveryEnd: dto.deliveryEnd ? new Date(dto.deliveryEnd) : null,
          content: dto.content, contentHash, region: contractRegion, woreda: contractWoreda,
          createdById: actor.sub, status: 'DRAFT',
          parties: { create: dto.parties.map((p) => ({ role: 'FARMER', farmerId: p.farmerId })) },
          versions: { create: [{ version: 1, content: dto.content, hash: contentHash, createdById: actor.sub }] },
        },
        include: { parties: true, versions: true },
      });
      const locked = await tx.parcel.updateMany({
        where: { id: { in: dto.parcelIds }, farmerId: { in: farmerIds }, isLocked: false },
        data: { isLocked: true, contractId: created.id },
      });
      if (locked.count !== new Set(dto.parcelIds).size) {
        throw new BadRequestException('One or more parcels are no longer available; reload the registry and retry');
      }
      return created;
    });

    await this.audit.log({
      actorId: actor.sub, action: AuditAction.CREATE,
      entity: 'Contract', entityId: contract.id, after: { contractNo },
    });
    return contract;
  }

  async listApprovedTemplates(actor: JwtUser, commodity?: string) {
    if (actor.role === Role.CONTRACTOR) {
      const contractor = await this.prisma.contractor.findUnique({ where: { userId: actor.sub } });
      if (!contractor || contractor.approvalStatus !== 'APPROVED') {
        throw new ForbiddenException('An approved contractor account is required');
      }
    }
    return this.prisma.contractTemplate.findMany({
      where: {
        status: 'APPROVED',
        ...(commodity ? { OR: [{ commodity }, { commodity: null }] } : {}),
      },
      orderBy: [{ commodity: 'asc' }, { title: 'asc' }, { version: 'desc' }],
    });
  }

  private validateTemplateDefinition(clauses: unknown): asserts clauses is Array<{ key: string; title: string; text: string; mandatory?: boolean; editable?: boolean }> {
    if (!Array.isArray(clauses) || clauses.length === 0) {
      throw new BadRequestException('A template must contain at least one structured clause');
    }
    const keys = new Set<string>();
    for (const clause of clauses as any[]) {
      if (!clause || typeof clause.key !== 'string' || !clause.key.trim() ||
        typeof clause.title !== 'string' || !clause.title.trim() ||
        typeof clause.text !== 'string' || !clause.text.trim()) {
        throw new BadRequestException('Every template clause must have a key, title, and non-empty text');
      }
      if (keys.has(clause.key)) throw new BadRequestException('Template clause keys must be unique');
      keys.add(clause.key);
      if (clause.mandatory !== undefined && typeof clause.mandatory !== 'boolean') {
        throw new BadRequestException('Template mandatory flags must be boolean');
      }
      if (clause.editable !== undefined && typeof clause.editable !== 'boolean') {
        throw new BadRequestException('Template editable flags must be boolean');
      }
    }
  }

  async createTemplate(dto: { title: string; description?: string; commodity?: string; language?: string; clauses: unknown }, actor: JwtUser) {
    if (actor.role !== Role.SYSTEM_ADMIN) throw new ForbiddenException('Only system administrators can manage contract templates');
    this.validateTemplateDefinition(dto.clauses);
    return this.prisma.contractTemplate.create({
      data: {
        title: dto.title.trim(), description: dto.description, commodity: dto.commodity,
        language: dto.language || 'en', clauses: dto.clauses as any, createdById: actor.sub, status: 'DRAFT',
      },
    });
  }

  async approveTemplate(id: string, actor: JwtUser) {
    if (actor.role !== Role.SYSTEM_ADMIN) throw new ForbiddenException('Only system administrators can approve contract templates');
    const template = await this.prisma.contractTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    this.validateTemplateDefinition(template.clauses);
    return this.prisma.contractTemplate.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: actor.sub, approvedAt: new Date() },
    });
  }

  async lookupContractParties(query: string, actor: JwtUser) {
    if (actor.role !== Role.CONTRACTOR) throw new ForbiddenException('Only contractors can search for contracting producers');
    const contractor = await this.prisma.contractor.findUnique({ where: { userId: actor.sub } });
    if (!contractor || contractor.approvalStatus !== 'APPROVED') throw new ForbiddenException('An approved contractor account is required');
    const term = query.trim();
    if (term.length < 2) throw new BadRequestException('Enter at least two characters to search the verified producer directory');
    return this.prisma.farmer.findMany({
      where: {
        user: { is: { isActive: true, role: Role.FARMER, OR: [{ fullName: { contains: term } }, { phone: { contains: term } }] } },
        parcels: { some: { isLocked: false } },
      },
      take: 20,
      orderBy: { user: { fullName: 'asc' } },
      select: {
        id: true,
        user: { select: { fullName: true, phone: true, region: true, woreda: true, kebele: true } },
        cooperative: { select: { registrationNo: true, user: { select: { fullName: true } } } },
        parcels: { where: { isLocked: false }, select: { id: true, name: true, sizeHa: true, crop: true, season: true }, take: 20 },
      },
    });
  }

  private async getEditableContract(id: string, actor: JwtUser) {
    const contract = await this.findOne(id, actor);
    if (contract.createdById !== actor.sub || actor.role !== Role.CONTRACTOR) {
      throw new ForbiddenException('Only the authenticated contract creator may edit this draft');
    }
    if (!['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(contract.status)) throw new BadRequestException('Only draft or returned-for-correction contracts can be edited');
    return contract;
  }

  private validateTemplateClauses(templateClauses: any, content: Record<string, any>) {
    const requiredClauses = Array.isArray(templateClauses) ? templateClauses : templateClauses?.clauses;
    if (!Array.isArray(requiredClauses)) throw new BadRequestException('Approved template clauses are malformed');
    const submitted = Array.isArray(content.clauses) ? content.clauses : [];
    const byKey = new Map(submitted.map((clause: any) => [clause?.key, clause]));
    if (byKey.size !== submitted.length) throw new BadRequestException('Clause keys must be unique within a draft');
    for (const required of requiredClauses) {
      if (!required || typeof required.key !== 'string') throw new BadRequestException('Template contains an invalid clause definition');
      const current: any = byKey.get(required.key);
      if (required.mandatory && (!current || (typeof current.text !== 'string' || !current.text.trim()))) {
        throw new BadRequestException(`Mandatory clause "${required.title || required.key}" cannot be removed or left blank`);
      }
      if (required.editable === false && !current) {
        throw new BadRequestException(`Locked clause "${required.title || required.key}" cannot be removed`);
      }
      if (current && required.editable === false && current.text !== required.text) {
        throw new BadRequestException(`Clause "${required.title || required.key}" is locked by the approved template`);
      }
    }
  }

  private async assertNegotiationParty(contract: any, actor: JwtUser) {
    const isParty = contract.createdById === actor.sub ||
      (contract.parties || []).some((party: any) => party.farmer?.userId === actor.sub) ||
      (actor.role === Role.COOPERATIVE && (contract.parties || []).some((party: any) => party.farmer?.cooperative?.userId === actor.sub));
    if (!isParty || actor.role === Role.AUDITOR || actor.role === Role.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only a contracting party may comment or accept negotiated changes');
    }
  }

  async saveDraft(id: string, dto: { content: Record<string, any>; expectedVersion: number; changeSummary?: string }, actor: JwtUser) {
    const contract = await this.getEditableContract(id, actor);
    const versions = contract.versions || [];
    const latestVersion = versions.length ? Math.max(...versions.map((version: any) => version.version)) : 0;
    if (dto.expectedVersion !== latestVersion) {
      throw new BadRequestException('This draft has changed since you opened it. Reload and compare the latest version before saving.');
    }
    if (contract.templateId) {
      const template = await this.prisma.contractTemplate.findUnique({ where: { id: contract.templateId } });
      if (!template || template.status !== 'APPROVED') throw new BadRequestException('The selected contract template is not currently approved');
      this.validateTemplateClauses(template.clauses, dto.content);
    }
    const hash = createHash('sha256').update(canonicalJson(dto.content)).digest('hex');
    const nextVersion = latestVersion + 1;
    const result = await this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.contract.update({
        where: { id, status: contract.status, updatedAt: contract.updatedAt },
        data: { status: 'DRAFT', content: dto.content, contentHash: hash },
      });
      const version = await tx.contractVersion.create({
        data: { contractId: id, version: nextVersion, content: dto.content, hash, createdById: actor.sub },
      });
      await tx.contractComment.create({
        data: { contractId: id, authorId: actor.sub, body: (dto.changeSummary || `Saved draft version ${nextVersion}`).slice(0, 4000), clauseKey: null },
      });
      return { contract: updated, version };
    });
    await this.audit.log({
      actorId: actor.sub, action: AuditAction.UPDATE, entity: 'Contract', entityId: id,
      before: { version: latestVersion }, after: { version: nextVersion, hash },
    });
    return result;
  }

  async listComments(id: string, actor: JwtUser) {
    await this.findOne(id, actor);
    return this.prisma.contractComment.findMany({ where: { contractId: id }, orderBy: { createdAt: 'asc' } });
  }

  async addComment(id: string, dto: { body: string; clauseKey?: string }, actor: JwtUser) {
    const contract = await this.findOne(id, actor);
    await this.assertNegotiationParty(contract, actor);
    const body = dto.body.trim();
    if (!body || body.length > 4000) throw new BadRequestException('Comment must contain 1–4000 characters');
    if (contract.status !== 'DRAFT') throw new BadRequestException('Negotiation comments are only available while the contract is a draft');
    return this.prisma.contractComment.create({
      data: { contractId: id, authorId: actor.sub, body, clauseKey: dto.clauseKey?.slice(0, 120) },
    });
  }

  async listAnnexes(id: string, actor: JwtUser) {
    await this.findOne(id, actor);
    return this.prisma.contractAnnex.findMany({ where: { contractId: id }, orderBy: { createdAt: 'asc' } });
  }

  async addAnnex(id: string, dto: { title: string; description?: string; content?: Record<string, any>; fileName?: string; mimeType?: string; storageUrl?: string }, actor: JwtUser) {
    const contract = await this.findOne(id, actor);
    await this.assertNegotiationParty(contract, actor);
    if (contract.status !== 'DRAFT') throw new BadRequestException('Annexes can only be changed while the contract is a draft');
    if (!dto.title.trim()) throw new BadRequestException('Annex title is required');
    if (dto.storageUrl && !dto.storageUrl.startsWith('https://')) throw new BadRequestException('Annex links must use HTTPS');
    const checksum = createHash('sha256').update(canonicalJson({
      title: dto.title.trim(), description: dto.description || null, content: dto.content || null,
      fileName: dto.fileName || null, storageUrl: dto.storageUrl || null,
    })).digest('hex');
    return this.prisma.contractAnnex.create({
      data: {
        contractId: id, title: dto.title.trim(), description: dto.description, content: dto.content as any,
        fileName: dto.fileName, mimeType: dto.mimeType, storageUrl: dto.storageUrl, checksum, createdById: actor.sub,
      },
    });
  }

  async compareVersions(id: string, actor: JwtUser) {
    await this.findOne(id, actor);
    return this.prisma.contractVersion.findMany({
      where: { contractId: id }, orderBy: { version: 'asc' },
      select: { id: true, version: true, content: true, hash: true, createdById: true, createdAt: true },
    });
  }

  async acceptChange(id: string, dto: { version: number; accepted: boolean; comment?: string }, actor: JwtUser) {
    const contract = await this.findOne(id, actor);
    await this.assertNegotiationParty(contract, actor);
    if (contract.status !== 'DRAFT') throw new BadRequestException('Changes can only be accepted while the contract is a draft');
    const version = await this.prisma.contractVersion.findFirst({ where: { contractId: id, version: dto.version } });
    if (!version) throw new NotFoundException('Contract version not found');
    return this.prisma.contractChangeAcceptance.upsert({
      where: { contractId_version_userId: { contractId: id, version: dto.version, userId: actor.sub } },
      create: { contractId: id, version: dto.version, userId: actor.sub, accepted: dto.accepted, comment: dto.comment?.slice(0, 1000) },
      update: { accepted: dto.accepted, comment: dto.comment?.slice(0, 1000), acceptedAt: new Date() },
    });
  }

  async listChangeAcceptances(id: string, actor: JwtUser) {
    await this.findOne(id, actor);
    return this.prisma.contractChangeAcceptance.findMany({ where: { contractId: id }, orderBy: [{ version: 'asc' }, { acceptedAt: 'asc' }] });
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
      include: { parties: { include: { farmer: { select: { id: true, userId: true, cooperativeId: true, user: { select: { id: true, fullName: true, region: true, zone: true, woreda: true, kebele: true } }, cooperative: { select: { userId: true } } } } } },
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
    const latestVersion = Math.max(0, ...(contract.versions || []).map((version: any) => Number(version.version)));
    if (!latestVersion) throw new BadRequestException('The draft must have a saved version before signature submission');
    const acceptances = await this.prisma.contractChangeAcceptance.findMany({
      where: { contractId: id, version: latestVersion, accepted: true },
      select: { userId: true },
    });
    const acceptedUserIds = new Set(acceptances.map((acceptance: any) => acceptance.userId));
    const requiredUserIds = [...new Set([...parties.map((party) => party.farmer!.userId), actor.sub])];
    const missingAcceptances = requiredUserIds.filter((userId) => !acceptedUserIds.has(userId));
    if (missingAcceptances.length) {
      throw new BadRequestException('Every contracting party must accept the latest draft version before it can be sent for signature');
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

  async listReviewQueue(actor: JwtUser) {
    if (!APPROVER_ROLES.includes(actor.role as Role)) {
      throw new ForbiddenException('Only statutory reviewers may access the review queue');
    }
    const where: any = { status: 'PENDING_APPROVAL' };
    if (actor.role === Role.WBOA_OFFICER) {
      if (!actor.region || !actor.woreda) throw new ForbiddenException('WBoA reviewers must have a registered region and woreda scope');
      where.region = actor.region;
      where.woreda = actor.woreda;
    } else if (actor.role === Role.RBOA_OFFICER) {
      if (!actor.region) throw new ForbiddenException('RBoA reviewers must have a registered region scope');
      where.region = actor.region;
    } else if (actor.role !== Role.MOA_OFFICER && actor.adminLevel !== AdminLevel.FEDERAL) {
      if (actor.adminLevel === AdminLevel.REGIONAL) {
        if (!actor.region) throw new ForbiddenException('Reviewer region is missing');
        where.region = actor.region;
      } else if (actor.adminLevel === AdminLevel.WOREDA) {
        if (!actor.region || !actor.woreda) throw new ForbiddenException('Reviewer woreda scope is missing');
        where.region = actor.region;
        where.woreda = actor.woreda;
      } else {
        throw new ForbiddenException('This reviewer has no statutory jurisdiction configured');
      }
    }
    return this.prisma.contract.findMany({
      where, orderBy: { updatedAt: 'asc' },
      select: {
        id: true, contractNo: true, commodity: true, quantity: true, unit: true,
        status: true, region: true, woreda: true, createdAt: true, updatedAt: true,
        createdBy: { select: { id: true, fullName: true, role: true } },
        parties: { include: { farmer: { include: { user: { select: { id: true, fullName: true, phone: true, region: true, woreda: true } } } } } },
        signatures: { select: { id: true, signerId: true, role: true, status: true, signedAt: true, signatureHash: true } },
      },
    });
  }

  async approve(id: string, decision: 'APPROVE' | 'REJECT' | 'RETURN_FOR_CORRECTION', note: string | undefined, actor: JwtUser) {
    if (!APPROVER_ROLES.includes(actor.role as Role)) {
      throw new ForbiddenException('Only government approvers can review contracts');
    }
    if (decision !== 'APPROVE' && !note?.trim()) {
      throw new BadRequestException('A reason is required when rejecting or returning a contract');
    }
    const contract = await this.findOne(id, actor);
    if (actor.role === Role.WBOA_OFFICER && (!actor.region || !actor.woreda || contract.region !== actor.region || contract.woreda !== actor.woreda)) {
      throw new ForbiddenException('Out of WBoA woreda approval scope');
    }
    if (actor.role === Role.RBOA_OFFICER && (!actor.region || contract.region !== actor.region)) {
      throw new ForbiddenException('Out of RBoA regional approval scope');
    }
    if (actor.adminLevel === AdminLevel.REGIONAL && (!actor.region || contract.region !== actor.region)) {
      throw new ForbiddenException('Out of regional approval scope');
    }
    if (actor.adminLevel === AdminLevel.WOREDA && (!actor.region || !actor.woreda || contract.region !== actor.region || contract.woreda !== actor.woreda)) {
      throw new ForbiddenException('Out of woreda approval scope');
    }
    if (contract.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Contract is not pending statutory approval');
    }
    const newStatus = decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'RETURNED_FOR_CORRECTION';
    const updated = await this.prisma.$transaction(async (tx: any) => {
      const result = await tx.contract.update({
        where: { id },
        data: {
          status: newStatus,
          approvedById: decision === 'APPROVE' ? actor.sub : null,
          approvedAt: decision === 'APPROVE' ? new Date() : null,
          rejectionNote: decision === 'APPROVE' ? null : note!.trim(),
        },
      });
      await tx.contractReviewAction.create({
        data: {
          contractId: id, reviewerId: actor.sub, reviewerRole: actor.role,
          action: decision, note: note?.trim(), fromStatus: 'PENDING_APPROVAL',
          toStatus: newStatus, scopeRegion: actor.region, scopeWoreda: actor.woreda,
        },
      });
      return result;
    });
    await this.audit.log({
      actorId: actor.sub,
      action: decision === 'APPROVE' ? AuditAction.APPROVE : AuditAction.REJECT,
      entity: 'Contract', entityId: id,
      after: { status: newStatus, decision, note, reviewerRole: actor.role, scopeRegion: actor.region, scopeWoreda: actor.woreda },
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
