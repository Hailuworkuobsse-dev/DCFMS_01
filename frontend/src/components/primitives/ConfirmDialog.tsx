import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, AlertCircle, CheckCircle2, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'primary',
  isLoading = false,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-600" />,
          btn: 'bg-rose-700 hover:bg-rose-800 text-white focus:ring-rose-900',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-harvest-600" />,
          btn: 'bg-harvest-600 hover:bg-harvest-700 text-stone-900 focus:ring-harvest-900',
        };
      default:
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-forest-700" />,
          btn: 'bg-forest-700 hover:bg-forest-800 text-white focus:ring-forest-900',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-white border border-stone-300 shadow-xl overflow-hidden focus:outline-none"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-stone-100 border border-stone-200 shrink-0">
              {styles.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 id="confirm-dialog-title" className="text-base font-bold text-stone-900">
                {title}
              </h3>
              <p className="mt-2 text-xs text-stone-600 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-3 bg-stone-50 border-t border-stone-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900"
          >
            {cancelLabel || t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-xs font-semibold shadow-xs focus:outline-none focus:ring-2 ${styles.btn} disabled:opacity-50`}
          >
            {isLoading ? t('common.processing', 'Processing...') : (confirmLabel || t('common.confirm', 'Confirm'))}
          </button>
        </div>
      </div>
    </div>
  );
};
