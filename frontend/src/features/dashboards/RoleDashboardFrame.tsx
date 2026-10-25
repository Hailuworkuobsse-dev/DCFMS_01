import React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Layers } from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { useAppStore } from '../../store/useAppStore';
import { ROLE_REGISTRY } from '../../lib/rbac/roles';

export interface RoleDashboardFrameProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const RoleDashboardFrame: React.FC<RoleDashboardFrameProps> = ({
  title,
  subtitle,
  onRefresh,
  isRefreshing = false,
  actions,
  children,
}) => {
  const { t } = useTranslation();
  const { currentRole, activeScope } = useAppStore();
  const roleInfo = ROLE_REGISTRY[currentRole];

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={
          subtitle ||
          `${t(roleInfo.labelKey, currentRole)} — ${
            activeScope?.region
              ? `${activeScope.region}${activeScope.woreda ? ` / ${activeScope.woreda}` : ''}`
              : 'Federal Democratic Republic of Ethiopia'
          }`
        }
        badge={
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-semibold bg-stone-100 text-stone-800 border border-stone-300">
            <Layers className="w-3 h-3 text-stone-500" />
            <span>{currentRole}</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-stone-500 ${
                    isRefreshing ? 'animate-spin' : ''
                  }`}
                />
                <span>{t('common.refresh', 'Refresh')}</span>
              </button>
            )}
            {actions}
          </div>
        }
      />

      <div className="space-y-6">{children}</div>
    </div>
  );
};
