/**
 * backendAdapter.ts — BFF integration layer between the DCFMS frontend server
 * (Express, cookie sessions, mock-shaped JSON) and the real NestJS backend
 * (/api/v1, Bearer JWT, {success,data} envelope, Prisma shapes).
 *
 * Every function here returns the EXACT response bodies the frontend client
 * (src/lib/api/client.ts) expects, so no React code needs to change.
 *
 * Enable/disable with BACKEND_ENABLED (default true) and point at the API
 * with BACKEND_URL (default http://localhost:3151/api/v1).
 */
import crypto from 'node:crypto';
import type {
  AuditLogEntry,
  AuthUser,
  Contract,
  ContractStatus,
  DashboardKPI,
  GrievanceCase,
  InputVoucher,
  LoanApplication,
  MonitoringReport,
  PermissionResource,
  PermissionScope,
  RoleId,
  ScopedRoleAssignment,
  SettlementRecord,
} from '../types/api';
import { ROLE_REGISTRY } from '../lib/rbac/roles';
import type {
  ContractWizardInput,
  GrievanceIntakeInput,
  LoanApplicationInput,
  MonitoringReportInput,
  VoucherIssueInput,
} from '../lib/validation/schemas';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:3151/api/v1').replace(/\/$/, '');
const BACKEND_ENABLED = (process.env.BACKEND_ENABLED ?? 'true') !== 'false';

export function backendEnabled(): boolean {
  return BACKEND_ENABLED;
}

export function backendUrl(): string {
  return BACKEND_URL;
}

// ---------------------------------------------------------------------------
// Errors — mapped to the frontend's { code, message, messageKey, fieldErrors }
// ---------------------------------------------------------------------------

export class BackendApiError extends Error {
  status: number;
  code: string;
  messageKey?: string;
  fieldErrors?: Record<string, string>;
  issues?: unknown;

  constructor(
    status: number,
    code: string,
    message?: string,
    messageKey?: string,
    fieldErrors?: Record<string, string>,
    issues?: unknown
  ) {
    super(message ?? code);
    this.name = 'BackendApiError';
    this.status = status;
    this.code = code;
    this.messageKey = messageKey;
    this.fieldErrors = fieldErrors;
    this.issues = issues;
  }
}

export function toErrorResponse(e: unknown): { status: number; body: Record<string, unknown> } {
  if (e instanceof BackendApiError) {
    return {
      status: e.status,
      body: {
        code: e.code,
        ...(e.message ? { message: e.message } : {}),
        ...(e.messageKey ? { messageKey: e.messageKey } : {}),
        ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}),
        ...(e.issues ? { issues: e.issues } : {}),
      },
    };
  }
  return {
    status: 500,
    body: { code: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Unexpected error' },
  };
}

// ---------------------------------------------------------------------------
// Session + low-level request plumbing (Bearer JWT, auto-refresh, envelope)
// ---------------------------------------------------------------------------

export interface BackendSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface RawRequestOptions {
  method: string;
  body?: unknown;
  token?: string;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query?: RawRequestOptions['query']): string {
  const url = `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

function mapBackendError(status: number, body: any): BackendApiError {
  const rawMessage = body?.message;
  if (Array.isArray(rawMessage)) {
    return new BackendApiError(
      status,
      'VALIDATION_ERROR',
      rawMessage[0],
      'errors.validationFailed',
      { form: rawMessage.join('; ') },
      rawMessage
    );
  }
  const message = typeof rawMessage === 'string' ? rawMessage : undefined;
  switch (status) {
    case 400:
      return new BackendApiError(400, 'INVALID_STATE', message ?? 'Bad request');
    case 401:
      return new BackendApiError(401, 'UNAUTHORIZED', message, 'errors.unauthorized');
    case 403:
      return new BackendApiError(403, 'FORBIDDEN', message, 'errors.forbidden');
    case 404:
      return new BackendApiError(404, 'NOT_FOUND', message, 'states.notFoundTitle');
    case 409:
      return new BackendApiError(409, 'CONFLICT', message ?? 'Conflict');
    case 422:
      return new BackendApiError(422, 'VALIDATION_ERROR', message, 'errors.validationFailed');
    default:
      return new BackendApiError(status, 'BACKEND_ERROR', message ?? `Backend error ${status}`);
  }
}

async function rawRequest<T = any>(path: string, opts: RawRequestOptions): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let payload: string | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), { method: opts.method, headers, body: payload });
  } catch {
    throw new BackendApiError(
      503,
      'BACKEND_UNAVAILABLE',
      `DCFMS backend unreachable at ${BACKEND_URL}`,
      'errors.authUnavailable'
    );
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw mapBackendError(res.status, json);
  }
  // Unwrap the backend's { success, data } envelope
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
}

/** Authenticated request with one automatic refresh retry on 401. */
export async function apiRequest<T = any>(
  sess: BackendSession,
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | undefined>
): Promise<T> {
  try {
    return await rawRequest<T>(path, { method, body, token: sess.accessToken, query });
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 401 && sess.refreshToken) {
      const tokens = await rawRequest<{ accessToken: string; refreshToken: string }>(
        '/auth/refresh',
        { method: 'POST', body: { refreshToken: sess.refreshToken } }
      );
      sess.accessToken = tokens.accessToken;
      sess.refreshToken = tokens.refreshToken;
      return await rawRequest<T>(path, { method, body, token: sess.accessToken, query });
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Role / status mapping
// ---------------------------------------------------------------------------

const ROLE_MAP: Record<string, RoleId> = {
  SYSTEM_ADMIN: 'SystemAdmin',
  MOA_OFFICER: 'MoAFederal',
  RBOA_OFFICER: 'RBoARegional',
  WBOA_OFFICER: 'WBoAWoreda',
  MOTRI_OFFICER: 'MoTRIOfficer',
  ECC_OFFICER: 'ECCOfficer',
  EAA_OFFICER: 'EAAOfficer',
  RESOLUTION_OFFICER: 'JusticeOfficer',
  CONTRACTOR: 'Contractor',
  FARMER: 'ProducerIndividual',
  COOPERATIVE: 'ProducerCooperative',
  FI_OFFICER: 'FinancialInstitution',
  AGRO_DEALER: 'AgroDealer',
  FIELD_AGENT: 'FieldAgent',
  AUDITOR: 'Auditor',
  SUPPORT_AGENT: 'FieldAgent',
};

const ADMIN_LEVEL_SCOPE: Record<string, PermissionScope> = {
  FEDERAL: 'federal',
  REGIONAL: 'region',
  ZONAL: 'zonal',
  WOREDA: 'woreda',
  KEBELE: 'kebele',
};

const VALUE_CHAIN_ROLES: RoleId[] = [
  'Contractor',
  'ProducerIndividual',
  'ProducerCooperative',
  'FinancialInstitution',
  'Insurer',
  'AgroDealer',
  'FieldAgent',
];

const CONTRACT_STATUS_MAP: Record<string, ContractStatus> = {
  DRAFT: 'Draft',
  PENDING_SIGNATURES: 'PENDING_SIGNATURE',
  SIGNED: 'Signed',
  // Keep showing the WBoA endorse action while approval is pending
  PENDING_APPROVAL: 'Signed',
  APPROVED: 'Approved',
  IN_EXECUTION: 'ACTIVE',
  COMPLETED: 'Completed',
  ADJUSTED: 'Adjusted',
  REJECTED: 'Rejected',
  CANCELLED: 'TERMINATED',
};

const VOUCHER_STATUS_MAP: Record<string, InputVoucher['status']> = {
  ISSUED: 'Issued',
  REDEEMED: 'Redeemed',
  EXPIRED: 'Expired',
  CANCELLED: 'CANCELLED',
};

const LOAN_STATUS_MAP: Record<string, LoanApplication['status']> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'UnderAssessment',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DISBURSED: 'Disbursed',
  REPAYING: 'ACTIVE',
  CLOSED: 'Completed',
  DEFAULTED: 'PENDING',
};

const SETTLEMENT_STATUS_MAP: Record<string, SettlementRecord['status']> = {
  PENDING: 'PENDING',
  PROCESSING: 'PENDING',
  COMPLETED: 'SETTLED',
  FAILED: 'PENDING',
  REVERSED: 'PENDING',
};

const GRIEVANCE_STATUS_MAP: Record<string, GrievanceCase['status']> = {
  OPEN: 'Submitted',
  IN_REVIEW: 'InMediation',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Resolved',
};

const GRIEVANCE_LEVEL_MAP: Record<string, GrievanceCase['escalationLevel']> = {
  OPEN: 'ContractorTier',
  IN_REVIEW: 'WoredaCommittee',
  ESCALATED: 'RegionalPanel',
  RESOLVED: 'WoredaCommittee',
  CLOSED: 'WoredaCommittee',
};

const GRIEVANCE_CATEGORY_LABEL: Record<string, string> = {
  CONTRACT_TERMS: 'Contract Terms',
  PAYMENT: 'Payment Delay',
  INPUT_QUALITY: 'Input Quality',
  DELIVERY: 'Delivery & Logistics',
  OTHER: 'Other',
};

const CHANNEL_TO_BACKEND: Record<SettlementRecord['disbursementChannel'], string> = {
  Telebirr: 'MOBILE_MONEY',
  CBE_Birr: 'BANK',
  Bank_Transfer: 'BANK',
};

const CHANNEL_FROM_BACKEND: Record<string, SettlementRecord['disbursementChannel']> = {
  BANK: 'Bank_Transfer',
  MOBILE_MONEY: 'Telebirr',
  USSD: 'CBE_Birr',
};

/** Static financial-institution registry until the backend exposes one. TODO(integration) */
const FI_DIRECTORY: Array<{ orgId: string; orgName: string }> = [
  { orgId: 'CBE', orgName: 'Commercial Bank of Ethiopia' },
  { orgId: 'COOP', orgName: 'Cooperative Bank of Ethiopia' },
  { orgId: 'AWASH', orgName: 'Awash Bank' },
  { orgId: 'DASHEN', orgName: 'Dashen Bank' },
];

const ENTITY_RESOURCE_MAP: Record<string, PermissionResource> = {
  Contract: 'contract',
  Loan: 'loan',
  Voucher: 'input_voucher',
  Payment: 'settlement',
  Grievance: 'grievance',
  MonitoringReport: 'monitoring',
  User: 'user',
  Auth: 'user',
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function iso(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const d = new Date(v as string | number | Date);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function reqIso(v: unknown): string {
  return iso(v) ?? new Date().toISOString();
}

function mapRoleId(backendRole: string | null | undefined): RoleId {
  return (backendRole && ROLE_MAP[backendRole]) || 'FieldAgent';
}

function mapGrievanceCategory(category: string): string {
  const s = category.toLowerCase();
  if (s.includes('pay')) return 'PAYMENT';
  if (s.includes('input') || s.includes('quality') || s.includes('seed') || s.includes('fert')) {
    return 'INPUT_QUALITY';
  }
  if (s.includes('deliver') || s.includes('collect') || s.includes('logist')) return 'DELIVERY';
  if (s.includes('contract') || s.includes('term') || s.includes('price')) return 'CONTRACT_TERMS';
  return 'OTHER';
}

// ---------------------------------------------------------------------------
// Directory cache (farmers + orgs) — resolves names, Fayda FINs, party ids
// ---------------------------------------------------------------------------

export interface BackendFarmer {
  farmerId: string;
  userId: string;
  faydaFin: string | null;
  name: string;
  phone: string;
  region: string | null;
  woreda: string | null;
  kebele: string | null;
  cooperativeId: string | null;
  cooperativeName: string | null;
}

export interface BackendOrg {
  type: 'CONTRACTOR' | 'COOPERATIVE';
  orgId: string;
  userId: string;
  name: string;
  phone: string | null;
  region?: string | null;
  woreda?: string | null;
  licenseNo?: string;
  tin?: string;
  approvalStatus?: string;
  registrationNo?: string;
  memberCount?: number;
}

interface DirectoryData {
  farmers: BackendFarmer[];
  orgs: BackendOrg[];
  fetchedAt: number;
}

const DIRECTORY_TTL_MS = 30_000;
const directoryCache = new WeakMap<BackendSession, DirectoryData>();

export async function getDirectory(sess: BackendSession): Promise<DirectoryData> {
  const cached = directoryCache.get(sess);
  if (cached && Date.now() - cached.fetchedAt < DIRECTORY_TTL_MS) return cached;
  let farmers: BackendFarmer[] = [];
  let orgs: BackendOrg[] = [];
  try {
    const [f, o] = await Promise.all([
      apiRequest<BackendFarmer[]>(sess, 'GET', '/directory/farmers'),
      apiRequest<BackendOrg[]>(sess, 'GET', '/directory/orgs'),
    ]);
    farmers = f;
    orgs = o;
  } catch {
    // Directory is best-effort: mappers fall back to placeholder names.
    if (cached) return cached;
  }
  const data: DirectoryData = { farmers, orgs, fetchedAt: Date.now() };
  directoryCache.set(sess, data);
  return data;
}

async function contractNoMap(sess: BackendSession): Promise<Map<string, string>> {
  try {
    const contracts = await apiRequest<any[]>(sess, 'GET', '/contracts');
    return new Map(contracts.map((c) => [c.id as string, c.contractNo as string]));
  } catch {
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

interface BackendLoginUser {
  id: string;
  fullName: string;
  role: string;
  email?: string | null;
  phone?: string | null;
  adminLevel?: string | null;
  region?: string | null;
  zone?: string | null;
  woreda?: string | null;
  kebele?: string | null;
}

function buildScopedRoles(b: BackendLoginUser, roleId: RoleId): ScopedRoleAssignment[] {
  const def = ROLE_REGISTRY[roleId];
  // Value-chain actors always use their role's default scope ('org' / 'own' /
  // 'woreda'); administrative level only governs government & oversight roles.
  const scopeType: PermissionScope = VALUE_CHAIN_ROLES.includes(roleId)
    ? def.defaultScope
    : (b.adminLevel && ADMIN_LEVEL_SCOPE[b.adminLevel]) || def.defaultScope;
  const scopeId = `scope-${b.id}`;
  const scopeLabel =
    b.woreda || b.zone || b.region || (scopeType === 'org' ? b.fullName : 'Personal Scope');
  return [
    {
      id: scopeId,
      roleId,
      scopeType,
      scopeLabel,
      ...(b.region ? { region: b.region } : {}),
      ...(b.woreda ? { woreda: b.woreda } : {}),
      ...(b.kebele ? { kebele: b.kebele } : {}),
      ...(scopeType === 'org' ? { orgId: b.id } : {}),
    },
  ];
}

export function buildAuthUser(b: BackendLoginUser, faydaFin?: string | null): AuthUser {
  const roleId = mapRoleId(b.role);
  const scopedRoles = buildScopedRoles(b, roleId);
  const orgScoped = scopedRoles[0].scopeType === 'org';
  const email = b.email || (b.phone ? `${b.phone.replace('+', '')}@users.dcfms.et` : `${b.id}@users.dcfms.et`);
  return {
    id: b.id,
    email,
    fullName: b.fullName,
    fullNameAm: b.fullName,
    ...(faydaFin ? { faydaId: faydaFin } : {}),
    ...(b.phone ? { phone: b.phone } : {}),
    primaryRole: roleId,
    scopedRoles,
    activeScopeId: scopedRoles[0].id,
    ...(orgScoped ? { orgId: b.id, orgName: b.fullName } : {}),
    ...(b.region ? { region: b.region } : {}),
    ...(b.woreda ? { woreda: b.woreda } : {}),
    ...(b.kebele ? { kebele: b.kebele } : {}),
    lastLoginAt: new Date().toISOString(),
  };
}

export async function login(identifier: string, password: string): Promise<BackendSession> {
  const data = await rawRequest<{ accessToken: string; refreshToken: string; user: BackendLoginUser }>(
    '/auth/login',
    { method: 'POST', body: { identifier, password } }
  );

  // Best-effort: attach the farmer's Fayda FIN when the account is a farmer.
  let faydaFin: string | null = null;
  try {
    const farmers = await rawRequest<BackendFarmer[]>('/directory/farmers', {
      method: 'GET',
      token: data.accessToken,
    });
    faydaFin = farmers.find((f) => f.userId === data.user.id)?.faydaFin ?? null;
  } catch {
    faydaFin = null;
  }

  return {
    user: buildAuthUser(data.user, faydaFin),
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

// ---------------------------------------------------------------------------
// Entity mappers (backend Prisma rows -> frontend domain types)
// ---------------------------------------------------------------------------

function mapContract(c: any, dir: DirectoryData): Contract {
  const ct = (c.content ?? {}) as Record<string, any>;
  const parties: any[] = Array.isArray(c.parties) ? c.parties : [];
  const signatures: any[] = Array.isArray(c.signatures) ? c.signatures : [];
  const versions: any[] = Array.isArray(c.versions) ? c.versions : [];

  const farmerParty = parties.find((p) => p.role === 'FARMER' && p.farmerId);
  const coopParty = parties.find((p) => p.role === 'COOPERATIVE');
  const farmer = dir.farmers.find((f) => f.farmerId === farmerParty?.farmerId);
  const contractorOrg = dir.orgs.find((o) => o.type === 'CONTRACTOR' && o.userId === c.createdById);

  const producerSig = signatures.find((s) => s.role === 'FARMER' && s.status === 'SIGNED');
  const contractorSig = signatures.find(
    (s) => (s.role === 'CONTRACTOR' || s.role === 'COOPERATIVE') && s.status === 'SIGNED'
  );

  const agreedPrice = num(c.fixedPrice) ?? num(ct.agreedPriceEtbPerQt) ?? 0;
  const quantity = num(c.quantity) ?? 0;

  return {
    id: c.id,
    contractNumber: c.contractNo,
    title: ct.title || `${c.commodity} Contract ${c.contractNo}`,
    titleAm: ct.title || `${c.commodity} ውል ${c.contractNo}`,
    status: CONTRACT_STATUS_MAP[c.status as string] ?? 'Draft',
    templateId: c.templateId || ct.templateId || 'TPL-STANDARD',
    version: versions.length
      ? Math.max(...versions.map((v) => num(v.version) ?? 1))
      : 1,
    contractorOrgId: c.createdById,
    contractorName: contractorOrg?.name ?? ct.contractorName ?? 'Contractor',
    producerId: farmer?.userId ?? coopParty?.id ?? '',
    producerName: farmer?.name ?? ct.producerName ?? (coopParty ? 'Producer Cooperative' : 'Producer'),
    producerType: coopParty && !farmerParty ? 'Cooperative' : 'Individual',
    ...(farmer?.faydaFin || ct.producerFaydaId
      ? { producerFaydaId: farmer?.faydaFin ?? ct.producerFaydaId }
      : {}),
    commodity: c.commodity,
    variety: ct.variety || 'Local',
    region: c.region ?? ct.region ?? '',
    woreda: c.woreda ?? ct.woreda ?? '',
    kebele: ct.kebele ?? '',
    landAreaHa: num(ct.landAreaHa) ?? 0,
    farmerCount: num(ct.farmerCount) ?? 1,
    expectedQuantityQt: quantity,
    agreedPriceEtbPerQt: agreedPrice,
    floorPriceEtbPerQt: num(ct.floorPriceEtbPerQt) ?? 0,
    pricingFormula: ct.pricingFormula || (c.priceMechanism === 'FIXED' ? 'Fixed price' : 'Market (NMIS)'),
    qualityGrade: c.quality || ct.qualityGrade || 'Grade 1',
    deliveryWindowStart: iso(c.deliveryStart) ?? ct.deliveryWindowStart ?? '',
    deliveryWindowEnd: iso(c.deliveryEnd) ?? ct.deliveryWindowEnd ?? '',
    inputAdvanceObligations: ct.inputAdvanceObligations || 'Standard input advance terms',
    exportOriented: !!ct.exportOriented,
    ecxVerified: !!ct.ecxVerified,
    totalValueEtb: num(ct.totalValueEtb) ?? Math.round(quantity * agreedPrice * 100) / 100,
    // UI aliases
    contractorOrgName: contractorOrg?.name,
    farmerName: farmer?.name ?? ct.producerName,
    ...(farmer?.faydaFin ? { farmerFaydaId: farmer.faydaFin } : {}),
    ...(farmer?.phone ? { farmerPhone: farmer.phone } : {}),
    quantityKg: Math.round(quantity * 100),
    landAreaHectares: num(ct.landAreaHa),
    unitPriceEtb: agreedPrice,
    floorPriceEtb: num(ct.floorPriceEtbPerQt),
    pricingModel: c.priceMechanism,
    deliveryStartDate: iso(c.deliveryStart) ?? ct.deliveryWindowStart,
    deliveryEndDate: iso(c.deliveryEnd) ?? ct.deliveryWindowEnd,
    deliveryLocation: [c.woreda, c.region].filter(Boolean).join(', '),
    qualitySpecs: {
      ...(num(ct.maxMoisturePercent) !== undefined ? { maxMoisturePercent: num(ct.maxMoisturePercent) } : {}),
      ...(num(ct.minPurityPercent) !== undefined ? { minPurityPercent: num(ct.minPurityPercent) } : {}),
      grade: c.quality || ct.qualityGrade || undefined,
    },
    ...(c.approvedAt
      ? {
          wboaEndorsement: {
            endorsedAt: iso(c.approvedAt),
            notes: c.rejectionNote ?? undefined,
          },
        }
      : {}),
    signatures: {
      ...(producerSig?.signedAt ? { producerSignedAt: iso(producerSig.signedAt) } : {}),
      ...(producerSig?.signatureHash
        ? { producerFaydaHash: `sha256-${String(producerSig.signatureHash).slice(0, 32)}` }
        : {}),
      ...(contractorSig?.signedAt ? { contractorSignedAt: iso(contractorSig.signedAt) } : {}),
      ...(producerSig?.signedAt
        ? { farmer: { signedAt: reqIso(producerSig.signedAt), method: producerSig.method ?? 'OTP' } }
        : {}),
      ...(contractorSig?.signedAt
        ? { contractor: { signedAt: reqIso(contractorSig.signedAt), method: contractorSig.method ?? 'OTP' } }
        : {}),
    },
    approvals: {
      ...(c.approvedAt ? { woredaApprovedAt: iso(c.approvedAt) } : {}),
      ...(c.rejectionNote ? { woredaNotes: c.rejectionNote } : {}),
    },
    createdAt: reqIso(c.createdAt),
    updatedAt: reqIso(c.updatedAt),
  };
}

function farmerByFarmerId(dir: DirectoryData, farmerId: string | null | undefined) {
  return farmerId ? dir.farmers.find((f) => f.farmerId === farmerId) : undefined;
}

function farmerByUserId(dir: DirectoryData, userId: string | null | undefined) {
  return userId ? dir.farmers.find((f) => f.userId === userId) : undefined;
}

function mapVoucher(v: any, dir: DirectoryData, contracts: Map<string, string>): InputVoucher {
  const farmer = farmerByFarmerId(dir, v.farmerId);
  return {
    id: v.id,
    contractId: v.contractId ?? '',
    contractNumber: contracts.get(v.contractId ?? '') ?? '—',
    voucherCode: v.voucherNo,
    beneficiaryFaydaId: farmer?.faydaFin ?? '',
    beneficiaryName: farmer?.name ?? 'Registered Farmer',
    farmerName: farmer?.name,
    inputType: v.inputType,
    quantity: num(v.amount) ?? 0,
    unit: v.unit || 'kg',
    valueEtb: num(v.valueEtb) ?? 0,
    totalValueEtb: num(v.valueEtb) ?? 0,
    status: VOUCHER_STATUS_MAP[v.status as string] ?? 'Issued',
    assignedDealerOrgId: v.dealerOrgId ?? v.agroDealerId ?? '',
    assignedDealerName: v.dealerOrgId ?? v.agroDealerId ?? 'Assigned Agro-Dealer',
    otpCode: '', // real OTPs are delivered out-of-band (SMS); see TODO(integration)
    expiryDate: iso(v.expiresAt),
    redeemedAt: iso(v.redeemedAt),
    createdAt: reqIso(v.createdAt),
  };
}

function mapLoan(l: any, dir: DirectoryData, contracts: Map<string, string>): LoanApplication {
  const farmer = farmerByFarmerId(dir, l.farmerId);
  const fiName = FI_DIRECTORY.find((f) => f.orgId === l.fiId)?.orgName ?? l.fiId;
  return {
    id: l.id,
    loanRef: l.loanNo,
    contractId: l.contractId ?? '',
    contractNumber: contracts.get(l.contractId ?? '') ?? '—',
    fiOrgId: l.fiId,
    fiOrgName: fiName,
    applicantFaydaId: farmer?.faydaFin ?? '',
    applicantName: farmer?.name ?? 'Registered Farmer',
    principalEtb: num(l.requestedAmt) ?? 0,
    outstandingPrincipalEtb: num(l.approvedAmt) ?? num(l.requestedAmt) ?? 0,
    interestRatePct: num(l.interestRate) ?? 9,
    creditScoreBand: 'A - Contract Backed',
    cropCycle: l.purpose ?? undefined,
    status: LOAN_STATUS_MAP[l.status as string] ?? 'Submitted',
    ...(l.status === 'DISBURSED' ? { disbursedAt: iso(l.updatedAt) } : {}),
    decisionAt: iso(l.decidedAt),
    decisionReason: l.decisionNote ?? undefined,
    createdAt: reqIso(l.createdAt),
  };
}

function mapSettlement(p: any, dir: DirectoryData, contracts: Map<string, string>): SettlementRecord {
  const payee = farmerByUserId(dir, p.payeeId);
  return {
    id: p.id,
    settlementRef: p.paymentNo,
    settlementNumber: p.paymentNo,
    contractId: p.contractId ?? '',
    contractNumber: contracts.get(p.contractId ?? '') ?? '—',
    deliveryReference: p.externalRef ?? p.paymentNo,
    producerName: payee?.name ?? 'Producer',
    farmerName: payee?.name,
    deliveredKg: num(p.deliveredKg),
    grossAmountEtb: num(p.grossAmount) ?? 0,
    loanDeductionEtb: num(p.loanDeduction) ?? 0,
    inputAdvanceDeductionEtb: 0,
    netPayoutEtb: num(p.netAmount) ?? 0,
    disbursementChannel: CHANNEL_FROM_BACKEND[p.channel as string] ?? 'Bank_Transfer',
    status: SETTLEMENT_STATUS_MAP[p.status as string] ?? 'PENDING',
    createdAt: reqIso(p.createdAt),
  };
}

function mapMonitoring(m: any, dir: DirectoryData, contracts: Map<string, string>): MonitoringReport {
  const f = (m.findings ?? {}) as Record<string, any>;
  const farmer = farmerByFarmerId(dir, m.farmerId);
  return {
    id: m.id,
    reportCode: `MON-${String(m.id).slice(0, 8).toUpperCase()}`,
    contractId: m.contractId ?? '',
    contractNumber: contracts.get(m.contractId ?? '') ?? '—',
    producerName: farmer?.name ?? 'Producer',
    agentId: m.agentId,
    agentName: typeof f.agentName === 'string' ? f.agentName : 'Field Agent',
    cropStage: typeof f.cropStage === 'string' ? f.cropStage : 'Vegetative',
    germinationRatePct: num(f.germinationRatePct),
    inputAppliedCorrectly: typeof f.inputAppliedCorrectly === 'boolean' ? f.inputAppliedCorrectly : undefined,
    sideSellingRisk: typeof f.sideSellingRisk === 'string' ? f.sideSellingRisk : undefined,
    pestOrWeatherAlert: typeof f.pestOrWeatherAlert === 'string' ? f.pestOrWeatherAlert : undefined,
    estimatedYieldQt: num(f.estimatedYieldQt),
    gpsLat: num(m.gpsLat),
    gpsLng: num(m.gpsLng),
    qualityNotes: typeof f.qualityNotes === 'string' ? f.qualityNotes : undefined,
    inspectionDate: iso(m.createdAt),
    createdAt: reqIso(m.createdAt),
  };
}

function mapGrievance(
  g: any,
  dir: DirectoryData,
  contracts: Map<string, string>,
  complainantName?: string
): GrievanceCase {
  const farmer = farmerByFarmerId(dir, g.raisedByFarmerId);
  return {
    id: g.id,
    caseNumber: g.ticketNo,
    title: g.title ?? undefined,
    contractId: g.contractId ?? '',
    contractNumber: contracts.get(g.contractId ?? '') ?? '—',
    complainantName: farmer?.name ?? complainantName ?? 'Registered User',
    category: GRIEVANCE_CATEGORY_LABEL[g.category as string] ?? g.category,
    severity: g.severity ?? 'MEDIUM',
    description: g.description,
    escalationLevel: GRIEVANCE_LEVEL_MAP[g.status as string] ?? 'ContractorTier',
    slaDueAt: reqIso(g.slaDueAt),
    confidentialNotes: [],
    resolutionSummary: g.resolutionNote ?? undefined,
    status: GRIEVANCE_STATUS_MAP[g.status as string] ?? 'Submitted',
    createdAt: reqIso(g.createdAt),
  };
}

function mapAudit(a: any): AuditLogEntry {
  const resource: PermissionResource = ENTITY_RESOURCE_MAP[a.entity as string] ?? 'user';
  const actorRole = mapRoleId(a.actor?.role);
  return {
    id: a.id,
    timestamp: reqIso(a.createdAt),
    actorId: a.actorId ?? 'system',
    actorName: a.actor?.fullName ?? 'System',
    actorRole,
    action: `${resource}:${String(a.action ?? 'UPDATE').toLowerCase()}`,
    resource,
    resourceId: a.entityId ?? a.id,
    ipAddress: a.ipAddress ?? '—',
    scope: a.entity ?? '—',
    previousHash: '0'.repeat(32),
    entryHash: crypto.createHash('sha256').update(String(a.id)).digest('hex').slice(0, 32),
    anomalyFlag: a.result !== 'SUCCESS',
    summary: `${a.action ?? 'ACTION'} on ${a.entity ?? 'entity'}${a.result && a.result !== 'SUCCESS' ? ` (${a.result})` : ''}`,
  };
}

function mapBackendUserRow(u: any): AuthUser {
  const b: BackendLoginUser = {
    id: u.id,
    fullName: u.fullName,
    role: u.role,
    email: u.email,
    phone: u.phone,
    adminLevel: u.adminLevel,
    region: u.region,
    woreda: u.woreda,
    kebele: u.kebele,
  };
  return buildAuthUser(b, null);
}

// ---------------------------------------------------------------------------
// Role-based post-filtering (mirrors the mock server's scoping semantics)
// ---------------------------------------------------------------------------

function scopeContracts(sess: BackendSession, contracts: Contract[]): Contract[] {
  const role = sess.user.primaryRole;
  if (role === 'ProducerIndividual') {
    return contracts.filter((c) => c.producerId === sess.user.id);
  }
  if (role === 'AgroDealer' || role === 'FinancialInstitution') {
    return [];
  }
  return contracts;
}

// ---------------------------------------------------------------------------
// High-level operations (each returns the exact BFF response body)
// ---------------------------------------------------------------------------

export async function listContracts(
  sess: BackendSession,
  query: { status?: string; commodity?: string; region?: string; q?: string }
): Promise<{ contracts: Contract[] }> {
  const dir = await getDirectory(sess);
  const raw = await apiRequest<any[]>(sess, 'GET', '/contracts', undefined, {
    ...(query.commodity && query.commodity !== 'ALL' ? { commodity: query.commodity } : {}),
    ...(query.region && query.region !== 'ALL' ? { region: query.region } : {}),
  });
  let contracts = raw.map((c) => mapContract(c, dir));
  contracts = scopeContracts(sess, contracts);
  if (query.status && query.status !== 'ALL') {
    contracts = contracts.filter((c) => c.status === query.status);
  }
  if (query.q) {
    const term = query.q.toLowerCase();
    contracts = contracts.filter(
      (c) =>
        c.contractNumber.toLowerCase().includes(term) ||
        c.title.toLowerCase().includes(term) ||
        c.producerName.toLowerCase().includes(term) ||
        c.contractorName.toLowerCase().includes(term)
    );
  }
  return { contracts };
}

export async function getContractDetail(sess: BackendSession, id: string) {
  const [dir, raw, settlements, monitoring, vouchers, loans, grievances] = await Promise.all([
    getDirectory(sess),
    apiRequest<any>(sess, 'GET', `/contracts/${id}`),
    apiRequest<any[]>(sess, 'GET', '/finance/settlements', undefined, { contractId: id }).catch(() => []),
    apiRequest<any[]>(sess, 'GET', '/monitoring', undefined, { contractId: id }).catch(() => []),
    apiRequest<any[]>(sess, 'GET', '/finance/vouchers').catch(() => []),
    apiRequest<any[]>(sess, 'GET', '/finance/loans').catch(() => []),
    apiRequest<any[]>(sess, 'GET', '/grievances').catch(() => []),
  ]);
  const contracts = new Map<string, string>([[raw.id, raw.contractNo]]);
  let auditLogs: AuditLogEntry[] = [];
  try {
    const rows = await apiRequest<any[]>(sess, 'GET', '/audit', undefined, { entityId: id, limit: 50 });
    auditLogs = rows.map(mapAudit);
  } catch {
    auditLogs = [];
  }
  return {
    contract: mapContract(raw, dir),
    vouchers: vouchers.filter((v) => v.contractId === id).map((v) => mapVoucher(v, dir, contracts)),
    loans: loans.filter((l) => l.contractId === id).map((l) => mapLoan(l, dir, contracts)),
    settlements: settlements.map((p) => mapSettlement(p, dir, contracts)),
    monitoring: monitoring.map((m) => mapMonitoring(m, dir, contracts)),
    grievances: grievances
      .filter((g) => g.contractId === id)
      .map((g) => mapGrievance(g, dir, contracts, sess.user.fullName)),
    auditLogs,
  };
}

export async function createContractFromWizard(
  sess: BackendSession,
  w: ContractWizardInput
): Promise<{ contract: Contract }> {
  const dir = await getDirectory(sess);
  let farmerId: string | undefined = w.producerFaydaId
    ? dir.farmers.find((f) => f.faydaFin === w.producerFaydaId)?.farmerId
    : undefined;
  if (!farmerId) {
    farmerId = dir.farmers.find((f) => f.name === w.producerName)?.farmerId;
  }

  const content = {
    title: w.title,
    templateId: w.templateId,
    variety: w.variety,
    kebele: w.kebele,
    producerType: w.producerType,
    producerName: w.producerName,
    ...(w.producerFaydaId ? { producerFaydaId: w.producerFaydaId } : {}),
    farmerCount: w.farmerCount,
    landAreaHa: w.landAreaHa,
    agreedPriceEtbPerQt: w.agreedPriceEtbPerQt,
    floorPriceEtbPerQt: w.floorPriceEtbPerQt,
    pricingFormula: w.pricingFormula,
    qualityGrade: w.qualityGrade,
    inputAdvanceObligations: w.inputAdvanceObligations,
    exportOriented: w.exportOriented,
    deliveryWindowStart: w.deliveryWindowStart,
    deliveryWindowEnd: w.deliveryWindowEnd,
    totalValueEtb: Math.round(w.expectedQuantityQt * w.agreedPriceEtbPerQt * 100) / 100,
  };

  const created = await apiRequest<{ id: string }>(sess, 'POST', '/contracts', {
    commodity: w.commodity,
    quantity: w.expectedQuantityQt,
    unit: 'quintal',
    quality: w.qualityGrade,
    priceMechanism: 'FIXED',
    fixedPrice: w.agreedPriceEtbPerQt,
    deliveryStart: w.deliveryWindowStart,
    deliveryEnd: w.deliveryWindowEnd,
    content,
    region: w.region,
    woreda: w.woreda,
    parties: [
      { role: 'CONTRACTOR' },
      ...(farmerId ? [{ role: 'FARMER', farmerId }] : []),
    ],
  });

  const full = await apiRequest<any>(sess, 'GET', `/contracts/${created.id}`);
  return { contract: mapContract(full, dir) };
}

export async function requestSignOtp(
  sess: BackendSession,
  id: string
): Promise<{ message: string; devOtp?: string }> {
  const current = await apiRequest<any>(sess, 'GET', `/contracts/${id}`);
  if (current.status === 'DRAFT') {
    // First signer triggers the signature round (creates pending rows for all parties)
    await apiRequest(sess, 'PATCH', `/contracts/${id}/send-for-signature`);
  }
  const data = await apiRequest<{ message: string; devOtp?: string }>(
    sess,
    'POST',
    `/contracts/${id}/sign/request-otp`
  );
  return { message: data.message, ...(data.devOtp ? { devOtp: data.devOtp } : {}) };
}

export async function signContract(
  sess: BackendSession,
  id: string,
  otp: string
): Promise<{ contract: Contract; signatureHash: string }> {
  const dir = await getDirectory(sess);
  const current = await apiRequest<any>(sess, 'GET', `/contracts/${id}`);
  if (current.status === 'DRAFT') {
    await apiRequest(sess, 'PATCH', `/contracts/${id}/send-for-signature`);
  }
  const sig = await apiRequest<{ signatureHash?: string }>(sess, 'POST', `/contracts/${id}/sign`, {
    method: 'OTP',
    otpCode: otp,
  });
  const full = await apiRequest<any>(sess, 'GET', `/contracts/${id}`);
  return { contract: mapContract(full, dir), signatureHash: sig.signatureHash ?? '' };
}

export async function decideContract(
  sess: BackendSession,
  id: string,
  action: 'approve' | 'reject',
  reason?: string,
  notes?: string
): Promise<{ contract: Contract }> {
  const dir = await getDirectory(sess);
  const current = await apiRequest<any>(sess, 'GET', `/contracts/${id}`);
  if (current.status === 'SIGNED') {
    await apiRequest(sess, 'PATCH', `/contracts/${id}/submit-approval`);
  }
  await apiRequest(sess, 'PATCH', `/contracts/${id}/approve`, {
    decision: action === 'approve' ? 'APPROVE' : 'REJECT',
    note: notes || reason || undefined,
  });
  const full = await apiRequest<any>(sess, 'GET', `/contracts/${id}`);
  return { contract: mapContract(full, dir) };
}

export async function listVouchers(sess: BackendSession): Promise<InputVoucher[]> {
  const [dir, raw, contracts] = await Promise.all([
    getDirectory(sess),
    apiRequest<any[]>(sess, 'GET', '/finance/vouchers'),
    contractNoMap(sess),
  ]);
  let vouchers = raw.map((v) => mapVoucher(v, dir, contracts));
  const role = sess.user.primaryRole;
  if (role === 'AgroDealer') {
    vouchers = vouchers.filter((v) => v.assignedDealerOrgId === sess.user.orgId);
  } else if (role === 'ProducerIndividual') {
    vouchers = vouchers.filter((v) => v.beneficiaryFaydaId === sess.user.faydaId);
  }
  return vouchers;
}

export async function issueVoucher(
  sess: BackendSession,
  dto: VoucherIssueInput
): Promise<{ voucher: InputVoucher }> {
  const dir = await getDirectory(sess);
  const farmer =
    dir.farmers.find((f) => f.faydaFin === dto.beneficiaryFaydaId) ??
    dir.farmers.find((f) => f.name === dto.beneficiaryName);
  if (!farmer) {
    throw new BackendApiError(
      422,
      'FARMER_NOT_REGISTERED',
      'Beneficiary Fayda ID is not registered on the platform.'
    );
  }
  const expiresAt = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
  const created = await apiRequest<any>(sess, 'POST', '/finance/vouchers', {
    farmerId: farmer.farmerId,
    contractId: dto.contractId || undefined,
    inputType: dto.inputType,
    amount: dto.quantity,
    unit: dto.unit,
    valueEtb: dto.valueEtb,
    dealerOrgId: dto.assignedDealerOrgId,
    expiresAt,
  });
  const contracts = await contractNoMap(sess);
  return { voucher: mapVoucher(created, dir, contracts) };
}

export async function redeemVoucher(
  sess: BackendSession,
  dto: { voucherCode: string; otpCode: string }
): Promise<{ voucher: InputVoucher }> {
  const dir = await getDirectory(sess);
  // NOTE: backend currently trusts the redeem call (role-guarded AGRO_DEALER);
  // farmer-OTP verification is a TODO(integration) on the backend side.
  const updated = await apiRequest<any>(sess, 'POST', '/finance/vouchers/redeem', {
    voucherNo: dto.voucherCode,
    agroDealerId: sess.user.orgId ?? sess.user.id,
  });
  const contracts = await contractNoMap(sess);
  return { voucher: mapVoucher(updated, dir, contracts) };
}

export async function financeOverview(sess: BackendSession): Promise<{
  loans: LoanApplication[];
  settlements: SettlementRecord[];
  financialInstitutions: Array<{ orgId: string; orgName: string }>;
}> {
  const [dir, rawLoans, rawSettlements, contracts] = await Promise.all([
    getDirectory(sess),
    apiRequest<any[]>(sess, 'GET', '/finance/loans'),
    apiRequest<any[]>(sess, 'GET', '/finance/settlements'),
    contractNoMap(sess),
  ]);
  let loans = rawLoans.map((l) => mapLoan(l, dir, contracts));
  let settlements = rawSettlements.map((p) => mapSettlement(p, dir, contracts));

  const role = sess.user.primaryRole;
  if (role === 'ProducerIndividual') {
    loans = loans.filter((l) => l.applicantFaydaId === sess.user.faydaId);
    settlements = settlements.filter((s) => s.producerName !== 'Producer');
  } else if (role === 'Contractor') {
    const mine = new Set(scopeByContractor(sess, contracts));
    loans = loans.filter((l) => mine.has(l.contractId));
    settlements = settlements.filter((s) => mine.has(s.contractId));
  }
  // TODO(integration): FI sessions are not yet filtered by institution because
  // backend loans carry a free-form fiId (e.g. 'CBE') while sessions carry a
  // user id as orgId. The backend already restricts decisions to FI_OFFICER.
  return { loans, settlements, financialInstitutions: FI_DIRECTORY };
}

function scopeByContractor(_sess: BackendSession, _contracts: Map<string, string>): string[] {
  // The backend list endpoint already filters contracts for CONTRACTOR sessions;
  // returning all known ids keeps finance rows for those contracts visible.
  return [..._contracts.keys()];
}

export async function applyLoan(
  sess: BackendSession,
  dto: LoanApplicationInput
): Promise<{ loan: LoanApplication }> {
  const dir = await getDirectory(sess);
  const farmer =
    dir.farmers.find((f) => f.faydaFin === dto.applicantFaydaId) ??
    dir.farmers.find((f) => f.userId === sess.user.id);
  if (!farmer) {
    throw new BackendApiError(
      422,
      'FARMER_NOT_REGISTERED',
      'Loan applicant must be a registered farmer (Fayda FIN not found).'
    );
  }
  const created = await apiRequest<any>(sess, 'POST', '/finance/loans', {
    farmerId: farmer.farmerId,
    contractId: dto.contractId,
    fiId: dto.fiOrgId,
    requestedAmt: dto.principalEtb,
    purpose: dto.cropCycle,
  });
  const contracts = await contractNoMap(sess);
  return { loan: mapLoan(created, dir, contracts) };
}

export async function decideLoan(
  sess: BackendSession,
  id: string,
  action: 'approve' | 'reject',
  reason: string
): Promise<{ loan: LoanApplication }> {
  const dir = await getDirectory(sess);
  const loans = await apiRequest<any[]>(sess, 'GET', '/finance/loans');
  const loan = loans.find((l) => l.id === id);
  if (!loan) throw new BackendApiError(404, 'NOT_FOUND', 'Loan not found', 'states.notFoundTitle');
  const decided = await apiRequest<any>(sess, 'PATCH', `/finance/loans/${id}/decide`, {
    decision: action === 'approve' ? 'APPROVE' : 'REJECT',
    ...(action === 'approve' ? { approvedAmt: num(loan.approvedAmt) ?? num(loan.requestedAmt) ?? 0, interestRate: num(loan.interestRate) ?? 9 } : {}),
    note: reason,
  });
  const contracts = await contractNoMap(sess);
  return { loan: mapLoan(decided, dir, contracts) };
}

export async function disburseLoan(sess: BackendSession, id: string): Promise<{ loan: LoanApplication }> {
  const dir = await getDirectory(sess);
  const disbursed = await apiRequest<any>(sess, 'PATCH', `/finance/loans/${id}/disburse`);
  const contracts = await contractNoMap(sess);
  return { loan: mapLoan(disbursed, dir, contracts) };
}

export async function createSettlement(
  sess: BackendSession,
  dto: {
    contractId: string;
    deliveryReference: string;
    deliveredKg: number;
    disbursementChannel: SettlementRecord['disbursementChannel'];
  }
): Promise<{ settlement: SettlementRecord }> {
  const dir = await getDirectory(sess);
  const contract = await apiRequest<any>(sess, 'GET', `/contracts/${dto.contractId}`);
  const ct = (contract.content ?? {}) as Record<string, any>;
  const price = num(contract.fixedPrice) ?? num(ct.agreedPriceEtbPerQt) ?? 0;
  const grossAmount = Math.round((dto.deliveredKg / 100) * price * 100) / 100;

  // Deduct outstanding principal of DISBURSED loans linked to this contract
  const loans = await apiRequest<any[]>(sess, 'GET', '/finance/loans').catch(() => []);
  const outstanding = loans
    .filter((l) => l.contractId === dto.contractId && l.status === 'DISBURSED')
    .reduce((sum, l) => sum + (num(l.approvedAmt) ?? num(l.requestedAmt) ?? 0), 0);
  const loanDeduction = Math.min(grossAmount, outstanding);

  const farmerParty = ((contract.parties ?? []) as any[]).find(
    (p) => p.role === 'FARMER' && p.farmerId
  );
  const farmer = farmerByFarmerId(dir, farmerParty?.farmerId);

  const created = await apiRequest<any>(sess, 'POST', '/finance/settlements', {
    contractId: dto.contractId,
    payerId: contract.createdById,
    payeeId: farmer?.userId ?? 'producer',
    grossAmount,
    loanDeduction,
    deliveredKg: dto.deliveredKg,
    externalRef: dto.deliveryReference,
    channel: CHANNEL_TO_BACKEND[dto.disbursementChannel] ?? 'BANK',
  });
  const contracts = new Map<string, string>([[contract.id, contract.contractNo]]);
  return { settlement: mapSettlement(created, dir, contracts) };
}

export async function releaseSettlement(sess: BackendSession, id: string): Promise<{ settlement: SettlementRecord }> {
  const dir = await getDirectory(sess);
  const raw = await apiRequest<any[]>(sess, 'GET', '/finance/settlements');
  const payment = raw.find((p) => p.id === id);
  if (!payment) throw new BackendApiError(404, 'NOT_FOUND', 'Settlement not found');
  const contracts = await contractNoMap(sess);
  // The backend payment gateway simulation completes settlements immediately;
  // release is therefore an acknowledgement. TODO(integration): persist a
  // distinct release step once real payment rails are wired.
  return { settlement: mapSettlement(payment, dir, contracts) };
}

export async function reconcileSettlement(sess: BackendSession, id: string): Promise<{ settlement: SettlementRecord }> {
  const released = await releaseSettlement(sess, id);
  // TODO(integration): reconciliation is not yet persisted by the backend.
  return { settlement: { ...released.settlement, status: 'Reconciled' } };
}

export async function listMonitoringReports(sess: BackendSession): Promise<MonitoringReport[]> {
  const [dir, raw, contracts] = await Promise.all([
    getDirectory(sess),
    apiRequest<any[]>(sess, 'GET', '/monitoring'),
    contractNoMap(sess),
  ]);
  let reports = raw.map((m) => mapMonitoring(m, dir, contracts));
  if (sess.user.primaryRole === 'FieldAgent') {
    reports = reports.filter((r) => r.agentId === sess.user.id);
  }
  return reports;
}

export async function createMonitoringReport(
  sess: BackendSession,
  dto: MonitoringReportInput
): Promise<{ report: MonitoringReport }> {
  const dir = await getDirectory(sess);
  const contract = await apiRequest<any>(sess, 'GET', `/contracts/${dto.contractId}`);
  const farmerParty = ((contract.parties ?? []) as any[]).find(
    (p) => p.role === 'FARMER' && p.farmerId
  );
  const created = await apiRequest<any>(sess, 'POST', '/monitoring', {
    contractId: dto.contractId,
    type: 'FIELD_VISIT',
    ...(farmerParty ? { farmerId: farmerParty.farmerId } : {}),
    gpsLat: dto.gpsLat,
    gpsLng: dto.gpsLng,
    findings: {
      cropStage: dto.cropStage,
      germinationRatePct: dto.germinationRatePct,
      inputAppliedCorrectly: dto.inputAppliedCorrectly,
      sideSellingRisk: dto.sideSellingRisk,
      pestOrWeatherAlert: dto.pestOrWeatherAlert,
      estimatedYieldQt: dto.estimatedYieldQt,
      qualityNotes: dto.qualityNotes,
      ...(dto.photoDataUrl ? { photoDataUrl: dto.photoDataUrl } : {}),
      agentName: sess.user.fullName,
    },
    score: Math.round((dto.germinationRatePct / 20) * 10) / 10,
  });
  const contracts = new Map<string, string>([[contract.id, contract.contractNo]]);
  return { report: mapMonitoring(created, dir, contracts) };
}

export async function listGrievances(sess: BackendSession): Promise<GrievanceCase[]> {
  const [dir, raw, contracts] = await Promise.all([
    getDirectory(sess),
    apiRequest<any[]>(sess, 'GET', '/grievances'),
    contractNoMap(sess),
  ]);
  let rows = raw;
  if (sess.user.primaryRole === 'ProducerIndividual') {
    const myFarmerId = dir.farmers.find((f) => f.userId === sess.user.id)?.farmerId;
    rows = rows.filter((g) => g.raisedByFarmerId && g.raisedByFarmerId === myFarmerId);
  }
  return rows.map((g) => mapGrievance(g, dir, contracts, sess.user.fullName));
}

export async function createGrievance(
  sess: BackendSession,
  dto: GrievanceIntakeInput
): Promise<{ grievance: GrievanceCase }> {
  const dir = await getDirectory(sess);
  const myFarmerId = dir.farmers.find((f) => f.userId === sess.user.id)?.farmerId;
  const created = await apiRequest<any>(sess, 'POST', '/grievances', {
    category: mapGrievanceCategory(dto.category),
    title: dto.title,
    severity: dto.severity,
    description: dto.description,
    contractId: dto.contractId || undefined,
    ...(myFarmerId ? { raisedByFarmerId: myFarmerId } : {}),
  });
  const contracts = await contractNoMap(sess);
  return { grievance: mapGrievance(created, dir, contracts, sess.user.fullName) };
}

export async function escalateGrievance(
  sess: BackendSession,
  id: string,
  reason: string
): Promise<{ grievance: GrievanceCase }> {
  const dir = await getDirectory(sess);
  const updated = await apiRequest<any>(sess, 'PATCH', `/grievances/${id}/escalate`, { reason });
  const contracts = await contractNoMap(sess);
  return { grievance: mapGrievance(updated, dir, contracts, sess.user.fullName) };
}

export async function resolveGrievance(
  sess: BackendSession,
  id: string,
  resolutionSummary: string
): Promise<{ grievance: GrievanceCase }> {
  const dir = await getDirectory(sess);
  const updated = await apiRequest<any>(sess, 'PATCH', `/grievances/${id}/resolve`, {
    resolutionNote: resolutionSummary,
  });
  const contracts = await contractNoMap(sess);
  return { grievance: mapGrievance(updated, dir, contracts, sess.user.fullName) };
}

export interface BackendDashboardData {
  kpis: DashboardKPI[];
  seriesData: { name: string; primary: number; secondary: number }[];
  distributionData: { name: string; value: number }[];
  contracts: Contract[];
  vouchers: InputVoucher[];
  loans: LoanApplication[];
  settlements: SettlementRecord[];
  monitoring: MonitoringReport[];
  grievances: GrievanceCase[];
  auditLogs: AuditLogEntry[];
  usersCount: number;
}

export async function dashboardData(sess: BackendSession): Promise<BackendDashboardData> {
  const [dir, rawContracts, analytics, vouchersRaw, loansRaw, settlementsRaw, monitoringRaw, grievancesRaw] =
    await Promise.all([
      getDirectory(sess),
      apiRequest<any[]>(sess, 'GET', '/contracts'),
      apiRequest<any>(sess, 'GET', '/analytics/dashboard').catch(() => null),
      apiRequest<any[]>(sess, 'GET', '/finance/vouchers').catch(() => []),
      apiRequest<any[]>(sess, 'GET', '/finance/loans').catch(() => []),
      apiRequest<any[]>(sess, 'GET', '/finance/settlements').catch(() => []),
      apiRequest<any[]>(sess, 'GET', '/monitoring').catch(() => []),
      apiRequest<any[]>(sess, 'GET', '/grievances').catch(() => []),
    ]);

  const contractsAll = rawContracts.map((c) => mapContract(c, dir));
  const contracts = scopeContracts(sess, contractsAll);
  const cmap = new Map(rawContracts.map((c) => [c.id as string, c.contractNo as string]));
  const vouchers = vouchersRaw.map((v) => mapVoucher(v, dir, cmap));
  const loans = loansRaw.map((l) => mapLoan(l, dir, cmap));
  const settlements = settlementsRaw.map((p) => mapSettlement(p, dir, cmap));
  const monitoring = monitoringRaw.map((m) => mapMonitoring(m, dir, cmap));
  const grievances = grievancesRaw.map((g) => mapGrievance(g, dir, cmap, sess.user.fullName));

  let auditLogs: AuditLogEntry[] = [];
  try {
    const rows = await apiRequest<any[]>(sess, 'GET', '/audit', undefined, { limit: 12 });
    auditLogs = rows.map(mapAudit);
  } catch {
    auditLogs = [];
  }
  let usersCount = 0;
  try {
    const users = await apiRequest<any[]>(sess, 'GET', '/users');
    usersCount = users.length;
  } catch {
    usersCount = 0;
  }

  const totalValue = contracts.reduce((s, c) => s + c.totalValueEtb, 0);
  const totalFarmers =
    (analytics && num(analytics.farmersReached)) ||
    contracts.reduce((s, c) => s + c.farmerCount, 0);
  const signedPlus = contracts.filter((c) =>
    ['Signed', 'Approved', 'ACTIVE', 'Completed', 'Adjusted'].includes(c.status)
  ).length;

  // Monthly series (last 6 months) from contract creation dates
  const now = new Date();
  const seriesData: { name: string; primary: number; secondary: number }[] = [];
  let cumulative = 0;
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const name = d.toLocaleString('en-US', { month: 'short' });
    const primary = contracts.filter((c) => {
      const cd = new Date(c.createdAt);
      return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
    }).length;
    cumulative += primary;
    seriesData.push({ name, primary, secondary: cumulative });
  }

  const byCommodity = new Map<string, number>();
  for (const c of contracts) byCommodity.set(c.commodity, (byCommodity.get(c.commodity) ?? 0) + 1);
  const distributionData = [...byCommodity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  const kpis: DashboardKPI[] = [
    {
      id: 'kpi-contracts',
      labelKey: 'kpi.totalContracts',
      value: String(contracts.length),
      delta: 'live backend data',
      deltaDirection: 'neutral',
      sparkline: seriesData.map((s) => s.secondary),
    },
    {
      id: 'kpi-value',
      labelKey: 'kpi.contractValue',
      value: `${(totalValue / 1_000_000).toFixed(1)}M`,
      delta: 'ETB contracted',
      deltaDirection: 'neutral',
      sparkline: seriesData.map((s) => s.primary),
    },
    {
      id: 'kpi-farmers',
      labelKey: 'kpi.activeFarmers',
      value: totalFarmers.toLocaleString('en-US'),
      delta: 'registered producers',
      deltaDirection: 'neutral',
      sparkline: [0, 0, 0, 0, 0, Math.max(totalFarmers, 1)],
    },
    {
      id: 'kpi-signed',
      labelKey: 'kpi.signedRate',
      value: contracts.length > 0 ? `${Math.round((signedPlus / contracts.length) * 100)}%` : '0%',
      delta: 'OTP e-signed',
      deltaDirection: 'neutral',
      sparkline: [0, 0, 0, 0, 0, contracts.length ? Math.round((signedPlus / contracts.length) * 100) : 0],
    },
  ];

  return {
    kpis,
    seriesData,
    distributionData,
    contracts,
    vouchers,
    loans,
    settlements,
    monitoring,
    grievances,
    auditLogs,
    usersCount,
  };
}

export async function listUsers(sess: BackendSession): Promise<AuthUser[]> {
  const rows = await apiRequest<any[]>(sess, 'GET', '/users');
  return rows.map(mapBackendUserRow);
}

export async function listAuditLogs(sess: BackendSession, limit = 100): Promise<AuditLogEntry[]> {
  const rows = await apiRequest<any[]>(sess, 'GET', '/audit', undefined, { limit });
  return rows.map(mapAudit);
}
