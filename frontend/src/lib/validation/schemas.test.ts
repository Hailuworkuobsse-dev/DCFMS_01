import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contractWizardSchema,
  grievanceEscalationSchema,
  grievanceIntakeSchema,
  grievanceResolutionSchema,
  loanDecisionSchema,
  otpSignatureSchema,
  monitoringReportSchema,
  settlementCreateSchema,
} from './schemas';

test('contractWizardSchema enforces 12-digit Fayda ID and floor price invariant', () => {
  const validData = {
    templateId: 'tpl-moa-barley',
    title: 'Malt Barley Supply Contract',
    commodity: 'Malt Barley',
    variety: 'Holker',
    region: 'Oromia',
    woreda: "Ada'a",
    kebele: 'Ude',
    producerType: 'Cooperative' as const,
    producerName: 'Erba Farmers Union',
    producerFaydaId: '123456789012',
    farmerCount: 85,
    landAreaHa: 120,
    expectedQuantityQt: 2400,
    qualityGrade: 'Grade 1',
    deliveryWindowStart: '2026-11-01',
    deliveryWindowEnd: '2026-12-15',
    inputAdvanceObligations: 'Certified seed and DAP fertilizer provided on credit.',
    floorPriceEtbPerQt: 3500,
    agreedPriceEtbPerQt: 3950,
    pricingFormula: 'Base 3950 + 5% protein premium',
    exportOriented: false,
  };

  const parsed = contractWizardSchema.safeParse(validData);
  assert.equal(parsed.success, true);

  const invalidPrice = { ...validData, agreedPriceEtbPerQt: 3200 };
  const priceCheck = contractWizardSchema.safeParse(invalidPrice);
  assert.equal(priceCheck.success, false);
});

test('otpSignatureSchema requires 6 numeric digits and explicit consent', () => {
  const valid = otpSignatureSchema.safeParse({
    otp: '123456',
    faydaId: '987654321012',
    consent: true,
  });
  assert.equal(valid.success, true);

  const invalidOtp = otpSignatureSchema.safeParse({
    otp: '123',
    faydaId: '987654321012',
    consent: true,
  });
  assert.equal(invalidOtp.success, false);
});

test('monitoringReportSchema enforces Ethiopian geographic bounds', () => {
  const valid = monitoringReportSchema.safeParse({
    contractId: 'CTR-2026-001',
    cropStage: 'Vegetative',
    germinationRatePct: 92,
    inputAppliedCorrectly: true,
    sideSellingRisk: 'Low',
    pestOrWeatherAlert: 'Normal weather conditions',
    estimatedYieldQt: 1200,
    gpsLat: 8.7512,
    gpsLng: 38.9841,
    qualityNotes: 'Inspected parcel quadrants; certified seed row-spacing verified.',
  });
  assert.equal(valid.success, true);

  const invalidGps = monitoringReportSchema.safeParse({
    contractId: 'CTR-2026-001',
    cropStage: 'Vegetative',
    germinationRatePct: 92,
    inputAppliedCorrectly: true,
    sideSellingRisk: 'Low',
    pestOrWeatherAlert: 'Normal',
    estimatedYieldQt: 1200,
    gpsLat: 52.52, // Germany - invalid for Ethiopia
    gpsLng: 13.405,
    qualityNotes: 'Test notes description.',
  });
  assert.equal(invalidGps.success, false);
});

test('loan decisions require an explicit outcome and rationale', () => {
  assert.equal(loanDecisionSchema.safeParse({ action: 'approve', reason: 'Credit check passed.' }).success, true);
  assert.equal(loanDecisionSchema.safeParse({ action: 'approve', reason: 'ok' }).success, false);
  assert.equal(loanDecisionSchema.safeParse({ action: 'hold', reason: 'More review needed.' }).success, false);
});

test('grievance intake and closure require the workflow fields and auditable explanations', () => {
  const intake = {
    contractId: 'CTR-2026-001',
    category: 'QUALITY',
    title: 'Moisture measurement dispute',
    severity: 'HIGH',
    description: 'The recorded grain moisture reading differs between the parties.',
  };
  assert.equal(grievanceIntakeSchema.safeParse(intake).success, true);
  assert.equal(grievanceIntakeSchema.safeParse({ ...intake, title: '' }).success, false);
  assert.equal(grievanceResolutionSchema.safeParse({ resolutionSummary: 'Secondary inspection completed and accepted by both parties.' }).success, true);
  assert.equal(grievanceResolutionSchema.safeParse({ resolutionSummary: 'Done.' }).success, false);
  assert.equal(grievanceEscalationSchema.safeParse({ reason: 'No agreement was reached at the woreda mediation.' }).success, true);
  assert.equal(grievanceEscalationSchema.safeParse({ reason: '' }).success, false);
});

test('settlement creation requires a unique delivery reference, positive volume, and supported payout channel', () => {
  const settlement = {
    contractId: 'CTR-2026-001',
    deliveryReference: 'DEL-0001',
    deliveredKg: 4200,
    disbursementChannel: 'Telebirr',
  };
  assert.equal(settlementCreateSchema.safeParse(settlement).success, true);
  assert.equal(settlementCreateSchema.safeParse({ ...settlement, deliveredKg: 0 }).success, false);
  assert.equal(settlementCreateSchema.safeParse({ ...settlement, disbursementChannel: 'Cash' }).success, false);
});
