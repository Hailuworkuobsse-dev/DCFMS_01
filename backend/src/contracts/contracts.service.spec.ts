import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContractsService } from './contracts.service';
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
      farmer: { id: 'farmer-record-2', userId: 'farmer-two', user: { id: 'farmer-two', region: 'Oromia', woreda: 'Ada', kebele: 'Kebele 02' }, cooperative: { userId: 'cooperative-owner' } },
    }],
    signatures: [],
    versions: [],
    payments: [{ id: 'payment-own', payerId: 'farmer-owner', payeeId: 'contractor-owner' }, { id: 'payment-other', payerId: 'farmer-two', payeeId: 'contractor-owner' }],
    loans: [{ id: 'loan-own', farmerId: 'farmer-record-1', fiId: 'fi-owner' }, { id: 'loan-other', farmerId: 'farmer-record-2', fiId: 'other-fi' }],
    vouchers: [{ id: 'voucher-own', farmerId: 'farmer-record-1', agroDealerId: 'dealer-owner' }, { id: 'voucher-other', farmerId: 'farmer-record-2', agroDealerId: 'other-dealer' }],
  };

  let prisma: any;
  let service: ContractsService;

  beforeEach(() => {
    prisma = {
      contract: {
        findUnique: jest.fn().mockImplementation(async () => JSON.parse(JSON.stringify(contract))),
        findMany: jest.fn().mockResolvedValue([contract]),
        create: jest.fn(),
        update: jest.fn(),
      },
      contractor: { findUnique: jest.fn() },
      cooperative: { findUnique: jest.fn() },
      farmer: { findMany: jest.fn().mockResolvedValue([{ id: 'farmer-record-1', user: { region: 'Oromia', woreda: 'Ada' } }]) },
      parcel: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
    };
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

  it('rejects contract creation by non-contracting roles', async () => {
    await expect(service.create({} as any, { sub: 'farmer-owner', role: Role.FARMER }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.contract.create).not.toHaveBeenCalled();
  });

  it('does not let a cooperative attach a non-member producer record', async () => {
    prisma.cooperative.findUnique.mockResolvedValue({ id: 'coop-1', userId: 'cooperative-owner' });
    prisma.farmer.findMany.mockResolvedValue([]);
    await expect(service.create({
      commodity: 'Wheat', quantity: 1, priceMechanism: 'MARKET', content: {},
      parties: [{ role: 'FARMER', farmerId: 'non-member-farmer' }],
    } as any, { sub: 'cooperative-owner', role: Role.COOPERATIVE })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.contract.create).not.toHaveBeenCalled();
  });
});
