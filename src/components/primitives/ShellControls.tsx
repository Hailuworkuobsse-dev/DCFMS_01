import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  Wifi,
  WifiOff,
  RefreshCw,
  UserCheck,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ROLE_REGISTRY, RoleId } from '../../lib/rbac/roles';
import { flushOfflineQueue } from '../../lib/offline/syncQueue';

export const ShellControls: React.FC = () => {
  const { i18n, t } = useTranslation();
  const {
    currentRole,
    currentUser,
    isOfflineSimulated,
    isOnline,
    queuedMutationCount,
    setRole,
    toggleOfflineSimulation,
    setQueuedMutationCount,
  } = useAppStore();

  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'am' ? 'en' : 'am';
    i18n.changeLanguage(nextLang);
    document.documentElement.lang = nextLang;
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const remaining = await flushOfflineQueue();
      setQueuedMutationCount(remaining);
    } catch (err) {
      console.error('Manual sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const effectiveOnline = isOnline && !isOfflineSimulated;

  return (
    <div className="flex items-center gap-2">
      {/* Offline simulation & queue status */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleOfflineSimulation}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-mono font-medium border transition-colors ${
            effectiveOnline
              ? 'bg-forest-50 border-forest-200 text-forest-800 hover:bg-forest-100'
              : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
          }`}
          title={
            effectiveOnline
              ? 'Connected (Click to simulate offline / low bandwidth)'
              : 'Offline Mode Active (Click to go online)'
          }
        >
          {effectiveOnline ? (
            <Wifi className="w-3.5 h-3.5 text-forest-600" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-rose-600" />
          )}
          <span className="hidden sm:inline">
            {effectiveOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </button>

        {queuedMutationCount > 0 && (
          <button
            type="button"
            onClick={handleManualSync}
            disabled={!effectiveOnline || isSyncing}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-harvest-50 border border-harvest-300 text-harvest-900 hover:bg-harvest-100 disabled:opacity-50"
            title="Sync pending offline mutations"
          >
            <RefreshCw
              className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`}
            />
            <span>{queuedMutationCount} pending</span>
          </button>
        )}
      </div>

      {/* Language Toggle */}
      <button
        type="button"
        onClick={toggleLanguage}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 focus:outline-none focus:ring-1 focus:ring-stone-900"
        title="Toggle English / Amharic"
      >
        <Globe className="w-3.5 h-3.5 text-stone-500" />
        <span className="font-mono">{i18n.language === 'am' ? 'አማርኛ' : 'EN'}</span>
      </button>

      {/* Role Switcher for Testing / Multi-role delegation */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-stone-800 bg-stone-100 border border-stone-300 hover:bg-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-900"
          title="Switch Active Role"
        >
          <Layers className="w-3.5 h-3.5 text-stone-600" />
          <span className="truncate max-w-[110px] sm:max-w-[140px] font-mono">
            {currentRole}
          </span>
          <ChevronDown className="w-3 h-3 text-stone-500" />
        </button>

        {isRoleDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsRoleDropdownOpen(false)}
            />
            <div className="absolute right-0 mt-1 w-64 max-h-80 overflow-y-auto bg-white border border-stone-300 shadow-xl z-50 py-1 text-xs">
              <div className="px-3 py-1.5 bg-stone-50 border-b border-stone-200 font-semibold text-stone-500 uppercase tracking-wider text-[10px]">
                {t('common.switchRole', 'Switch Active Role (18 Roles)')}
              </div>
              {Object.keys(ROLE_REGISTRY).map((rId) => {
                const info = ROLE_REGISTRY[rId as RoleId];
                const isSelected = rId === currentRole;
                return (
                  <button
                    key={rId}
                    type="button"
                    onClick={() => {
                      setRole(rId as RoleId);
                      setIsRoleDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-stone-100 transition-colors ${
                      isSelected
                        ? 'bg-stone-100 font-bold text-stone-900 border-l-2 border-stone-900'
                        : 'text-stone-700'
                    }`}
                  >
                    <div>
                      <p className="font-mono text-xs">{rId}</p>
                      <p className="text-[11px] text-stone-500 truncate">
                        {t(info.labelKey, rId)}
                      </p>
                    </div>
                    {isSelected && <UserCheck className="w-3.5 h-3.5 text-forest-700 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
