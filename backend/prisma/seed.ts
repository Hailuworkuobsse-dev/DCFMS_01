import { PrismaClient, Role, AdminLevel } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const pw = await bcrypt.hash('Password123!', 12);

  const admin = await prisma.user.upsert({
    where: { phone: '+251911000001' },
    update: {},
    create: {
      fullName: 'System Admin',
      phone: '+251911000001',
      email: 'admin@dcfms.et',
      passwordHash: pw,
      role: Role.SYSTEM_ADMIN,
      adminLevel: AdminLevel.FEDERAL,
    },
  });

  const moa = await prisma.user.upsert({
    where: { phone: '+251911000002' },
    update: {},
    create: {
      fullName: 'MoA Approver',
      phone: '+251911000002',
      email: 'moa@dcfms.et',
      passwordHash: pw,
      role: Role.MOA_OFFICER,
      adminLevel: AdminLevel.FEDERAL,
    },
  });

  const wboa = await prisma.user.upsert({
    where: { phone: '+251911000003' },
    update: {},
    create: {
      fullName: 'WBoA Officer - Adama',
      phone: '+251911000003',
      email: 'wboa@dcfms.et',
      passwordHash: pw,
      role: Role.WBOA_OFFICER,
      adminLevel: AdminLevel.WOREDA,
      region: 'Oromia',
      woreda: 'Adama',
    },
  });

  const farmerUser = await prisma.user.upsert({
    where: { phone: '+251911000004' },
    update: {},
    create: {
      fullName: 'Abebe Bekele',
      phone: '+251911000004',
      passwordHash: pw,
      role: Role.FARMER,
      adminLevel: AdminLevel.KEBELE,
      region: 'Oromia',
      woreda: 'Adama',
      kebele: 'Kebele 01',
    },
  });

  const farmer = await prisma.farmer.upsert({
    where: { userId: farmerUser.id },
    update: {},
    create: { userId: farmerUser.id, faydaFin: 'FIN-TEST-0001' },
  });

  const contractorUser = await prisma.user.upsert({
    where: { phone: '+251911000005' },
    update: {},
    create: {
      fullName: 'Acme Agri Exports',
      phone: '+251911000005',
      email: 'contractor@acme.et',
      passwordHash: pw,
      role: Role.CONTRACTOR,
      adminLevel: AdminLevel.FEDERAL,
    },
  });

  await prisma.contractor.upsert({
    where: { userId: contractorUser.id },
    update: {},
    create: {
      userId: contractorUser.id,
      licenseNo: 'LIC-ACME-001',
      tin: '1234567890',
      approvalStatus: 'APPROVED',
    },
  });

  const fiUser = await prisma.user.upsert({
    where: { phone: '+251911000006' },
    update: {},
    create: {
      fullName: 'CBE Loan Officer',
      phone: '+251911000006',
      email: 'fi@cbe.et',
      passwordHash: pw,
      role: Role.FI_OFFICER,
      adminLevel: AdminLevel.FEDERAL,
    },
  });

  console.log({ admin: admin.id, moa: moa.id, wboa: wboa.id, farmer: farmer.id, fiUser: fiUser.id });

  // Sample contract
  const existing = await prisma.contract.findFirst();
  if (!existing) {
    const content = { note: 'Seeded sample contract' };
    const contentHash = createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex');
    await prisma.contract.create({
      data: {
        contractNo: 'DCF-2026-000001',
        commodity: 'Malt Barley',
        quantity: 500,
        unit: 'quintal',
        quality: 'Grade A',
        priceMechanism: 'FIXED',
        fixedPrice: 3500,
        content,
        contentHash,
        createdById: contractorUser.id,
        status: 'DRAFT',
        region: 'Oromia',
        woreda: 'Adama',
        parties: {
          create: [{ role: 'CONTRACTOR' }, { role: 'FARMER', farmerId: farmer.id }],
        },
        versions: {
          create: [{ version: 1, content, hash: contentHash, createdById: contractorUser.id }],
        },
      },
    });
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
