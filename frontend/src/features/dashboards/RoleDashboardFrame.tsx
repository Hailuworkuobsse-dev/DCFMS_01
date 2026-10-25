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
    <div className="role-dashboard space-y-6">
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
          <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-forest-50 text-forest-800 border border-forest-200">
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
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-forest-800 bg-white border border-forest-200 shadow-sm hover:bg-forest-50 focus:outline-none focus:ring-2 focus:ring-forest-600 disabled:opacity-50"
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
