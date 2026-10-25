import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Calendar, Filter } from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { SimpleBarChart, SimplePieChart } from '../../components/charts/LazyCharts';
import { formatEtb, downloadTextFile } from '../../lib/utils/format';

export interface ReportsPageProps {
  onNavigate?: (path: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = () => {
  const { t } = useTranslation();
  const [selectedSeason, setSelectedSeason] = useState('2025_MEHER');
  const [selectedRegion, setSelectedRegion] = useState('ALL');

  const commodityQuotas = [
    { commodity: 'Durum Wheat', target: 185000, actual: 142000 },
    { commodity: 'Malt Barley', target: 92000, actual: 78000 },
    { commodity: 'Sesame Seed', target: 64000, actual: 51000 },
    { commodity: 'Soybean', target: 45000, actual: 39000 },
    { commodity: 'Coffee Arabica', target: 38000, actual: 33000 },
  ];

  const regionalShares = [
    { name: 'Oromia', value: 4200 },
    { name: 'Amhara', value: 3100 },
    { name: 'Sidama', value: 1400 },
    { name: 'Tigray', value: 920 },
    { name: 'Somali', value: 680 },
    { name: 'Afar', value: 410 },
  ];

  const handleExportFullReport = () => {
    const reportData = {
      title: 'Ethiopian Digital Contract Farming Management System (DCFMS) - National Report',
      season: selectedSeason,
      region: selectedRegion,
      generatedAt: new Date().toISOString(),
      statutoryReference: 'Proclamation No. 1289/2023',
      metrics: {
        totalContracts: 7834,
        enrolledFarmers: 72700,
        totalContractedValueEtb: 486500000,
        disputeRatePercent: 1.2,
        proclamationComplianceRate: 98.7,
      },
      commodities: commodityQuotas,
      regions: regionalShares,
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
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">424,000 MT</p>
          <p className="text-xs text-stone-500 mt-1">Contracted off-take</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Total Escrow Value</p>
          <p className="text-2xl font-bold font-mono text-forest-800 mt-1">{formatEtb(486500000)}</p>
          <p className="text-xs text-stone-500 mt-1">100% Commercial Bank secured</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Enrolled Smallholders</p>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">72,700</p>
          <p className="text-xs text-stone-500 mt-1">Fayda National ID verified</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Floor Price Integrity</p>
          <p className="text-2xl font-bold font-mono text-earth-800 mt-1">99.4%</p>
          <p className="text-xs text-stone-500 mt-1">MoTR threshold compliant</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-stone-200 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-stone-900 mb-1">
            Strategic Grain Quotas: Target vs Delivered (Metric Tons)
          </h3>
          <p className="text-xs text-stone-500 mb-4">
            Monitoring supply to domestic flour mills, breweries, and edible oil processors
          </p>
          <SimpleBarChart
            data={commodityQuotas}
            dataKey="actual"
            nameKey="commodity"
            color="#1b4332"
            height={260}
            unit=" MT"
          />
        </div>

        <div className="lg:col-span-4 bg-white border border-stone-200 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-stone-900 mb-1">
            Regional Contract Distribution
          </h3>
          <p className="text-xs text-stone-500 mb-4">
            Federated share across regional bureaus
          </p>
          <SimplePieChart data={regionalShares} height={260} />
        </div>
      </div>
    </div>
  );
};
