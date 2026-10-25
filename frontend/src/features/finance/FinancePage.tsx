import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/primitives/PageHeader';
import { DataTable, Column } from '../../components/primitives/DataTable';
import { StatusBadge } from '../../components/primitives/StatusBadge';
import { Can } from '../../components/primitives/PermissionGate';
import { api } from '../../lib/api/client';
import { Settlement, Loan } from '../../types/api';
import { formatEtb } from '../../lib/utils/format';

export interface FinancePageProps {
  onNavigate?: (path: string) => void;
}

export const FinancePage: React.FC<FinancePageProps> = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'settlements' | 'loans'>('settlements');
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [setRes, loanRes] = await Promise.all([
          api.finance.listSettlements(),
          api.finance.listLoans(),
        ]);
        setSettlements(setRes.settlements);
        setLoans(loanRes.loans);
      } catch (err) {
        console.error('Failed to load finance data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

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
            {((item.deliveredKg ?? 4500) / 100).toFixed(1)} Qtl
          </p>
          <p className="text-[11px] text-stone-500">{(item.deliveredKg ?? 4500).toLocaleString()} Kg</p>
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
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Secured Escrow Vaults</p>
          <p className="text-2xl font-bold font-mono text-forest-800 mt-1">{formatEtb(62400000)}</p>
          <p className="text-xs text-stone-500 mt-1">Guaranteed at Commercial Bank</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Input Credit Disbursed</p>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">{formatEtb(18500000)}</p>
          <p className="text-xs text-stone-500 mt-1">Deducted at harvest intake</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Total Settled to Farmers</p>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">{formatEtb(43900000)}</p>
          <p className="text-xs text-stone-500 mt-1">100% on-time transfer</p>
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
            <Can permission="settlement:approve:all">
              {item.status === 'PENDING' ? (
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
                >
                  Release Payout
                </button>
              ) : (
                <span className="text-xs text-stone-400 font-mono">Disbursed</span>
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
        />
      )}
    </div>
  );
};
