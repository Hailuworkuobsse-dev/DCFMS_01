import type {
  AuthUser,
  Contract,
  DashboardPayload,
  InputVoucher,
  LinkageRequest,
  LoanApplication,
  MonitoringReport,
  GrievanceCase,
  SettlementRecord,
  AuditLogEntry,
  PermissionString,
} from '../../types/api';

export interface RequestOptions extends RequestInit {
  silent401?: boolean;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  messageKey?: string;
  fieldErrors?: Record<string, string>;

  constructor(status: number, message: string, code?: string, messageKey?: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.messageKey = messageKey;
    this.fieldErrors = fieldErrors;
  }
}

const BASE_URL = '/api';

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let errorData: { code?: string; message?: string; messageKey?: string; fieldErrors?: Record<string, string> } = {};
    try {
      errorData = (await res.json()) as typeof errorData;
    } catch {
      // ignore
    }

    if (res.status === 401 && options.silent401) {
      throw new ApiError(401, 'Unauthorized', errorData.code, errorData.messageKey);
    }

    throw new ApiError(
      res.status,
      errorData.message || errorData.messageKey || `Request failed with status ${res.status}`,
      errorData.code,
      errorData.messageKey,
      errorData.fieldErrors
    );
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

export const apiClient = {
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'GET' });
  },
  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'DELETE' });
  },
};

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiClient.post<{ user: AuthUser; permissions: PermissionString[] }>('/auth/login', {
        email,
        password,
      }),
    switchScope: (scopeId: string) =>
      apiClient.post<{ user: AuthUser; permissions: PermissionString[] }>('/auth/switch-scope', { scopeId }),
    logout: () => apiClient.post<{ ok: boolean }>('/auth/logout'),
    me: () =>
      apiClient.get<{ user: AuthUser | null; permissions: PermissionString[] }>('/auth/me', {
        silent401: true,
      }),
  },
  dashboard: {
    get: () => apiClient.get<DashboardPayload>('/dashboard'),
  },
  contracts: {
    list: (params?: { status?: string; commodity?: string; region?: string; q?: string }) => {
      const q = new URLSearchParams();
      if (params?.status && params.status !== 'ALL') q.set('status', params.status);
      if (params?.commodity && params.commodity !== 'ALL') q.set('commodity', params.commodity);
      if (params?.region && params.region !== 'ALL') q.set('region', params.region);
      if (params?.q) q.set('q', params.q);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      return apiClient.get<{ contracts: Contract[] }>(`/contracts${queryStr}`);
    },
    get: (id: string) =>
      apiClient.get<{
        contract: Contract;
        vouchers: InputVoucher[];
        loans: LoanApplication[];
        settlements: any[];
        monitoring: MonitoringReport[];
        grievances: GrievanceCase[];
        auditLogs: AuditLogEntry[];
      }>(`/contracts/${id}`),
    create: (data: any) => apiClient.post<{ contract: Contract }>('/contracts', data),
    sign: (id: string, data: { party: string; method: string; otpCode?: string }) =>
      apiClient.post<{ contract: Contract }>(`/contracts/${id}/sign-otp`, {
        faydaId: '987654321012',
        otp: data.otpCode || '123456',
        acceptDeclaration: true,
      }),
    endorse: (id: string, data: { notes?: string }) =>
      apiClient.post<{ contract: Contract }>(`/contracts/${id}/decision`, {
        action: 'approve',
        reason: 'Statutory compliance verified',
        notes: data.notes,
      }),
  },
  linkages: {
    list: () => apiClient.get<{ linkages: LinkageRequest[]; competencyApps: any[] }>('/linkage'),
    create: (data: any) => apiClient.post<{ linkage: LinkageRequest }>('/linkage', data),
  },
  inputs: {
    listVouchers: () => apiClient.get<{ vouchers: InputVoucher[]; inventory: any[] }>('/vouchers'),
    issueVoucher: (data: any) => apiClient.post<{ voucher: InputVoucher }>('/vouchers/issue', data),
    redeemVoucher: (_id: string, data: { supplierId?: string; otpCode: string; voucherCode?: string }) =>
      apiClient.post<{ voucher: InputVoucher }>('/vouchers/redeem', {
        voucherCode: data.voucherCode || 'VCH-ETH-4001',
        otpCode: data.otpCode,
        dealerFaydaId: '123456789012',
      }),
  },
  finance: {
    list: () =>
      apiClient.get<{
        loans: LoanApplication[];
        insurances: any[];
        settlements: SettlementRecord[];
        financialInstitutions: Array<{ orgId: string; orgName: string }>;
      }>('/finance'),
    listSettlements: async () => {
      const res = await apiClient.get<{ loans: LoanApplication[]; insurances: any[]; settlements: any[] }>('/finance');
      return { settlements: res.settlements };
    },
    listLoans: async () => {
      const res = await apiClient.get<{ loans: LoanApplication[]; insurances: any[]; settlements: any[] }>('/finance');
      return { loans: res.loans };
    },
    applyLoan: (data: {
      contractId: string;
      fiOrgId: string;
      applicantFaydaId: string;
      applicantName: string;
      principalEtb: number;
      cropCycle: string;
    }) => apiClient.post<{ loan: LoanApplication }>('/loans/apply', data),
    createSettlement: (data: {
      contractId: string;
      deliveryReference: string;
      deliveredKg: number;
      disbursementChannel: SettlementRecord['disbursementChannel'];
    }) => apiClient.post<{ settlement: SettlementRecord }>('/settlements', data),
    decideLoan: (id: string, data: { action: 'approve' | 'reject'; reason: string }) =>
      apiClient.post<{ loan: LoanApplication }>(`/loans/${id}/decision`, data),
    disburseLoan: (id: string) =>
      apiClient.post<{ loan: LoanApplication }>(`/loans/${id}/disburse`),
    releaseSettlement: (id: string) =>
      apiClient.post<{ settlement: SettlementRecord }>(`/settlement/${id}/release`),
    reconcileSettlement: (id: string) =>
      apiClient.post<{ settlement: SettlementRecord }>(`/settlement/${id}/reconcile`),
  },
  monitoring: {
    list: () => apiClient.get<{ reports: MonitoringReport[]; advisories: any[] }>('/monitoring'),
    create: (data: any) => apiClient.post<{ report: MonitoringReport }>('/monitoring', data),
  },
  grievances: {
    list: () => apiClient.get<{ grievances: GrievanceCase[] }>('/grievances'),
    create: (data: {
      contractId: string;
      category: string;
      title: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      description: string;
    }) => apiClient.post<{ grievance: GrievanceCase }>('/grievances', data),
    escalate: (id: string, data: { reason: string }) =>
      apiClient.post<{ grievance: GrievanceCase }>(`/grievances/${id}/escalate`, data),
    resolve: (id: string, data: { resolutionNotes: string }) =>
      apiClient.post<{ grievance: GrievanceCase }>(`/grievances/${id}/resolve`, {
        resolutionSummary: data.resolutionNotes,
      }),
  },
  admin: {
    getAuditLogs: async () => {
      const res = await apiClient.get<DashboardPayload>('/dashboard');
      return { logs: res.auditLogs };
    },
    getUsers: () => apiClient.get<{ users: AuthUser[] }>('/admin/users'),
  },
};
