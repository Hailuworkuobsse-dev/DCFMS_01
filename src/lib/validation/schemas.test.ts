import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contractWizardSchema,
  otpSignatureSchema,
  monitoringReportSchema,
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
