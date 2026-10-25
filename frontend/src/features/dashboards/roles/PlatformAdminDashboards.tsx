import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Users,
  FileText,
  Server,
  AlertTriangle,
  CheckCircle2,
  Database,
  Cpu,
  Clock,
} from 'lucide-react';
import { RoleDashboardFrame } from '../RoleDashboardFrame';
import { StatCard } from '../../../components/primitives/StatCard';
import { SimpleBarChart, SimplePieChart, SimpleAreaChart } from '../../../components/charts/LazyCharts';
import { formatEtb } from '../../../lib/utils/format';

export interface DashboardProps {
  onNavigate: (path: string) => void;
}

export const ATISuperAdminDashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  const contractStatusData = [
    { name: 'Active', value: 3420 },
    { name: 'Submitted', value: 890 },
    { name: 'Approved', value: 1250 },
    { name: 'Settled', value: 2180 },
    { name: 'Disputed', value: 94 },
  ];

  const regionalActivityData = [
    { region: 'Oromia', contracts: 4200, farmers: 28000 },
    { region: 'Amhara', contracts: 3100, farmers: 21000 },
    { region: 'Sidama', contracts: 1400, farmers: 9500 },
    { region: 'Tigray', contracts: 920, farmers: 6800 },
    { region: 'Somali', contracts: 680, farmers: 4500 },
    { region: 'Afar', contracts: 410, farmers: 2900 },
  ];

  const integrations = [
    { name: 'Fayda National e-KYC', status: 'Operational', latency: '42ms', uptime: '99.98%' },
    { name: 'NMIS Commodity Market', status: 'Operational', latency: '68ms', uptime: '99.91%' },
    { name: 'Commercial Bank of Ethiopia (CBE)', status: 'Operational', latency: '112ms', uptime: '99.85%' },
    { name: 'Ethio Telecom USSD / SMS Gateway', status: 'Operational', latency: '19ms', uptime: '99.99%' },
  ];

  return (
    <RoleDashboardFrame
      title={t('dw.atiPlatformHealth', 'National Contract Farming Overview')}
      subtitle="Federated agricultural linkage and contract enforcement metrics across Ethiopia"
      actions={
        <button
          type="button"
          onClick={() => onNavigate('/admin')}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
        >
          {t('dw.systemConfig', 'System Configuration')}
        </button>
      }
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dw.activeContractsTotal', 'Total Active Contracts')}
          value="7,834"
          change="+14.2% MoM"
          trend="up"
          color="forest"
          icon={<FileText className="w-4 h-4 text-forest-700" />}
        />
        <StatCard
          title={t('dw.registeredFarmers', 'Enrolled Smallholders')}
          value="72,700"
          change="+8.6% MoM"
          trend="up"
          color="harvest"
          icon={<Users className="w-4 h-4 text-harvest-700" />}
        />
        <StatCard
          title={t('dw.totalContractedVolume', 'Contract Value (ETB)')}
          value={formatEtb(486500000)}
          change="+19.4% YoY"
          trend="up"
          color="earth"
          icon={<Activity className="w-4 h-4 text-earth-700" />}
        />
        <StatCard
          title={t('dw.disputeRate', 'Dispute Escalation Rate')}
          value="1.2%"
          change="-0.4% MoM"
          trend="up"
          color="stone"
          icon={<AlertTriangle className="w-4 h-4 text-stone-600" />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-stone-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                {t('dw.regionalContractDistribution', 'Regional Contract Distribution')}
              </h3>
              <p className="text-xs text-stone-500">Active contracts & participating farmers</p>
            </div>
          </div>
          <SimpleBarChart
            data={regionalActivityData}
            dataKey="contracts"
            nameKey="region"
            color="#1b4332"
            height={260}
          />
        </div>

        <div className="lg:col-span-4 bg-white border border-stone-200 p-5 shadow-xs">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-stone-900">
              {t('dw.contractLifecycleBreakdown', 'Contracts by Status')}
            </h3>
            <p className="text-xs text-stone-500">Distribution across 5 key lifecycle states</p>
          </div>
          <SimplePieChart data={contractStatusData} height={260} />
        </div>
      </div>

      {/* Integration Health Matrix */}
      <div className="bg-white border border-stone-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-forest-700" />
            <h3 className="text-sm font-bold text-stone-900">
              {t('dw.interoperabilityHealth', 'Federal Interoperability & External Gateways')}
            </h3>
          </div>
          <span className="text-xs font-mono text-forest-700 bg-forest-50 px-2 py-0.5 border border-forest-200">
            All 4 Integrations Healthy
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {integrations.map((item) => (
            <div key={item.name} className="p-3 border border-stone-200 bg-stone-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-900 truncate">{item.name}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-forest-600 shrink-0" />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-stone-500">Latency:</span>
                <span className="font-mono text-stone-800">{item.latency}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-stone-500">Uptime (30d):</span>
                <span className="font-mono text-forest-700 font-semibold">{item.uptime}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </RoleDashboardFrame>
  );
};

export const SystemAdminDashboard: React.FC<DashboardProps> = () => {
  const { t } = useTranslation();

  const throughputData = [
    { time: '08:00', req: 450 },
    { time: '10:00', req: 1820 },
    { time: '12:00', req: 2450 },
    { time: '14:00', req: 3100 },
    { time: '16:00', req: 2800 },
    { time: '18:00', req: 1200 },
  ];

  return (
    <RoleDashboardFrame
      title={t('dw.systemHealthAndInfra', 'System Infrastructure & Telemetry')}
      subtitle="Node services, database latency, background sync queues, and active worker sessions"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Cluster Health"
          value="99.98%"
          change="Optimal"
          trend="up"
          color="forest"
          icon={<Cpu className="w-4 h-4 text-forest-700" />}
        />
        <StatCard
          title="Active User Sessions"
          value="482"
          change="Peak hours"
          trend="neutral"
          color="harvest"
          icon={<Users className="w-4 h-4 text-harvest-700" />}
        />
        <StatCard
          title="DB Query Latency"
          value="18ms"
          change="-4ms avg"
          trend="up"
          color="earth"
          icon={<Database className="w-4 h-4 text-earth-700" />}
        />
        <StatCard
          title="Sync Worker Backlog"
          value="0 jobs"
          change="All flushed"
          trend="up"
          color="stone"
          icon={<Clock className="w-4 h-4 text-stone-600" />}
        />
      </div>

      <div className="bg-white border border-stone-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-stone-900 mb-2">
          API Request Throughput (Req/Min)
        </h3>
        <SimpleAreaChart data={throughputData} dataKey="req" nameKey="time" height={220} />
      </div>
    </RoleDashboardFrame>
  );
};

export const DataClerkDashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  return (
    <RoleDashboardFrame
      title={t('dw.dataClerkWorkstation', 'Digitization & Data Entry Desk')}
      subtitle="Woreda-level paper registry conversion, Fayda e-KYC validation, and pending farmer profiles"
      actions={
        <button
          type="button"
          onClick={() => onNavigate('/contracts/new')}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
        >
          {t('dw.newContractEntry', 'New Contract Entry')}
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t('dw.digitizedToday', 'Digitized Today')}
          value="48 profiles"
          change="+12 vs target"
          trend="up"
          color="forest"
        />
        <StatCard
          title={t('dw.pendingPaperContracts', 'Pending Paper Verification')}
          value="14 files"
          change="Awaiting scan"
          trend="neutral"
          color="harvest"
        />
        <StatCard
          title={t('dw.validationErrors', 'Fayda Mismatches')}
          value="2 items"
          change="Requires re-scan"
          trend="down"
          color="stone"
        />
      </div>

      <div className="bg-white border border-stone-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-stone-900 mb-3">
          {t('dw.quickDataEntryActions', 'Digitization Workflow')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/contracts/new')}
            className="p-4 border border-stone-200 hover:border-stone-900 bg-stone-50 hover:bg-stone-100 text-left"
          >
            <p className="font-bold text-xs text-stone-900">Step-by-Step Contract Wizard</p>
            <p className="text-[11px] text-stone-500 mt-1">
              Enter buyer, supplier, commodity quota, pricing model, and woreda endorsement.
            </p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/inputs')}
            className="p-4 border border-stone-200 hover:border-stone-900 bg-stone-50 hover:bg-stone-100 text-left"
          >
            <p className="font-bold text-xs text-stone-900">Input Voucher Redemption</p>
            <p className="text-[11px] text-stone-500 mt-1">
              Record agrochemical, fertilizer (NPS/UREA), and certified seed deliveries.
            </p>
          </button>
        </div>
      </div>
    </RoleDashboardFrame>
  );
};
