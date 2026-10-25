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
import { flushOfflineQueue } from '../../lib/offline/syncQueue';
import { api } from '../../lib/api/client';

export const ShellControls: React.FC = () => {
  const { i18n, t } = useTranslation();
  const {
    currentRole,
    currentUser,
    activeScope,
    isOfflineSimulated,
    isOnline,
    queuedMutationCount,
    setSession,
    toggleOfflineSimulation,
    refreshQueuedCount,
  } = useAppStore();

  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isSwitchingScope, setIsSwitchingScope] = React.useState(false);
  const [scopeError, setScopeError] = React.useState<string | null>(null);
  const [syncMessage, setSyncMessage] = React.useState<string | null>(null);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'am' ? 'en' : 'am';
    i18n.changeLanguage(nextLang);
    document.documentElement.lang = nextLang;
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const result = await flushOfflineQueue(async (item) => {
        if (
          !currentUser ||
          !activeScope ||
          item.ownerId !== currentUser.id ||
          item.scopeId !== activeScope.id
        ) {
          return false;
        }
        try {
          const response = await fetch(item.endpoint, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload),
            credentials: 'include',
          });
          return response.ok;
        } catch {
          return false;
        }
      });
      await refreshQueuedCount();
      setSyncMessage(
        result.failed > 0
          ? t('common.syncPartial', { count: result.failed, defaultValue: '{{count}} submissions remain queued. Sign in with the original account and scope, then retry.' })
          : t('common.syncComplete')
      );
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncMessage(t('common.syncFailed', 'Could not read or synchronize the offline queue.'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleScopeChange = async (scopeId: string) => {
    setIsSwitchingScope(true);
    setScopeError(null);
    try {
      const response = await api.auth.switchScope(scopeId);
      setSession(response.user, response.permissions);
      setIsScopeDropdownOpen(false);
    } catch (err) {
      console.error('Unable to switch active scope:', err);
      setScopeError(t('errors.scopeSwitchFailed', 'Could not switch scope. Please try again.'));
    } finally {
      setIsSwitchingScope(false);
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
          aria-label={effectiveOnline ? t('common.goOffline', 'Go offline') : t('common.goOnline', 'Reconnect')}
          aria-pressed={!effectiveOnline}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-mono font-medium border transition-colors ${
            effectiveOnline
              ? 'bg-forest-50 border-forest-200 text-forest-800 hover:bg-forest-100'
              : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
          }`}
          title={
            effectiveOnline
              ? t('common.simulateOffline', 'Test Offline')
              : t('common.goOnline', 'Reconnect')
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
            aria-label={t('common.queuedItems', { count: queuedMutationCount })}
          >
            <RefreshCw
              className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`}
            />
            <span>{queuedMutationCount} pending</span>
          </button>
        )}
        {syncMessage && (
          <p role="status" aria-live="polite" className="sr-only">{syncMessage}</p>
        )}
      </div>

      {/* Language Toggle */}
      <button
        type="button"
        onClick={toggleLanguage}
        aria-label={t('common.switchLanguage', 'Switch language')}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 focus:outline-none focus:ring-1 focus:ring-stone-900"
        title={t('common.switchLanguage', 'Switch language')}
      >
        <Globe className="w-3.5 h-3.5 text-stone-500" />
        <span className="font-mono">{i18n.language === 'am' ? 'አማርኛ' : 'EN'}</span>
      </button>

      {/* Active scope switcher; only server-assigned scopes are selectable. */}
      {currentUser && currentUser.scopedRoles.length > 1 && <div className="relative">
        <button
          type="button"
          onClick={() => setIsScopeDropdownOpen(!isScopeDropdownOpen)}
          disabled={isSwitchingScope}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-stone-800 bg-stone-100 border border-stone-300 hover:bg-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-900"
          title={t('common.switchScope', 'Switch active role and scope')}
        >
          <Layers className="w-3.5 h-3.5 text-stone-600" />
          <span className="truncate max-w-[110px] sm:max-w-[140px] font-mono">
            {currentRole}
          </span>
          <ChevronDown className="w-3 h-3 text-stone-500" />
        </button>

        {scopeError && (
          <p role="alert" className="absolute right-0 mt-1 w-64 bg-rose-50 border border-rose-200 p-2 text-xs text-rose-800 z-50">
            {scopeError}
          </p>
        )}

        {isScopeDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsScopeDropdownOpen(false)}
            />
            <div className="absolute right-0 mt-1 w-64 max-h-80 overflow-y-auto bg-white border border-stone-300 shadow-xl z-50 py-1 text-xs">
              <div className="px-3 py-1.5 bg-stone-50 border-b border-stone-200 font-semibold text-stone-500 uppercase tracking-wider text-[10px]">
                {t('common.switchScope', 'Assigned roles and scopes')}
              </div>
              {currentUser.scopedRoles.map((assignment) => {
                const isSelected = assignment.id === currentUser.activeScopeId;
                return (
                  <button
                    key={assignment.id}
                    type="button"
                    onClick={() => void handleScopeChange(assignment.id)}
                    disabled={isSwitchingScope}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-stone-100 transition-colors ${
                      isSelected
                        ? 'bg-stone-100 font-bold text-stone-900 border-l-2 border-stone-900'
                        : 'text-stone-700'
                    }`}
                  >
                    <div>
                      <p className="font-mono text-xs">{assignment.roleId}</p>
                      <p className="text-[11px] text-stone-500 truncate">
                        {assignment.scopeLabel} · {assignment.scopeType}
                      </p>
                    </div>
                    {isSelected && <UserCheck className="w-3.5 h-3.5 text-forest-700 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>}
    </div>
  );
};
