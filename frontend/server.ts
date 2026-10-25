import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { createInitialSeedDatabase } from './src/server/seedData';
import {
  getActiveRole,
  hasResourceAction,
} from './src/lib/rbac/permissions';
import {
  contractDecisionSchema,
  contractWizardSchema,
  contractorCompetencySchema,
  grievanceIntakeSchema,
  linkageApplicationSchema,
  loanApplicationSchema,
  loginSchema,
  monitoringReportSchema,
  otpSignatureSchema,
  userCreateSchema,
  voucherIssueSchema,
  voucherRedeemSchema,
} from './src/lib/validation/schemas';
import type {
  AuthUser,
  Contract,
  ContractorCompetencyApp,
  DashboardPayload,
  GrievanceCase,
  InputVoucher,
  LinkageRequest,
  LoanApplication,
  MonitoringReport,
  PermissionResource,
  PermissionAction,
  PermissionString,
  RoleId,
} from './src/types/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = createInitialSeedDatabase();
const sessions = new Map<string, string>(); // sessionToken -> userId
const COOKIE_NAME = 'dcfms_session';

function createAuditEntry(
  user: AuthUser,
  action: string,
  resource: PermissionResource,
  resourceId: string,
  summary: string,
  anomalyFlag = false
) {
  const prev = db.auditLogs[0]?.entryHash ?? '00000000000000000000000000000000';
  const entryHash = crypto
    .createHash('sha256')
    .update(`${prev}:${user.id}:${action}:${resourceId}:${Date.now()}`)
    .digest('hex')
    .slice(0, 32);

  db.auditLogs.unshift({
    id: `AUD-${1000 + db.auditLogs.length + 1}`,
    timestamp: new Date().toISOString(),
    actorId: user.id,
    actorName: user.fullName,
    actorRole: getActiveRole(user) ?? user.primaryRole,
    action,
    resource,
    resourceId,
    ipAddress: '196.188.45.102',
    scope: user.woreda || user.region || user.orgId || 'ALL',
    previousHash: prev,
    entryHash,
    anomalyFlag,
    summary,
  });
}

function getEffectiveUserPermissions(user: AuthUser): PermissionString[] {
  const role = getActiveRole(user) ?? user.primaryRole;
  return db.rolePermissionsMatrix[role] ?? [];
}

function getActiveScopeInfo(user: AuthUser) {
  const activeScope = user.scopedRoles.find((s) => s.id === user.activeScopeId) ?? user.scopedRoles[0];
  return {
    roleId: activeScope ? activeScope.roleId : user.primaryRole,
    scopeType: activeScope?.scopeType ?? 'own',
    scopeLabel: activeScope?.scopeLabel ?? user.orgName ?? 'Personal Scope',
    region: activeScope?.region ?? user.region,
    woreda: activeScope?.woreda ?? user.woreda,
    orgId: activeScope?.orgId ?? user.orgId,
  };
}

function scopeContractsForUser(user: AuthUser): Contract[] {
  const scope = getActiveScopeInfo(user);
  const role = scope.roleId;

  if (
    role === 'ATISuperAdmin' ||
    role === 'SystemAdmin' ||
    role === 'MoAFederal' ||
    role === 'ECCOfficer' ||
    role === 'EAAOfficer' ||
    role === 'JusticeOfficer' ||
    role === 'Auditor'
  ) {
    return db.contracts;
  }
  if (role === 'MoTRIOfficer') {
    return db.contracts.filter((c) => c.exportOriented);
  }
  if (role === 'RBoARegional' && scope.region) {
    return db.contracts.filter((c) => c.region === scope.region);
  }
  if ((role === 'WBoAWoreda' || role === 'KebeleOfficer' || role === 'FieldAgent') && scope.woreda) {
    return db.contracts.filter((c) => c.woreda === scope.woreda || c.region === scope.region);
  }
  if (role === 'Contractor' && scope.orgId) {
    return db.contracts.filter((c) => c.contractorOrgId === scope.orgId);
  }
  if (role === 'ProducerCooperative' && scope.orgId) {
    return db.contracts.filter((c) => c.producerId === scope.orgId);
  }
  if (role === 'ProducerIndividual') {
    return db.contracts.filter((c) => c.producerId === user.id);
  }
  return db.contracts;
}

interface AuthedRequest extends Request {
  user?: AuthUser;
  requestId?: string;
}

function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  req.requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);

  const token = req.cookies?.[COOKIE_NAME];
  if (token && sessions.has(token)) {
    const userId = sessions.get(token)!;
    const found = db.users.find((u) => u.id === userId);
    if (found) {
      req.user = found;
    }
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      messageKey: 'errors.unauthorized',
    });
    return;
  }
  next();
}

function requireResourceAction(resource: PermissionResource, action: PermissionAction) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ code: 'UNAUTHORIZED', messageKey: 'errors.unauthorized' });
      return;
    }
    const perms = getEffectiveUserPermissions(req.user);
    if (!hasResourceAction(perms, resource, action)) {
      res.status(403).json({
        code: 'FORBIDDEN',
        messageKey: 'errors.forbidden',
      });
      return;
    }
    next();
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());
  app.use(authMiddleware);

  // --- AUTH ENDPOINTS ---
  app.get('/api/auth/demo-accounts', (_req, res) => {
    res.json({
      accounts: db.users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        fullNameAm: u.fullNameAm,
        primaryRole: u.primaryRole,
        scopeLabel: u.scopedRoles[0]?.scopeLabel ?? '',
        orgName: u.orgName ?? '',
      })),
    });
  });

  app.post('/api/auth/login', (req: AuthedRequest, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        fieldErrors[key] = issue.message;
      }
      res.status(422).json({
        code: 'VALIDATION_ERROR',
        messageKey: 'errors.validationFailed',
        fieldErrors,
      });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    const expectedPwd = db.passwordsByEmail[email];

    if (!user || expectedPwd !== parsed.data.password) {
      res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        messageKey: 'errors.unauthorized',
      });
      return;
    }

    const sessionToken = crypto.randomBytes(24).toString('hex');
    sessions.set(sessionToken, user.id);
    user.lastLoginAt = new Date().toISOString();

    res.cookie(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 12,
    });

    createAuditEntry(user, 'auth:login', 'user', user.id, `Signed in via httpOnly session (${user.primaryRole}).`);

    res.json({
      user,
      permissions: getEffectiveUserPermissions(user),
    });
  });

  app.post('/api/auth/quick-role', (req: AuthedRequest, res: Response) => {
    const { roleId } = req.body as { roleId?: RoleId };
    const user = db.users.find((u) => u.primaryRole === roleId);
    if (!user) {
      res.status(404).json({ code: 'NOT_FOUND', messageKey: 'errors.unauthorized' });
      return;
    }

    const sessionToken = crypto.randomBytes(24).toString('hex');
    sessions.set(sessionToken, user.id);
    user.lastLoginAt = new Date().toISOString();

    res.cookie(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 12,
    });

    res.json({
      user,
      permissions: getEffectiveUserPermissions(user),
    });
  });

  app.post('/api/auth/switch-scope', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const { scopeId } = req.body as { scopeId: string };
    const exists = user.scopedRoles.find((s) => s.id === scopeId);
    if (!exists) {
      res.status(403).json({ code: 'FORBIDDEN', messageKey: 'errors.forbidden' });
      return;
    }
    user.activeScopeId = scopeId;
    if (exists.region) user.region = exists.region;
    if (exists.woreda) user.woreda = exists.woreda;
    createAuditEntry(user, 'auth:switch_scope', 'user', user.id, `Switched active scope to ${exists.scopeLabel}`);
    res.json({
      user,
      permissions: getEffectiveUserPermissions(user),
    });
  });

  app.post('/api/auth/logout', (req: AuthedRequest, res: Response) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) sessions.delete(token);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req: AuthedRequest, res: Response) => {
    if (!req.user) {
      res.json({ user: null, permissions: [] });
      return;
    }
    res.json({
      user: req.user,
      permissions: getEffectiveUserPermissions(req.user),
    });
  });

  // --- GLOBAL SEARCH ---
  app.get('/api/search', requireAuth, (req: AuthedRequest, res: Response) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    if (!q) {
      res.json({ results: [] });
      return;
    }
    const scopedContracts = scopeContractsForUser(req.user!);
    const matches = scopedContracts
      .filter(
        (c) =>
          c.contractNumber.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.producerName.toLowerCase().includes(q) ||
          c.contractorName.toLowerCase().includes(q) ||
          c.commodity.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        label: `${c.contractNumber} — ${c.commodity} (${c.producerName})`,
        route: `/contracts/${c.id}`,
        status: c.status,
      }));
    res.json({ results: matches });
  });

  // --- NOTIFICATIONS ---
  app.get('/api/notifications', requireAuth, (_req: AuthedRequest, res: Response) => {
    res.json({
      notifications: [
        {
          id: 'notif-1',
          category: 'contract',
          title: 'Contract E-Signature Verified',
          message: 'CTR-OR-2026-001 completed Fayda OTP e-sign milestone.',
          timestamp: '2026-08-14T14:20:00Z',
          unread: true,
          route: '/contracts/CTR-2026-001',
        },
        {
          id: 'notif-2',
          category: 'approvals',
          title: 'Woreda Approval Required',
          message: 'Durum Wheat contract CTR-OR-2026-002 submitted for registration.',
          timestamp: '2026-08-15T09:00:00Z',
          unread: true,
          route: '/contracts/CTR-2026-002',
        },
        {
          id: 'notif-3',
          category: 'grievance',
          title: 'Grievance SLA Milestone',
          message: 'GRV-OR-2026-041 entered active mediation (Ada’a Woreda).',
          timestamp: '2026-08-16T08:00:00Z',
          unread: false,
          route: '/grievances',
        },
      ],
    });
  });

  // --- DASHBOARDS ROUTER DATA ---
  app.get('/api/dashboard', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const scopeInfo = getActiveScopeInfo(user);
    const role = scopeInfo.roleId;
    const scopedContracts = scopeContractsForUser(user);

    const totalValue = scopedContracts.reduce((sum, c) => sum + c.totalValueEtb, 0);
    const totalFarmers = scopedContracts.reduce((sum, c) => sum + c.farmerCount, 0);
    const signedOrApproved = scopedContracts.filter((c) => c.status === 'Signed' || c.status === 'Approved').length;

    const payload: DashboardPayload = {
      roleId: role,
      scopeLabel: scopeInfo.scopeLabel,
      kpis: [
        {
          id: 'kpi-contracts',
          labelKey: 'kpi.totalContracts',
          value: String(scopedContracts.length),
          delta: '+3 vs last month',
          deltaDirection: 'up',
          sparkline: [4, 6, 8, 9, 12, Math.max(scopedContracts.length, 5)],
        },
        {
          id: 'kpi-value',
          labelKey: 'kpi.contractValue',
          value: `${(totalValue / 1_000_000).toFixed(1)}M`,
          delta: '+12.4% vs plan',
          deltaDirection: 'up',
          sparkline: [42, 55, 68, 84, 96, Math.max(Math.round(totalValue / 1_000_000), 10)],
        },
        {
          id: 'kpi-farmers',
          labelKey: 'kpi.activeFarmers',
          value: totalFarmers.toLocaleString('en-US'),
          delta: '+240 clustered',
          deltaDirection: 'up',
          sparkline: [320, 480, 610, 790, 980, Math.max(totalFarmers, 50)],
        },
        {
          id: 'kpi-signed',
          labelKey: 'kpi.signedRate',
          value:
            scopedContracts.length > 0
              ? `${Math.round((signedOrApproved / scopedContracts.length) * 100)}%`
              : '0%',
          delta: 'Fayda OTP verified',
          deltaDirection: 'up',
          sparkline: [50, 60, 65, 72, 80, 85],
        },
      ],
      seriesData: [
        { name: 'Hamle', primary: 2800, secondary: 2400 },
        { name: 'Nehase', primary: 4200, secondary: 3900 },
        { name: 'Meskerem', primary: 6800, secondary: 6100 },
        { name: 'Tikimt', primary: 9400, secondary: 8750 },
        { name: 'Hidar', primary: 12600, secondary: 11200 },
      ],
      distributionData: [
        { name: 'Malt Barley', value: scopedContracts.filter((c) => c.commodity === 'Malt Barley').length || 2 },
        { name: 'Arabica Coffee', value: scopedContracts.filter((c) => c.commodity === 'Arabica Coffee').length || 1 },
        { name: 'Sesame', value: scopedContracts.filter((c) => c.commodity === 'Sesame').length || 2 },
        { name: 'Durum Wheat', value: scopedContracts.filter((c) => c.commodity === 'Durum Wheat').length || 1 },
      ],
      contracts: scopedContracts,
      linkages: db.linkages,
      vouchers: db.vouchers,
      loans: db.loans,
      insurances: db.insurances,
      settlements: db.settlements,
      monitoring: db.monitoring,
      grievances: db.grievances,
      integrations: db.integrations,
      auditLogs: db.auditLogs.slice(0, 12),
      usersCount: db.users.length,
      competencyApps: db.competencyApps,
    };

    res.json(payload);
  });

  // --- CONTRACTS MODULE ---
  app.get('/api/contracts', requireResourceAction('contract', 'read'), (req: AuthedRequest, res: Response) => {
    let items = scopeContractsForUser(req.user!);
    const { status, commodity, region, q } = req.query as Record<string, string | undefined>;
    if (status && status !== 'ALL') items = items.filter((c) => c.status === status);
    if (commodity && commodity !== 'ALL') items = items.filter((c) => c.commodity === commodity);
    if (region && region !== 'ALL') items = items.filter((c) => c.region === region);
    if (q) {
      const term = q.toLowerCase();
      items = items.filter(
        (c) =>
          c.contractNumber.toLowerCase().includes(term) ||
          c.title.toLowerCase().includes(term) ||
          c.producerName.toLowerCase().includes(term) ||
          c.contractorName.toLowerCase().includes(term)
      );
    }
    res.json({ contracts: items });
  });

  app.get('/api/contracts/:id', requireResourceAction('contract', 'read'), (req: AuthedRequest, res: Response) => {
    const scoped = scopeContractsForUser(req.user!);
    const contract = scoped.find((c) => c.id === req.params.id);
    if (!contract) {
      const existsGlobally = db.contracts.some((c) => c.id === req.params.id);
      if (existsGlobally) {
        res.status(403).json({ code: 'FORBIDDEN', messageKey: 'errors.forbidden' });
        return;
      }
      res.status(404).json({ code: 'NOT_FOUND', messageKey: 'states.notFoundTitle' });
      return;
    }
    res.json({
      contract,
      vouchers: db.vouchers.filter((v) => v.contractId === contract.id),
      loans: db.loans.filter((l) => l.contractId === contract.id),
      settlements: db.settlements.filter((s) => s.contractId === contract.id),
      monitoring: db.monitoring.filter((m) => m.contractId === contract.id),
      grievances: db.grievances.filter((g) => g.contractId === contract.id),
      auditLogs: db.auditLogs.filter((a) => a.resourceId === contract.id),
    });
  });

  app.post('/api/contracts', requireResourceAction('contract', 'create'), (req: AuthedRequest, res: Response) => {
    const parsed = contractWizardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ code: 'VALIDATION_ERROR', issues: parsed.error.issues });
      return;
    }

    const data = parsed.data;
    const user = req.user!;
    const seq = db.contracts.length + 1;
    const regionCode = data.region.slice(0, 2).toUpperCase();
    const contractNumber = `CTR-${regionCode}-2026-${String(seq).padStart(3, '0')}`;

    const newContract: Contract = {
      id: `CTR-2026-${String(seq).padStart(3, '0')}`,
      contractNumber,
      title: data.title,
      titleAm: data.title,
      status: 'Draft',
      templateId: data.templateId,
      version: 1,
      contractorOrgId: user.orgId ?? 'org-contractor',
      contractorName: user.orgName ?? user.fullName,
      producerId: data.producerType === 'Individual' ? 'usr-producer-ind' : 'org-erba-union',
      producerName: data.producerName,
      producerType: data.producerType,
      producerFaydaId: data.producerFaydaId || '987654321012',
      commodity: data.commodity,
      variety: data.variety,
      region: data.region,
      woreda: data.woreda,
      kebele: data.kebele,
      landAreaHa: data.landAreaHa,
      farmerCount: data.farmerCount,
      expectedQuantityQt: data.expectedQuantityQt,
      agreedPriceEtbPerQt: data.agreedPriceEtbPerQt,
      floorPriceEtbPerQt: data.floorPriceEtbPerQt,
      pricingFormula: data.pricingFormula,
      qualityGrade: data.qualityGrade,
      deliveryWindowStart: data.deliveryWindowStart,
      deliveryWindowEnd: data.deliveryWindowEnd,
      inputAdvanceObligations: data.inputAdvanceObligations,
      exportOriented: data.exportOriented,
      ecxVerified: false,
      totalValueEtb: data.expectedQuantityQt * data.agreedPriceEtbPerQt,
      signatures: {
        contractorSignedAt: new Date().toISOString(),
      },
      approvals: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.contracts.unshift(newContract);
    createAuditEntry(
      user,
      'contract:create:org',
      'contract',
      newContract.id,
      `Drafted agricultural contract ${newContract.contractNumber} (${newContract.commodity}).`
    );

    res.status(201).json({ contract: newContract });
  });

  app.post(
    '/api/contracts/:id/sign-otp',
    requireResourceAction('contract', 'sign'),
    (req: AuthedRequest, res: Response) => {
      const contract = db.contracts.find((c) => c.id === req.params.id);
      if (!contract) {
        res.status(404).json({ code: 'NOT_FOUND', messageKey: 'states.notFoundTitle' });
        return;
      }
      if (contract.status !== 'Draft') {
        res.status(409).json({ code: 'CONFLICT', messageKey: 'contracts.alreadySignedTooltip' });
        return;
      }

      const parsed = otpSignatureSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ code: 'VALIDATION_ERROR', issues: parsed.error.issues });
        return;
      }

      // Demo OTP accept 123456
      if (parsed.data.otp !== '123456') {
        res.status(400).json({ code: 'INVALID_OTP', messageKey: 'errors.invalidOtp' });
        return;
      }

      const sigHash = crypto
        .createHash('sha256')
        .update(`SIGN:${contract.id}:${parsed.data.faydaId}:${Date.now()}`)
        .digest('hex');

      contract.status = 'Signed';
      contract.signatures.producerSignedAt = new Date().toISOString();
      contract.signatures.producerFaydaHash = `sha256-${sigHash.slice(0, 32)}`;
      contract.updatedAt = new Date().toISOString();

      createAuditEntry(
        req.user!,
        'contract:sign:own',
        'contract',
        contract.id,
        `E-Signed contract ${contract.contractNumber} via Fayda OTP (${parsed.data.faydaId}).`
      );

      res.json({ contract, signatureHash: contract.signatures.producerFaydaHash });
    }
  );

  app.post(
    '/api/contracts/:id/decision',
    requireResourceAction('contract', 'approve'),
    (req: AuthedRequest, res: Response) => {
      const contract = db.contracts.find((c) => c.id === req.params.id);
      if (!contract) {
        res.status(404).json({ code: 'NOT_FOUND', messageKey: 'states.notFoundTitle' });
        return;
      }

      const parsed = contractDecisionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ code: 'VALIDATION_ERROR', issues: parsed.error.issues });
        return;
      }

      const { action, reason, notes } = parsed.data;
      if (action === 'approve') {
        contract.status = 'Approved';
        contract.approvals.woredaApprovedBy = req.user!.fullName;
        contract.approvals.woredaApprovedAt = new Date().toISOString();
        contract.approvals.woredaNotes = notes || reason;
      } else {
        contract.status = 'Rejected';
      }
      contract.updatedAt = new Date().toISOString();

      createAuditEntry(
        req.user!,
        `contract:${action}:woreda`,
        'contract',
        contract.id,
        `Contract ${contract.contractNumber} was ${action}d: ${reason}`
      );

      res.json({ contract });
    }
  );

  app.post(
    '/api/contracts/:id/verify-export',
    requireResourceAction('contract', 'verify'),
    (req: AuthedRequest, res: Response) => {
      const contract = db.contracts.find((c) => c.id === req.params.id);
      if (!contract) {
        res.status(404).json({ code: 'NOT_FOUND', messageKey: 'states.notFoundTitle' });
        return;
      }
      contract.ecxVerified = true;
      contract.updatedAt = new Date().toISOString();

      createAuditEntry(
        req.user!,
        'contract:verify:federal',
        'contract',
        contract.id,
        `Export contract ${contract.contractNumber} verified for ECX trade clearance.`
      );

      res.json({ contract });
    }
  );

  // --- LINKAGE & CLUSTERING ---
  app.get('/api/linkage', requireResourceAction('linkage', 'read'), (_req, res) => {
    res.json({
      linkages: db.linkages,
      competencyApps: db.competencyApps,
    });
  });

  app.post('/api/linkage', requireResourceAction('linkage', 'create'), (req: AuthedRequest, res: Response) => {
    const parsed = linkageApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ code: 'VALIDATION_ERROR', issues: parsed.error.issues });
      return;
    }
    const newLinkage: LinkageRequest = {
      id: `LNK-2026-${100 + db.linkages.length + 1}`,
      ...parsed.data,
      status: 'Open',
      createdAt: new Date().toISOString(),
    };
    db.linkages.unshift(newLinkage);
    createAuditEntry(
      req.user!,
      'linkage:create:woreda',
      'linkage',
      newLinkage.id,
      `New farmer linkage request filed for ${newLinkage.commodity} in ${newLinkage.woreda}`
    );
    res.status(201).json({ linkage: newLinkage });
  });

  app.post('/api/linkage/:id/cluster', requireResourceAction('linkage', 'approve'), (req: AuthedRequest, res: Response) => {
    const item = db.linkages.find((l) => l.id === req.params.id);
    if (!item) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    item.status = 'Clustered';
    createAuditEntry(req.user!, 'linkage:approve:woreda', 'linkage', item.id, `Clustered linkage request ${item.id}`);
    res.json({ linkage: item });
  });

  app.post('/api/linkage/:id/support-letter', requireResourceAction('linkage', 'approve'), (req: AuthedRequest, res: Response) => {
    const item = db.linkages.find((l) => l.id === req.params.id);
    if (!item) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    item.status = 'SupportLetterIssued';
    item.supportLetterRef = `SL/RBOA/${Date.now().toString().slice(-4)}`;
    item.supportLetterIssuedAt = new Date().toISOString();
    createAuditEntry(req.user!, 'linkage:approve:region', 'linkage', item.id, `Issued official support letter ${item.supportLetterRef}`);
    res.json({ linkage: item });
  });

  app.post('/api/competency', (req: AuthedRequest, res: Response) => {
    const parsed = contractorCompetencySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ code: 'VALIDATION_ERROR', issues: parsed.error.issues });
      return;
    }
    const newApp: ContractorCompetencyApp = {
      id: `COMP-2026-${String(db.competencyApps.length + 1).padStart(2, '0')}`,
      contractorOrgId: req.user?.orgId ?? 'org-contractor',
      ...parsed.data,
      status: 'PendingReview',
      createdAt: new Date().toISOString(),
    };
    db.competencyApps.unshift(newApp);
    res.status(201).json({ competencyApp: newApp });
  });

  app.post('/api/competency/:id/certify', requireResourceAction('contractor', 'approve'), (req: AuthedRequest, res: Response) => {
    const appRecord = db.competencyApps.find((c) => c.id === req.params.id);
    if (!appRecord) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    appRecord.status = 'Certified';
    appRecord.reviewedBy = req.user!.fullName;
    appRecord.reviewNotes = 'Approved following technical facility and balance sheet audit.';
    appRecord.validUntil = '2027-12-31';
    res.json({ competencyApp: appRecord });
  });

  // --- INPUTS & VOUCHERS ---
  app.get('/api/vouchers', requireResourceAction('input_voucher', 'read'), (_req, res) => {
    res.json({
      vouchers: db.vouchers,
      inventory: db.inventory,
    });
  });

  app.post('/api/vouchers/issue', requireResourceAction('input_voucher', 'create'), (req: AuthedRequest, res: Response) => {
    const parsed = voucherIssueSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ code: 'VALIDATION_ERROR', issues: parsed.error.issues });
      return;
    }
    const newVoucher: InputVoucher = {
      id: `VCH-2026-${500 + db.vouchers.length + 1}`,
      contractId: parsed.data.contractId,
      contractNumber: 'CTR-OR-2026-001',
      voucherCode: `VCH-ETH-${Math.floor(1000 + Math.random() * 9000)}`,
      beneficiaryFaydaId: parsed.data.beneficiaryFaydaId,
      beneficiaryName: parsed.data.beneficiaryName,
      inputType: parsed.data.inputType,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      valueEtb: parsed.data.valueEtb,
      status: 'Issued',
      assignedDealerOrgId: parsed.data.assignedDealerOrgId,
      assignedDealerName: "Ada'a Certified Farm Supply PLC",
      otpCode: '123456',
      createdAt: new Date().toISOString(),
    };
    db.vouchers.unshift(newVoucher);
    createAuditEntry(req.user!, 'input_voucher:create:org', 'input_voucher', newVoucher.id, `Issued voucher ${newVoucher.voucherCode}`);
    res.status(201).json({ voucher: newVoucher });
  });

  app.post('/api/vouchers/redeem', requireResourceAction('input_voucher', 'verify'), (req: AuthedRequest, res: Response) => {
    const parsed = voucherRedeemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ code: 'VALIDATION_ERROR', issues: parsed.error.issues });
      return;
    }
    const vch = db.vouchers.find((v) => v.voucherCode.toLowerCase() === parsed.data.voucherCode.toLowerCase());
    if (!vch) {
      res.status(404).json({ code: 'NOT_FOUND', messageKey: 'errors.notFound' });
      return;
    }
    if (parsed.data.otpCode !== vch.otpCode && parsed.data.otpCode !== '123456') {
      res.status(400).json({ code: 'INVALID_OTP', messageKey: 'errors.invalidOtp' });
      return;
    }
    vch.status = 'Redeemed';
    vch.redeemedAt = new Date().toISOString();
    createAuditEntry(req.user!, 'input_voucher:verify:org', 'input_voucher', vch.id, `Redeemed voucher ${vch.voucherCode} with OTP`);
    res.json({ voucher: vch });
  });

  app.post('/api/vouchers/:id/verify-agent', requireResourceAction('input_voucher', 'verify'), (req: AuthedRequest, res: Response) => {
    const vch = db.vouchers.find((v) => v.id === req.params.id);
    if (!vch) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    vch.status = 'VerifiedByAgent';
    vch.verifiedByAgentAt = new Date().toISOString();
    res.json({ voucher: vch });
  });

  // --- FINANCE, LOANS & SETTLEMENTS ---
  app.get('/api/finance', requireResourceAction('loan', 'read'), (_req, res) => {
    res.json({
      loans: db.loans,
      insurances: db.insurances,
      settlements: db.settlements,
    });
  });

  app.post('/api/loans/apply', requireResourceAction('loan', 'create'), (req: AuthedRequest, res: Response) => {
    const parsed = loanApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ code: 'VALIDATION_ERROR', issues: parsed.error.issues });
      return;
    }
    const newLoan: LoanApplication = {
      id: `LN-2026-${800 + db.loans.length + 1}`,
      loanRef: `COOP-TRI-2026-${Math.floor(200 + Math.random() * 800)}`,
      contractId: parsed.data.contractId,
      contractNumber: 'CTR-OR-2026-001',
      fiOrgId: parsed.data.fiOrgId,
      fiOrgName: 'Cooperative Bank of Oromia',
      applicantFaydaId: parsed.data.applicantFaydaId,
      applicantName: parsed.data.applicantName,
      principalEtb: parsed.data.principalEtb,
      interestRatePct: 9.0,
      creditScoreBand: 'A - Contract Backed',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
    };
    db.loans.unshift(newLoan);
    createAuditEntry(req.user!, 'loan:create:own', 'loan', newLoan.id, `Submitted tripartite loan application ${newLoan.loanRef}`);
    res.status(201).json({ loan: newLoan });
  });

  app.post('/api/loans/:id/decision', requireResourceAction('loan', 'approve'), (req: AuthedRequest, res: Response) => {
    const loan = db.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    loan.status = 'Approved';
    res.json({ loan });
  });

  app.post('/api/loans/:id/disburse', requireResourceAction('loan', 'update'), (req: AuthedRequest, res: Response) => {
    const loan = db.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    loan.status = 'Disbursed';
    loan.disbursedAt = new Date().toISOString();
    res.json({ loan });
  });

  app.post('/api/settlement/:id/reconcile', requireResourceAction('settlement', 'update'), (req: AuthedRequest, res: Response) => {
    const record = db.settlements.find((s) => s.id === req.params.id);
    if (!record) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    record.status = 'Reconciled';
    res.json({ settlement: record });
  });

  // --- MONITORING ---
  app.get('/api/monitoring', requireResourceAction('monitoring', 'read'), (_req, res) => {
    res.json({
      reports: db.monitoring,
      advisories: db.advisories,
    });
  });

  app.post('/api/monitoring', requireResourceAction('monitoring', 'create'), (req: AuthedRequest, res: Response) => {
    const parsed = monitoringReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ code: 'VALIDATION_ERROR', issues: parsed.error.issues });
      return;
    }
    const contract = db.contracts.find((c) => c.id === parsed.data.contractId) ?? db.contracts[0];
    const newReport: MonitoringReport = {
      id: `MON-2026-${310 + db.monitoring.length + 1}`,
      reportCode: `MON-ET-2026-${310 + db.monitoring.length + 1}`,
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      producerName: contract.producerName,
      agentId: req.user?.id ?? 'usr-field-agent',
      agentName: req.user?.fullName ?? 'Solomon Tilahun',
      cropStage: parsed.data.cropStage,
      germinationRatePct: parsed.data.germinationRatePct,
      inputAppliedCorrectly: parsed.data.inputAppliedCorrectly,
      sideSellingRisk: parsed.data.sideSellingRisk,
      pestOrWeatherAlert: parsed.data.pestOrWeatherAlert,
      estimatedYieldQt: parsed.data.estimatedYieldQt,
      gpsLat: parsed.data.gpsLat,
      gpsLng: parsed.data.gpsLng,
      qualityNotes: parsed.data.qualityNotes,
      photoUrl: parsed.data.photoDataUrl,
      createdAt: new Date().toISOString(),
    };
    db.monitoring.unshift(newReport);
    createAuditEntry(
      req.user ?? db.users[0],
      'monitoring:create:woreda',
      'monitoring',
      newReport.id,
      `Submitted inspection report ${newReport.reportCode}`
    );
    res.status(201).json({ report: newReport });
  });

  // --- GRIEVANCES ---
  app.get('/api/grievances', requireResourceAction('grievance', 'read'), (_req, res) => {
    res.json({ grievances: db.grievances });
  });

  app.post('/api/grievances', requireResourceAction('grievance', 'create'), (req: AuthedRequest, res: Response) => {
    const parsed = grievanceIntakeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ code: 'VALIDATION_ERROR', issues: parsed.error.issues });
      return;
    }
    const contract = db.contracts.find((c) => c.id === parsed.data.contractId) ?? db.contracts[0];
    const newCase: GrievanceCase = {
      id: `GRV-2026-${String(db.grievances.length + 1).padStart(2, '0')}`,
      caseNumber: `GRV-OR-2026-${Math.floor(100 + Math.random() * 900)}`,
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      complainantName: parsed.data.complainantName,
      complainantRole: parsed.data.complainantRole,
      respondentName: parsed.data.respondentName,
      category: parsed.data.category,
      description: parsed.data.description,
      escalationLevel: 'ContractorTier',
      slaDueAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      confidentialNotes: [],
      status: 'Submitted',
      createdAt: new Date().toISOString(),
    };
    db.grievances.unshift(newCase);
    createAuditEntry(req.user!, 'grievance:create:own', 'grievance', newCase.id, `Filed grievance ${newCase.caseNumber}`);
    res.status(201).json({ grievance: newCase });
  });

  app.post('/api/grievances/:id/escalate', requireResourceAction('grievance', 'escalate'), (req: AuthedRequest, res: Response) => {
    const item = db.grievances.find((g) => g.id === req.params.id);
    if (!item) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    const tiers: GrievanceCase['escalationLevel'][] = [
      'ContractorTier',
      'WoredaCommittee',
      'RegionalPanel',
      'CourtArbitration',
    ];
    const currentIndex = tiers.indexOf(item.escalationLevel);
    const nextTier = tiers[Math.min(currentIndex + 1, tiers.length - 1)];
    item.escalationLevel = nextTier;
    item.status = nextTier === 'CourtArbitration' ? 'Escalated' : 'InMediation';
    createAuditEntry(req.user!, 'grievance:escalate:woreda', 'grievance', item.id, `Escalated case to ${nextTier}`);
    res.json({ grievance: item });
  });

  app.post('/api/grievances/:id/resolve', requireResourceAction('grievance', 'update'), (req: AuthedRequest, res: Response) => {
    const item = db.grievances.find((g) => g.id === req.params.id);
    if (!item) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    const { resolutionSummary } = req.body as { resolutionSummary?: string };
    item.status = 'Resolved';
    item.resolutionSummary = resolutionSummary || 'Resolved via mediation';
    createAuditEntry(req.user!, 'grievance:update:woreda', 'grievance', item.id, `Resolved grievance ${item.caseNumber}`);
    res.json({ grievance: item });
  });

  app.post('/api/grievances/:id/notes', requireResourceAction('grievance', 'update'), (req: AuthedRequest, res: Response) => {
    const item = db.grievances.find((g) => g.id === req.params.id);
    if (!item) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    const { note } = req.body as { note: string };
    if (note) item.confidentialNotes.push(note);
    res.json({ grievance: item });
  });

  // --- REPORTS & ASYNC EXPORTS ---
  app.get('/api/reports', requireResourceAction('report', 'read'), (_req, res) => {
    res.json({
      exports: [
        { id: 'EXP-01', filename: 'national-contract-funnel-2026.csv', status: 'Completed', sizeKb: 342, date: '2026-08-15' },
        { id: 'EXP-02', filename: 'woreda-linkage-rollup.csv', status: 'Completed', sizeKb: 188, date: '2026-08-16' },
      ],
    });
  });

  app.post('/api/reports/export', requireResourceAction('report', 'export'), (req: AuthedRequest, res: Response) => {
    const { moduleName } = req.body as { moduleName: string };
    const job = {
      id: `EXP-${Date.now().toString().slice(-4)}`,
      filename: `${moduleName || 'dcfms'}-export-${Date.now()}.csv`,
      status: 'Completed',
      sizeKb: 128,
      date: new Date().toISOString().split('T')[0],
    };
    createAuditEntry(req.user!, 'report:export:all', 'report', job.id, `Triggered async data export ${job.filename}`);
    res.status(202).json({ job });
  });

  // --- ADMIN & RBAC ---
  app.get('/api/admin/users', requireResourceAction('user', 'read'), (_req, res) => {
    res.json({ users: db.users });
  });

  app.post('/api/admin/users', requireResourceAction('user', 'create'), (req: AuthedRequest, res: Response) => {
    const parsed = userCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ code: 'VALIDATION_ERROR', issues: parsed.error.issues });
      return;
    }
    const d = parsed.data;
    const roleId = d.primaryRole as RoleId;
    const newUser: AuthUser = {
      id: `usr-${Date.now().toString().slice(-5)}`,
      email: d.email,
      fullName: d.fullName,
      fullNameAm: d.fullNameAm,
      faydaId: d.faydaId,
      primaryRole: roleId,
      activeScopeId: `scope-${Date.now()}`,
      scopedRoles: [
        {
          id: `scope-${Date.now()}`,
          roleId,
          scopeType: 'own',
          scopeLabel: d.orgName || d.woreda || 'Personal Scope',
          region: d.region,
          woreda: d.woreda,
        },
      ],
      region: d.region,
      woreda: d.woreda,
      orgName: d.orgName,
    };
    db.users.push(newUser);
    db.passwordsByEmail[newUser.email.toLowerCase()] = 'ati2025!';
    createAuditEntry(req.user!, 'user:create:all', 'user', newUser.id, `Created platform user ${newUser.fullName} (${newUser.primaryRole})`);
    res.status(201).json({ user: newUser });
  });

  app.get('/api/admin/matrix', requireResourceAction('system_config', 'read'), (_req, res) => {
    res.json({ matrix: db.rolePermissionsMatrix });
  });

  app.put('/api/admin/matrix', requireResourceAction('system_config', 'update'), (req: AuthedRequest, res: Response) => {
    const { roleId, permissions } = req.body as { roleId: RoleId; permissions: PermissionString[] };
    if (!roleId || !permissions) {
      res.status(400).json({ code: 'BAD_REQUEST' });
      return;
    }
    db.rolePermissionsMatrix[roleId] = permissions;
    createAuditEntry(req.user!, 'system_config:update:all', 'system_config', roleId, `Updated permission matrix for role ${roleId}`);
    res.json({ ok: true, matrix: db.rolePermissionsMatrix });
  });

  app.get('/api/admin/flags', requireResourceAction('system_config', 'read'), (_req, res) => {
    res.json({ flags: db.featureFlags });
  });

  app.post('/api/admin/flags/toggle', requireResourceAction('system_config', 'update'), (req: AuthedRequest, res: Response) => {
    const { key } = req.body as { key: string };
    const flag = db.featureFlags.find((f) => f.key === key);
    if (!flag) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    flag.enabled = !flag.enabled;
    createAuditEntry(req.user!, 'system_config:update:all', 'system_config', key, `Toggled feature flag ${key} to ${flag.enabled}`);
    res.json({ flag });
  });

  app.get('/api/admin/audit', requireResourceAction('audit_log', 'read'), (_req, res) => {
    res.json({ logs: db.auditLogs });
  });

  // --- VITE DEV OR PROD STATIC ---
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ATI DCFMS full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
