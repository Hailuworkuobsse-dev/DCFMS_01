import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wheat,
  UserCheck,
  Banknote,
  Scale,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { api } from '../../lib/api/client';
import { formatEtb } from '../../lib/utils/format';

export interface ContractCreateWizardPageProps {
  onNavigate: (path: string) => void;
}

export const ContractCreateWizardPage: React.FC<ContractCreateWizardPageProps> = ({
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Commodity
    commodity: 'Durum Wheat',
    variety: 'Kingbird 2024 certified',
    quantityKg: 20000, // 200 Quintals
    landAreaHectares: 8.5,
    maxMoisturePercent: 12.5,
    minPurityPercent: 98.0,
    deliveryStartDate: '2025-11-01',
    deliveryEndDate: '2025-12-15',
    deliveryLocation: 'Hetosa Primary Cooperative Warehouse 01',

    // Step 2: Parties
    farmerName: 'Tadesse Bekele Mengesha',
    farmerFaydaId: 'ET-9921-4820-1192',
    farmerPhone: '+251911445566',
    region: 'Oromia',
    woreda: 'Hetosa',
    kebele: 'Kebele 04',
    contractorOrgName: 'EthioFlour Agro-Processing S.C.',
    contractorRepName: 'Dr. Hailu Zewde',
    contractorTin: '0049281729',

    // Step 3: Pricing & Escrow
    pricingModel: 'FLOOR_PLUS_MARKET_PREMIUM' as 'FIXED' | 'FLOOR_PLUS_MARKET_PREMIUM',
    unitPriceEtb: 52, // 5,200 ETB per Qtl
    floorPriceEtb: 48,
    marketPremiumPercent: 5,
    inputAdvanceValueEtb: 150000,
    escrowBank: 'Commercial Bank of Ethiopia (CBE)',

    // Step 4: Legal
    arbitrationForum: 'Woreda Agriculture Office Conciliation Panel',
    forceMajeureNoticeDays: 7,
    proclamationAccepted: true,
  });

  const totalValue = formData.quantityKg * formData.unitPriceEtb;

  const validateStep = (step: number): boolean => {
    setError(null);
    if (step === 1) {
      if (!formData.commodity || formData.quantityKg <= 0 || formData.landAreaHectares <= 0) {
        setError(t('wizard.invalidCommodity', 'Please specify valid commodity, quantity, and land area.'));
        return false;
      }
    }
    if (step === 2) {
      if (!formData.farmerName || !formData.farmerFaydaId || !formData.contractorOrgName) {
        setError(t('wizard.invalidParties', 'Buyer, producer name, and Fayda ID are required.'));
        return false;
      }
      if (formData.farmerFaydaId.replace(/\D/g, '').length < 12 && !formData.farmerFaydaId.startsWith('ET-')) {
        setError(t('wizard.invalidFayda', 'Fayda ID must be 12 digits or ET-XXXX-XXXX-XXXX format.'));
        return false;
      }
    }
    if (step === 3) {
      if (formData.unitPriceEtb <= 0) {
        setError(t('wizard.invalidPrice', 'Unit purchase price must be greater than zero.'));
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((s) => Math.min(4, s + 1));
    }
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        title: `${formData.commodity} Contract Farming Agreement - ${formData.woreda}`,
        commodity: formData.commodity,
        variety: formData.variety,
        quantityKg: Number(formData.quantityKg),
        landAreaHectares: Number(formData.landAreaHectares),
        qualitySpecs: {
          maxMoisturePercent: Number(formData.maxMoisturePercent),
          minPurityPercent: Number(formData.minPurityPercent),
          grade: 'Grade 1',
        },
        farmerId: 'usr-farmer-001',
        farmerName: formData.farmerName,
        farmerFaydaId: formData.farmerFaydaId,
        farmerPhone: formData.farmerPhone,
        contractorId: 'usr-contractor-001',
        contractorOrgName: formData.contractorOrgName,
        region: formData.region,
        woreda: formData.woreda,
        kebele: formData.kebele,
        pricingModel: formData.pricingModel,
        unitPriceEtb: Number(formData.unitPriceEtb),
        floorPriceEtb: Number(formData.floorPriceEtb),
        marketPremiumPercent: Number(formData.marketPremiumPercent),
        totalValueEtb: totalValue,
        inputAdvanceValueEtb: Number(formData.inputAdvanceValueEtb),
        deliveryStartDate: formData.deliveryStartDate,
        deliveryEndDate: formData.deliveryEndDate,
        deliveryLocation: formData.deliveryLocation,
      };

      const res = await api.contracts.create(payload);
      onNavigate(`/contracts/${res.contract.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit contract.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={t('wizard.pageTitle', 'New Contract Farming Agreement')}
        subtitle={t(
          'wizard.pageSubtitle',
          'Create a legally compliant tripartite agreement under Proclamation No. 1289/2023'
        )}
        breadcrumbs={[
          { label: t('nav.contracts', 'Contracts'), href: '#' },
          { label: t('wizard.newContract', 'New Agreement') },
        ]}
      />

      {/* Step Progress Indicators */}
      <div className="grid grid-cols-4 border border-stone-200 bg-white">
        {[
          { num: 1, label: t('wizard.stepCommodity', 'Commodity & Plot'), icon: Wheat },
          { num: 2, label: t('wizard.stepParties', 'Parties & e-KYC'), icon: UserCheck },
          { num: 3, label: t('wizard.stepPricing', 'Pricing & Escrow'), icon: Banknote },
          { num: 4, label: t('wizard.stepLegal', 'Legal & Review'), icon: Scale },
        ].map((step) => {
          const isActive = currentStep === step.num;
          const isCompleted = currentStep > step.num;
          return (
            <div
              key={step.num}
              className={`p-3 sm:p-4 border-r last:border-r-0 flex items-center gap-2.5 transition-colors ${
                isActive
                  ? 'bg-stone-900 text-white font-semibold'
                  : isCompleted
                  ? 'bg-forest-50 text-forest-800'
                  : 'bg-white text-stone-500'
              }`}
            >
              <div
                className={`w-6 h-6 flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                  isActive
                    ? 'bg-white text-stone-900'
                    : isCompleted
                    ? 'bg-forest-700 text-white'
                    : 'bg-stone-200 text-stone-700'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.num}
              </div>
              <div className="hidden sm:block min-w-0">
                <p className="text-xs truncate">{step.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Wizard Content Card */}
      <div className="bg-white border border-stone-300 p-6 sm:p-8 shadow-xs space-y-6">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Commodity & Plot */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-stone-900 border-b border-stone-200 pb-2">
              Step 1: Agricultural Commodity & Production Specifications
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Crop Commodity
                </label>
                <select
                  value={formData.commodity}
                  onChange={(e) => setFormData({ ...formData, commodity: e.target.value })}
                  className="w-full text-xs bg-white border border-stone-300 px-3 py-2 text-stone-800 focus:outline-none focus:border-stone-900"
                >
                  <option value="Durum Wheat">Durum Wheat (ስንዴ)</option>
                  <option value="Malt Barley">Malt Barley (ገብስ)</option>
                  <option value="Sesame Seed">Sesame Seed (ሰሊጥ)</option>
                  <option value="Soybean">Soybean (አኩሪ አተር)</option>
                  <option value="Coffee Arabica">Coffee Arabica (ቡና)</option>
                  <option value="White Teff">White Teff (ነጭ ጤፍ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Certified Variety / Line
                </label>
                <input
                  type="text"
                  value={formData.variety}
                  onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
                  className="w-full text-xs bg-white border border-stone-300 px-3 py-2 text-stone-800 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Target Quantity (Kg)
                </label>
                <input
                  type="number"
                  value={formData.quantityKg}
                  onChange={(e) => setFormData({ ...formData, quantityKg: Number(e.target.value) })}
                  className="w-full text-xs bg-white border border-stone-300 px-3 py-2 font-mono text-stone-800 focus:outline-none focus:border-stone-900"
                />
                <p className="text-[11px] text-stone-500 mt-0.5">
                  = {(formData.quantityKg / 100).toFixed(1)} Quintals (ኩንታል)
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Cultivated Land Area (Hectares)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.landAreaHectares}
                  onChange={(e) => setFormData({ ...formData, landAreaHectares: Number(e.target.value) })}
                  className="w-full text-xs bg-white border border-stone-300 px-3 py-2 font-mono text-stone-800 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Max Allowable Moisture (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.maxMoisturePercent}
                  onChange={(e) => setFormData({ ...formData, maxMoisturePercent: Number(e.target.value) })}
                  className="w-full text-xs bg-white border border-stone-300 px-3 py-2 font-mono text-stone-800 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Delivery Destination
                </label>
                <input
                  type="text"
                  value={formData.deliveryLocation}
                  onChange={(e) => setFormData({ ...formData, deliveryLocation: e.target.value })}
                  className="w-full text-xs bg-white border border-stone-300 px-3 py-2 text-stone-800 focus:outline-none focus:border-stone-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Parties & Fayda ID */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-stone-900 border-b border-stone-200 pb-2">
              Step 2: Legal Parties & Fayda National e-KYC Verification
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 p-3 bg-stone-50 border border-stone-200 text-xs">
                <span className="font-bold text-stone-900">Contractor / Industrial Buyer</span>
                <p className="text-stone-600 mt-1">
                  {formData.contractorOrgName} (TIN: {formData.contractorTin}) • Rep: {formData.contractorRepName}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Smallholder Producer / Representative Name
                </label>
                <input
                  type="text"
                  value={formData.farmerName}
                  onChange={(e) => setFormData({ ...formData, farmerName: e.target.value })}
                  className="w-full text-xs bg-white border border-stone-300 px-3 py-2 text-stone-800 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Fayda National ID (12-Digit)
                </label>
                <input
                  type="text"
                  value={formData.farmerFaydaId}
                  onChange={(e) => setFormData({ ...formData, farmerFaydaId: e.target.value })}
                  placeholder="ET-XXXX-XXXX-XXXX"
                  className="w-full text-xs bg-white border border-stone-300 px-3 py-2 font-mono text-forest-800 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Producer Phone (SMS / USSD)
                </label>
                <input
                  type="text"
                  value={formData.farmerPhone}
                  onChange={(e) => setFormData({ ...formData, farmerPhone: e.target.value })}
                  className="w-full text-xs bg-white border border-stone-300 px-3 py-2 font-mono text-stone-800 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Jurisdiction (Region & Woreda)
                </label>
                <input
                  type="text"
                  disabled
                  value={`${formData.region} • ${formData.woreda} (${formData.kebele})`}
                  className="w-full text-xs bg-stone-100 border border-stone-300 px-3 py-2 text-stone-600 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Pricing & Escrow */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-stone-900 border-b border-stone-200 pb-2">
              Step 3: Pricing Mechanism & Financial Guarantees
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Statutory Pricing Model
                </label>
                <select
                  value={formData.pricingModel}
                  onChange={(e) => setFormData({ ...formData, pricingModel: e.target.value as any })}
                  className="w-full text-xs bg-white border border-stone-300 px-3 py-2 text-stone-800 focus:outline-none focus:border-stone-900"
                >
                  <option value="FLOOR_PLUS_MARKET_PREMIUM">
                    Floor Price + Market Premium (Recommended)
                  </option>
                  <option value="FIXED">Fixed Price Agreement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Purchase Price (ETB / Kg)
                </label>
                <input
                  type="number"
                  value={formData.unitPriceEtb}
                  onChange={(e) => setFormData({ ...formData, unitPriceEtb: Number(e.target.value) })}
                  className="w-full text-xs bg-white border border-stone-300 px-3 py-2 font-mono text-stone-800 focus:outline-none focus:border-stone-900"
                />
                <p className="text-[11px] text-stone-500 mt-0.5">
                  = {(formData.unitPriceEtb * 100).toLocaleString()} ETB / Quintal
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Guaranteed Floor Price (ETB / Kg)
                </label>
                <input
                  type="number"
                  value={formData.floorPriceEtb}
                  onChange={(e) => setFormData({ ...formData, floorPriceEtb: Number(e.target.value) })}
                  className="w-full text-xs bg-white border border-stone-300 px-3 py-2 font-mono text-stone-800 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Input Pre-financing Advance (ETB)
                </label>
                <input
                  type="number"
                  value={formData.inputAdvanceValueEtb}
                  onChange={(e) => setFormData({ ...formData, inputAdvanceValueEtb: Number(e.target.value) })}
                  className="w-full text-xs bg-white border border-stone-300 px-3 py-2 font-mono text-stone-800 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div className="sm:col-span-2 p-4 bg-forest-50 border border-forest-200">
                <div className="flex justify-between items-center text-sm font-bold text-forest-900">
                  <span>Gross Contract Commitment:</span>
                  <span className="font-mono text-base">{formatEtb(totalValue)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-forest-700 mt-1">
                  <span>Buyer Escrow Deposit Required (100%):</span>
                  <span className="font-mono">{formatEtb(totalValue)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Legal & Review */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-stone-900 border-b border-stone-200 pb-2">
              Step 4: Statutory Legal Review & Final Declarations
            </h3>

            <div className="space-y-3 text-xs text-stone-700">
              <div className="p-4 bg-stone-50 border border-stone-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">Agreed Commodity:</span>
                  <span className="font-semibold text-stone-900">{formData.commodity} ({formData.variety})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Total Quota:</span>
                  <span className="font-mono font-semibold text-stone-900">
                    {formData.quantityKg.toLocaleString()} Kg ({(formData.quantityKg / 100).toFixed(0)} Qtl)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Total Purchase Value:</span>
                  <span className="font-mono font-bold text-forest-800">{formatEtb(totalValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Buyer Entity:</span>
                  <span className="font-semibold text-stone-900">{formData.contractorOrgName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Producer:</span>
                  <span className="font-semibold text-stone-900">{formData.farmerName} ({formData.farmerFaydaId})</span>
                </div>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 text-xs space-y-1">
                <span className="font-semibold text-stone-900">Dispute Escalation Hierarchy:</span>
                <p className="text-stone-600">
                  1. Kebele Development Agent (DA) fact-finding &rarr; 2. WBoA Woreda Tripartite Mediation (Max 15 days) &rarr; 3. Woreda Court Binding Adjudication.
                </p>
              </div>

              <div className="flex items-start gap-2 pt-2">
                <input
                  id="proclamation"
                  type="checkbox"
                  checked={formData.proclamationAccepted}
                  onChange={(e) => setFormData({ ...formData, proclamationAccepted: e.target.checked })}
                  className="mt-0.5 rounded-none border-stone-300 text-forest-700 focus:ring-forest-600 h-4 w-4"
                />
                <label htmlFor="proclamation" className="cursor-pointer select-none">
                  We confirm that this contract conforms to Ethiopian Contract Farming Proclamation No. 1289/2023, incorporates statutory floor pricing, and will be submitted for Woreda Bureau of Agriculture (WBoA) official endorsement.
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-stone-200">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1 || isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 disabled:opacity-40"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('common.back', 'Back')}</span>
          </button>

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 shadow-xs"
            >
              <span>{t('common.next', 'Continue')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.proclamationAccepted}
              className="inline-flex items-center gap-1.5 px-6 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 shadow-xs disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? t('common.submitting', 'Submitting Agreement...') : t('wizard.createDraft', 'Submit Tripartite Contract')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
