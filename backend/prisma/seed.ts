import { PrismaClient, Role, AdminLevel, ContractStatus, SignatureStatus, SignatureMethod, LoanStatus, VoucherStatus, GrievanceStatus, GrievanceCategory, MonitoringType, PaymentStatus, AuditAction, ContractTemplateStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

const prisma = new PrismaClient();
const DEMO_PASSWORD = process.env.DCFMS_DEMO_PASSWORD || 'Password123!';
const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scopes = {
  federal: { adminLevel: AdminLevel.FEDERAL, region: 'Addis Ababa', zone: 'Central', woreda: 'Federal', kebele: 'Federal' },
  regional: { adminLevel: AdminLevel.REGIONAL, region: 'Oromia', zone: 'East Shewa', woreda: 'Adama', kebele: 'Kebele 01' },
  woreda: { adminLevel: AdminLevel.WOREDA, region: 'Oromia', zone: 'East Shewa', woreda: 'Adama', kebele: 'Kebele 01' },
  kebele: { adminLevel: AdminLevel.KEBELE, region: 'Oromia', zone: 'East Shewa', woreda: 'Adama', kebele: 'Kebele 01' },
};
const roleDefs = [
  { role: Role.SYSTEM_ADMIN, slug: 'system-admin', label: 'System Administrator', scope: 'federal', email: 'admin@dcfms.et', phone: '+251911000001', name: 'System Admin' },
  { role: Role.MOA_OFFICER, slug: 'moa', label: 'MoA Officer', scope: 'federal', email: 'moa@dcfms.et', phone: '+251911000002', name: 'MoA Approver' },
  { role: Role.RBOA_OFFICER, slug: 'rboa', label: 'Regional Agriculture Officer', scope: 'regional' },
  { role: Role.WBOA_OFFICER, slug: 'wboa', label: 'Woreda Agriculture Officer', scope: 'woreda', email: 'wboa@dcfms.et', phone: '+251911000003', name: 'WBoA Officer - Adama' },
  { role: Role.MOTRI_OFFICER, slug: 'motri', label: 'Trade and Regional Integration Officer', scope: 'federal' },
  { role: Role.ECC_OFFICER, slug: 'ecc', label: 'Competition Commission Officer', scope: 'federal' },
  { role: Role.EAA_OFFICER, slug: 'eaa', label: 'Agricultural Authority Officer', scope: 'federal' },
  { role: Role.RESOLUTION_OFFICER, slug: 'resolution', label: 'Dispute Resolution Officer', scope: 'woreda' },
  { role: Role.CONTRACTOR, slug: 'contractor', label: 'Agricultural Contractor', scope: 'regional', email: 'contractor@acme.et', phone: '+251911000005', name: 'Acme Agri Exports' },
  { role: Role.FARMER, slug: 'farmer', label: 'Smallholder Farmer', scope: 'kebele', phone: '+251911000004', name: 'Abebe Bekele' },
  { role: Role.COOPERATIVE, slug: 'cooperative', label: 'Farmers Cooperative', scope: 'woreda' },
  { role: Role.FI_OFFICER, slug: 'fi', label: 'Financial Institution Officer', scope: 'federal', email: 'fi@cbe.et', phone: '+251911000006', name: 'CBE Loan Officer' },
  { role: Role.AGRO_DEALER, slug: 'agrodealer', label: 'Agricultural Input Dealer', scope: 'woreda' },
  { role: Role.FIELD_AGENT, slug: 'fieldagent', label: 'Field Agent', scope: 'woreda' },
  { role: Role.AUDITOR, slug: 'auditor', label: 'Independent Auditor', scope: 'federal' },
  { role: Role.SUPPORT_AGENT, slug: 'support', label: 'Platform Support Agent', scope: 'federal' },
] as const;
const firstNames = ['Abebe','Almaz','Dawit','Hana','Kebede','Mekdes','Tadesse','Selam','Biruk','Rahel','Yonas','Liya'];
const lastNames = ['Bekele','Tadesse','Worku','Tesfaye','Kassa','Girma','Alemu','Hailu','Desta','Mulugeta','Kebede','Demissie'];
const crops = [
  { name: 'Malt Barley', unit: 'quintal', price: 3500 },
  { name: 'Wheat', unit: 'quintal', price: 3200 },
  { name: 'Maize', unit: 'quintal', price: 2800 },
  { name: 'Coffee', unit: 'kg', price: 450 },
  { name: 'Sesame', unit: 'quintal', price: 7200 },
  { name: 'Soybean', unit: 'quintal', price: 4100 },
  { name: 'Teff', unit: 'quintal', price: 5200 },
  { name: 'Chickpea', unit: 'quintal', price: 6000 },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const byRole = new Map<Role, any[]>();
  const allUsers: any[] = [];
  let phoneCounter = 7;

  // Four users for every backend Role enum value: 16 roles / 64 demo accounts.
  for (let r = 0; r < roleDefs.length; r++) {
    const def = roleDefs[r];
    const users = [];
    for (let j = 0; j < 4; j++) {
      const scope = scopes[def.scope];
      const email = j === 0 && 'email' in def && def.email ? def.email : `${def.slug}${j + 1}@dcfms.et`;
      const phone = j === 0 && 'phone' in def && def.phone ? def.phone : `+251911${String(phoneCounter++).padStart(6, '0')}`;
      const fullName = j === 0 && 'name' in def && def.name ? def.name : `${firstNames[(r * 4 + j) % firstNames.length]} ${lastNames[(r * 3 + j) % lastNames.length]} (${def.label} ${j + 1})`;
      const user = await prisma.user.upsert({
        where: { phone },
        update: { email, passwordHash, fullName, role: def.role, adminLevel: scope.adminLevel, region: scope.region, zone: scope.zone, woreda: scope.woreda, kebele: scope.kebele, isActive: true },
        create: { email, phone, passwordHash, fullName, role: def.role, adminLevel: scope.adminLevel, region: scope.region, zone: scope.zone, woreda: scope.woreda, kebele: scope.kebele, isActive: true },
      });
      users.push(user); allUsers.push(user);
    }
    byRole.set(def.role, users);
  }

  const cooperatives = [];
  for (let i = 0; i < 4; i++) {
    const u = byRole.get(Role.COOPERATIVE)![i];
    cooperatives.push(await prisma.cooperative.upsert({
      where: { userId: u.id },
      update: { registrationNo: `COOP-OR-${String(i + 1).padStart(4, '0')}`, region: u.region || 'Oromia', woreda: u.woreda || 'Adama' },
      create: { userId: u.id, registrationNo: `COOP-OR-${String(i + 1).padStart(4, '0')}`, region: u.region || 'Oromia', woreda: u.woreda || 'Adama' },
    }));
  }
  for (let i = 0; i < 4; i++) {
    const u = byRole.get(Role.CONTRACTOR)![i];
    await prisma.contractor.upsert({
      where: { userId: u.id },
      update: { licenseNo: `LIC-DCFMS-${i + 1}`, tin: `10000000${String(i + 1).padStart(2, '0')}`, approvalStatus: i === 1 ? 'PENDING' : 'APPROVED', businessPlan: 'DEMO business plan', guaranteeProof: `DEMO-GUARANTEE-${i + 1}` },
      create: { userId: u.id, licenseNo: `LIC-DCFMS-${i + 1}`, tin: `10000000${String(i + 1).padStart(2, '0')}`, approvalStatus: i === 1 ? 'PENDING' : 'APPROVED', businessPlan: 'DEMO business plan', guaranteeProof: `DEMO-GUARANTEE-${i + 1}` },
    });
  }
  const farmerUsers = byRole.get(Role.FARMER)!;
  const farmers = [];
  for (let i = 0; i < 4; i++) {
    farmers.push(await prisma.farmer.upsert({
      where: { userId: farmerUsers[i].id },
      update: { faydaFin: i === 0 ? '123456789012' : `1234567890${String(i + 12)}`, faydaFan: `FAN-DEMO-${i + 1}`, cooperativeId: cooperatives[i].id },
      create: { userId: farmerUsers[i].id, faydaFin: i === 0 ? '123456789012' : `1234567890${String(i + 12)}`, faydaFan: `FAN-DEMO-${i + 1}`, cooperativeId: cooperatives[i].id },
    }));
  }

  const templateId = id(9001);
  await prisma.contractTemplate.upsert({
    where: { id: templateId },
    update: { title: 'DCFMS Demo Crop Offtake Agreement', description: 'Synthetic development fixture only.', commodity: 'Mixed Crops', language: 'en', version: 1, clauses: { sections: ['parties','commodity','quantity','quality','pricing','delivery','dispute resolution'] }, status: ContractTemplateStatus.APPROVED },
    create: { id: templateId, title: 'DCFMS Demo Crop Offtake Agreement', description: 'Synthetic development fixture only.', commodity: 'Mixed Crops', language: 'en', version: 1, clauses: { sections: ['parties','commodity','quantity','quality','pricing','delivery','dispute resolution'] }, status: ContractTemplateStatus.APPROVED, createdById: byRole.get(Role.SYSTEM_ADMIN)![0].id, approvedById: byRole.get(Role.MOA_OFFICER)![0].id, approvedAt: new Date('2026-01-10T09:00:00Z') },
  });

  const statuses = [ContractStatus.DRAFT, ContractStatus.PENDING_SIGNATURES, ContractStatus.SIGNED, ContractStatus.PENDING_APPROVAL, ContractStatus.APPROVED, ContractStatus.IN_EXECUTION, ContractStatus.COMPLETED, ContractStatus.ADJUSTED, ContractStatus.REJECTED, ContractStatus.RETURNED_FOR_CORRECTION, ContractStatus.CANCELLED];
  const contracts: any[] = [];
  for (let i = 0; i < 16; i++) {
    const farmer = farmers[i % 4], farmerUser = farmerUsers[i % 4], contractor = byRole.get(Role.CONTRACTOR)![i % 4], coop = cooperatives[i % 4], crop = crops[i % crops.length];
    const contractNo = `DCF-DEMO-2026-${String(i + 1).padStart(4, '0')}`;
    const content = { demoData: true, title: `${crop.name} supply agreement ${i + 1}`, commodity: crop.name, agreedPriceEtbPerQt: crop.price, quantity: 120 + i * 25, unit: crop.unit, farmerUserId: farmerUser.id, cooperativeId: coop.id, contractorUserId: contractor.id, deliveryTerms: 'Synthetic fixture; not a legal agreement.' };
    const contentHash = sha(content), status = statuses[i % statuses.length];
    const hasApproval = status === ContractStatus.APPROVED || status === ContractStatus.IN_EXECUTION || status === ContractStatus.COMPLETED;
    await prisma.contract.upsert({
      where: { contractNo },
      update: { templateId, commodity: crop.name, quantity: 120 + i * 25, unit: crop.unit, quality: i % 2 ? 'Grade B' : 'Grade A', priceMechanism: i % 2 ? 'MARKET' : 'FIXED', fixedPrice: crop.price, content, contentHash, region: farmerUser.region, woreda: farmerUser.woreda, status },
      create: {
        contractNo, templateId, commodity: crop.name, quantity: 120 + i * 25, unit: crop.unit,
        quality: i % 2 ? 'Grade B' : 'Grade A', priceMechanism: i % 2 ? 'MARKET' : 'FIXED',
        fixedPrice: crop.price, deliveryStart: new Date(Date.UTC(2026, 0, i + 1)), deliveryEnd: new Date(Date.UTC(2026, 5, i + 1)),
        content, contentHash, region: farmerUser.region, woreda: farmerUser.woreda, createdById: contractor.id,
        approvedById: hasApproval ? byRole.get(Role.WBOA_OFFICER)![i % 4].id : null,
        approvedAt: hasApproval ? new Date(Date.UTC(2026, 1, i + 1)) : null,
        status,
        parties: { create: [{ role: 'CONTRACTOR' }, { role: 'FARMER', farmerId: farmer.id }, { role: 'COOPERATIVE' }] },
        versions: { create: [{ version: 1, content, hash: contentHash, createdById: contractor.id }, ...(i % 3 === 0 ? [{ version: 2, content: { ...content, versionNote: 'Demo amendment' }, hash: sha({ ...content, versionNote: 'Demo amendment' }), createdById: contractor.id }] : [])] },
      },
    });
    const contract = await prisma.contract.findUniqueOrThrow({ where: { contractNo } });
    contracts.push(contract);

    for (let p = 0; p < 2; p++) {
      const parcelId = id(100 + i * 2 + p);
      await prisma.parcel.upsert({
        where: { id: parcelId },
        update: { farmerId: farmer.id, name: `Demo parcel ${i + 1}-${p + 1}`, sizeHa: 1.5 + i * 0.25 + p * 0.5, crop: crop.name, season: '2026 Meher', contractId: p === 0 ? contract.id : null, isLocked: p === 0 && (status === ContractStatus.APPROVED || status === ContractStatus.IN_EXECUTION) },
        create: { id: parcelId, farmerId: farmer.id, name: `Demo parcel ${i + 1}-${p + 1}`, sizeHa: 1.5 + i * 0.25 + p * 0.5, gpsPolygon: `DEMO-GPS-${i + 1}-${p + 1}`, crop: crop.name, season: '2026 Meher', contractId: p === 0 ? contract.id : null, isLocked: p === 0 && [ContractStatus.APPROVED, ContractStatus.IN_EXECUTION].includes(status) },
      });
    }

    for (let p = 0; p < 2; p++) {
      const signer = p === 0 ? farmerUser : contractor, signatureId = id(1000 + i * 2 + p), signed = (i + p) % 3 === 0;
      const signatureHash = signed ? sha({ demo: true, contractNo, signer: signer.id, p }) : null;
      const signatureData = { contractId: contract.id, signerId: signer.id, role: p === 0 ? 'FARMER' : 'CONTRACTOR', method: SignatureMethod.OTP, status: signed ? SignatureStatus.SIGNED : SignatureStatus.PENDING, signatureHash, contentHashAtSigning: signed ? contentHash : null, otpVerifiedAt: signed ? new Date(Date.UTC(2026, 2, i + 1)) : null, authorityVerified: signed, signedAt: signed ? new Date(Date.UTC(2026, 2, i + 1)) : null, ipAddress: '192.0.2.10', deviceInfo: 'Synthetic DCFMS seed' };
      await prisma.signature.upsert({ where: { id: signatureId }, update: signatureData, create: { id: signatureId, ...signatureData } });
    }

    const commentId = id(2000 + i), comment = { contractId: contract.id, authorId: contractor.id, clauseKey: 'delivery', body: `DEMO comment for ${contractNo}: confirm delivery schedule.` };
    await prisma.contractComment.upsert({ where: { id: commentId }, update: comment, create: { id: commentId, ...comment } });
    const annexId = id(3000 + i), annex = { contractId: contract.id, title: 'Demo production plan', description: 'Synthetic annex for relationship testing.', content: { crop: crop.name, acreage: 2 + i }, fileName: `demo-plan-${i + 1}.json`, mimeType: 'application/json', checksum: sha({ contractNo, annex: i }), createdById: contractor.id };
    await prisma.contractAnnex.upsert({ where: { id: annexId }, update: annex, create: { id: annexId, ...annex } });
    if (i % 2 === 0) {
      const reviewId = id(4000 + i), review = { contractId: contract.id, reviewerId: byRole.get(Role.WBOA_OFFICER)![i % 4].id, reviewerRole: 'WBOA_OFFICER', action: 'APPROVE', note: 'DEMO review record; verify scope and transitions.', fromStatus: 'PENDING_APPROVAL', toStatus: 'APPROVED', scopeRegion: farmerUser.region, scopeWoreda: farmerUser.woreda };
      await prisma.contractReviewAction.upsert({ where: { id: reviewId }, update: review, create: { id: reviewId, ...review } });
    }

    const loanNo = `LOAN-DEMO-2026-${String(i + 1).padStart(4, '0')}`, loanStatus = [LoanStatus.SUBMITTED, LoanStatus.UNDER_REVIEW, LoanStatus.APPROVED, LoanStatus.DISBURSED, LoanStatus.REPAYING, LoanStatus.CLOSED][i % 6];
    const loanApproved = loanStatus === LoanStatus.APPROVED || loanStatus === LoanStatus.DISBURSED || loanStatus === LoanStatus.REPAYING || loanStatus === LoanStatus.CLOSED;
    const loan = { farmerId: farmer.id, contractId: contract.id, fiId: byRole.get(Role.FI_OFFICER)![i % 4].id, requestedAmt: 25000 + i * 3500, approvedAmt: loanApproved ? 20000 + i * 3000 : null, interestRate: 12.5, status: loanStatus, purpose: `Seasonal ${crop.name} inputs; demo data.`, decidedAt: loanStatus === LoanStatus.SUBMITTED ? null : new Date(Date.UTC(2026, 1, i + 1)), decisionNote: loanStatus === LoanStatus.SUBMITTED ? null : 'Synthetic decision for testing.' };
    await prisma.loan.upsert({ where: { loanNo }, update: loan, create: { loanNo, ...loan } });

    const voucherNo = `VCH-DEMO-2026-${String(i + 1).padStart(4, '0')}`, voucherStatus = i % 4 === 0 ? VoucherStatus.REDEEMED : i % 4 === 1 ? VoucherStatus.EXPIRED : VoucherStatus.ISSUED;
    const voucher = { farmerId: farmer.id, contractId: contract.id, inputType: i % 2 ? 'FERTILIZER' : 'CERTIFIED_SEED', amount: 100 + i * 10, unit: 'kg', valueEtb: 5000 + i * 750, dealerOrgId: `DEMO-DEALER-ORG-${(i % 4) + 1}`, agroDealerId: byRole.get(Role.AGRO_DEALER)![i % 4].id, status: voucherStatus, expiresAt: new Date('2027-01-01T00:00:00Z'), redeemedAt: voucherStatus === VoucherStatus.REDEEMED ? new Date(Date.UTC(2026, 3, i + 1)) : null };
    await prisma.voucher.upsert({ where: { voucherNo }, update: voucher, create: { voucherNo, ...voucher } });

    const paymentNo = `PAY-DEMO-2026-${String(i + 1).padStart(4, '0')}`, grossAmount = (120 + i * 25) * crop.price, paymentStatus = [PaymentStatus.PENDING, PaymentStatus.PROCESSING, PaymentStatus.COMPLETED][i % 3];
    const payment = { contractId: contract.id, payerId: contractor.id, payeeId: farmerUser.id, deliveredKg: (120 + i * 25) * 100, grossAmount, loanDeduction: i % 2 ? 1500 : 0, netAmount: grossAmount - (i % 2 ? 1500 : 0), status: paymentStatus, channel: i % 2 ? 'MOBILE_MONEY' : 'BANK', externalRef: paymentStatus === PaymentStatus.COMPLETED ? `DEMO-TXN-${i + 1}` : null, processedAt: paymentStatus === PaymentStatus.COMPLETED ? new Date(Date.UTC(2026, 4, i + 1)) : null };
    await prisma.payment.upsert({ where: { paymentNo }, update: payment, create: { paymentNo, ...payment } });

    const monitorId = id(5000 + i), monitoring = { contractId: contract.id, type: [MonitoringType.FIELD_VISIT, MonitoringType.INPUT_DISTRIBUTION, MonitoringType.PRODUCTION_PROGRESS, MonitoringType.COMPLIANCE][i % 4], agentId: byRole.get(Role.FIELD_AGENT)![i % 4].id, farmerId: farmer.id, gpsLat: 8.54 + i * 0.002, gpsLng: 39.27 + i * 0.002, findings: { demo: true, crop: crop.name, observation: i % 2 ? 'Needs follow-up' : 'On track', actionRequired: i % 2 === 1 }, score: 60 + (i % 5) * 8 };
    await prisma.monitoringReport.upsert({ where: { id: monitorId }, update: monitoring, create: { id: monitorId, ...monitoring } });

    const ticketNo = `GRV-DEMO-2026-${String(i + 1).padStart(4, '0')}`, grievanceStatus = [GrievanceStatus.OPEN, GrievanceStatus.IN_REVIEW, GrievanceStatus.ESCALATED, GrievanceStatus.RESOLVED][i % 4];
    const grievance = { category: [GrievanceCategory.CONTRACT_TERMS, GrievanceCategory.PAYMENT, GrievanceCategory.INPUT_QUALITY, GrievanceCategory.DELIVERY, GrievanceCategory.OTHER][i % 5], title: `Demo ${crop.name} case ${i + 1}`, severity: i % 3 === 0 ? 'HIGH' : 'MEDIUM', description: 'Synthetic grievance for authorization and workflow testing.', raisedById: farmerUser.id, raisedByFarmerId: farmer.id, contractId: contract.id, status: grievanceStatus, assignedToId: byRole.get(Role.RESOLUTION_OFFICER)![i % 4].id, slaDueAt: new Date('2026-12-31T00:00:00Z'), resolutionNote: grievanceStatus === GrievanceStatus.RESOLVED ? 'Demo resolution: delivery review agreed.' : null, resolvedAt: grievanceStatus === GrievanceStatus.RESOLVED ? new Date(Date.UTC(2026, 5, i + 1)) : null };
    await prisma.grievance.upsert({ where: { ticketNo }, update: grievance, create: { ticketNo, ...grievance } });

    const acceptanceId = id(6000 + i), acceptance = { contractId: contract.id, version: 1, userId: farmerUser.id, accepted: i % 2 === 0, comment: 'DEMO version acceptance; not a legal signature.' };
    await prisma.contractChangeAcceptance.upsert({ where: { id: acceptanceId }, update: acceptance, create: { id: acceptanceId, ...acceptance } });
  }

  for (let i = 0; i < allUsers.length; i++) {
    const u = allUsers[i], auditId = id(7000 + i), audit = { actorId: u.id, action: i % 2 ? AuditAction.VIEW_SENSITIVE : AuditAction.LOGIN, entity: 'DEMO_SEED', entityId: u.id, after: { demo: true, role: u.role, seedBatch: '2026-10' }, ipAddress: '192.0.2.20', userAgent: 'DCFMS demo seeder', result: 'SUCCESS', createdAt: new Date(Date.UTC(2026, 9, 1 + (i % 27))) };
    await prisma.auditLog.upsert({ where: { id: auditId }, update: audit, create: { id: auditId, ...audit } });
  }

  console.log('Seed complete: 64 demo users (4 for each of 16 backend roles). Shared password:', DEMO_PASSWORD);
  console.log(await Promise.all([
    prisma.user.count().then(users => ({ users })),
    prisma.farmer.count().then(farmers => ({ farmers })),
    prisma.cooperative.count().then(cooperatives => ({ cooperatives })),
    prisma.contractor.count().then(contractors => ({ contractors })),
    prisma.contract.count().then(contracts => ({ contracts })),
    prisma.parcel.count().then(parcels => ({ parcels })),
    prisma.signature.count().then(signatures => ({ signatures })),
    prisma.loan.count().then(loans => ({ loans })),
    prisma.voucher.count().then(vouchers => ({ vouchers })),
    prisma.payment.count().then(payments => ({ payments })),
    prisma.monitoringReport.count().then(monitoringReports => ({ monitoringReports })),
    prisma.grievance.count().then(grievances => ({ grievances })),
    prisma.contractTemplate.count().then(templates => ({ templates })),
    prisma.contractComment.count().then(comments => ({ comments })),
    prisma.contractAnnex.count().then(annexes => ({ annexes })),
    prisma.contractReviewAction.count().then(reviewActions => ({ reviewActions })),
    prisma.contractChangeAcceptance.count().then(changeAcceptances => ({ changeAcceptances })),
    prisma.auditLog.count().then(auditLogs => ({ auditLogs })),
  ]));
  console.warn('Synthetic development fixtures only. Do not use demo credentials/data in production.');
}

main().catch(error => {
  console.error('DCFMS demo seed failed:', error);
  process.exitCode = 1;
}).finally(async () => { await prisma.$disconnect(); });
