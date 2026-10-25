import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wheat,
  Users,
  Factory,
  Ticket,
  Banknote,
  Truck,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { RoleDashboardFrame } from '../RoleDashboardFrame';
import { StatCard } from '../../../components/primitives/StatCard';
import { SimpleAreaChart } from '../../../components/charts/LazyCharts';
import { formatEtb } from '../../../lib/utils/format';

export interface DashboardProps {
  onNavigate: (path: string) => void;
}

export const FarmerIndividualDashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  return (
    <RoleDashboardFrame
      title={t('dw.farmerDashboard', 'Smallholder Farmer Portal')}
      subtitle="Digital contract terms, input voucher redemption, upcoming harvest delivery, and mobile wallet payout"
      actions={
        <button
          type="button"
          onClick={() => onNavigate('/contracts')}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
        >
          {t('dw.viewMyContracts', 'View My Contracts')}
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dw.activeCommitment', 'Contracted Volume')}
          value="45 Quintals"
          change="Durum Wheat (Grade 1)"
          trend="neutral"
          color="forest"
          icon={<Wheat className="w-4 h-4 text-forest-700" />}
        />
        <StatCard
          title={t('dw.agreedPurchasePrice', 'Agreed Price')}
          value="5,200 ETB / Qtl"
          change="Floor guarantee: 4,800"
          trend="up"
          color="harvest"
          icon={<Banknote className="w-4 h-4 text-harvest-700" />}
        />
        <StatCard
          title={t('dw.inputVoucherStatus', 'Input Advance')}
          value="Redeemed"
          change="2 bags UREA + Certified Seed"
          trend="up"
          color="earth"
          icon={<Ticket className="w-4 h-4 text-earth-700" />}
        />
        <StatCard
          title={t('dw.projectedPayout', 'Est. Net Payout')}
          value={formatEtb(234000)}
          change="Escrow Secured"
          trend="up"
          color="stone"
          icon={<CheckCircle2 className="w-4 h-4 text-forest-600" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-stone-200 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-stone-900 mb-2">Upcoming Harvest & Delivery Schedule</h3>
          <p className="text-xs text-stone-600 mb-4">
            Deliver grain to Hetosa Primary Cooperative Aggregation Center by <span className="font-semibold text-stone-900">Nov 15, 2025</span>.
          </p>
          <div className="p-3 bg-stone-50 border border-stone-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-500">Commodity:</span>
              <span className="font-semibold text-stone-900">Durum Wheat (Local variety Kingbird)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Max Moisture Allowed:</span>
              <span className="font-semibold text-stone-900">12.5%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Target Delivery Center:</span>
              <span className="font-semibold text-stone-900">Hetosa Center 01, Arsi Zone</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-stone-900 mb-2">USSD & SMS Notifications</h3>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-stone-50 border border-stone-200">
              <p className="font-mono text-[11px] text-stone-500">Yesterday at 14:30 • SMS 8028</p>
              <p className="text-stone-800 mt-0.5">
                "DCFMS: Your input voucher for 100kg NPS fertilizer has been verified by Hetosa Agro-Dealership."
              </p>
            </div>
            <div className="p-2.5 bg-stone-50 border border-stone-200">
              <p className="font-mono text-[11px] text-stone-500">3 days ago • USSD *998#</p>
              <p className="text-stone-800 mt-0.5">
                "DCFMS: Contract CF-2025-0891 successfully stamped by WBoA Arsi Office."
              </p>
            </div>
          </div>
        </div>
      </div>
    </RoleDashboardFrame>
  );
};

export const PrimaryCooperativeDashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  return (
    <RoleDashboardFrame
      title={t('dw.primaryCoopDesk', 'Primary Cooperative Aggregation Hub')}
      subtitle="Smallholder aggregation, warehouse intake receipts, member crop quality grading, and collective contracts"
      actions={
        <button
          type="button"
          onClick={() => onNavigate('/contracts')}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
        >
          {t('dw.manageCollectiveContracts', 'Manage Collective Contracts')}
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Aggregated Grain Volume"
          value="4,850 MT"
          change="Durum Wheat (82% of target)"
          trend="up"
          color="forest"
          icon={<Wheat className="w-4 h-4 text-forest-700" />}
        />
        <StatCard
          title="Participating Smallholders"
          value="850 Farmers"
          change="100% Fayda registered"
          trend="up"
          color="harvest"
          icon={<Users className="w-4 h-4 text-harvest-700" />}
        />
        <StatCard
          title="Buyer Escrow Locked"
          value={formatEtb(25220000)}
          change="Guaranteed by Commercial Bank"
          trend="up"
          color="earth"
          icon={<Banknote className="w-4 h-4 text-earth-700" />}
        />
      </div>

      <div className="bg-white border border-stone-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-stone-900">
            Grain Aggregation & Warehouse Intake
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('/contracts/ct-001')}
            className="text-xs font-semibold text-forest-700 hover:underline flex items-center gap-1"
          >
            <span>View Active Buyer Off-take</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-stone-600 mb-3">
          Contracts with EthioFlour Agro-Processing and Bale Union for 2025/26 season. All intake tested for moisture & impurities at dock.
        </p>
      </div>
    </RoleDashboardFrame>
  );
};

export const CooperativeUnionDashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  return (
    <RoleDashboardFrame
      title={t('dw.coopUnionDesk', 'Cooperative Union Executive Dashboard')}
      subtitle="Multi-woreda primary cooperative federations, industrial off-take contracts, and bulk input imports"
      actions={
        <button
          type="button"
          onClick={() => onNavigate('/contracts/new')}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
        >
          {t('dw.initiateCommercialContract', 'Initiate Commercial Off-take')}
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Affiliated Primary Co-ops"
          value="24 Co-ops"
          change="Across Arsi & Bale"
          trend="neutral"
          color="forest"
        />
        <StatCard
          title="Industrial Volume Contracted"
          value="28,000 MT"
          change="Wheat, Malt Barley, Faba Bean"
          trend="up"
          color="harvest"
        />
        <StatCard
          title="Gross Seasonal Turnover"
          value={formatEtb(145600000)}
          change="+16% YoY"
          trend="up"
          color="earth"
        />
      </div>
    </RoleDashboardFrame>
  );
};

export const ContractorAgroProcessorDashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  const intakeProgress = [
    { week: 'W1', intake: 1200 },
    { week: 'W2', intake: 2400 },
    { week: 'W3', intake: 4100 },
    { week: 'W4', intake: 6500 },
    { week: 'W5', intake: 8900 },
  ];

  return (
    <RoleDashboardFrame
      title={t('dw.contractorProcessorDesk', 'Agro-Processor & Commercial Buyer Console')}
      subtitle="Industrial wheat milling intake, quality inspection logs, escrow bank balances, and supplier payments"
      actions={
        <button
          type="button"
          onClick={() => onNavigate('/contracts/new')}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
        >
          {t('dw.draftContract', 'Draft Supplier Contract')}
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dw.targetProcurement', 'Procurement Target')}
          value="12,000 MT"
          change="Durum Wheat"
          trend="neutral"
          color="forest"
          icon={<Factory className="w-4 h-4 text-forest-700" />}
        />
        <StatCard
          title={t('dw.deliveredIntake', 'Verified Intake')}
          value="8,900 MT"
          change="74.2% fulfilled"
          trend="up"
          color="harvest"
          icon={<Truck className="w-4 h-4 text-harvest-700" />}
        />
        <StatCard
          title={t('dw.escrowDeposit', 'Tripartite Escrow Balance')}
          value={formatEtb(62400000)}
          change="Held at Commercial Bank"
          trend="neutral"
          color="earth"
          icon={<Banknote className="w-4 h-4 text-earth-700" />}
        />
        <StatCard
          title={t('dw.qualityPassRate', 'Quality Acceptance Rate')}
          value="98.6%"
          change="Avg moisture 11.8%"
          trend="up"
          color="stone"
          icon={<CheckCircle2 className="w-4 h-4 text-forest-600" />}
        />
      </div>

      <div className="bg-white border border-stone-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-stone-900 mb-2">
          Harvest Intake Velocity (Cumulative Metric Tons)
        </h3>
        <SimpleAreaChart data={intakeProgress} dataKey="intake" nameKey="week" height={220} />
      </div>
    </RoleDashboardFrame>
  );
};

export const InputSupplierDashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  return (
    <RoleDashboardFrame
      title={t('dw.inputSupplierDesk', 'Input Supplier & Agro-Dealer Desk')}
      subtitle="Certified seed, fertilizer (NPS/UREA), and crop protection voucher validation and subsidy claims"
      actions={
        <button
          type="button"
          onClick={() => onNavigate('/inputs')}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
        >
          {t('dw.redeemVoucher', 'Redeem Voucher')}
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Vouchers Redeemed"
          value="1,450 vouchers"
          change="Certified wheat seed & NPS"
          trend="up"
          color="forest"
          icon={<Ticket className="w-4 h-4 text-forest-700" />}
        />
        <StatCard
          title="Warehouse Stock Balance"
          value="850 Bags NPS"
          change="Adequate inventory"
          trend="neutral"
          color="harvest"
        />
        <StatCard
          title="Pending Bank Reimbursement"
          value={formatEtb(4650000)}
          change="Awaiting settlement"
          trend="neutral"
          color="earth"
        />
      </div>
    </RoleDashboardFrame>
  );
};

export const CommercialBankDashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  return (
    <RoleDashboardFrame
      title={t('dw.commercialBankDesk', 'Commercial Bank Agricultural Credit & Escrow')}
      subtitle="Tripartite escrow management, pre-financing disbursements, and harvest off-take lien settlements"
      actions={
        <button
          type="button"
          onClick={() => onNavigate('/finance')}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
        >
          {t('dw.manageEscrow', 'Manage Escrow Accounts')}
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t('dw.activeEscrowVaults', 'Active Escrow Vaults')}
          value={formatEtb(142000000)}
          change="Held against contracts"
          trend="up"
          color="forest"
          icon={<Banknote className="w-4 h-4 text-forest-700" />}
        />
        <StatCard
          title={t('dw.inputCreditDisbursed', 'Seasonal Credit Disbursed')}
          value={formatEtb(34500000)}
          change="99.1% recovery rate"
          trend="up"
          color="harvest"
        />
        <StatCard
          title={t('dw.settledDeliveries', 'Deliveries Settled')}
          value="842 transactions"
          change="Automatic bank transfer"
          trend="up"
          color="earth"
        />
      </div>
    </RoleDashboardFrame>
  );
};
