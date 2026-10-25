import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Filter, Eye, RefreshCw, AlertCircle, RotateCcw } from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { DataTable, Column } from '../../components/primitives/DataTable';
import { StatusBadge } from '../../components/primitives/StatusBadge';
import { Can } from '../../components/primitives/PermissionGate';
import { api } from '../../lib/api/client';
import { Contract } from '../../types/api';
import { formatEtb, formatShortDate } from '../../lib/utils/format';

export interface ContractListPageProps {
  onNavigate: (path: string) => void;
}

export const ContractListPage: React.FC<ContractListPageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [commodityFilter, setCommodityFilter] = useState<string>('ALL');

  const fetchContracts = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const res = await api.contracts.list({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        commodity: commodityFilter === 'ALL' ? undefined : commodityFilter,
      });
      setContracts(res.contracts);
    } catch (err) {
      console.error('Failed to load contracts:', err);
      setLoadError(err instanceof Error ? err.message : t('contracts.loadFailed', 'Unable to load contracts. Check your connection and try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [statusFilter, commodityFilter]);

  const columns: Column<Contract>[] = [
    {
      key: 'contractNumber',
      header: t('contracts.contractNumber', 'Contract #'),
      sortable: true,
      render: (item) => (
        <span className="font-mono font-semibold text-stone-900">
          {item.contractNumber}
        </span>
      ),
    },
    {
      key: 'commodity',
      header: t('contracts.commodity', 'Commodity'),
      sortable: true,
      render: (item) => {
        const qtl = item.expectedQuantityQt ?? (item.quantityKg ? item.quantityKg / 100 : null);
        return (
          <div>
            <p className="font-medium text-stone-900">{item.commodity}</p>
            <p className="text-[11px] text-stone-500 font-mono">
              {item.variety || 'Standard'} • {qtl === null ? '—' : `${qtl} Qtl`}
            </p>
          </div>
        );
      },
    },
    {
      key: 'parties',
      header: t('contracts.parties', 'Buyer / Seller'),
      render: (item) => (
        <div className="text-xs">
          <p className="font-medium text-stone-900 truncate max-w-[200px]">
            {item.contractorOrgName || item.contractorName}
          </p>
          <p className="text-stone-500 truncate max-w-[200px]">
            ↔ {item.farmerName || item.producerName}
          </p>
        </div>
      ),
    },
    {
      key: 'price',
      header: t('contracts.price', 'Price & Escrow'),
      align: 'right',
      render: (item) => {
        const pricePerKg = item.unitPriceEtb ?? (item.agreedPriceEtbPerQt ? item.agreedPriceEtbPerQt / 100 : null);
        return (
          <div className="text-right">
            <p className="font-mono font-semibold text-stone-900">
              {pricePerKg === null ? '—' : <>{formatEtb(pricePerKg)} <span className="text-[10px] text-stone-500">/Kg</span></>}
            </p>
            <p className="text-[11px] text-forest-700 font-mono">
              Total {item.totalValueEtb == null ? '—' : formatEtb(item.totalValueEtb)}
            </p>
          </div>
        );
      },
    },
    {
      key: 'woreda',
      header: t('contracts.location', 'Location'),
      render: (item) => (
        <span className="text-xs text-stone-600">
          {item.woreda}, {item.region}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('contracts.status', 'Status'),
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'startDate',
      header: t('contracts.deliveryPeriod', 'Delivery'),
      render: (item) => (
        <span className="text-xs font-mono text-stone-500">
          {(item.deliveryStartDate || item.deliveryWindowStart) ? formatShortDate(item.deliveryStartDate || item.deliveryWindowStart || '') : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('contracts.title', 'Contract Farming Agreements')}
        subtitle={t(
          'contracts.subtitle',
          'Legally binding tripartite agricultural contracts under Proclamation No. 1289/2023'
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void fetchContracts()} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50" aria-label={t('common.refresh', 'Refresh')}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> {t('common.refresh', 'Refresh')}
          </button>
          <Can resource="contract" action="create">
            <button
              type="button"
              onClick={() => onNavigate('/contracts/new')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-forest-900"
            >
              <Plus className="w-4 h-4" />
              <span>{t('contracts.newContract', 'Create Contract')}</span>
            </button>
          </Can>
          </div>
        }
      />

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">{t('contracts.loadFailedTitle', 'Contracts could not be loaded')}</p><p className="mt-1 text-rose-800">{loadError}</p></div></div>
          <button type="button" onClick={() => void fetchContracts()} className="inline-flex items-center gap-2 self-start rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-rose-100"><RotateCcw className="h-3.5 w-3.5" />{t('common.retry', 'Retry')}</button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 border border-stone-200">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
          <Filter className="w-3.5 h-3.5 text-stone-500" />
          <span>{t('common.filterBy', 'Filter:')}</span>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs bg-stone-50 border border-stone-300 px-2.5 py-1.5 text-stone-800 focus:outline-none focus:border-stone-900"
        >
          <option value="ALL">{t('contracts.allStatuses', 'All Statuses')}</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_SIGNATURE">Pending Signature</option>
          <option value="SIGNED">Signed (Pending Endorsement)</option>
          <option value="ENDORSED_WBOA">Endorsed (WBoA)</option>
          <option value="ACTIVE">Active</option>
          <option value="IN_DELIVERY">In Delivery</option>
          <option value="SETTLED">Settled</option>
          <option value="DISPUTED">Disputed</option>
        </select>

        <select
          value={commodityFilter}
          onChange={(e) => setCommodityFilter(e.target.value)}
          className="text-xs bg-stone-50 border border-stone-300 px-2.5 py-1.5 text-stone-800 focus:outline-none focus:border-stone-900"
        >
          <option value="ALL">{t('contracts.allCommodities', 'All Commodities')}</option>
          <option value="Durum Wheat">Durum Wheat</option>
          <option value="Malt Barley">Malt Barley</option>
          <option value="Sesame Seed">Sesame Seed</option>
          <option value="Soybean">Soybean</option>
          <option value="Coffee Arabica">Coffee Arabica</option>
        </select>
        <button type="button" onClick={() => { setStatusFilter('ALL'); setCommodityFilter('ALL'); }} disabled={statusFilter === 'ALL' && commodityFilter === 'ALL'} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw className="h-3 w-3" />{t('common.clearFilters', 'Clear filters')}</button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={contracts}
        keyField="id"
        isLoading={isLoading}
        searchPlaceholder={t('contracts.searchPlaceholder', 'Search by contract #, buyer, farmer...')}
        exportFileName="dcfms-contracts"
        onRowClick={(item) => onNavigate(`/contracts/${item.id}`)}
        actions={(item) => (
          <button
            type="button"
            onClick={() => onNavigate(`/contracts/${item.id}`)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50"
          >
            <Eye className="w-3.5 h-3.5 text-stone-600" />
            <span>{t('common.view', 'View')}</span>
          </button>
        )}
      />
    </div>
  );
};
