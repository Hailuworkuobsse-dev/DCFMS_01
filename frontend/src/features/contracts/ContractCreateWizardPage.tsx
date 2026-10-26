import React, { useEffect, useState } from 'react';
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
import type { LinkageRequest } from '../../types/api';

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
  const [linkedDemand, setLinkedDemand] = useState<LinkageRequest | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [partyQuery, setPartyQuery] = useState('');
  const [partyResults, setPartyResults] = useState<any[]>([]);
  const [selectedProducers, setSelectedProducers] = useState<any[]>([]);
  const [selectedParcelIds, setSelectedParcelIds] = useState<string[]>([]);
  const [isSearchingParties, setIsSearchingParties] = useState(false);

  useEffect(() => {
    const linkageId = new URLSearchParams(window.location.search).get('linkageId');
    if (!linkageId) return;
    let cancelled = false;
    void api.linkages.list().then(({ linkages }) => {
      if (cancelled) return;
      const demand = linkages.find((item) => item.id === linkageId);
      if (!demand) {
        setError(t('wizard.linkageNotFound', 'The selected demand could not be found or is outside your access scope. Please select the contract details manually.'));
        return;
      }
      setLinkedDemand(demand);
      setFormData((current) => ({
        ...current,
        commodity: demand.commodity || current.commodity,
        quantityKg: Number(demand.estimatedVolumeQt || 0) * 100 || current.quantityKg,
        landAreaHectares: Number(demand.totalHectares || 0) || current.landAreaHectares,
        region: demand.region || current.region,
        woreda: demand.woreda || current.woreda,
        kebele: demand.kebele || current.kebele,
        contractorOrgName: demand.buyerOrgName || current.contractorOrgName,
      }));
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : t('wizard.linkageLoadFailed', 'Unable to load the selected demand.'));
    });
    return () => { cancelled = true; };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    void api.contracts.templates().then(({ templates: approved }) => {
      if (!cancelled) setTemplates(approved);
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load approved contract templates.');
    });
    return () => { cancelled = true; };
  }, []);

  const searchProducers = async () => {
    setIsSearchingParties(true);
    setError(null);
    try {
      const result = await api.contracts.lookupParties(partyQuery);
      setPartyResults(result.parties);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to search the verified producer directory.');
      setPartyResults([]);
    } finally {
      setIsSearchingParties(false);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Commodity
    commodity: '',
    variety: '',
    quantityKg: 0,
    landAreaHectares: 0,
    maxMoisturePercent: 0,
    minPurityPercent: 0,
    deliveryStartDate: '',
    deliveryEndDate: '',
    deliveryLocation: '',

    // Step 2: Parties
    farmerRecordId: '',
    region: '',
    woreda: '',
    kebele: '',
    contractorOrgName: '',

    // Step 3: Pricing & Escrow
    pricingModel: 'FIXED' as 'FIXED' | 'FLOOR_PLUS_MARKET_PREMIUM',
    unitPriceEtb: 0,
    floorPriceEtb: 0,
    marketPremiumPercent: 0,
    inputAdvanceValueEtb: 0,
    escrowBank: '',

    // Step 4: Legal
    arbitrationForum: '',
    forceMajeureNoticeDays: 7,
    proclamationAccepted: false,
  });

  const selectedParcelArea = selectedProducers.reduce((sum, producer) => sum + producer.parcels.filter((parcel: any) => selectedParcelIds.includes(parcel.id)).reduce((parcelSum: number, parcel: any) => parcelSum + Number(parcel.sizeHa || 0), 0), 0);
  const totalValue = formData.quantityKg * (formData.pricingModel === 'FIXED' ? formData.unitPriceEtb : formData.floorPriceEtb);

  const validateStep = (step: number): boolean => {
    setError(null);
    if (step === 1) {
      if (!templateId) {
        setError(t('wizard.templateRequired', 'Select an approved contract template before drafting.'));
        return false;
      }
      if (!formData.commodity || formData.quantityKg <= 0) {
        setError(t('wizard.invalidCommodity', 'Please specify a commodity and a positive quantity.'));
        return false;
      }
      if (formData.maxMoisturePercent <= 0 || formData.maxMoisturePercent > 100 || formData.minPurityPercent <= 0 || formData.minPurityPercent > 100) {
        setError('Enter valid moisture and purity percentages between greater than 0 and 100.');
        return false;
      }
    }
    if (step === 2) {
      if (selectedProducers.length === 0 || selectedParcelIds.length === 0 || selectedParcelArea <= 0 || selectedProducers.some((producer) => !producer.parcels.some((parcel: any) => selectedParcelIds.includes(parcel.id)))) {
        setError(t('wizard.invalidParties', 'Select at least one verified producer and one available parcel.'));
        return false;
      }
    }
    if (step === 3) {
      if (formData.pricingModel === 'FIXED' && formData.unitPriceEtb <= 0) {
        setError(t('wizard.invalidPrice', 'Fixed unit purchase price must be greater than zero.'));
        return false;
      }
      if (formData.pricingModel === 'FLOOR_PLUS_MARKET_PREMIUM' && formData.floorPriceEtb <= 0) {
        setError(t('wizard.invalidFloorPrice', 'Floor price must be greater than zero for a floor-plus-market-premium contract.'));
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
        commodity: formData.commodity,
        quantity: Number(formData.quantityKg) / 100,
        unit: 'quintal',
        templateId,
        quality: `Variety: ${formData.variety}; max moisture: ${Number(formData.maxMoisturePercent)}%; minimum purity: ${Number(formData.minPurityPercent)}%`,
        priceMechanism: formData.pricingModel === 'FIXED' ? 'FIXED' : 'MARKET',
        fixedPrice: formData.pricingModel === 'FIXED' ? Number(formData.unitPriceEtb) : undefined,
        deliveryStart: formData.deliveryStartDate || undefined,
        deliveryEnd: formData.deliveryEndDate || undefined,
        region: formData.region || undefined,
        woreda: formData.woreda || undefined,
        content: {
          title: `${formData.commodity} Contract Farming Agreement`,
          templateTitle: templates.find((template) => template.id === templateId)?.title,
          clauses: templates.find((template) => template.id === templateId)?.clauses || [],
          variety: formData.variety,
          landAreaHectares: selectedParcelArea,
          qualitySpecs: {
            maxMoisturePercent: Number(formData.maxMoisturePercent),
            minPurityPercent: Number(formData.minPurityPercent),
            grade: 'Grade 1',
          },
          pricing: {
            pricingModel: formData.pricingModel,
            unitPriceEtb: Number(formData.unitPriceEtb),
            floorPriceEtb: Number(formData.floorPriceEtb),
            marketPremiumPercent: Number(formData.marketPremiumPercent),
            totalValueEtb: totalValue,
            inputAdvanceValueEtb: Number(formData.inputAdvanceValueEtb),
          },
          deliveryLocation: formData.deliveryLocation,
          deliveryStartDate: formData.deliveryStartDate || null,
          deliveryEndDate: formData.deliveryEndDate || null,
          proclamationAccepted: formData.proclamationAccepted,
          linkageId: linkedDemand?.id ?? null,
        },
        parties: selectedProducers.map((producer) => ({ role: 'FARMER', farmerId: producer.id })),
        parcelIds: selectedParcelIds,
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

      {linkedDemand && (
        <div className="flex items-start gap-3 rounded-xl border border-forest-200 bg-forest-50 p-4 text-sm text-forest-900" role="status">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-semibold">{t('wizard.linkedDemand', 'Creating a contract from a market demand')}</p><p className="mt-1">{linkedDemand.commodity} · {linkedDemand.estimatedVolumeQt.toLocaleString()} Qt · {linkedDemand.woreda}, {linkedDemand.kebele}. Verify buyer, farmer identity, quantity, dates and price before submitting.</p></div>
        </div>
      )}

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
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">Approved contract template</label>
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full text-xs bg-white border border-stone-300 px-3 py-2 text-stone-800">
                  <option value="">Select an approved template…</option>
                  {templates.filter((template) => !template.commodity || template.commodity === formData.commodity).map((template) => (
                    <option key={template.id} value={template.id}>{template.title} · v{template.version} · {template.language.toUpperCase()}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-stone-500">Only templates approved by the system administrator are available. Mandatory and locked clauses are validated again by the backend.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Crop Commodity
                </label>
                <select
                  value={formData.commodity}
                  onChange={(e) => setFormData({ ...formData, commodity: e.target.value })}
                  className="w-full text-xs bg-white border border-stone-300 px-3 py-2 text-stone-800 focus:outline-none focus:border-stone-900"
                >
                  <option value="">Select commodity…</option>
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
                <label className="block text-xs font-semibold text-stone-700 mb-1">Cultivated land area</label>
                <div className="w-full border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-xs text-stone-600">{selectedParcelArea.toFixed(2)} hectares</div>
                <p className="mt-1 text-[11px] text-stone-500">Calculated from parcels selected in Step 2; it cannot be manually overridden.</p>
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
                <label className="block text-xs font-semibold text-stone-700 mb-1">Minimum Grain Purity (%)</label>
                <input type="number" min="0" max="100" step="0.1" value={formData.minPurityPercent} onChange={(e) => setFormData({ ...formData, minPurityPercent: Number(e.target.value) })} className="w-full text-xs bg-white border border-stone-300 px-3 py-2 font-mono text-stone-800 focus:outline-none focus:border-stone-900" />
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

        {/* STEP 2: Registered parties */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-stone-900 border-b border-stone-200 pb-2">
              Step 2: Registered Contract Parties
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 p-3 bg-stone-50 border border-stone-200 text-xs">
                <span className="font-bold text-stone-900">Contracting organization</span>
                <p className="text-stone-600 mt-1">
                  The backend binds the contractor/cooperative party to your authenticated, registered account. Party identity is not accepted from this form.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">Search verified producer directory</label>
                <div className="flex gap-2">
                  <input type="search" autoComplete="off" value={partyQuery} onChange={(e) => setPartyQuery(e.target.value)} placeholder="Search by registered farmer name or phone" className="min-w-0 flex-1 text-xs bg-white border border-stone-300 px-3 py-2" />
                  <button type="button" disabled={isSearchingParties || partyQuery.trim().length < 2} onClick={() => void searchProducers()} className="rounded bg-stone-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{isSearchingParties ? 'Searching…' : 'Search'}</button>
                </div>
                {partyResults.length > 0 && (
                  <div className="mt-2 divide-y border border-stone-200 rounded-lg">
                    {partyResults.map((party) => (
                      <button key={party.id} type="button" onClick={() => {
                        if (selectedProducers.some((selected) => selected.id === party.id)) return;
                        if (selectedProducers.length && (selectedProducers[0].user.region !== party.user.region || selectedProducers[0].user.woreda !== party.user.woreda)) {
                          setError('A single contract cannot combine producers from different regions or woredas.');
                          return;
                        }
                        setSelectedProducers((current) => [...current, party]);
                        setFormData((current) => ({ ...current, farmerRecordId: current.farmerRecordId || party.id, region: party.user.region || '', woreda: party.user.woreda || '', kebele: party.user.kebele || '' }));
                        setPartyResults([]);
                      }} disabled={selectedProducers.some((selected) => selected.id === party.id)} className="block w-full p-3 text-left hover:bg-stone-50 disabled:opacity-50">
                        <span className="block text-xs font-semibold text-stone-900">{party.user.fullName}</span>
                        <span className="block mt-1 text-xs text-stone-600">{party.user.region} · {party.user.woreda} · {party.user.kebele || 'Kebele not recorded'}</span>
                        <span className="block mt-1 text-[11px] text-stone-500">{party.parcels.length} available parcel(s) · {party.parcels.reduce((sum: number, parcel: any) => sum + Number(parcel.sizeHa || 0), 0).toFixed(2)} ha available</span>
                        <span className="mt-1 block text-[11px] font-semibold text-forest-800">{selectedProducers.some((selected) => selected.id === party.id) ? 'Already selected' : 'Add producer and choose parcels'}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedProducers.length > 0 && <div className="mt-3 space-y-3" role="status">
                  <p className="text-xs font-semibold text-stone-900">Selected registered producers ({selectedProducers.length})</p>
                  {selectedProducers.map((producer) => <div key={producer.id} className="rounded border border-forest-200 bg-forest-50 p-3">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-forest-900">{producer.user.fullName}</p><p className="mt-1 text-[11px] text-forest-800">Record {producer.id} · {producer.user.region} · {producer.user.woreda}</p></div>
                    <button type="button" className="text-xs underline" onClick={() => {
                      setSelectedProducers((current) => current.filter((item) => item.id !== producer.id));
                      setSelectedParcelIds((current) => current.filter((parcelId) => !producer.parcels.some((parcel: any) => parcel.id === parcelId)));
                      setFormData((current) => ({ ...current, farmerRecordId: selectedProducers.filter((item) => item.id !== producer.id)[0]?.id || '', region: selectedProducers.filter((item) => item.id !== producer.id)[0]?.user.region || '', woreda: selectedProducers.filter((item) => item.id !== producer.id)[0]?.user.woreda || '', kebele: selectedProducers.filter((item) => item.id !== producer.id)[0]?.user.kebele || '' }));
                    }}>Remove</button></div>
                    <p className="mt-3 text-[11px] font-semibold text-stone-700">Choose parcel(s) for this agreement</p>
                    <div className="mt-2 space-y-2">{producer.parcels.map((parcel: any) => <label key={parcel.id} className="flex items-start gap-2 text-xs text-stone-700">
                      <input type="checkbox" checked={selectedParcelIds.includes(parcel.id)} onChange={(event) => {
                        setSelectedParcelIds((current) => event.target.checked ? [...current, parcel.id] : current.filter((id) => id !== parcel.id));
                      }} />
                      <span>{parcel.name} · {parcel.sizeHa} ha{parcel.crop ? ` · ${parcel.crop}` : ''}{parcel.season ? ` · ${parcel.season}` : ''}</span>
                    </label>)}</div>
                  </div>)}
                </div>}
                <p className="mt-1 text-xs text-stone-500">Only active registered producers with available parcels are returned. Every selected producer and parcel is revalidated by the backend before the draft is created.</p>
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
                  <span className="font-semibold text-stone-900">{formData.contractorOrgName || 'Authenticated organization'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Producer:</span>
                  <span className="font-semibold text-stone-900">{selectedProducers.length ? selectedProducers.map((producer) => producer.user.fullName).join(', ') : 'Producer not selected'}</span>
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
              <span>{isSubmitting ? t('common.submitting', 'Submitting Agreement...') : t('wizard.createDraft', 'Save Draft')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
