import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ArrowRight } from 'lucide-react';
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

  useEffect(() => {
    const fetchLinkages = async () => {
      setIsLoading(true);
      try {
        const res = await api.linkages.list();
        setLinkages(res.linkages);
      } catch (err) {
        console.error('Failed to load linkages:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLinkages();
  }, []);

  const columns: Column<any>[] = [
    {
      key: 'demandId',
      header: t('linkage.demandRef', 'Demand Ref'),
      render: (item) => (
        <span className="font-mono font-semibold text-stone-900">
          {item.demandId || `LNK-2025-${item.id?.slice(-4)}`}
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
            {item.variety || 'Certified Standard'}
          </p>
        </div>
      ),
    },
    {
      key: 'buyer',
      header: t('linkage.buyer', 'Off-Taker / Buyer'),
      render: (item) => (
        <div>
          <p className="font-semibold text-stone-900">{item.buyerName || 'EthioFlour Agro-Processing'}</p>
          <p className="text-[11px] text-stone-500">{item.buyerRegion || 'Federal / Oromia'}</p>
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
            {(item.demandVolumeKg ? item.demandVolumeKg / 100 : 500).toLocaleString()} Qtl
          </p>
          <p className="text-[11px] text-stone-500 font-mono">
            {(item.demandVolumeKg || 50000).toLocaleString()} Kg
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
          {formatEtb(item.indicativePriceEtb || 52)} <span className="text-[10px] text-stone-500">/Kg</span>
        </div>
      ),
    },
    {
      key: 'matchedCoops',
      header: t('linkage.matchedProducers', 'Matched Cooperatives'),
      render: (item) => (
        <span className="text-xs text-stone-700">
          {item.matchedProducersCount || 3} Primary Co-ops
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
          <Can permission="linkage:create:all">
            <button
              type="button"
              onClick={() => onNavigate('/contracts/new')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t('linkage.publishDemand', 'Publish Buyer Demand')}</span>
            </button>
          </Can>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Active Industrial Demands
          </p>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">28 Demands</p>
          <p className="text-xs text-stone-500 mt-1">Wheat, Barley, Sesame, Soybean</p>
        </div>

        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Aggregated Supply Capacity
          </p>
          <p className="text-2xl font-bold font-mono text-forest-800 mt-1">94,000 MT</p>
          <p className="text-xs text-stone-500 mt-1">Across 420 Primary Cooperatives</p>
        </div>

        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Pre-Planting Match Rate
          </p>
          <p className="text-2xl font-bold font-mono text-harvest-700 mt-1">88.5%</p>
          <p className="text-xs text-stone-500 mt-1">Converted to binding contracts</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={linkages}
        keyField="id"
        isLoading={isLoading}
        searchPlaceholder={t('linkage.searchPlaceholder', 'Search demands, commodities, buyers...')}
        exportFileName="dcfms-linkages"
        actions={() => (
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
