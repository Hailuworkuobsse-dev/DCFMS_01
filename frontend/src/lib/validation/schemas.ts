import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('validation.invalidEmail'),
  password: z.string().min(6, 'validation.passwordMin'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const contractWizardSchema = z
  .object({
    templateId: z.string().min(1, 'validation.required'),
    title: z.string().min(5, 'validation.titleMin'),
    commodity: z.string().min(1, 'validation.required'),
    variety: z.string().min(1, 'validation.required'),
    region: z.string().min(1, 'validation.required'),
    woreda: z.string().min(1, 'validation.required'),
    kebele: z.string().min(1, 'validation.required'),
    producerType: z.enum(['Individual', 'Cooperative']),
    producerName: z.string().min(2, 'validation.required'),
    producerFaydaId: z
      .string()
      .regex(/^\d{12}$/, 'validation.faydaDigits')
      .optional()
      .or(z.literal('')),
    farmerCount: z.number().int().min(1, 'validation.positiveNumber'),
    landAreaHa: z.number().positive('validation.positiveNumber'),
    expectedQuantityQt: z.number().positive('validation.positiveNumber'),
    qualityGrade: z.string().min(1, 'validation.required'),
    deliveryWindowStart: z.string().min(1, 'validation.required'),
    deliveryWindowEnd: z.string().min(1, 'validation.required'),
    inputAdvanceObligations: z.string().min(8, 'validation.minChars8'),
    floorPriceEtbPerQt: z.number().positive('validation.positiveNumber'),
    agreedPriceEtbPerQt: z.number().positive('validation.positiveNumber'),
    pricingFormula: z.string().min(3, 'validation.required'),
    exportOriented: z.boolean(),
  })
  .refine((data) => data.agreedPriceEtbPerQt >= data.floorPriceEtbPerQt, {
    message: 'validation.agreedBelowFloor',
    path: ['agreedPriceEtbPerQt'],
  });

export type ContractWizardInput = z.infer<typeof contractWizardSchema>;

export const otpSignatureSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'validation.otp6Digits'),
  faydaId: z.string().regex(/^\d{12}$/, 'validation.faydaDigits'),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'validation.consentRequired' }),
  }),
});

export type OtpSignatureInput = z.infer<typeof otpSignatureSchema>;

export const contractDecisionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().min(4, 'validation.commentRequired'),
  notes: z.string().optional(),
});

export type ContractDecisionInput = z.infer<typeof contractDecisionSchema>;

export const linkageApplicationSchema = z.object({
  woreda: z.string().min(1, 'validation.required'),
  kebele: z.string().min(1, 'validation.required'),
  commodity: z.string().min(1, 'validation.required'),
  farmersCount: z.number().int().positive('validation.positiveNumber'),
  totalHectares: z.number().positive('validation.positiveNumber'),
  estimatedVolumeQt: z.number().positive('validation.positiveNumber'),
});

export type LinkageApplicationInput = z.infer<typeof linkageApplicationSchema>;

export const contractorCompetencySchema = z.object({
  orgName: z.string().min(2, 'validation.required'),
  tinNumber: z.string().regex(/^\d{10}$/, 'validation.tin10Digits'),
  commodityFocus: z.string().min(1, 'validation.required'),
  processingCapacityMt: z.number().positive('validation.positiveNumber'),
  performanceGuaranteeEtb: z.number().min(50000, 'validation.minGuarantee'),
  supportingDocs: z.array(z.string()).optional(),
});

export type ContractorCompetencyInput = z.infer<typeof contractorCompetencySchema>;

export const voucherIssueSchema = z.object({
  contractId: z.string().min(1, 'validation.required'),
  beneficiaryFaydaId: z.string().regex(/^\d{12}$/, 'validation.faydaDigits'),
  beneficiaryName: z.string().min(2, 'validation.required'),
  inputType: z.string().min(1, 'validation.required'),
  quantity: z.number().positive('validation.positiveNumber'),
  unit: z.string().min(1, 'validation.required'),
  valueEtb: z.number().positive('validation.positiveNumber'),
  assignedDealerOrgId: z.string().min(1, 'validation.required'),
});

export type VoucherIssueInput = z.infer<typeof voucherIssueSchema>;

export const voucherRedeemSchema = z.object({
  voucherCode: z.string().min(4, 'validation.required'),
  otpCode: z.string().regex(/^\d{6}$/, 'validation.otp6Digits'),
});

export type VoucherRedeemInput = z.infer<typeof voucherRedeemSchema>;

export const loanApplicationSchema = z.object({
  contractId: z.string().min(1, 'validation.required'),
  fiOrgId: z.string().min(1, 'validation.required'),
  applicantFaydaId: z.string().regex(/^\d{12}$/, 'validation.faydaDigits'),
  applicantName: z.string().min(2, 'validation.required'),
  principalEtb: z.number().positive('validation.positiveNumber'),
  cropCycle: z.string().min(1, 'validation.required'),
});

export type LoanApplicationInput = z.infer<typeof loanApplicationSchema>;

export const monitoringReportSchema = z.object({
  contractId: z.string().min(1, 'validation.required'),
  cropStage: z.enum([
    'LandPrep',
    'Planting',
    'Vegetative',
    'Flowering',
    'PreHarvest',
    'HarvestReady',
  ]),
  germinationRatePct: z.number().min(0).max(100),
  inputAppliedCorrectly: z.boolean(),
  sideSellingRisk: z.enum(['Low', 'Medium', 'High']),
  pestOrWeatherAlert: z.string().default('None'),
  estimatedYieldQt: z.number().positive('validation.positiveNumber'),
  gpsLat: z.number().min(3.0).max(15.0), // Ethiopia latitude bounds
  gpsLng: z.number().min(32.0).max(48.0), // Ethiopia longitude bounds
  qualityNotes: z.string().min(4, 'validation.minChars8'),
  photoDataUrl: z.string().optional(),
});

export type MonitoringReportInput = z.infer<typeof monitoringReportSchema>;

export const grievanceIntakeSchema = z.object({
  contractId: z.string().min(1, 'validation.required'),
  complainantName: z.string().min(2, 'validation.required'),
  complainantRole: z.string().min(1, 'validation.required'),
  respondentName: z.string().min(2, 'validation.required'),
  category: z.string().min(1, 'validation.required'),
  description: z.string().min(10, 'validation.minChars8'),
});

export type GrievanceIntakeInput = z.infer<typeof grievanceIntakeSchema>;

export const userCreateSchema = z.object({
  fullName: z.string().min(2, 'validation.required'),
  fullNameAm: z.string().min(2, 'validation.required'),
  email: z.string().email('validation.invalidEmail'),
  primaryRole: z.string().min(1, 'validation.required'),
  faydaId: z.string().regex(/^\d{12}$/, 'validation.faydaDigits'),
  region: z.string().optional(),
  woreda: z.string().optional(),
  orgName: z.string().optional(),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
