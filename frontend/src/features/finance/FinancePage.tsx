import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/primitives/PageHeader';
import { RefreshCw } from 'lucide-react';
import { DataTable, Column } from '../../components/primitives/DataTable';
import { StatusBadge } from '../../components/primitives/StatusBadge';
import { Can } from '../../components/primitives/PermissionGate';
import { api } from '../../lib/api/client';
import { Contract, Settlement, Loan } from '../../types/api';
import { formatEtb } from '../../lib/utils/format';
import { useAppStore } from '../../store/useAppStore';

export interface FinancePageProps {
  onNavigate?: (path: string) => void;
}

export const FinancePage: React.FC<FinancePageProps> = () => {
  const { t } = useTranslation();
  const user = useAppStore((state) => state.user);
  const currentRole = useAppStore((state) => state.currentRole);
  const activeScopeId = useAppStore((state) => state.activeScope?.id);
  const [activeTab, setActiveTab] = useState<'settlements' | 'loans'>('settlements');
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [financialInstitutions, setFinancialInstitutions] = useState<Array<{ orgId: string; orgName: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanContractId, setLoanContractId] = useState('');
  const [loanInstitutionId, setLoanInstitutionId] = useState('');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [cropCycle, setCropCycle] = useState('');
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [deliveryContractId, setDeliveryContractId] = useState('');
  const [deliveryReference, setDeliveryReference] = useState('');
  const [deliveredKg, setDeliveredKg] = useState('');
  const [disbursementChannel, setDisbursementChannel] = useState<Settlement['disbursementChannel']>('Telebirr');
  const [actionError, setActionError] = useState('');
  const [pendingLoan, setPendingLoan] = useState<{ loan: Loan; action: 'approve' | 'reject' } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [pendingActionId, setPendingActionId] = useState('');
  const selectedLoanContract = contracts.find((contract) => contract.id === loanContractId);
  const loanApplicantFaydaId =
    currentRole === 'ProducerIndividual' ? user?.faydaId : selectedLoanContract?.producerFaydaId;
  const loanApplicantName =
    currentRole === 'ProducerIndividual' ? user?.fullName : selectedLoanContract?.producerName;
  const hasActiveLoanForSelectedContract = loans.some(
    (loan) =>
      loan.contractId === loanContractId &&
      loan.applicantFaydaId === loanApplicantFaydaId &&
      loan.status !== 'Rejected' &&
      loan.status !== 'Completed'
  );

  const fetchData = async () => {
    setIsLoading(true);
    setActionError('');
    try {
      const [financeRes, contractRes] = await Promise.all([
        api.finance.list(),
        api.contracts.list(),
      ]);
      setSettlements(financeRes.settlements);
      setLoans(financeRes.loans);
      setFinancialInstitutions(financeRes.financialInstitutions);
      setContracts(contractRes.contracts);
      setDeliveryContractId((current) =>
        contractRes.contracts.some((contract) => contract.id === current)
          ? current
          : contractRes.contracts[0]?.id || ''
      );
      setLoanContractId((current) =>
        contractRes.contracts.some((contract) => contract.id === current)
          ? current
          : contractRes.contracts[0]?.id || ''
      );
      setLoanInstitutionId((current) => current || financeRes.financialInstitutions[0]?.orgId || '');
    } catch (err) {
      console.error('Failed to load finance data:', err);
      setActionError(err instanceof Error ? err.message : 'Unable to load finance data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [activeScopeId]);

  const handleLoanDecision = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingLoan || decisionReason.trim().length < 5) return;
    setPendingActionId(pendingLoan.loan.id);
    setActionError('');
    try {
      const { loan } = await api.finance.decideLoan(pendingLoan.loan.id, {
        action: pendingLoan.action,
        reason: decisionReason.trim(),
      });
      setLoans((current) => current.map((item) => (item.id === loan.id ? loan : item)));
      setPendingLoan(null);
      setDecisionReason('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to record the loan decision.');
    } finally {
      setPendingActionId('');
    }
  };

  const handleLoanApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    const principalEtb = Number(loanPrincipal);
    if (
      !loanApplicantFaydaId ||
      !loanApplicantName ||
      !loanContractId ||
      !loanInstitutionId ||
      !cropCycle.trim() ||
      !Number.isFinite(principalEtb) ||
      principalEtb <= 0
    ) {
      return;
    }
    setPendingActionId('new-loan');
    setActionError('');
    try {
      const { loan } = await api.finance.applyLoan({
        contractId: loanContractId,
        fiOrgId: loanInstitutionId,
        applicantFaydaId: loanApplicantFaydaId,
        applicantName: loanApplicantName,
        principalEtb,
        cropCycle: cropCycle.trim(),
      });
      setLoans((current) => [loan, ...current]);
      setActiveTab('loans');
      setIsLoanModalOpen(false);
      setLoanPrincipal('');
      setCropCycle('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to submit the loan application.');
    } finally {
      setPendingActionId('');
    }
  };

  const handleLoanDisbursement = async (loan: Loan) => {
    setPendingActionId(loan.id);
    setActionError('');
    try {
      const { loan: updatedLoan } = await api.finance.disburseLoan(loan.id);
      setLoans((current) => current.map((item) => (item.id === updatedLoan.id ? updatedLoan : item)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to disburse the loan.');
    } finally {
      setPendingActionId('');
    }
  };

  const handleSettlementAction = async (settlement: Settlement) => {
    setPendingActionId(settlement.id);
    setActionError('');
    try {
      const response =
        settlement.status === 'PENDING'
          ? await api.finance.releaseSettlement(settlement.id)
          : await api.finance.reconcileSettlement(settlement.id);
      setSettlements((current) =>
        current.map((item) => (item.id === response.settlement.id ? response.settlement : item))
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update the settlement.');
    } finally {
      setPendingActionId('');
    }
  };

  const handleCreateSettlement = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedKilograms = Number(deliveredKg);
    if (!deliveryContractId || !deliveryReference.trim() || !Number.isFinite(parsedKilograms) || parsedKilograms <= 0) {
      return;
    }
    setPendingActionId('new-settlement');
    setActionError('');
    try {
      const { settlement } = await api.finance.createSettlement({
        contractId: deliveryContractId,
        deliveryReference: deliveryReference.trim(),
        deliveredKg: parsedKilograms,
        disbursementChannel,
      });
      setSettlements((current) => [settlement, ...current]);
      setIsSettlementModalOpen(false);
      setDeliveryReference('');
      setDeliveredKg('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create the settlement.');
    } finally {
      setPendingActionId('');
    }
  };

  const settlementColumns: Column<Settlement>[] = [
    {
      key: 'settlementNumber',
      header: t('finance.settlementRef', 'Settlement #'),
      render: (item) => (
        <span className="font-mono font-bold text-stone-900">
          {item.settlementNumber || `SET-2025-${item.id.slice(-4)}`}
        </span>
      ),
    },
    {
      key: 'farmerName',
      header: t('finance.beneficiary', 'Beneficiary / Producer'),
      render: (item) => (
        <div>
          <p className="font-semibold text-stone-900">{item.farmerName}</p>
          <p className="text-[11px] text-stone-500 font-mono">
            Contract #{item.contractId?.slice(0, 8)}
          </p>
        </div>
      ),
    },
    {
      key: 'deliveredKg',
      header: t('finance.deliveredVolume', 'Delivered Volume'),
      align: 'right',
      render: (item) => (
        <div className="text-right font-mono">
          <p className="font-semibold text-stone-900">
            {(item.deliveredKg == null ? '—' : (item.deliveredKg / 100).toFixed(1))} Qtl
          </p>
          <p className="text-[11px] text-stone-500">{item.deliveredKg == null ? '—' : `${item.deliveredKg.toLocaleString()} Kg`}</p>
        </div>
      ),
    },
    {
      key: 'grossAmountEtb',
      header: t('finance.grossAmount', 'Gross Value'),
      align: 'right',
      render: (item) => (
        <span className="font-mono font-medium text-stone-800 text-right block">
          {formatEtb(item.grossAmountEtb)}
        </span>
      ),
    },
    {
      key: 'deductions',
      header: t('finance.deductions', 'Input Advance'),
      align: 'right',
      render: (item) => (
        <span className="font-mono text-rose-700 text-right block text-xs">
          -{formatEtb(item.inputAdvanceDeductionEtb || item.loanDeductionEtb || 0)}
        </span>
      ),
    },
    {
      key: 'netPayoutEtb',
      header: t('finance.netPayout', 'Net Payout'),
      align: 'right',
      render: (item) => (
        <span className="font-mono font-bold text-forest-800 text-right block">
          {formatEtb(item.netPayoutEtb)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('finance.status', 'Escrow Status'),
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

  const loanColumns: Column<Loan>[] = [
    {
      key: 'loanRef',
      header: 'Loan #',
      render: (item) => <span className="font-mono font-bold text-stone-900">{item.loanRef}</span>,
    },
    {
      key: 'applicantName',
      header: 'Borrower',
      render: (item) => (
        <div>
          <p className="font-semibold text-stone-900">{item.applicantName}</p>
          <p className="text-[11px] text-stone-500">{item.fiOrgName}</p>
        </div>
      ),
    },
    {
      key: 'principalEtb',
      header: 'Principal',
      align: 'right',
      render: (item) => <span className="font-mono font-semibold">{formatEtb(item.principalEtb)}</span>,
    },
    {
      key: 'interestRatePct',
      header: 'Interest',
      render: (item) => <span className="font-mono text-xs">{item.interestRatePct}% APR</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('finance.title', 'Tripartite Escrow & Financial Settlement')}
        subtitle={t(
          'finance.subtitle',
          'Commercial bank tripartite escrow guarantees, crop loan recovery, and mobile wallet disbursement'
        )}
        actions={
          <>
            <button type="button" onClick={() => void fetchData()} disabled={isLoading} className="mr-2 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />{t('common.refresh', 'Refresh')}</button>
            <Can resource="loan" action="create">
              <button
                type="button"
                onClick={() => setIsLoanModalOpen(true)}
                className="mr-2 border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50"
              >
                {t('finance.applyLoan', 'Apply for financing')}
              </button>
            </Can>
            <Can resource="settlement" action="create">
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(true)}
                className="bg-forest-800 px-3 py-2 text-xs font-semibold text-white hover:bg-forest-900"
              >
                {t('finance.createSettlement', 'Record delivery')}
              </button>
            </Can>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Gross settlement value</p>
          <p className="text-2xl font-bold font-mono text-forest-800 mt-1">{formatEtb(settlements.reduce((sum, item) => sum + Number(item.grossAmountEtb || 0), 0))}</p>
          <p className="text-xs text-stone-500 mt-1">Sum of loaded settlement records</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Loan principal disbursed</p>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">{formatEtb(loans.filter((item) => Boolean(item.disbursedAt) || ['Disbursed', 'DISBURSED'].includes(String(item.status))).reduce((sum, item) => sum + Number(item.principalEtb || 0), 0))}</p>
          <p className="text-xs text-stone-500 mt-1">Loans marked as disbursed</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Net payout reconciled</p>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">{formatEtb(settlements.filter((item) => ['Reconciled', 'SETTLED'].includes(String(item.status))).reduce((sum, item) => sum + Number(item.netPayoutEtb || 0), 0))}</p>
          <p className="text-xs text-stone-500 mt-1">Settlements marked reconciled or settled</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-200 flex items-center gap-4 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('settlements')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeTab === 'settlements'
              ? 'border-stone-900 text-stone-900 font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {t('finance.harvestSettlements', 'Harvest Off-take Settlements')} ({settlements.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('loans')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeTab === 'loans'
              ? 'border-stone-900 text-stone-900 font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {t('finance.tripartiteLoans', 'Seasonal Agricultural Loans')} ({loans.length})
        </button>
      </div>

      {activeTab === 'settlements' ? (
        <DataTable
          columns={settlementColumns}
          data={settlements}
          keyField="id"
          isLoading={isLoading}
          searchPlaceholder={t('finance.searchPlaceholder', 'Search settlements, contracts, farmers...')}
          exportFileName="dcfms-settlements"
          actions={(item) => (
            <Can resource="settlement" action="update">
              {item.status === 'PENDING' || item.status === 'SETTLED' ? (
                <button
                  type="button"
                  disabled={pendingActionId === item.id}
                  onClick={() => void handleSettlementAction(item)}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
                >
                  {pendingActionId === item.id
                    ? t('common.saving', 'Saving...')
                    : item.status === 'PENDING'
                      ? t('finance.releasePayout', 'Release Payout')
                      : t('finance.reconcilePayout', 'Reconcile Payout')}
                </button>
              ) : (
                <span className="text-xs text-stone-400 font-mono">{item.status}</span>
              )}
            </Can>
          )}
        />
      ) : (
        <DataTable
          columns={loanColumns}
          data={loans}
          keyField="id"
          isLoading={isLoading}
          searchPlaceholder="Search loans, borrowers, banks..."
          exportFileName="dcfms-crop-loans"
          actions={(item) => (
            <div className="flex items-center gap-2">
              {(item.status === 'Submitted' || item.status === 'UnderAssessment') && (
                <Can resource="loan" action="approve">
                  <button
                    type="button"
                    disabled={pendingActionId === item.id}
                    onClick={() => {
                      setDecisionReason('');
                      setPendingLoan({ loan: item, action: 'approve' });
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 disabled:opacity-50"
                  >
                    {t('common.approve', 'Approve')}
                  </button>
                  <button
                    type="button"
                    disabled={pendingActionId === item.id}
                    onClick={() => {
                      setDecisionReason('');
                      setPendingLoan({ loan: item, action: 'reject' });
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 disabled:opacity-50"
                  >
                    {t('common.reject', 'Reject')}
                  </button>
                </Can>
              )}
              {item.status === 'Approved' && (
                <Can resource="loan" action="update">
                  <button
                    type="button"
                    disabled={pendingActionId === item.id}
                    onClick={() => void handleLoanDisbursement(item)}
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 disabled:opacity-50"
                  >
                    {pendingActionId === item.id
                      ? t('common.saving', 'Saving...')
                      : t('finance.disburseLoan', 'Disburse')}
                  </button>
                </Can>
              )}
            </div>
          )}
        />
      )}

      {actionError && (
        <div role="alert" className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {actionError}
        </div>
      )}

      {pendingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4">
          <form onSubmit={handleLoanDecision} className="w-full max-w-md space-y-4 border border-stone-300 bg-white p-6 shadow-xl">
            <div>
              <h2 className="text-base font-bold text-stone-900">
                {pendingLoan.action === 'approve' ? 'Approve loan application' : 'Reject loan application'}
              </h2>
              <p className="mt-1 text-xs text-stone-600">
                {pendingLoan.loan.loanRef} · {pendingLoan.loan.applicantName}
              </p>
            </div>
            <label className="block text-xs font-semibold text-stone-700">
              Decision rationale
              <textarea
                required
                minLength={5}
                value={decisionReason}
                onChange={(event) => setDecisionReason(event.target.value)}
                rows={4}
                className="mt-1 w-full border border-stone-300 p-2 text-sm font-normal"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingLoan(null)}
                className="border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={pendingActionId === pendingLoan.loan.id || decisionReason.trim().length < 5}
                className="bg-forest-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {pendingActionId === pendingLoan.loan.id
                  ? t('common.saving', 'Saving...')
                  : pendingLoan.action === 'approve'
                    ? t('common.approve', 'Approve')
                    : t('common.reject', 'Reject')}
              </button>
            </div>
          </form>
        </div>
      )}
      {isSettlementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4">
          <form onSubmit={handleCreateSettlement} className="w-full max-w-md space-y-4 border border-stone-300 bg-white p-6 shadow-xl">
            <div>
              <h2 className="text-base font-bold text-stone-900">{t('finance.createSettlement', 'Record delivery')}</h2>
              <p className="mt-1 text-xs text-stone-600">
                The payable amount and eligible disbursed-loan deduction are calculated from the contract.
              </p>
            </div>
            <label className="block text-xs font-semibold text-stone-700">
              Contract
              <select
                required
                value={deliveryContractId}
                onChange={(event) => setDeliveryContractId(event.target.value)}
                className="mt-1 w-full border border-stone-300 bg-white p-2 text-sm font-normal"
              >
                <option value="" disabled>Select a contract</option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.contractNumber} · {contract.commodity} · {contract.producerName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-stone-700">
              Delivery receipt reference
              <input
                required
                minLength={4}
                value={deliveryReference}
                onChange={(event) => setDeliveryReference(event.target.value)}
                className="mt-1 w-full border border-stone-300 p-2 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-semibold text-stone-700">
              Delivered volume (kg)
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={deliveredKg}
                onChange={(event) => setDeliveredKg(event.target.value)}
                className="mt-1 w-full border border-stone-300 p-2 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-semibold text-stone-700">
              Payout channel
              <select
                value={disbursementChannel}
                onChange={(event) => setDisbursementChannel(event.target.value as Settlement['disbursementChannel'])}
                className="mt-1 w-full border border-stone-300 bg-white p-2 text-sm font-normal"
              >
                <option value="Telebirr">Telebirr</option>
                <option value="CBE_Birr">CBE Birr</option>
                <option value="Bank_Transfer">Bank transfer</option>
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(false)}
                className="border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={!deliveryContractId || deliveryReference.trim().length < 4 || Number(deliveredKg) <= 0 || pendingActionId === 'new-settlement'}
                className="bg-forest-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {pendingActionId === 'new-settlement' ? t('common.saving', 'Saving...') : t('finance.createSettlement', 'Record delivery')}
              </button>
            </div>
          </form>
        </div>
      )}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4">
          <form onSubmit={handleLoanApplication} className="w-full max-w-md space-y-4 border border-stone-300 bg-white p-6 shadow-xl">
            <div>
              <h2 className="text-base font-bold text-stone-900">{t('finance.applyLoan', 'Apply for financing')}</h2>
              <p className="mt-1 text-xs text-stone-600">Your identity and contract eligibility are verified by the server.</p>
            </div>
            <label className="block text-xs font-semibold text-stone-700">
              Contract
              <select
                required
                value={loanContractId}
                onChange={(event) => setLoanContractId(event.target.value)}
                className="mt-1 w-full border border-stone-300 bg-white p-2 text-sm font-normal"
              >
                <option value="" disabled>Select a contract</option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.contractNumber} · {contract.commodity} · {contract.producerName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-stone-700">
              Financial institution
              <select
                required
                value={loanInstitutionId}
                onChange={(event) => setLoanInstitutionId(event.target.value)}
                className="mt-1 w-full border border-stone-300 bg-white p-2 text-sm font-normal"
              >
                <option value="" disabled>Select an institution</option>
                {financialInstitutions.map((institution) => (
                  <option key={institution.orgId} value={institution.orgId}>{institution.orgName}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-stone-700">
              Requested amount (ETB)
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={loanPrincipal}
                onChange={(event) => setLoanPrincipal(event.target.value)}
                className="mt-1 w-full border border-stone-300 p-2 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-semibold text-stone-700">
              Crop cycle
              <input
                required
                minLength={2}
                value={cropCycle}
                onChange={(event) => setCropCycle(event.target.value)}
                className="mt-1 w-full border border-stone-300 p-2 text-sm font-normal"
              />
            </label>
            {!loanApplicantFaydaId && (
              <p role="alert" className="text-xs text-rose-700">The selected contract party must have a verified Fayda ID to apply.</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsLoanModalOpen(false)}
                className="border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={
                  !loanApplicantFaydaId || !loanApplicantName || !loanContractId || !loanInstitutionId ||
                  hasActiveLoanForSelectedContract ||
                  !cropCycle.trim() || Number(loanPrincipal) <= 0 || pendingActionId === 'new-loan'
                }
                className="bg-forest-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {pendingActionId === 'new-loan' ? t('common.saving', 'Saving...') : t('finance.applyLoan', 'Apply')}
              </button>
            </div>
            {hasActiveLoanForSelectedContract && (
              <p role="alert" className="text-xs text-rose-700">
                An active financing application already exists for this applicant and contract.
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
