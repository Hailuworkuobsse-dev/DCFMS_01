import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ArrowRight, RefreshCw, AlertCircle, RotateCcw } from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { DataTable, Column } from '../../components/primitives/DataTable';
import { StatusBadge } from '../../components/primitives/StatusBadge';
import { Can } from '../../components/primitives/PermissionGate';
import { api } from '../../lib/api/client';
import { formatEtb } from '../../lib/utils/format';

export interface LinkagePageProps {
  onNavigate: (path: string) => void;
}

export const LinkagePage: React.FC<LinkagePageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [linkages, setLinkages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const fetchLinkages = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const res = await api.linkages.list();
        setLinkages(res.linkages);
      } catch (err) {
        console.error('Failed to load linkages:', err);
        setLoadError(err instanceof Error ? err.message : t('linkage.loadFailed', 'Unable to load market demand records.'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchLinkages();
  }, []);

  const totalDemandKg = linkages.reduce((sum, item) => sum + Number(item.demandVolumeKg || 0), 0);
  const matchedDemandCount = linkages.filter((item) => String(item.status || '').toUpperCase() === 'MATCHED').length;
  const columns: Column<any>[] = [
    {
      key: 'demandId',
      header: t('linkage.demandRef', 'Demand Ref'),
      render: (item) => (
        <span className="font-mono font-semibold text-stone-900">
          {item.demandId || (item.id ? `LNK-${String(item.id).slice(-4)}` : '—')}
        </span>
      ),
    },
    {
      key: 'commodity',
      header: t('linkage.commodity', 'Commodity'),
      render: (item) => (
        <div>
          <p className="font-medium text-stone-900">{item.commodity}</p>
          <p className="text-[11px] text-stone-500 font-mono">
            {item.variety || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'buyer',
      header: t('linkage.buyer', 'Off-Taker / Buyer'),
      render: (item) => (
        <div>
          <p className="font-semibold text-stone-900">{item.buyerName || item.buyerOrgName || '—'}</p>
          <p className="text-[11px] text-stone-500">{item.buyerRegion || item.region || '—'}</p>
        </div>
      ),
    },
    {
      key: 'demandVolume',
      header: t('linkage.demandVolume', 'Required Volume'),
      align: 'right',
      render: (item) => (
        <div className="text-right">
          <p className="font-mono font-semibold text-stone-900">
            {item.demandVolumeKg == null ? '—' : `${(Number(item.demandVolumeKg) / 100).toLocaleString()} Qtl`}
          </p>
          <p className="text-[11px] text-stone-500 font-mono">
            {item.demandVolumeKg == null ? '—' : `${Number(item.demandVolumeKg).toLocaleString()} Kg`}
          </p>
        </div>
      ),
    },
    {
      key: 'targetPrice',
      header: t('linkage.indicativePrice', 'Indicative Price'),
      align: 'right',
      render: (item) => (
        <div className="text-right font-mono font-semibold text-forest-800">
          {item.indicativePriceEtb == null ? '—' : <>{formatEtb(item.indicativePriceEtb)} <span className="text-[10px] text-stone-500">/Kg</span></>}
        </div>
      ),
    },
    {
      key: 'matchedCoops',
      header: t('linkage.matchedProducers', 'Matched Cooperatives'),
      render: (item) => (
        <span className="text-xs text-stone-700">
          {item.matchedProducersCount == null ? 'Not assessed' : `${item.matchedProducersCount} Primary Co-ops`}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('linkage.status', 'Status'),
      render: (item) => (
        <StatusBadge status={item.status || 'MATCHED'} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('linkage.title', 'Market Linkage & Demand Registry')}
        subtitle={t(
          'linkage.subtitle',
          'Connecting industrial processors, exporters, and cooperatives prior to planting season'
        )}
        actions={
          <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setIsLoading(true); setLoadError(''); void api.linkages.list().then((res) => setLinkages(res.linkages)).catch((err) => setLoadError(err instanceof Error ? err.message : t('linkage.loadFailed', 'Unable to load market demand records.'))).finally(() => setIsLoading(false)); }} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />{t('common.refresh', 'Refresh')}</button>
          <Can resource="linkage" action="create">
            <button
              type="button"
              onClick={() => onNavigate(`/contracts/new?linkageId=${encodeURIComponent(String(item.id ?? ''))}`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t('linkage.publishDemand', 'Publish Buyer Demand')}</span>
            </button>
          </Can>
          </div>
        }
      />

      {loadError && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">{t('linkage.loadFailedTitle', 'Market demand records could not be loaded')}</p><p className="mt-1">{loadError}</p></div></div><button type="button" onClick={() => { setIsLoading(true); setLoadError(''); void api.linkages.list().then((res) => setLinkages(res.linkages)).catch((err) => setLoadError(err instanceof Error ? err.message : t('linkage.loadFailed', 'Unable to load market demand records.'))).finally(() => setIsLoading(false)); }} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold"><RotateCcw className="h-3 w-3" />{t('common.retry', 'Retry')}</button></div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Registered Buyer Demands
          </p>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">{linkages.length.toLocaleString()} Demands</p>
          <p className="text-xs text-stone-500 mt-1">Loaded from the current authorized demand registry</p>
        </div>

        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Total Demand Volume
          </p>
          <p className="text-2xl font-bold font-mono text-forest-800 mt-1">{totalDemandKg ? `${(totalDemandKg / 1000).toLocaleString()} MT` : '—'}</p>
          <p className="text-xs text-stone-500 mt-1">Calculated from available demand records</p>
        </div>

        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Matched Demand Records
          </p>
          <p className="text-2xl font-bold font-mono text-harvest-700 mt-1">{matchedDemandCount.toLocaleString()}</p>
          <p className="text-xs text-stone-500 mt-1">Records currently marked as matched</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={linkages}
        keyField="id"
        isLoading={isLoading}
        searchPlaceholder={t('linkage.searchPlaceholder', 'Search demands, commodities, buyers...')}
        exportFileName="dcfms-linkages"
        actions={(item) => (
          <button
            type="button"
            onClick={() => onNavigate('/contracts/new')}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-forest-800 bg-forest-50 border border-forest-300 hover:bg-forest-100"
          >
            <span>Convert to Contract</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      />
    </div>
  );
};
