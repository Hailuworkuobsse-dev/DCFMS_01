import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  MapPin,
  ClipboardCheck,
  AlertTriangle,
  Wheat,
  FileCheck,
} from 'lucide-react';
import { RoleDashboardFrame } from '../RoleDashboardFrame';
import { StatCard } from '../../../components/primitives/StatCard';
import { SimpleBarChart } from '../../../components/charts/LazyCharts';
import { formatEtb } from '../../../lib/utils/format';

export interface DashboardProps {
  onNavigate: (path: string) => void;
}

export const MoAFederalDashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  const commodityQuotas = [
    { commodity: 'Durum Wheat', contracted: 185000, delivered: 142000 },
    { commodity: 'Malt Barley', contracted: 92000, delivered: 78000 },
    { commodity: 'Sesame Seed', contracted: 64000, delivered: 51000 },
    { commodity: 'Soybean', contracted: 45000, delivered: 39000 },
    { commodity: 'Coffee Arabica', contracted: 38000, delivered: 33000 },
  ];

  return (
    <RoleDashboardFrame
      title={t('dw.moaFederalOversight', 'Ministry of Agriculture — Federal Oversight')}
      subtitle="National food security quotas, strategic commodity contracts, and inter-regional regulatory compliance"
      actions={
        <button
          type="button"
          onClick={() => onNavigate('/reports')}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
        >
          {t('dw.downloadNationalReport', 'Download National Report')}
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dw.nationalFoodSecurityQuota', 'Strategic Commodity Quota')}
          value="424,000 MT"
          change="81% fulfilled"
          trend="up"
          color="forest"
          icon={<Wheat className="w-4 h-4 text-forest-700" />}
        />
        <StatCard
          title={t('dw.endorsedContracts', 'Endorsed Contracts')}
          value="7,834"
          change="100% legally recorded"
          trend="up"
          color="harvest"
          icon={<FileCheck className="w-4 h-4 text-harvest-700" />}
        />
        <StatCard
          title={t('dw.interRegionalDisputes', 'Inter-Regional Escalations')}
          value="7 cases"
          change="Under federal mediation"
          trend="neutral"
          color="stone"
          icon={<AlertTriangle className="w-4 h-4 text-stone-600" />}
        />
        <StatCard
          title={t('dw.statutoryCompliantRate', 'Proclamation 1289 Compliance')}
          value="98.7%"
          change="+1.5% YoY"
          trend="up"
          color="earth"
          icon={<ShieldCheck className="w-4 h-4 text-earth-700" />}
        />
      </div>

      <div className="bg-white border border-stone-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-stone-900 mb-1">
          {t('dw.strategicCommodityDelivery', 'National Commodity Target vs Delivered (Metric Tons)')}
        </h3>
        <p className="text-xs text-stone-500 mb-4">
          Tracking national agro-processing supply chains for staple crops
        </p>
        <SimpleBarChart
          data={commodityQuotas}
          dataKey="delivered"
          nameKey="commodity"
          color="#2d6a4f"
          height={260}
          unit=" MT"
        />
      </div>
    </RoleDashboardFrame>
  );
};

export const RBoARegionalDashboard: React.FC<DashboardProps> = () => {
  const { t } = useTranslation();

  const zoneData = [
    { zone: 'Arsi', contracts: 1420 },
    { zone: 'Bale', contracts: 1120 },
    { zone: 'East Shewa', contracts: 840 },
    { zone: 'West Arsi', contracts: 720 },
    { zone: 'Jimma', contracts: 410 },
  ];

  return (
    <RoleDashboardFrame
      title={t('dw.rboaRegionalOversight', 'Regional Bureau of Agriculture (RBoA)')}
      subtitle="Regional agricultural linkage, seasonal inputs distribution, and zonal performance tracking"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Regional Enrolled Farmers"
          value="42,500"
          change="+12% this season"
          trend="up"
          color="forest"
        />
        <StatCard
          title="Input Vouchers Disbursed"
          value="38,200"
          change="94% redemption rate"
          trend="up"
          color="harvest"
        />
        <StatCard
          title="Regional Disputes"
          value="18 open"
          change="5 resolved this week"
          trend="neutral"
          color="earth"
        />
      </div>

      <div className="bg-white border border-stone-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-stone-900 mb-2">
          Contracts Registered per Zone
        </h3>
        <SimpleBarChart data={zoneData} dataKey="contracts" nameKey="zone" height={240} />
      </div>
    </RoleDashboardFrame>
  );
};

export const ZBoAZonalDashboard: React.FC<DashboardProps> = () => {
  const { t } = useTranslation();

  return (
    <RoleDashboardFrame
      title={t('dw.zboaZonalOversight', 'Zonal Department of Agriculture (ZBoA)')}
      subtitle="Zonal aggregation, woreda comparison, and seasonal harvest inspection logs"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Woredas"
          value="14 Woredas"
          change="100% reporting"
          trend="up"
          color="forest"
        />
        <StatCard
          title="Pre-Harvest Crop Yield Est."
          value="94,000 MT"
          change="Above 5-year average"
          trend="up"
          color="harvest"
        />
        <StatCard
          title="Aggregated Value"
          value={formatEtb(124000000)}
          change="Wheat & Malt Barley"
          trend="up"
          color="earth"
        />
      </div>
    </RoleDashboardFrame>
  );
};

export const WBoAWoredaDashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  return (
    <RoleDashboardFrame
      title={t('dw.wboaWoredaOffice', 'Woreda Office of Agriculture (WBoA) Desk')}
      subtitle="Statutory contract endorsement, tripartite mediation, and DA field deployment"
      actions={
        <button
          type="button"
          onClick={() => onNavigate('/contracts')}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
        >
          {t('dw.reviewPendingEndorsements', 'Review Pending Endorsements')}
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Endorsements"
          value="12 contracts"
          change="Requires WBoA stamp"
          trend="neutral"
          color="forest"
          icon={<FileCheck className="w-4 h-4 text-forest-700" />}
        />
        <StatCard
          title="Active Kebeles"
          value="18 Kebeles"
          change="All reporting"
          trend="up"
          color="harvest"
          icon={<MapPin className="w-4 h-4 text-harvest-700" />}
        />
        <StatCard
          title="Open Grievances"
          value="3 disputes"
          change="Under woreda mediation"
          trend="neutral"
          color="earth"
          icon={<AlertTriangle className="w-4 h-4 text-earth-700" />}
        />
        <StatCard
          title="DA Reports Filed"
          value="142 this month"
          change="+18% vs prev"
          trend="up"
          color="stone"
          icon={<ClipboardCheck className="w-4 h-4 text-stone-600" />}
        />
      </div>

      <div className="bg-white border border-stone-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-stone-900">
            {t('dw.woredaStatutoryActions', 'Immediate Woreda Officer Actions')}
          </h3>
        </div>
        <div className="space-y-2">
          <div className="p-3 bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-stone-900">Contract CF-2025-0891 (Wheat Delivery)</p>
              <p className="text-stone-500">Hetosa Primary Coop ↔ EthioFlour Agro-Processing</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/contracts/ct-001')}
              className="px-3 py-1 bg-stone-900 text-white font-semibold hover:bg-stone-800"
            >
              Verify & Endorse
            </button>
          </div>
          <div className="p-3 bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-stone-900">Grievance GRV-2025-0012 (Quality Grade Dispute)</p>
              <p className="text-stone-500">Moisture content dispute at aggregation warehouse</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/grievances')}
              className="px-3 py-1 bg-forest-700 text-white font-semibold hover:bg-forest-800"
            >
              Mediate Case
            </button>
          </div>
        </div>
      </div>
    </RoleDashboardFrame>
  );
};

export const KebeleDADashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  return (
    <RoleDashboardFrame
      title={t('dw.kebeleDADashboard', 'Development Agent (DA) Field Workspace')}
      subtitle="Farm plot geotagging, biometric farmer identification, and crop growth monitoring"
      actions={
        <button
          type="button"
          onClick={() => onNavigate('/monitoring')}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
        >
          {t('dw.submitPlotInspection', 'Submit Plot Inspection')}
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Assigned Farmers"
          value="185 smallholders"
          change="Kebele 04"
          trend="neutral"
          color="forest"
        />
        <StatCard
          title="Inspections Completed"
          value="142 / 185"
          change="76% coverage"
          trend="up"
          color="harvest"
        />
        <StatCard
          title="Pest & Flood Alerts"
          value="1 alert"
          change="Stem rust detected"
          trend="neutral"
          color="earth"
        />
      </div>

      <div className="bg-white border border-stone-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-stone-900 mb-3">
          {t('dw.fieldActions', 'Field Operations (Offline Enabled)')}
        </h3>
        <p className="text-xs text-stone-600 mb-4">
          Inspections recorded while disconnected in remote kebeles will automatically queue in IndexedDB and sync when back in network range.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/monitoring')}
          className="px-4 py-2 bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800"
        >
          Record Geotagged Inspection
        </button>
      </div>
    </RoleDashboardFrame>
  );
};
