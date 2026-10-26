import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  Wheat,
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  Stamp,
} from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { ContractNegotiationPanel } from './ContractNegotiationPanel';
import { StatusBadge } from '../../components/primitives/StatusBadge';
import { Timeline, TimelineEvent } from '../../components/primitives/Timeline';
import { SignatureOTPModal } from '../../components/primitives/SignatureOTPModal';
import { ConfirmDialog } from '../../components/primitives/ConfirmDialog';
import { api } from '../../lib/api/client';
import { Contract } from '../../types/api';
import { useAppStore } from '../../store/useAppStore';
import { formatEtb, formatShortDate, downloadTextFile } from '../../lib/utils/format';

export interface ContractDetailPageProps {
  contractId: string;
  onNavigate?: (path: string) => void;
}

export const ContractDetailPage: React.FC<ContractDetailPageProps> = ({
  contractId,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAppStore();
  const [contract, setContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isEndorseModalOpen, setIsEndorseModalOpen] = useState(false);
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);

  const fetchContract = async () => {
    setIsLoading(true);
    try {
      const res = await api.contracts.get(contractId);
      setContract(res.contract);
    } catch (err: any) {
      console.error('Failed to get contract:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContract();
  }, [contractId]);

  if (isLoading || !contract) {
    return (
      <div className="p-8 text-center text-xs text-stone-500 font-mono">
        {t('common.loading', 'Loading contract details...')}
      </div>
    );
  }

  const quantityKg = contract.quantityKg ?? (contract.expectedQuantityQt ? contract.expectedQuantityQt * 100 : 0);
  const landAreaHa = contract.landAreaHectares ?? contract.landAreaHa ?? 0;
  const unitPrice = contract.unitPriceEtb ?? (contract.agreedPriceEtbPerQt ? contract.agreedPriceEtbPerQt / 100 : 0);
  const buyerName = contract.contractorOrgName || contract.contractorName || 'Contracting organization';
  const producerName = contract.farmerName || contract.producerName || 'Registered producer';
  const deliveryStart = contract.deliveryStartDate || contract.deliveryWindowStart || '';
  const deliveryEnd = contract.deliveryEndDate || contract.deliveryWindowEnd || '';
  const deliveryPoint = contract.deliveryLocation || 'Not specified';
  const maxMoisture = contract.qualitySpecs?.maxMoisturePercent;
  const minPurity = contract.qualitySpecs?.minPurityPercent;
  const grade = contract.qualitySpecs?.grade || contract.qualityGrade || 'Not specified';

  const handleSign = async (data: { otpCode: string; declarationAccepted: boolean }) => {
    // The backend authenticates the signer via JWT; the Fayda ID is only
    // enforced by the mock API path (farmers get their FIN from the directory,
    // other backend roles fall back to a placeholder the backend ignores).
    await api.contracts.sign(contract.id, {
      faydaId: currentUser?.faydaId ?? '',
      otpCode: data.otpCode,
      consent: data.declarationAccepted,
    });
    await fetchContract();
  };

  const handleSendForSignature = async () => {
    setIsSubmittingSignature(true);
    try {
      await api.contracts.sendForSignature(contract.id);
      await fetchContract();
    } catch (err: any) {
      console.error('Unable to submit contract for signatures', err);
    } finally {
      setIsSubmittingSignature(false);
    }
  };

  const handleEndorse = async () => {
    try {
      await api.contracts.endorse(contract.id, {
        notes: 'Endorsed after technical and floor price compliance check.',
      });
      setIsEndorseModalOpen(false);
      await fetchContract();
    } catch (err: any) {
      console.error('Endorsement failed', err);
    }
  };

  const handleExportText = () => {
    const textContent = `
========================================================================
FEDERAL DEMOCRATIC REPUBLIC OF ETHIOPIA
AGRICULTURAL TRANSFORMATION INSTITUTE (ATI)
DIGITAL CONTRACT FARMING MANAGEMENT SYSTEM (DCFMS)
LEGAL CONTRACT AGREEMENT
Proclamation No. 1289/2023
========================================================================
Contract Number: ${contract.contractNumber}
Date Created: ${contract.createdAt}
Status: ${contract.status}

1. COMMODITY & QUOTA
- Commodity: ${contract.commodity} (${contract.variety || 'Standard'})
- Quantity: ${quantityKg} Kg (${(quantityKg / 100).toFixed(1)} Quintals)
- Land Area: ${landAreaHa} Hectares
- Max Moisture: ${maxMoisture ?? 'Not specified'}%
- Min Purity: ${minPurity ?? 'Not specified'}%

2. PARTIES
- Buyer: ${buyerName}
- Producer: ${producerName} (Fayda ID: ${contract.farmerFaydaId || contract.producerFaydaId || 'N/A'})
- Location: ${contract.woreda}, ${contract.region} (${contract.kebele || ''})

3. COMMERCIAL TERMS
- Purchase Price: ETB ${unitPrice} / Kg
- Total Value: ETB ${contract.totalValueEtb.toLocaleString()}
- Delivery: ${deliveryStart} to ${deliveryEnd}
- Destination: ${deliveryPoint}
========================================================================
Generated by DCFMS Production Engine
    `.trim();

    downloadTextFile(
      `${contract.contractNumber}-Agreement.txt`,
      textContent,
      'text/plain;charset=utf-8;'
    );
  };

  const timelineEvents: TimelineEvent[] = [
    {
      id: 'evt-1',
      title: 'Contract Created',
      description: 'Initial tripartite terms drafted and submitted into DCFMS registry.',
      timestamp: contract.createdAt,
      actor: buyerName,
      actorRole: 'Buyer',
      status: 'completed',
    },
    ...(contract.signatures?.producerSignedAt || contract.signatures?.farmer
      ? [
          {
            id: 'evt-2',
            title: 'Producer E-Signature Executed',
            description: 'Cryptographic authorization verified via SMS/USSD OTP (Fayda e-KYC).',
            timestamp: contract.signatures.producerSignedAt || contract.signatures.farmer?.signedAt || contract.createdAt,
            actor: producerName,
            actorRole: 'Producer',
            status: 'completed' as const,
          },
        ]
      : []),
    ...(contract.signatures?.contractorSignedAt || contract.signatures?.contractor
      ? [
          {
            id: 'evt-3',
            title: 'Buyer E-Signature Executed',
            description: 'Industrial processor authorization verified.',
            timestamp: contract.signatures.contractorSignedAt || contract.signatures.contractor?.signedAt || contract.createdAt,
            actor: buyerName,
            actorRole: 'Contractor',
            status: 'completed' as const,
          },
        ]
      : []),
    ...(contract.approvals?.woredaApprovedBy || contract.wboaEndorsement
      ? [
          {
            id: 'evt-4',
            title: 'WBoA Statutory Endorsement Stamped',
            description: `Official registration #${contract.wboaEndorsement?.registrationNumber || 'Not recorded'} recorded under Proclamation 1289/2023.`,
            timestamp: contract.approvals?.woredaApprovedAt || contract.wboaEndorsement?.endorsedAt || contract.updatedAt,
            actor: contract.approvals?.woredaApprovedBy || contract.wboaEndorsement?.endorsedBy || 'WBoA Officer',
            actorRole: 'WBoA Woreda Officer',
            status: 'completed' as const,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={contract.title || `${contract.commodity} Contract Farming Agreement`}
        subtitle={`Contract #${contract.contractNumber} • ${contract.woreda}, ${contract.region}`}
        badge={<StatusBadge status={contract.status} />}
        breadcrumbs={[
          { label: t('nav.contracts', 'Contracts'), href: '#' },
          { label: contract.contractNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50"
            >
              <Download className="w-3.5 h-3.5 text-stone-500" />
              <span>{t('contracts.exportAgreement', 'Export Contract')}</span>
            </button>

            {((contract.status === 'Draft' || contract.status === 'DRAFT') && currentUser?.role?.toUpperCase() === 'CONTRACTOR') && (
              <button
                type="button"
                disabled={isSubmittingSignature}
                onClick={() => void handleSendForSignature()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 shadow-xs disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isSubmittingSignature ? 'Submitting…' : 'Send for signatures'}</span>
              </button>
            )}

            {/* OTP signing is enabled only after the backend creates authorized signature requests. */}
            {contract.status === 'PENDING_SIGNATURES' && (
              <button
                type="button"
                onClick={() => setIsSignModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 shadow-xs"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('contracts.executeSign', 'Authorize & Sign')}</span>
              </button>
            )}

            {((contract.status === 'Signed' || contract.status === 'SIGNED') && currentUser?.role === 'CONTRACTOR') && (
              <button
                type="button"
                onClick={() => setIsEndorseModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-harvest-700 hover:bg-harvest-800 shadow-xs"
              >
                <Stamp className="w-3.5 h-3.5" />
                <span>{t('contracts.endorseWboa', 'Submit for statutory approval')}</span>
              </button>
            )}
          </div>
        }
      />

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {/* Key Parameters Matrix */}
          <div className="bg-white border border-stone-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Wheat className="w-4 h-4 text-forest-700" />
              <span>{t('contracts.commodityAndSpecs', 'Commodity & Quota Specifications')}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-stone-50 border border-stone-200">
                <span className="text-stone-500">Commodity</span>
                <p className="font-semibold text-stone-900 text-sm mt-0.5">{contract.commodity}</p>
                <p className="text-[11px] text-stone-500 font-mono">{contract.variety || 'Certified'}</p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200">
                <span className="text-stone-500">Contracted Quota</span>
                <p className="font-semibold text-stone-900 text-sm font-mono mt-0.5">
                  {(quantityKg / 100).toFixed(1)} Qtl
                </p>
                <p className="text-[11px] text-stone-500 font-mono">{quantityKg.toLocaleString()} Kg</p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200">
                <span className="text-stone-500">Cultivated Area</span>
                <p className="font-semibold text-stone-900 text-sm font-mono mt-0.5">
                  {landAreaHa > 0 ? `${landAreaHa} Ha` : 'Not recorded'}
                </p>
                <p className="text-[11px] text-stone-500">Area from registered parcels</p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200">
                <span className="text-stone-500">Max Moisture</span>
                <p className="font-semibold text-stone-900 font-mono mt-0.5">
                  {maxMoisture}%
                </p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200">
                <span className="text-stone-500">Min Grain Purity</span>
                <p className="font-semibold text-stone-900 font-mono mt-0.5">
                  {minPurity}%
                </p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200">
                <span className="text-stone-500">Quality Grade</span>
                <p className="font-semibold text-stone-900 font-mono mt-0.5">
                  {grade}
                </p>
              </div>
            </div>
          </div>

          {/* Pricing & Escrow */}
          <div className="bg-white border border-stone-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Banknote className="w-4 h-4 text-forest-700" />
              <span>{t('contracts.commercialsAndEscrow', 'Commercial Terms & Tripartite Escrow')}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-stone-50 border border-stone-200">
                <span className="text-stone-500">Agreed Unit Price</span>
                <p className="font-mono font-bold text-stone-900 text-base mt-0.5">
                  {unitPrice > 0 ? formatEtb(unitPrice) : 'Not agreed'} <span className="text-xs font-normal text-stone-500">/Kg</span>
                </p>
                <p className="text-[11px] text-stone-500 font-mono">
                  = {unitPrice > 0 ? `${(unitPrice * 100).toLocaleString()} ETB / Quintal` : 'Price not recorded'}
                </p>
              </div>

              <div className="p-3 bg-forest-50 border border-forest-200">
                <span className="text-forest-700 font-medium">Gross Contract Commitment</span>
                <p className="font-mono font-bold text-forest-900 text-base mt-0.5">
                  {formatEtb(contract.totalValueEtb)}
                </p>
                <p className="text-[11px] text-forest-700">
                  Escrow Status: <span className="font-semibold uppercase">{contract.escrowStatus || 'Not verified'}</span>
                </p>
              </div>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">Delivery Window:</span>
                <span className="font-mono text-stone-800">
                  {deliveryStart ? formatShortDate(deliveryStart) : 'Not set'} to {deliveryEnd ? formatShortDate(deliveryEnd) : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-stone-500">Delivery Point:</span>
                <span className="text-stone-800 font-medium">{deliveryPoint}</span>
              </div>
            </div>
          </div>

          {/* Legal Signatures and Endorsements */}
          <div className="bg-white border border-stone-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-forest-700" />
              <span>{t('contracts.signaturesAndEndorsements', 'Legal Signatures & Statutory Verification')}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Farmer Signature */}
              <div className="p-3 border border-stone-200 bg-stone-50 space-y-1">
                <span className="text-stone-500">Smallholder Producer:</span>
                <p className="font-bold text-stone-900">{producerName}</p>
                <p className="text-stone-500 font-mono">Fayda: {contract.farmerFaydaId || contract.producerFaydaId || 'Not displayed'}</p>
                <div className="mt-2 pt-2 border-t border-stone-200 flex items-center gap-1.5">
                  {contract.signatures?.producerSignedAt || contract.signatures?.farmer ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-forest-700" />
                      <span className="font-mono text-forest-800 text-[11px]">
                        Signed {formatShortDate(contract.signatures.producerSignedAt || contract.signatures.farmer?.signedAt || contract.createdAt)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5 text-harvest-600" />
                      <span className="text-stone-500 text-[11px]">Pending digital authorization</span>
                    </>
                  )}
                </div>
              </div>

              {/* Contractor Signature */}
              <div className="p-3 border border-stone-200 bg-stone-50 space-y-1">
                <span className="text-stone-500">Contractor / Agro-Processor:</span>
                <p className="font-bold text-stone-900">{buyerName}</p>
                <p className="text-stone-500 font-mono">TIN: {(contract as any).contractorTin || 'Not available'}</p>
                <div className="mt-2 pt-2 border-t border-stone-200 flex items-center gap-1.5">
                  {contract.signatures?.contractorSignedAt || contract.signatures?.contractor ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-forest-700" />
                      <span className="font-mono text-forest-800 text-[11px]">
                        Signed {formatShortDate(contract.signatures.contractorSignedAt || contract.signatures.contractor?.signedAt || contract.createdAt)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5 text-harvest-600" />
                      <span className="text-stone-500 text-[11px]">Pending digital authorization</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* WBoA Endorsement Box */}
            <div className="p-4 bg-stone-50 border border-stone-200 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stamp className="w-4 h-4 text-forest-700" />
                  <span className="font-bold text-stone-900">
                    Woreda Office of Agriculture (WBoA) Endorsement
                  </span>
                </div>
                {contract.approvals?.woredaApprovedBy || contract.wboaEndorsement ? (
                  <span className="px-2 py-0.5 bg-forest-100 text-forest-800 font-mono font-semibold">
                    REG #{contract.wboaEndorsement?.registrationNumber || 'WBOA-OR-2026-004'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-harvest-100 text-harvest-800 font-medium">
                    Awaiting Endorsement
                  </span>
                )}
              </div>
              {(contract.approvals?.woredaApprovedBy || contract.wboaEndorsement) && (
                <p className="text-[11px] text-stone-600 mt-2">
                  Endorsed by {contract.approvals?.woredaApprovedBy || contract.wboaEndorsement?.endorsedBy} on {formatShortDate(contract.approvals?.woredaApprovedAt || contract.wboaEndorsement?.endorsedAt || contract.updatedAt)}.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Lifecycle Timeline & Governance */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-stone-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-forest-700" />
              <span>{t('contracts.auditTimeline', 'Contract Lifecycle Audit')}</span>
            </h3>
            <Timeline events={timelineEvents} />
          </div>

          <div className="bg-stone-50 border border-stone-200 p-4 text-xs space-y-2">
            <h4 className="font-bold text-stone-900">Proclamation No. 1289/2023</h4>
            <p className="text-stone-600 leading-relaxed">
              In terms of Article 14, standard dispute mediation remains mandatory at Woreda Agricultural Offices for 15 days before any civil judicial litigation can be instituted.
            </p>
          </div>
        </div>
      </div>

      <ContractNegotiationPanel
        contractId={contract.id}
        status={String(contract.status).toUpperCase()}
        initialContent={(contract as any).content || {}}
        currentUserId={currentUser?.id}
        requiredPartyCount={(contract.farmerCount || 1) + 1}
        onSaved={() => { void fetchContract(); }}
      />

      {/* Signature Modal */}
      <SignatureOTPModal
        isOpen={isSignModalOpen}
        onClose={() => setIsSignModalOpen(false)}
        onSign={handleSign}
        onRequestOtp={async () => {
          const r = await api.contracts.requestOtp(contract.id);
          return r.devOtp ?? null;
        }}
        contractTitle={contract.title || contract.commodity}
        contractNumber={contract.contractNumber}
      />

      {/* Endorse Modal */}
      <ConfirmDialog
        isOpen={isEndorseModalOpen}
        onClose={() => setIsEndorseModalOpen(false)}
        onConfirm={handleEndorse}
        title={t('contracts.endorseConfirmTitle', 'Submit Signed Contract for Statutory Approval')}
        description={t(
          'contracts.endorseConfirmDesc',
          'This submits the fully signed agreement to the authorized statutory reviewer. It does not itself approve the contract.'
        )}
        confirmLabel={t('contracts.confirmEndorsement', 'Submit for Approval')}
      />
    </div>
  );
};
