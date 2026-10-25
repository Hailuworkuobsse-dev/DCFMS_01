export type RoleId =
  | 'ATISuperAdmin'
  | 'SystemAdmin'
  | 'MoAFederal'
  | 'RBoARegional'
  | 'WBoAWoreda'
  | 'KebeleOfficer'
  | 'MoTRIOfficer'
  | 'ECCOfficer'
  | 'EAAOfficer'
  | 'JusticeOfficer'
  | 'Contractor'
  | 'ProducerIndividual'
  | 'ProducerCooperative'
  | 'FinancialInstitution'
  | 'Insurer'
  | 'AgroDealer'
  | 'FieldAgent'
  | 'Auditor';

export type PermissionResource =
  | 'user'
  | 'farmer'
  | 'contractor'
  | 'contract'
  | 'document'
  | 'signature'
  | 'linkage'
  | 'input_voucher'
  | 'loan'
  | 'insurance'
  | 'settlement'
  | 'monitoring'
  | 'advisory'
  | 'price'
  | 'grievance'
  | 'report'
  | 'audit_log'
  | 'system_config'
  | 'integration'
  | 'dashboard'
  | 'parcel'
  | 'cooperative'
  | 'provider';

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'sign'
  | 'reject'
  | 'escalate'
  | 'export'
  | 'assign'
  | 'verify';

export type PermissionScope =
  | 'own'
  | 'org'
  | 'kebele'
  | 'woreda'
  | 'zonal'
  | 'region'
  | 'federal'
  | 'all';

export type PermissionString = `${PermissionResource}:${PermissionAction}:${PermissionScope}`;

export type ContractStatus =
  | 'Draft'
  | 'Signed'
  | 'Approved'
  | 'Completed'
  | 'Adjusted'
  | 'Rejected'
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'SIGNED'
  | 'ENDORSED_WBOA'
  | 'ACTIVE'
  | 'IN_DELIVERY'
  | 'SETTLED'
  | 'DISPUTED'
  | 'TERMINATED';

export type LinkageStatus = 'Open' | 'Clustered' | 'Matched' | 'SupportLetterIssued' | 'Closed' | 'OPEN' | 'CLUSTERED' | 'MATCHED' | 'CLOSED';
export type VoucherStatus = 'Issued' | 'Redeemed' | 'VerifiedByAgent' | 'Expired' | 'ISSUED' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';
export type LoanStatus = 'Submitted' | 'UnderAssessment' | 'Approved' | 'Disbursed' | 'Rejected' | 'Completed' | 'ACTIVE' | 'DISBURSED' | 'PENDING';
export type InsuranceStatus = 'Requested' | 'Active' | 'Expired';
export type GrievanceStatus = 'Submitted' | 'InMediation' | 'Escalated' | 'Resolved' | 'SUBMITTED' | 'UNDER_MEDIATION' | 'ESCALATED_WBOA' | 'ESCALATED_COURT' | 'RESOLVED' | 'DISMISSED';
export type IntegrationHealthStatus = 'Healthy' | 'Degraded' | 'Offline';
export type CompetencyStatus = 'PendingReview' | 'Certified' | 'RequiresClarification' | 'Rejected';
export type SettlementStatus = 'InstructionCreated' | 'LoanDeducted' | 'Reconciled' | 'PENDING' | 'SETTLED';

export interface ScopedRoleAssignment {
  id: string;
  roleId: RoleId;
  scopeType: PermissionScope;
  scopeLabel: string;
  region?: string;
  woreda?: string;
  kebele?: string;
  orgId?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  fullNameAm: string;
  faydaId?: string;
  phone?: string;
  primaryRole: RoleId;
  scopedRoles: ScopedRoleAssignment[];
  activeScopeId: string;
  orgId?: string;
  orgName?: string;
  region?: string;
  woreda?: string;
  kebele?: string;
  lastLoginAt?: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  title: string;
  titleAm: string;
  status: ContractStatus;
  templateId: string;
  version: number;
  contractorOrgId: string;
  contractorName: string;
  producerId: string;
  producerName: string;
  producerType: 'Individual' | 'Cooperative';
  producerFaydaId?: string;
  commodity: string;
  variety: string;
  region: string;
  woreda: string;
  kebele: string;
  landAreaHa: number;
  farmerCount: number;
  expectedQuantityQt: number;
  agreedPriceEtbPerQt: number;
  floorPriceEtbPerQt: number;
  pricingFormula: string;
  qualityGrade: string;
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
  inputAdvanceObligations: string;
  exportOriented: boolean;
  ecxVerified: boolean;
  totalValueEtb: number;
  // UI aliases:
  contractorOrgName?: string;
  farmerName?: string;
  farmerFaydaId?: string;
  farmerPhone?: string;
  quantityKg?: number;
  landAreaHectares?: number;
  unitPriceEtb?: number;
  floorPriceEtb?: number;
  pricingModel?: string;
  deliveryStartDate?: string;
  deliveryEndDate?: string;
  deliveryLocation?: string;
  escrowStatus?: string;
  inputAdvanceValueEtb?: number;
  qualitySpecs?: {
    maxMoisturePercent?: number;
    minPurityPercent?: number;
    grade?: string;
  };
  wboaEndorsement?: {
    registrationNumber?: string;
    endorsedBy?: string;
    endorsedAt?: string;
    notes?: string;
  };
  signatures: {
    contractorSignedAt?: string;
    producerSignedAt?: string;
    producerFaydaHash?: string;
    farmer?: { signedAt: string; method: string };
    contractor?: { signedAt: string; method: string };
  };
  approvals: {
    woredaApprovedBy?: string;
    woredaApprovedAt?: string;
    woredaNotes?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LinkageRequest {
  id: string;
  woreda: string;
  kebele: string;
  commodity: string;
  farmersCount: number;
  totalHectares: number;
  estimatedVolumeQt: number;
  status: LinkageStatus;
  buyerOrgId?: string;
  buyerOrgName?: string;
  createdByOrgId?: string;
  supportLetterRef?: string;
  supportLetterIssuedAt?: string;
  createdAt: string;
}

export interface ContractorCompetencyApp {
  id: string;
  contractorOrgId: string;
  orgName: string;
  tinNumber: string;
  commodityFocus: string;
  processingCapacityMt: number;
  performanceGuaranteeEtb: number;
  status: CompetencyStatus;
  reviewedBy?: string;
  reviewNotes?: string;
  validUntil?: string;
  createdAt: string;
}

export interface InputVoucher {
  id: string;
  contractId: string;
  contractNumber: string;
  voucherCode: string;
  beneficiaryFaydaId: string;
  beneficiaryName: string;
  farmerName?: string;
  inputType: string;
  quantity: number;
  unit: string;
  valueEtb: number;
  totalValueEtb?: number;
  status: VoucherStatus;
  assignedDealerOrgId: string;
  assignedDealerName: string;
  otpCode: string;
  items?: Array<{ description: string; quantity: number; unit: string }>;
  expiryDate?: string;
  redeemedAt?: string;
  verifiedByAgentAt?: string;
  createdAt: string;
}

export interface InputStockItem {
  id: string;
  dealerOrgId: string;
  inputType: string;
  batchNumber: string;
  availableQuantity: number;
  unit: string;
  unitPriceEtb: number;
}

export interface LoanApplication {
  id: string;
  loanRef: string;
  contractId: string;
  contractNumber: string;
  fiOrgId: string;
  fiOrgName: string;
  applicantFaydaId: string;
  applicantName: string;
  principalEtb: number;
  outstandingPrincipalEtb?: number;
  interestRatePct: number;
  creditScoreBand: string;
  cropCycle?: string;
  status: LoanStatus;
  disbursedAt?: string;
  decisionAt?: string;
  decisionReason?: string;
  createdAt: string;
}

export interface InsurancePolicy {
  id: string;
  policyNumber: string;
  contractId: string;
  contractNumber: string;
  insurerOrgId: string;
  insurerOrgName: string;
  insuredName: string;
  coverageType: string;
  sumInsuredEtb: number;
  premiumEtb: number;
  claimStatus: 'None' | 'Pending' | 'Approved' | 'Settled';
  status: InsuranceStatus;
  validUntil: string;
  createdAt: string;
}

export interface SettlementRecord {
  id: string;
  settlementRef: string;
  settlementNumber?: string;
  contractId: string;
  contractNumber: string;
  deliveryReference?: string;
  fiOrgId?: string;
  producerName: string;
  farmerName?: string;
  deliveredKg?: number;
  grossAmountEtb: number;
  loanDeductionEtb: number;
  inputAdvanceDeductionEtb?: number;
  netPayoutEtb: number;
  disbursementChannel: 'Telebirr' | 'CBE_Birr' | 'Bank_Transfer';
  status: SettlementStatus;
  createdAt: string;
}

export interface MonitoringReport {
  id: string;
  reportCode: string;
  contractId: string;
  contractNumber: string;
  producerName: string;
  agentId: string;
  agentName: string;
  inspectorName?: string;
  inspectorRole?: string;
  cropStage: 'LandPrep' | 'Planting' | 'Vegetative' | 'Flowering' | 'PreHarvest' | 'HarvestReady' | string;
  stage?: string;
  cropHealth?: string;
  germinationRatePct?: number;
  inputAppliedCorrectly?: boolean;
  sideSellingRisk?: 'Low' | 'Medium' | 'High' | string;
  pestOrWeatherAlert?: string;
  estimatedYieldQt?: number;
  estimatedYieldKg?: number;
  gpsLat?: number;
  gpsLng?: number;
  gpsCoordinates?: { latitude: number; longitude: number };
  qualityNotes?: string;
  notes?: string;
  inspectionDate?: string;
  photoUrl?: string;
  createdAt: string;
}

export interface AdvisoryArticle {
  id: string;
  titleEn: string;
  titleAm: string;
  commodity: string;
  category: 'Agronomy' | 'PestControl' | 'Harvest' | 'MarketStandards';
  contentEn: string;
  contentAm: string;
  publishedAt: string;
}

export interface GrievanceCase {
  id: string;
  caseNumber: string;
  title?: string;
  contractId: string;
  contractNumber: string;
  complainantName: string;
  complainantRole?: string;
  respondentName?: string;
  category: string;
  severity?: string;
  description: string;
  escalationReason?: string;
  stage?: string;
  escalationLevel: 'ContractorTier' | 'WoredaCommittee' | 'RegionalPanel' | 'CourtArbitration' | string;
  slaDueAt: string;
  confidentialNotes: string[];
  resolutionSummary?: string;
  status: GrievanceStatus;
  createdAt: string;
}

export interface ExternalIntegrationHealth {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  status: IntegrationHealthStatus;
  latencyMs: number;
  uptimePct: number;
  failedJobs24h: number;
  lastSyncAt: string;
}

export interface FeatureFlagConfig {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  minRole: RoleId;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: RoleId;
  action: string;
  resource: PermissionResource;
  resourceId: string;
  ipAddress: string;
  scope: string;
  previousHash: string;
  entryHash: string;
  anomalyFlag: boolean;
  summary: string;
}

export interface SystemConfig {
  maintenanceMode: boolean;
  statutoryFloorPricesEtb: Record<string, number>;
  defaultSlaHoursGrievance: number;
}

export interface DashboardKPI {
  id: string;
  labelKey: string;
  value: string;
  delta: string;
  deltaDirection: 'up' | 'down' | 'neutral';
  sparkline: number[];
}

export interface DashboardPayload {
  roleId: RoleId;
  scopeLabel: string;
  kpis: DashboardKPI[];
  seriesData: { name: string; primary: number; secondary: number }[];
  distributionData: { name: string; value: number }[];
  contracts: Contract[];
  linkages: LinkageRequest[];
  vouchers: InputVoucher[];
  loans: LoanApplication[];
  insurances: InsurancePolicy[];
  settlements: SettlementRecord[];
  monitoring: MonitoringReport[];
  grievances: GrievanceCase[];
  integrations: ExternalIntegrationHealth[];
  auditLogs: AuditLogEntry[];
  usersCount: number;
  competencyApps: ContractorCompetencyApp[];
}

export type MonitoringRecord = MonitoringReport;
export type Settlement = SettlementRecord;
export type Loan = LoanApplication;
export type Grievance = GrievanceCase;
