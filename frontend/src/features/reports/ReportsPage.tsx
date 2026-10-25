import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Calendar, Filter } from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { SimpleBarChart, SimplePieChart } from '../../components/charts/LazyCharts';
import { formatEtb, downloadTextFile } from '../../lib/utils/format';
import { api } from '../../lib/api/client';
import type { Contract } from '../../types/api';

export interface ReportsPageProps {
  onNavigate?: (path: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = () => {
  const { t } = useTranslation();
  const [selectedSeason, setSelectedSeason] = useState('2025_MEHER');
  const [selectedRegion, setSelectedRegion] = useState('ALL');

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [grievances, setGrievances] = useState<Array<{ contractId?: string; status?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void Promise.all([api.contracts.list(), api.grievances.list()])
      .then(([contractResponse, grievanceResponse]) => {
        if (cancelled) return;
        setContracts(contractResponse.contracts || []);
        setGrievances(grievanceResponse.grievances || []);
        setLoadError('');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load report data:', err);
        setLoadError(err instanceof Error ? err.message : t('reports.loadFailed', 'Unable to load report data.'));
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [t]);

  const seasonBounds: Record<string, { start: string; end: string }> = {
    '2025_MEHER': { start: '2025-09-01', end: '2026-03-31' },
    '2025_BELG': { start: '2025-02-01', end: '2025-06-30' },
    '2024_MEHER': { start: '2024-09-01', end: '2025-03-31' },
  };

  const filteredContracts = useMemo(() => {
    const bounds = seasonBounds[selectedSeason];
    return contracts.filter((contract) => {
      const date = String(contract.deliveryWindowStart || contract.deliveryStartDate || contract.createdAt || '').slice(0, 10);
      const inSeason = !date || !bounds || (date >= bounds.start && date <= bounds.end);
      const inRegion = selectedRegion === 'ALL' || contract.region === selectedRegion;
      return inSeason && inRegion;
    });
  }, [contracts, selectedSeason, selectedRegion]);

  const commodityQuotas = useMemo(() => {
    const totals = new Map<string, number>();
    filteredContracts.forEach((contract) => {
      const commodity = contract.commodity || 'Unspecified';
      const volumeMt = Number(contract.quantityKg ?? Number(contract.expectedQuantityQt || 0) * 100) / 1000;
      totals.set(commodity, (totals.get(commodity) || 0) + volumeMt);
    });
    return Array.from(totals, ([commodity, actual]) => ({ commodity, actual: Math.round(actual * 100) / 100 }));
  }, [filteredContracts]);

  const regionalShares = useMemo(() => {
    const totals = new Map<string, number>();
    filteredContracts.forEach((contract) => {
      const region = contract.region || 'Unspecified';
      totals.set(region, (totals.get(region) || 0) + 1);
    });
    return Array.from(totals, ([name, value]) => ({ name, value }));
  }, [filteredContracts]);

  const totalVolumeMt = filteredContracts.reduce((sum, contract) =>
    sum + Number(contract.quantityKg ?? Number(contract.expectedQuantityQt || 0) * 100) / 1000, 0);
  const totalContractedValue = filteredContracts.reduce((sum, contract) => sum + Number(contract.totalValueEtb || 0), 0);
  const farmerCount = new Set(filteredContracts.map((contract) => contract.producerId).filter(Boolean)).size;
  const filteredContractIds = new Set(filteredContracts.map((contract) => contract.id));
  const relevantGrievances = grievances.filter((grievance) => grievance.contractId && filteredContractIds.has(grievance.contractId));
  const disputeRate = filteredContracts.length ? (relevantGrievances.length / filteredContracts.length) * 100 : 0;
  const ecxVerifiedPercent = filteredContracts.length
    ? (filteredContracts.filter((contract) => contract.ecxVerified).length / filteredContracts.length) * 100
    : 0;

  const handleExportFullReport = () => {
    const reportData = {
      title: 'Ethiopian Digital Contract Farming Management System (DCFMS) - National Report',
      season: selectedSeason,
      region: selectedRegion,
      generatedAt: new Date().toISOString(),
      statutoryReference: 'Proclamation No. 1289/2023',
      metrics: {
        totalContracts: filteredContracts.length,
        enrolledFarmers: farmerCount,
        totalContractedValueEtb: totalContractedValue,
        disputeRatePercent: Number(disputeRate.toFixed(2)),
        ecxVerifiedContractsPercent: Number(ecxVerifiedPercent.toFixed(2)),
      },
      filters: { season: selectedSeason, region: selectedRegion },
      metricsSource: 'Current authorized DCFMS contract and grievance records',
      commodities: commodityQuotas,
      regions: regionalShares,
      contractIds: filteredContracts.map((contract) => contract.contractNumber),
    };

    downloadTextFile(
      `DCFMS-National-Report-${selectedSeason}.json`,
      JSON.stringify(reportData, null, 2),
      'application/json;charset=utf-8;'
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('reports.title', 'National Agricultural Analytics & Reports')}
        subtitle={t(
          'reports.subtitle',
          'Official reports for Ministry of Agriculture, ATI leadership, regional bureaus, and commercial partners'
        )}
        actions={
          <button
            type="button"
            onClick={handleExportFullReport}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>{t('reports.exportOfficialReport', 'Export Official Report (JSON/CSV)')}</span>
          </button>
        }
      />

      {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><p className="font-semibold">{t('reports.loadFailedTitle', 'Report data could not be loaded')}</p><p className="mt-1">{loadError}</p><button type="button" onClick={() => window.location.reload()} className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold">{t('common.retry', 'Retry')}</button></div>}
      {isLoading && <p role="status" className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-600">{t('common.loading', 'Loading authorized report data…')}</p>}

      {/* Filter Ribbon */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 border border-stone-200">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
          <Calendar className="w-3.5 h-3.5 text-stone-500" />
          <span>Season:</span>
        </div>
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          className="text-xs bg-stone-50 border border-stone-300 px-3 py-1.5 text-stone-800"
        >
          <option value="2025_MEHER">2025/26 Meher Main Season</option>
          <option value="2025_BELG">2025 Belg Short Season</option>
          <option value="2024_MEHER">2024/25 Meher Season</option>
        </select>

        <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 ml-2">
          <Filter className="w-3.5 h-3.5 text-stone-500" />
          <span>Region:</span>
        </div>
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="text-xs bg-stone-50 border border-stone-300 px-3 py-1.5 text-stone-800"
        >
          <option value="ALL">All Regions (Federal Overview)</option>
          <option value="Oromia">Oromia</option>
          <option value="Amhara">Amhara</option>
          <option value="Sidama">Sidama</option>
          <option value="Tigray">Tigray</option>
        </select>
      </div>

      {/* Top Level Metric Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">National Volume</p>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">{totalVolumeMt.toLocaleString(undefined, { maximumFractionDigits: 1 })} MT</p>
          <p className="text-xs text-stone-500 mt-1">Contracted off-take</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Total Escrow Value</p>
          <p className="text-2xl font-bold font-mono text-forest-800 mt-1">{formatEtb(totalContractedValue)}</p>
          <p className="text-xs text-stone-500 mt-1">Sum of contract values in the selected scope</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Enrolled Smallholders</p>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">{farmerCount.toLocaleString()}</p>
          <p className="text-xs text-stone-500 mt-1">Distinct producer IDs represented in selected contracts</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Floor Price Integrity</p>
          <p className="text-2xl font-bold font-mono text-earth-800 mt-1">{ecxVerifiedPercent.toFixed(1)}%</p>
          <p className="text-xs text-stone-500 mt-1">Contracts flagged as ECX verified</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-stone-200 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-stone-900 mb-1">
            Contracted Volume by Commodity (Metric Tons)
          </h3>
          <p className="text-xs text-stone-500 mb-4">
            Aggregated from contracts in the selected season and region
          </p>
          {commodityQuotas.length ? <SimpleBarChart data={commodityQuotas} dataKey="actual" nameKey="commodity" color="#1b4332" height={260} unit=" MT" /> : <p className="rounded-lg bg-stone-50 p-6 text-sm text-stone-500">No commodity records match these filters.</p>}
        </div>

        <div className="lg:col-span-4 bg-white border border-stone-200 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-stone-900 mb-1">
            Regional Contract Distribution
          </h3>
          <p className="text-xs text-stone-500 mb-4">
            Count of contracts by region in the selected scope
          </p>
          {regionalShares.length ? <SimplePieChart data={regionalShares} height={260} /> : <p className="rounded-lg bg-stone-50 p-6 text-sm text-stone-500">No regional contract records match these filters.</p>}
        </div>
      </div>
    </div>
  );
};
