import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Scale,
  FileCheck2,
  Building,
  Gavel,
  BookOpen,
} from 'lucide-react';
import { RoleDashboardFrame } from '../RoleDashboardFrame';
import { StatCard } from '../../../components/primitives/StatCard';
import { SimpleBarChart } from '../../../components/charts/LazyCharts';

export interface DashboardProps {
  onNavigate: (path: string) => void;
}

export const MoTRFederalDashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  const priceIndices = [
    { commodity: 'Durum Wheat', floor: 4600, market: 5200, ceiling: 5800 },
    { commodity: 'Malt Barley', floor: 4200, market: 4800, ceiling: 5400 },
    { commodity: 'Sesame', floor: 9800, market: 11400, ceiling: 13000 },
    { commodity: 'Soybean', floor: 3800, market: 4300, ceiling: 4900 },
  ];

  return (
    <RoleDashboardFrame
      title={t('dw.motrFederalDesk', 'Ministry of Trade & Regional Integration (MoTR)')}
      subtitle="Commercial buyer licensing verification, national minimum price indices, and cross-border trade flow"
      actions={
        <button
          type="button"
          onClick={() => onNavigate('/reports')}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
        >
          {t('dw.exportPriceAdvisories', 'Export Price Bulletin')}
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t('dw.licensedAgroProcessors', 'Verified Agro-Processors')}
          value="182 entities"
          change="100% Tin & VAT verified"
          trend="up"
          color="forest"
          icon={<Building className="w-4 h-4 text-forest-700" />}
        />
        <StatCard
          title={t('dw.floorPriceCompliance', 'Floor Price Compliance')}
          value="99.4%"
          change="0 predatory contracts"
          trend="up"
          color="harvest"
          icon={<Scale className="w-4 h-4 text-harvest-700" />}
        />
        <StatCard
          title={t('dw.activeTradeCorridors', 'Active Commodity Corridors')}
          value="14 routes"
          change="Direct off-take tracking"
          trend="neutral"
          color="earth"
          icon={<FileCheck2 className="w-4 h-4 text-earth-700" />}
        />
      </div>

      <div className="bg-white border border-stone-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-stone-900 mb-2">
          {t('dw.motrCommodityFloorComparison', 'Statutory Floor vs Current Market Price (ETB/Quintal)')}
        </h3>
        <p className="text-xs text-stone-500 mb-4">
          Enforcing minimum purchasing guarantees to protect smallholders from price collapse
        </p>
        <SimpleBarChart
          data={priceIndices}
          dataKey="market"
          nameKey="commodity"
          color="#1b4332"
          height={240}
          unit=" ETB"
        />
      </div>
    </RoleDashboardFrame>
  );
};

export const RCoPARegionalDashboard: React.FC<DashboardProps> = () => {
  const { t } = useTranslation();

  return (
    <RoleDashboardFrame
      title={t('dw.rcopaRegionalDesk', 'Regional Cooperative Promotion Agency (RCoPA)')}
      subtitle="Primary cooperative audit, collective bargaining quotas, and member dividend distributions"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Affiliated Cooperatives"
          value="420 Co-ops"
          change="18 Unions active"
          trend="up"
          color="forest"
        />
        <StatCard
          title="Collective Grain Volume"
          value="180,000 MT"
          change="Aggregated for unions"
          trend="up"
          color="harvest"
        />
        <StatCard
          title="Dividend Settlement Integrity"
          value="97.8%"
          change="Paid to members"
          trend="up"
          color="earth"
        />
      </div>
    </RoleDashboardFrame>
  );
};

export const OmbudsmanDashboard: React.FC<DashboardProps> = () => {
  const { t } = useTranslation();

  return (
    <RoleDashboardFrame
      title={t('dw.ombudsmanDesk', 'Institution of the Ombudsman — Fair Terms Audit')}
      subtitle="Independent oversight of contract clause fairness, force majeure invocations, and smallholder protection"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Audited Contracts"
          value="1,420 sample"
          change="Zero predatory terms"
          trend="up"
          color="forest"
        />
        <StatCard
          title="Reported Injustices"
          value="4 inquiries"
          change="2 resolved"
          trend="neutral"
          color="harvest"
        />
        <StatCard
          title="Fair Terms Index"
          value="98.2 / 100"
          change="High standard"
          trend="up"
          color="earth"
        />
      </div>
    </RoleDashboardFrame>
  );
};

export const CourtJudgeDashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  return (
    <RoleDashboardFrame
      title={t('dw.woredaCourtBench', 'Woreda Court Judicial Bench')}
      subtitle="Statutory adjudication under Proclamation No. 1289/2023, binding arbitral awards, and escrow lien releases"
      actions={
        <button
          type="button"
          onClick={() => onNavigate('/grievances')}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
        >
          {t('dw.viewDocket', 'View Judicial Docket')}
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t('dw.courtDocketCases', 'Active Judicial Docket')}
          value="3 cases"
          change="Under formal hearing"
          trend="neutral"
          color="stone"
          icon={<Gavel className="w-4 h-4 text-stone-700" />}
        />
        <StatCard
          title={t('dw.disputeResolutionAvg', 'Average Adjudication Time')}
          value="14 days"
          change="Statutory max is 30d"
          trend="up"
          color="forest"
          icon={<BookOpen className="w-4 h-4 text-forest-700" />}
        />
        <StatCard
          title={t('dw.arbitralEnforcementRate', 'Enforceability Rate')}
          value="100%"
          change="Proclamation 1289 compliant"
          trend="up"
          color="earth"
          icon={<Scale className="w-4 h-4 text-earth-700" />}
        />
      </div>

      <div className="bg-white border border-stone-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-stone-900 mb-3">
          {t('dw.activeJudicialCases', 'Formal Contract Disputes Pending Hearing')}
        </h3>
        <div className="p-3 bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-stone-900">Case #DCFMS-JD-2025-004: Grade & Moisture Rejection</p>
            <p className="text-stone-500">
              Contract CF-2025-0891 • Plaintiff: Hetosa Primary Coop • Defendant: EthioFlour Agro-Processing
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/grievances')}
            className="px-3 py-1 bg-stone-900 text-white font-semibold hover:bg-stone-800"
          >
            Review Evidence & Summons
          </button>
        </div>
      </div>
    </RoleDashboardFrame>
  );
};
