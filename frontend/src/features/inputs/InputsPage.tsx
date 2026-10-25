import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';
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
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [redeemingVoucher, setRedeemingVoucher] = useState<InputVoucher | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  const fetchVouchers = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const res = await api.inputs.listVouchers();
      setVouchers(res.vouchers);
    } catch (err) {
      console.error('Failed to load vouchers:', err);
      setLoadError(err instanceof Error ? err.message : t('inputs.loadFailed', 'Unable to load voucher records.'));
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
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setActionError(t('inputs.invalidOtp', 'Enter the 6-digit verification code.'));
      return;
    }
    setActionError('');
    setIsRedeeming(true);
    try {
      await api.inputs.redeemVoucher(redeemingVoucher.voucherCode, { otpCode });
      setRedeemingVoucher(null);
      setOtpCode('');
      await fetchVouchers();
    } catch (err) {
      console.error('Redeem failed:', err);
      setActionError(err instanceof Error ? err.message : t('inputs.redeemFailed', 'Voucher redemption failed. Verify the code and try again.'));
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
          {item.expiryDate ? formatShortDate(item.expiryDate) : '—'}
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
        actions={<button type="button" onClick={() => void fetchVouchers()} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />{t('common.refresh', 'Refresh')}</button>}
      />

      {loadError && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">{t('inputs.loadFailedTitle', 'Voucher records could not be loaded')}</p><p className="mt-1">{loadError}</p></div></div><button type="button" onClick={() => void fetchVouchers()} className="inline-flex items-center gap-2 self-start rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold"><RotateCcw className="h-3.5 w-3.5" />{t('common.retry', 'Retry')}</button></div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Vouchers in current scope</p>
          <p className="mt-1 font-mono text-2xl font-bold text-stone-900">{vouchers.length.toLocaleString()}</p>
          <p className="mt-1 text-xs text-stone-500">Value: {formatEtb(vouchers.reduce((sum, item) => sum + Number(item.totalValueEtb ?? item.valueEtb ?? 0), 0))}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Redeemed vouchers</p>
          <p className="mt-1 font-mono text-2xl font-bold text-forest-800">{vouchers.filter((item) => ['REDEEMED', 'Redeemed'].includes(String(item.status))).length.toLocaleString()}</p>
          <p className="mt-1 text-xs text-stone-500">Based on loaded voucher status records</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Awaiting redemption</p>
          <p className="mt-1 font-mono text-2xl font-bold text-harvest-700">{vouchers.filter((item) => ['ISSUED', 'Issued'].includes(String(item.status))).length.toLocaleString()}</p>
          <p className="mt-1 text-xs text-stone-500">Issued and not yet redeemed</p>
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
          <div role="dialog" aria-modal="true" aria-labelledby="voucher-redemption-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 id="voucher-redemption-title" className="text-base font-bold text-stone-900 mb-1">
              {t('inputs.confirmRedemption', 'Confirm Voucher Redemption')}
            </h3>
            <p className="text-xs text-stone-600 mb-4">
              Voucher #{redeemingVoucher.voucherCode} for {redeemingVoucher.farmerName || redeemingVoucher.beneficiaryName}.
            </p>

            {actionError && <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{actionError}</div>}
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
                  onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setActionError(''); }}
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  placeholder="123456"
                  className="w-full text-center font-mono py-2 text-base border border-stone-300 focus:outline-none focus:border-stone-900"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Enter the code sent to the farmer. The server verifies whether it is valid.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => { setRedeemingVoucher(null); setOtpCode(''); setActionError(''); }}
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
