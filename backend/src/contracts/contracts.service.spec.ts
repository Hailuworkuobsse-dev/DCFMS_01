import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ContractsService, canonicalJson } from './contracts.service';
import { AdminLevel, Role } from '../common/enums';

describe('ContractsService access control', () => {
  const contract = {
    id: 'contract-1',
    contractNo: 'DCF-2026-000001',
    createdById: 'contractor-owner',
    region: 'Oromia',
    woreda: 'Ada',
    status: 'DRAFT',
    parties: [{
      id: 'party-1',
      role: 'FARMER',
      farmerId: 'farmer-record-1',
      farmer: {
        id: 'farmer-record-1',
        userId: 'farmer-owner',
        user: { id: 'farmer-owner', region: 'Oromia', woreda: 'Ada', kebele: 'Kebele 01' },
        cooperative: { userId: 'cooperative-owner' },
      },
    }, {
      id: 'party-2', role: 'FARMER', farmerId: 'farmer-record-2',
      farmer: { id: 'farmer-record-2', userId: 'farmer-two', user: { id: 'farmer-two', region: 'Oromia', woreda: 'Ada', kebele: 'Kebele 02' }, cooperative: { userId: 'different-cooperative' } },
    }],
    signatures: [],
    versions: [{ id: 'version-1', version: 1, content: {}, hash: 'hash-v1', createdById: 'contractor-owner', createdAt: new Date('2026-01-01T00:00:00.000Z') }],
    payments: [{ id: 'payment-own', payerId: 'farmer-owner', payeeId: 'contractor-owner' }, { id: 'payment-other', payerId: 'farmer-two', payeeId: 'contractor-owner' }],
    loans: [{ id: 'loan-own', farmerId: 'farmer-record-1', fiId: 'fi-owner' }, { id: 'loan-other', farmerId: 'farmer-record-2', fiId: 'other-fi' }],
    vouchers: [{ id: 'voucher-own', farmerId: 'farmer-record-1', agroDealerId: 'dealer-owner' }, { id: 'voucher-other', farmerId: 'farmer-record-2', agroDealerId: 'other-dealer' }],
  };

  let prisma: any;
  let service: ContractsService;

  beforeEach(() => {
    prisma = {
      contractReviewAction: { create: jest.fn().mockResolvedValue({ id: 'review-action-1' }) },
      contractEvent: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
      contractNotification: { createMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findFirst: jest.fn(), findUnique: jest.fn() },
      contractMilestone: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'milestone-1', title: 'Deliver inputs', status: 'PENDING' }), update: jest.fn().mockResolvedValue({ id: 'milestone-1', status: 'COMPLETED' }) },
      contractAmendment: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'amendment-1', amendmentNo: 1 }), update: jest.fn().mockResolvedValue({ id: 'amendment-1' }) },
      contractClosure: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'closure-1' }) },
      contract: {
        findUnique: jest.fn().mockImplementation(async () => JSON.parse(JSON.stringify(contract))),
        findMany: jest.fn().mockResolvedValue([contract]),
        create: jest.fn(),
        update: jest.fn(),
      },
      contractor: { findUnique: jest.fn() },
      contractTemplate: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      contractVersion: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'version-2', version: 2 }) },
      contractComment: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({ id: 'comment-1' }) },
      contractAnnex: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({ id: 'annex-1' }) },
      contractChangeAcceptance: { findMany: jest.fn().mockResolvedValue([{ userId: 'farmer-owner' }, { userId: 'farmer-two' }, { userId: 'contractor-owner' }]), upsert: jest.fn().mockResolvedValue({ accepted: true }) },
      contractParty: { findMany: jest.fn().mockResolvedValue([
        { role: 'FARMER', farmer: { userId: 'farmer-owner' } },
        { role: 'FARMER', farmer: { userId: 'farmer-two' } },
      ]) },
      cooperative: { findUnique: jest.fn() },
      farmer: { findMany: jest.fn().mockResolvedValue([{ id: 'farmer-record-1', user: { region: 'Oromia', woreda: 'Ada' } }]) },
      parcel: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
    };
    prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
    service = new ContractsService(prisma, { log: jest.fn() } as any, { canTransition: jest.fn().mockReturnValue(true) } as any);
  });

  it('scopes contractor lists to contracts created by the authenticated contractor', async () => {
    await service.list({ sub: 'contractor-1', role: Role.CONTRACTOR }, {});
    expect(prisma.contract.findMany.mock.calls[0][0].where.createdById).toBe('contractor-1');
  });

  it('scopes farmer lists to contracts containing that farmer record', async () => {
    await service.list({ sub: 'farmer-1', role: Role.FARMER }, {});
    expect(prisma.contract.findMany.mock.calls[0][0].where.parties.some.farmer.userId).toBe('farmer-1');
  });

  it('does not let a regional list filter widen the actor\'s region', async () => {
    await service.list({
      sub: 'regional-officer', role: Role.RBOA_OFFICER, adminLevel: AdminLevel.REGIONAL, region: 'Oromia',
    }, { region: 'Amhara' });
    const where = prisma.contract.findMany.mock.calls[0][0].where;
    expect(where.region).toBe('Oromia');
    expect(where.AND).toContainEqual({ region: 'Amhara' });
  });

  it('denies list access to a field agent without an explicit contract assignment relationship', async () => {
    await service.list({
      sub: 'field-agent', role: Role.FIELD_AGENT, adminLevel: AdminLevel.WOREDA,
      region: 'Oromia', woreda: 'Ada',
    }, {});
    expect(prisma.contract.findMany.mock.calls[0][0].where.id).toBe('__no_scope__');
  });

  it('allows a contractor to read only contracts created by that authenticated account', async () => {
    await expect(service.findOne(contract.id, { sub: 'contractor-owner', role: Role.CONTRACTOR }))
      .resolves.toMatchObject({ id: contract.id });
    await expect(service.findOne(contract.id, { sub: 'different-contractor', role: Role.CONTRACTOR }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows a farmer to read only contracts linked to their registered farmer record', async () => {
    await expect(service.findOne(contract.id, { sub: 'farmer-owner', role: Role.FARMER }))
      .resolves.toMatchObject({ id: contract.id });
    await expect(service.findOne(contract.id, { sub: 'different-farmer', role: Role.FARMER }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not expose another producer\'s linked finance or input records to an individual farmer', async () => {
    const result = await service.findOne(contract.id, { sub: 'farmer-owner', role: Role.FARMER });
    expect(result.loans.map((loan: any) => loan.id)).toEqual(['loan-own']);
    expect(result.vouchers.map((voucher: any) => voucher.id)).toEqual(['voucher-own']);
    expect(result.payments.map((payment: any) => payment.id)).toEqual(['payment-own']);
  });

  it('allows a cooperative to read contracts linked to its registered members', async () => {
    await expect(service.findOne(contract.id, { sub: 'cooperative-owner', role: Role.COOPERATIVE }))
      .resolves.toMatchObject({ id: contract.id });
    await expect(service.findOne(contract.id, { sub: 'different-cooperative', role: Role.COOPERATIVE }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not expose non-member payment records to a cooperative', async () => {
    const result = await service.findOne(contract.id, { sub: 'cooperative-owner', role: Role.COOPERATIVE });
    expect(result.loans.map((loan: any) => loan.id)).toEqual(['loan-own']);
    expect(result.vouchers.map((voucher: any) => voucher.id)).toEqual(['voucher-own']);
    expect(result.payments.map((payment: any) => payment.id)).toEqual(['payment-own']);
  });

  it.each([
    Role.FI_OFFICER,
    Role.AGRO_DEALER,
    Role.FIELD_AGENT,
    Role.SUPPORT_AGENT,
    Role.MOTRI_OFFICER,
    Role.ECC_OFFICER,
    Role.EAA_OFFICER,
    Role.MOA_OFFICER,
    Role.RBOA_OFFICER,
    Role.WBOA_OFFICER,
    Role.RESOLUTION_OFFICER,
  ])('denies %s access when no relationship or authorized administrative scope exists', async (role) => {
    await expect(service.findOne(contract.id, { sub: 'unrelated-user', role }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows regional and woreda officers only within their exact jurisdiction', async () => {
    await expect(service.findOne(contract.id, {
      sub: 'regional-officer', role: Role.RBOA_OFFICER, adminLevel: AdminLevel.REGIONAL, region: 'Oromia',
    })).resolves.toMatchObject({ id: contract.id });

    await expect(service.findOne(contract.id, {
      sub: 'regional-officer', role: Role.RBOA_OFFICER, adminLevel: AdminLevel.REGIONAL, region: 'Amhara',
    })).rejects.toBeInstanceOf(NotFoundException);

    await expect(service.findOne(contract.id, {
      sub: 'woreda-officer', role: Role.WBOA_OFFICER, adminLevel: AdminLevel.WOREDA,
      region: 'Oromia', woreda: 'Other Woreda',
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fails closed when a woreda officer lacks the region needed for a unique scope', async () => {
    await expect(service.findOne(contract.id, {
      sub: 'woreda-officer', role: Role.WBOA_OFFICER, adminLevel: AdminLevel.WOREDA, woreda: 'Ada',
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not grant a field agent broad woreda access merely because an adminLevel claim exists', async () => {
    await expect(service.findOne(contract.id, {
      sub: 'field-agent', role: Role.FIELD_AGENT, adminLevel: AdminLevel.WOREDA,
      region: 'Oromia', woreda: 'Ada',
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not allow an approver to change a contract outside their woreda', async () => {
    await expect(service.approve(contract.id, 'APPROVE', undefined, {
      sub: 'woreda-officer', role: Role.WBOA_OFFICER, adminLevel: AdminLevel.WOREDA,
      region: 'Oromia', woreda: 'Different Woreda',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.contract.update).not.toHaveBeenCalled();
  });

  it('lists only approved templates and narrows by commodity', async () => {
    prisma.contractor.findUnique.mockResolvedValue({ approvalStatus: 'APPROVED' });
    await service.listApprovedTemplates({ sub: 'contractor-owner', role: Role.CONTRACTOR }, 'Wheat');
    expect(prisma.contractTemplate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'APPROVED', OR: [{ commodity: 'Wheat' }, { commodity: null }] },
    }));
  });

  it('limits verified party lookup to approved contractors and registered active producers with available parcels', async () => {
    prisma.contractor.findUnique.mockResolvedValue({ approvalStatus: 'APPROVED' });
    prisma.farmer.findMany.mockResolvedValue([]);
    await service.lookupContractParties('Abebe', { sub: 'contractor-owner', role: Role.CONTRACTOR });
    expect(prisma.farmer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        user: { is: expect.objectContaining({ isActive: true, role: Role.FARMER }) },
        parcels: { some: { isLocked: false } },
      }),
    }));
  });

  it('denies producer-directory lookup to non-contractor roles', async () => {
    await expect(service.lookupContractParties('Abebe', { sub: 'farmer-owner', role: Role.FARMER }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.farmer.findMany).not.toHaveBeenCalled();
  });

  it('records a version-specific acceptance from a registered contracting party', async () => {
    prisma.contractVersion.findFirst.mockResolvedValue({ id: 'version-1', version: 1 });
    await service.acceptChange(contract.id, { version: 1, accepted: true, comment: 'Reviewed terms' }, {
      sub: 'farmer-owner', role: Role.FARMER,
    });
    expect(prisma.contractChangeAcceptance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { contractId_version_userId: { contractId: contract.id, version: 1, userId: 'farmer-owner' } },
      create: expect.objectContaining({ accepted: true, comment: 'Reviewed terms' }),
    }));
  });

  it('stores negotiation comments against a specific clause for a contracting party', async () => {
    await service.addComment(contract.id, { body: 'Please clarify the delivery date.', clauseKey: 'delivery' }, {
      sub: 'farmer-owner', role: Role.FARMER,
    });
    expect(prisma.contractComment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ contractId: contract.id, authorId: 'farmer-owner', clauseKey: 'delivery' }),
    }));
  });

  it('saves a new draft version using the expected current version', async () => {
    prisma.contract.update.mockResolvedValue({ ...contract, content: { clauses: [] } });
    await service.saveDraft(contract.id, {
      content: { clauses: [{ key: 'price', text: 'New agreed price' }] },
      expectedVersion: 1,
      changeSummary: 'Clarified price term',
    }, { sub: 'contractor-owner', role: Role.CONTRACTOR });
    expect(prisma.contract.update).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: contract.id, status: 'DRAFT' }),
    }));
    expect(prisma.contractVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ contractId: contract.id, version: 2, createdById: 'contractor-owner' }),
    }));
  });

  it('rejects stale draft saves instead of overwriting a newer version', async () => {
    await expect(service.saveDraft(contract.id, { content: {}, expectedVersion: 0 }, {
      sub: 'contractor-owner', role: Role.CONTRACTOR,
    })).rejects.toThrow('This draft has changed since you opened it');
    expect(prisma.contract.update).not.toHaveBeenCalled();
  });

  it('rejects removal of mandatory approved-template clauses', async () => {
    prisma.contract.findUnique.mockResolvedValue({
      ...JSON.parse(JSON.stringify(contract)), templateId: 'template-1', updatedAt: new Date(),
    });
    prisma.contractTemplate.findUnique.mockResolvedValue({
      id: 'template-1', status: 'APPROVED',
      clauses: [{ key: 'purpose', title: 'Purpose', text: 'Fixed legal text', mandatory: true, editable: false }],
    });
    await expect(service.saveDraft(contract.id, { content: { clauses: [] }, expectedVersion: 1 }, {
      sub: 'contractor-owner', role: Role.CONTRACTOR,
    })).rejects.toThrow('Mandatory clause');
    expect(prisma.contract.update).not.toHaveBeenCalled();
  });

  it('rejects edits to locked clauses from an approved template', async () => {
    prisma.contract.findUnique.mockResolvedValue({
      ...JSON.parse(JSON.stringify(contract)), templateId: 'template-1', updatedAt: new Date(),
    });
    prisma.contractTemplate.findUnique.mockResolvedValue({
      id: 'template-1', status: 'APPROVED',
      clauses: [{ key: 'purpose', title: 'Purpose', text: 'Fixed legal text', mandatory: true, editable: false }],
    });
    await expect(service.saveDraft(contract.id, {
      content: { clauses: [{ key: 'purpose', title: 'Purpose', text: 'Changed legal text' }] }, expectedVersion: 1,
    }, { sub: 'contractor-owner', role: Role.CONTRACTOR })).rejects.toThrow('is locked by the approved template');
    expect(prisma.contract.update).not.toHaveBeenCalled();
  });

  it('does not allow sending a draft for signature until all parties accept the latest version', async () => {
    prisma.contractChangeAcceptance.findMany.mockResolvedValue([{ userId: 'contractor-owner' }]);
    await expect(service.sendForSignatures(contract.id, { sub: 'contractor-owner', role: Role.CONTRACTOR }))
      .rejects.toThrow('Every contracting party must accept the latest draft version');
    expect(prisma.contract.update).not.toHaveBeenCalled();
  });

  it('creates pending signatures for the producer parties and the authenticated contractor', async () => {
    prisma.contract.update.mockResolvedValue({ id: contract.id, status: 'PENDING_SIGNATURES' });
    await service.sendForSignatures(contract.id, { sub: 'contractor-owner', role: Role.CONTRACTOR });
    const updateArgs = prisma.contract.update.mock.calls[0][0];
    expect(updateArgs.data.signatures.create).toEqual([
      { signerId: 'farmer-owner', role: 'FARMER', status: 'PENDING' },
      { signerId: 'farmer-two', role: 'FARMER', status: 'PENDING' },
      { signerId: 'contractor-owner', role: 'CONTRACTOR', status: 'PENDING' },
    ]);
    expect(prisma.contractEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'SIGNATURES_REQUESTED', fromStatus: 'DRAFT', toStatus: 'PENDING_SIGNATURES' }),
    }));
  });

  it('does not allow an unrelated contractor to submit another party contract for signature', async () => {
    await expect(service.sendForSignatures(contract.id, {
      sub: 'different-contractor', role: Role.CONTRACTOR,
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.contract.update).not.toHaveBeenCalled();
  });

  it('does not allow an unrelated contractor to submit another party contract for approval', async () => {
    await expect(service.submitForApproval(contract.id, {
      sub: 'different-contractor', role: Role.CONTRACTOR,
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.contract.update).not.toHaveBeenCalled();
  });

  it('requires an approved template before a contractor can create a draft', async () => {
    prisma.contractor.findUnique.mockResolvedValue({ approvalStatus: 'APPROVED' });
    await expect(service.create({
      commodity: 'Wheat', quantity: 1, priceMechanism: 'MARKET', content: {},
      parties: [{ role: 'FARMER', farmerId: 'farmer-record-1' }], parcelIds: ['parcel-1'],
    } as any, { sub: 'contractor-owner', role: Role.CONTRACTOR })).rejects.toThrow('An approved contract template is required');
    expect(prisma.contract.create).not.toHaveBeenCalled();
  });

  it('rejects contract creation by non-contracting roles', async () => {
    await expect(service.create({} as any, { sub: 'farmer-owner', role: Role.FARMER }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.contract.create).not.toHaveBeenCalled();
  });

  it('rejects cooperative contract creation until organizational parties are represented in the schema', async () => {
    await expect(service.create({
      commodity: 'Wheat', quantity: 1, priceMechanism: 'MARKET', content: {},
      parties: [{ role: 'FARMER', farmerId: 'farmer-record-1' }],
    } as any, { sub: 'cooperative-owner', role: Role.COOPERATIVE })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.contract.create).not.toHaveBeenCalled();
  });

  it('limits the WBoA review queue to the reviewer region and woreda', async () => {
    await service.listReviewQueue({
      sub: 'wboa-reviewer', role: Role.WBOA_OFFICER, adminLevel: AdminLevel.WOREDA,
      region: 'Oromia', woreda: 'Ada',
    });
    expect(prisma.contract.findMany.mock.calls[0][0].where).toEqual({
      status: 'PENDING_APPROVAL', region: 'Oromia', woreda: 'Ada',
    });
  });

  it('requires a reason for return-for-correction decisions', async () => {
    prisma.contract.findUnique.mockResolvedValue({ ...contract, status: 'PENDING_APPROVAL' });
    await expect(service.approve(contract.id, 'RETURN_FOR_CORRECTION', '  ', {
      sub: 'wboa-reviewer', role: Role.WBOA_OFFICER, adminLevel: AdminLevel.WOREDA,
      region: 'Oromia', woreda: 'Ada',
    })).rejects.toThrow('A reason is required');
    expect(prisma.contract.update).not.toHaveBeenCalled();
  });

  it('records statutory return-for-correction decisions with jurisdiction metadata', async () => {
    prisma.contract.findUnique.mockResolvedValue({ ...contract, status: 'PENDING_APPROVAL' });
    prisma.contract.update.mockResolvedValue({ ...contract, status: 'RETURNED_FOR_CORRECTION' });
    await service.approve(contract.id, 'RETURN_FOR_CORRECTION', 'Correct the delivery terms', {
      sub: 'wboa-reviewer', role: Role.WBOA_OFFICER, adminLevel: AdminLevel.WOREDA,
      region: 'Oromia', woreda: 'Ada',
    });
    expect(prisma.contractReviewAction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'RETURN_FOR_CORRECTION', fromStatus: 'PENDING_APPROVAL',
        toStatus: 'RETURNED_FOR_CORRECTION', scopeRegion: 'Oromia', scopeWoreda: 'Ada',
      }),
    }));
  });

  it('returns only the authenticated user notifications', async () => {
    await service.listNotifications({ sub: 'farmer-owner', role: Role.FARMER }, true);
    expect(prisma.contractNotification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'farmer-owner', readAt: null },
    }));
  });

  it('creates a real milestone and appends a lifecycle event', async () => {
    prisma.contract.findUnique.mockResolvedValue({ ...contract, status: 'IN_EXECUTION' });
    await service.createMilestone(contract.id, { title: 'Deliver inputs', dueAt: '2026-11-01T00:00:00.000Z' }, {
      sub: 'contractor-owner', role: Role.CONTRACTOR,
    });
    expect(prisma.contractMilestone.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ contractId: contract.id, title: 'Deliver inputs', required: true }),
    }));
    expect(prisma.contractEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'MILESTONE_CREATED', actorId: 'contractor-owner' }),
    }));
  });

  it('checks current contract and version content hashes during integrity verification', async () => {
    const content = { clauses: [{ key: 'delivery', text: 'Deliver produce' }] };
    const hash = createHash('sha256').update(canonicalJson(content)).digest('hex');
    const intactContract = { ...contract, content, contentHash: hash };
    prisma.contract.findUnique.mockResolvedValue(intactContract);
    prisma.contractVersion.findMany.mockResolvedValue([{ id: 'version-1', contractId: contract.id, version: 1, content, hash, previousHash: null }]);
    prisma.contractAnnex.findMany.mockResolvedValue([]);
    prisma.contractEvent.findMany.mockResolvedValue([]);
    const result = await service.verifyIntegrity(contract.id, { sub: 'contractor-owner', role: Role.CONTRACTOR });
    expect(result.intact).toBe(true);
    expect(result.currentContentIntact).toBe(true);
    expect(result.versionIntegrity).toBe(true);
  });
});
