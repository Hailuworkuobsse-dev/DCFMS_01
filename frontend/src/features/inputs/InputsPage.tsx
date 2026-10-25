import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { DataTable, Column } from '../../components/primitives/DataTable';
import { StatusBadge } from '../../components/primitives/StatusBadge';
import { Can } from '../../components/primitives/PermissionGate';
import { api } from '../../lib/api/client';
import { InputVoucher } from '../../types/api';
import { formatEtb, formatShortDate } from '../../lib/utils/format';

export interface InputsPageProps {
  onNavigate?: (path: string) => void;
}

export const InputsPage: React.FC<InputsPageProps> = () => {
  const { t } = useTranslation();
  const [vouchers, setVouchers] = useState<InputVoucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [redeemingVoucher, setRedeemingVoucher] = useState<InputVoucher | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  const fetchVouchers = async () => {
    setIsLoading(true);
    try {
      const res = await api.inputs.listVouchers();
      setVouchers(res.vouchers);
    } catch (err) {
      console.error('Failed to load vouchers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemingVoucher) return;
    setIsRedeeming(true);
    try {
      await api.inputs.redeemVoucher(redeemingVoucher.voucherCode, { otpCode });
      setRedeemingVoucher(null);
      setOtpCode('');
      await fetchVouchers();
    } catch (err) {
      console.error('Redeem failed:', err);
    } finally {
      setIsRedeeming(false);
    }
  };

  const columns: Column<InputVoucher>[] = [
    {
      key: 'voucherCode',
      header: t('inputs.voucherCode', 'Voucher Code'),
      sortable: true,
      render: (item) => (
        <span className="font-mono font-bold text-stone-900">
          {item.voucherCode}
        </span>
      ),
    },
    {
      key: 'farmerName',
      header: t('inputs.farmer', 'Farmer / Beneficiary'),
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-medium text-stone-900">{item.farmerName || item.beneficiaryName}</p>
          <p className="text-[11px] text-stone-500 font-mono">
            Contract #{item.contractId?.slice(0, 8)}
          </p>
        </div>
      ),
    },
    {
      key: 'items',
      header: t('inputs.allocatedItems', 'Allocated Inputs'),
      render: (item) => (
        <div className="text-xs space-y-0.5 font-mono text-stone-700">
          {item.items && item.items.length > 0 ? (
            item.items.map((it: any, idx: number) => (
              <div key={idx}>
                {it.quantity} {it.unit} • {it.description}
              </div>
            ))
          ) : (
            <div>
              {item.quantity} {item.unit} • {item.inputType}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'totalValueEtb',
      header: t('inputs.value', 'Value'),
      align: 'right',
      render: (item) => (
        <span className="font-mono font-semibold text-stone-900 text-right block">
          {formatEtb(item.totalValueEtb ?? item.valueEtb ?? 0)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('inputs.status', 'Status'),
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'expiryDate',
      header: t('inputs.validUntil', 'Valid Until'),
      render: (item) => (
        <span className="text-xs font-mono text-stone-500">
          {item.expiryDate ? formatShortDate(item.expiryDate) : '2026-12-31'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('inputs.title', 'Agricultural Input Vouchers')}
        subtitle={t(
          'inputs.subtitle',
          'Certified seed, fertilizer (NPS/UREA), and crop protection distribution with agro-dealer redemption'
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Total Issued Vouchers</p>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">1,450</p>
          <p className="text-xs text-stone-500 mt-1">Value: {formatEtb(7250000)}</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Redeemed by Farmers</p>
          <p className="text-2xl font-bold font-mono text-forest-800 mt-1">1,380 (95.1%)</p>
          <p className="text-xs text-stone-500 mt-1">NPS, UREA & Certified Seed</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Pending Dealer Settlement</p>
          <p className="text-2xl font-bold font-mono text-harvest-700 mt-1">70 vouchers</p>
          <p className="text-xs text-stone-500 mt-1">Under bank processing</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={vouchers}
        keyField="id"
        isLoading={isLoading}
        searchPlaceholder={t('inputs.searchPlaceholder', 'Search vouchers, farmers, seed...')}
        exportFileName="dcfms-input-vouchers"
        actions={(item) =>
          item.status === 'Issued' || item.status === 'ISSUED' ? (
            <Can resource="input_voucher" action="verify">
              <button
                type="button"
                onClick={() => setRedeemingVoucher(item)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('inputs.redeem', 'Redeem')}</span>
              </button>
            </Can>
          ) : (
            <span className="text-xs text-stone-400 font-mono">Completed</span>
          )
        }
      />

      {/* Redemption Dialog */}
      {redeemingVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-stone-300 shadow-xl p-6">
            <h3 className="text-base font-bold text-stone-900 mb-1">
              {t('inputs.confirmRedemption', 'Confirm Voucher Redemption')}
            </h3>
            <p className="text-xs text-stone-600 mb-4">
              Voucher #{redeemingVoucher.voucherCode} for {redeemingVoucher.farmerName || redeemingVoucher.beneficiaryName}.
            </p>

            <form onSubmit={handleRedeem} className="space-y-4">
              <div className="p-3 bg-stone-50 border border-stone-200 text-xs space-y-1">
                {redeemingVoucher.items && redeemingVoucher.items.length > 0 ? (
                  redeemingVoucher.items.map((it: any, idx: number) => (
                    <div key={idx} className="flex justify-between font-mono">
                      <span>{it.description}:</span>
                      <span className="font-bold">{it.quantity} {it.unit}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between font-mono">
                    <span>{redeemingVoucher.inputType}:</span>
                    <span className="font-bold">{redeemingVoucher.quantity} {redeemingVoucher.unit}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Farmer Verification PIN / SMS OTP
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full text-center font-mono py-2 text-base border border-stone-300 focus:outline-none focus:border-stone-900"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Simulated validation: Any 6 digits accepted.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setRedeemingVoucher(null)}
                  className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isRedeeming}
                  className="px-4 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
                >
                  {isRedeeming ? t('common.processing', 'Verifying...') : t('inputs.completeRedemption', 'Disburse & Complete')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
