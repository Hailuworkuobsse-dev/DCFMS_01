import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, KeyRound, X, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export interface SignatureOTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSign: (data: { otpCode: string; declarationAccepted: boolean }) => Promise<void>;
  contractTitle: string;
  contractNumber: string;
  title?: string;
  description?: string;
}

export const SignatureOTPModal: React.FC<SignatureOTPModalProps> = ({
  isOpen,
  onClose,
  onSign,
  contractTitle,
  contractNumber,
  title,
  description,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAppStore();
  const [otpCode, setOtpCode] = useState('');
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeScope = currentUser?.scopedRoles.find((scope) => scope.id === currentUser.activeScopeId);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!declarationAccepted) {
      setError(t('signature.mustAcceptDeclaration', 'You must agree to the legal declaration'));
      return;
    }

    if (otpCode.length !== 6) {
      setError(t('signature.invalidOtp', 'Enter a valid 6-digit OTP code'));
      return;
    }

    try {
      setIsSubmitting(true);
      await onSign({ otpCode, declarationAccepted });
      onClose();
    } catch (err: any) {
      setError(err?.message || t('signature.failed', 'Failed to execute digital signature'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-white border border-stone-300 shadow-xl overflow-hidden focus:outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-forest-700" />
            <h3 id="signature-modal-title" className="text-base font-bold text-stone-900">
              {title || t('signature.title', 'Digital Signature & Authorization')}
            </h3>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-stone-400 hover:text-stone-700 p-1 focus:outline-none focus:ring-1 focus:ring-stone-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <p className="text-xs text-stone-500 font-mono">{contractNumber}</p>
            <p className="text-sm font-semibold text-stone-900">{contractTitle}</p>
            <p className="text-xs text-stone-600 mt-1">
              {description ||
                t(
                  'signature.desc',
                  'In accordance with Ethiopian Contract Farming Proclamation No. 1289/2023, digital signatures execute legally binding commitments.'
                )}
            </p>
          </div>

          {/* Signer Identity Box */}
          <div className="bg-stone-50 border border-stone-200 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-500">{t('signature.authorizedSigner', 'Authorized Signer')}:</span>
              <span className="font-semibold text-stone-900">{currentUser?.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">{t('signature.role', 'Role & Scope')}:</span>
              <span className="font-mono text-stone-700">
                {activeScope?.roleId} ({activeScope?.scopeLabel})
              </span>
            </div>
            {currentUser?.faydaId && (
              <div className="flex justify-between">
                <span className="text-stone-500">{t('signature.faydaId', 'Fayda ID')}:</span>
                <span className="font-mono text-forest-700">{currentUser.faydaId}</span>
              </div>
            )}
          </div>

          {/* Verification Method Tabs */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-stone-700">
              {t('signature.verificationMethod', 'Verification Method')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-center gap-2 p-3 text-xs font-medium border border-stone-900 bg-stone-100 text-stone-900">
                <KeyRound className="w-4 h-4 text-forest-700" />
                <span>{t('signature.smsUssdOtp', 'SMS / USSD OTP')}</span>
              </div>
              <div className="flex items-center justify-center gap-2 p-3 text-xs font-medium border border-stone-200 bg-stone-50 text-stone-400">
                <span>{t('signature.faydaBiometric', 'Fayda Biometric')} — not configured</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="otp-input" className="block text-xs font-semibold text-stone-700">
              {t('signature.enter6DigitOtp', 'Enter 6-Digit Verification Code')}
            </label>
            <input
              id="otp-input"
              type="text"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center tracking-widest text-lg font-mono py-2 bg-white border border-stone-300 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
            />
            <p className="text-[11px] text-stone-500">
              {t('signature.otpSentNotice', 'Demo verification code: 123456')}
            </p>
          </div>

          {/* Legal Checkbox */}
          <div className="flex items-start gap-2 pt-2">
            <input
              id="declaration"
              type="checkbox"
              checked={declarationAccepted}
              onChange={(e) => setDeclarationAccepted(e.target.checked)}
              className="mt-0.5 rounded-none border-stone-300 text-forest-700 focus:ring-forest-600 h-4 w-4"
            />
            <label htmlFor="declaration" className="text-xs text-stone-700 leading-snug cursor-pointer select-none">
              {t(
                'signature.declarationText',
                'I hereby certify that I am legally authorized to represent my institution/farm, that the details stated are accurate, and that my electronic authorization constitutes an enforceable signature under Ethiopian law.'
              )}
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2 bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !declarationAccepted || otpCode.length !== 6}
              className="px-4 py-2 text-xs font-semibold text-white bg-forest-700 hover:bg-forest-800 focus:outline-none focus:ring-2 focus:ring-forest-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {isSubmitting ? t('common.processing', 'Signing...') : t('signature.confirmAndSign', 'Authorize & Sign')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
