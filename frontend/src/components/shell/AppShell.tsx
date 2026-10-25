import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Menu,
  X,
  FileSignature,
  LayoutDashboard,
  Wheat,
  FolderSync,
  Ticket,
  Banknote,
  SearchCheck,
  AlertOctagon,
  FileBarChart,
  ShieldAlert,
  LogOut,
  Palette,
  ExternalLink,
  Search,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { NAV_REGISTRY } from '../../lib/rbac/roles';
import { ShellControls } from '../primitives/ShellControls';
import { api } from '../../lib/api/client';

export interface AppShellProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentPath,
  onNavigate,
  children,
}) => {
  const { t } = useTranslation();
  const { currentUser, currentRole, activeScope, permissions, logout } = useAppStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<Array<{ id: string; kind: string; title: string; detail: string; path: string }>>([]);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchMessage, setGlobalSearchMessage] = useState('');

  const getNavIcon = (iconName: string) => {
    switch (iconName) {
      case 'LayoutDashboard':
        return <LayoutDashboard className="w-4 h-4 shrink-0" />;
      case 'Users':
      case 'FolderSync':
        return <FolderSync className="w-4 h-4 shrink-0" />;
      case 'FileSignature':
      case 'FileCheck':
        return <FileSignature className="w-4 h-4 shrink-0" />;
      case 'Ticket':
        return <Ticket className="w-4 h-4 shrink-0" />;
      case 'Banknote':
      case 'Scale':
        return <Banknote className="w-4 h-4 shrink-0" />;
      case 'ClipboardCheck':
      case 'SearchCheck':
        return <SearchCheck className="w-4 h-4 shrink-0" />;
      case 'AlertCircle':
      case 'AlertOctagon':
        return <AlertOctagon className="w-4 h-4 shrink-0" />;
      case 'BarChart3':
      case 'FileBarChart':
        return <FileBarChart className="w-4 h-4 shrink-0" />;
      case 'ShieldAlert':
      case 'Settings':
        return <ShieldAlert className="w-4 h-4 shrink-0" />;
      default:
        return <Wheat className="w-4 h-4 shrink-0" />;
    }
  };

  // Filter navigation items by user permissions
  const navItems = NAV_REGISTRY.filter((item) => {
    if (item.requiredAnyPermissions) {
      return item.requiredAnyPermissions.some((required) => permissions.includes(required));
    }
    if (!item.requiredResource || !item.requiredAction) return true;
    return permissions.some((p) => p.startsWith(`${item.requiredResource}:${item.requiredAction}:`));
  });

  const handleGlobalSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = globalSearchQuery.trim();
    if (query.length < 2) {
      setGlobalSearchMessage(t('common.searchMinLength', 'Enter at least 2 characters to search.'));
      setGlobalSearchResults([]);
      setGlobalSearchOpen(true);
      return;
    }

    const normalized = query.toLocaleLowerCase();
    const jobs: Array<Promise<{ kind: string; items: any[] }>> = [];
    if (permissions.some((permission) => permission.startsWith('contract:read:'))) {
      jobs.push(api.contracts.list({ q: query }).then((response) => ({ kind: 'contract', items: response.contracts || [] })));
    }
    if (permissions.some((permission) => permission.startsWith('grievance:read:'))) {
      jobs.push(api.grievances.list().then((response) => ({ kind: 'grievance', items: (response.grievances || []).filter((item) => [item.id, item.caseNumber, item.title, item.category, item.status, item.contractId].some((value) => String(value ?? '').toLocaleLowerCase().includes(normalized))) })));
    }
    if (permissions.some((permission) => permission.startsWith('linkage:read:'))) {
      jobs.push(api.linkages.list().then((response) => ({ kind: 'linkage', items: (response.linkages || []).filter((item) => [item.id, item.commodity, item.buyerOrgName, item.woreda, item.kebele, item.status].some((value) => String(value ?? '').toLocaleLowerCase().includes(normalized))) })));
    }

    setGlobalSearchLoading(true);
    setGlobalSearchOpen(true);
    setGlobalSearchMessage('');
    setGlobalSearchResults([]);
    try {
      const settled = await Promise.allSettled(jobs);
      const results: Array<{ id: string; kind: string; title: string; detail: string; path: string }> = [];
      let successfulSources = 0;
      settled.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        successfulSources += 1;
        const { kind, items } = result.value;
        items.forEach((item) => {
          if (results.length >= 12) return;
          if (kind === 'contract') {
            results.push({ id: item.id, kind, title: item.contractNumber || item.title || 'Contract', detail: [item.commodity, item.region, item.status].filter(Boolean).join(' · '), path: `/contracts/${item.id}` });
          } else if (kind === 'grievance') {
            results.push({ id: item.id, kind, title: item.caseNumber || item.title || 'Grievance', detail: [item.category, item.status, item.contractId ? `Contract ${item.contractId}` : ''].filter(Boolean).join(' · '), path: '/grievances' });
          } else {
            results.push({ id: item.id, kind, title: item.commodity || 'Market demand', detail: [item.buyerOrgName, item.woreda, item.status].filter(Boolean).join(' · '), path: '/linkage' });
          }
        });
      });
      setGlobalSearchResults(results);
      if (results.length === 0) {
        setGlobalSearchMessage(successfulSources ? t('common.noSearchResults', 'No matching records were found.') : t('common.searchUnavailable', 'Search sources are unavailable. Check your connection and permissions.'));
      }
    } finally {
      setGlobalSearchLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      console.error('Unable to invalidate the server session during sign-out:', error);
    }
    logout();
    onNavigate('/login');
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col text-stone-900 selection:bg-stone-800 selection:text-white">
      {/* WCAG Skip-to-content accessible anchor */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-stone-900 focus:text-white focus:outline-none"
      >
        {t('common.skipToContent', 'Skip to main content')}
      </a>

      {/* Top Banner & Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/80 backdrop-blur-xl">
        {/* National Flag Accent Strip */}
        <div className="h-1 flex w-full">
          <div className="flex-1 bg-forest-700" />
          <div className="flex-1 bg-harvest-500" />
          <div className="flex-1 bg-rose-700" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Mobile hamburger & Logo */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden rounded-lg border border-stone-200 bg-white p-2 text-stone-600 shadow-sm hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-forest-700"
                aria-label={t('common.toggleNavigation', 'Toggle navigation menu')}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/dashboard')}
                aria-label={t('nav.dashboard', 'Dashboard')}
                className="flex items-center gap-2.5 cursor-pointer text-left rounded-full border border-stone-200 bg-stone-50/80 px-2 py-1.5 shadow-sm transition hover:border-forest-200 hover:bg-stone-50"
              >
                <div className="brand-emblem flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md" aria-hidden="true"><Wheat className="h-6 w-6" strokeWidth={2.2} /></div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm tracking-tight text-stone-900">
                      DCFMS
                    </span>
                    <span className="rounded border border-stone-200 bg-stone-100 px-1 text-[10px] font-mono text-stone-600">
                      ET
                    </span>
                  </div>
                  <p className="hidden sm:block text-[10px] text-stone-500 leading-none">
                    Digital Contract Farming Management System
                  </p>
                </div>
              </button>
            </div>

            {/* Right: Controls & User session */}
            <div className="flex items-center gap-3">
              <div className="relative hidden w-64 lg:block">
                <form onSubmit={(event) => void handleGlobalSearch(event)} role="search">
                  <label className="sr-only" htmlFor="dcfms-global-search">{t('common.globalSearch', 'Search contracts, grievances and market demands')}</label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input id="dcfms-global-search" value={globalSearchQuery} onChange={(event) => setGlobalSearchQuery(event.target.value)} onFocus={() => { if (globalSearchResults.length || globalSearchMessage) setGlobalSearchOpen(true); }} placeholder={t('common.globalSearch', 'Search contracts, grievances…')} className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-10 text-xs text-stone-800 placeholder:text-stone-400 focus:border-forest-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-100" aria-expanded={globalSearchOpen} aria-controls="dcfms-global-search-results" />
                  <button type="submit" aria-label={t('common.search', 'Search')} disabled={globalSearchLoading} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-500 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-forest-600 disabled:opacity-50">{globalSearchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}</button>
                </form>
                {globalSearchOpen && (globalSearchResults.length > 0 || globalSearchMessage || globalSearchLoading) && (
                  <div id="dcfms-global-search-results" className="absolute right-0 top-full z-50 mt-2 max-h-[min(70vh,32rem)] w-[min(26rem,90vw)] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
                    <div className="flex items-center justify-between px-2 py-1.5"><p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{t('common.searchResults', 'Search results')}</p><button type="button" onClick={() => setGlobalSearchOpen(false)} className="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100">{t('common.close', 'Close')}</button></div>
                    {globalSearchLoading && <p role="status" className="px-2 py-3 text-xs text-stone-500">{t('common.searching', 'Searching authorized records…')}</p>}
                    {!globalSearchLoading && globalSearchMessage && <p role="status" className="px-2 py-3 text-xs text-stone-600">{globalSearchMessage}</p>}
                    {globalSearchResults.map((result) => <button key={`${result.kind}-${result.id}`} type="button" onClick={() => { setGlobalSearchOpen(false); onNavigate(result.path); }} className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-forest-50 focus:outline-none focus:ring-2 focus:ring-forest-600"><span className="block text-xs font-semibold text-stone-900">{result.title}</span><span className="mt-1 block text-[11px] text-stone-500">{result.kind} · {result.detail || 'No additional details'}</span></button>)}
                  </div>
                )}
              </div>
              <ShellControls />

              {currentUser && (
                <div className="hidden md:flex items-center gap-2 pl-2 border-l border-stone-200 text-xs">
                  <div className="text-right">
                    <p className="font-semibold text-stone-800 truncate max-w-[120px]">
                      {currentUser.fullName}
                    </p>
                    <p className="text-[10px] font-mono text-stone-500 truncate max-w-[120px]">
                      {currentUser.woreda || currentUser.region || 'Federal'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    title={t('common.logout', 'Sign out')}
                    aria-label={t('common.logout', 'Sign out')}
                    className="p-1.5 text-stone-500 hover:text-stone-900 border border-stone-200 hover:bg-stone-50"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace with Sidebar */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-60 shrink-0 border-r border-stone-200 bg-white min-h-[calc(100vh-3.75rem)] py-4 flex flex-col justify-between">
          <div className="px-3 space-y-6">
            {/* Active Scope Badge */}
            <div className="p-3 bg-stone-50 border border-stone-200">
              <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                {t('common.activeRoleScope', 'Role Scope')}
              </div>
              <div className="mt-1 font-bold text-xs text-stone-900 font-mono">
                {currentRole}
              </div>
              <div className="mt-0.5 text-[11px] text-forest-800 font-medium truncate">
                {activeScope?.region
                  ? `${activeScope.region} ${activeScope.woreda ? `• ${activeScope.woreda}` : ''}`
                  : 'Federal Oversight'}
              </div>
            </div>

            {/* Nav Menu */}
            <nav aria-label="Sidebar Navigation" className="space-y-1">
              {navItems.map((item) => {
                const isActive =
                  currentPath === item.route ||
                  (item.route !== '/dashboard' && currentPath.startsWith(item.route));

                return (
                  <button
                    key={item.route}
                    type="button"
                    onClick={() => onNavigate(item.route)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-colors ${
                      isActive
                        ? 'bg-stone-900 text-white font-semibold'
                        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    {getNavIcon(item.iconName)}
                    <span className="truncate">{t(item.labelKey, item.route)}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Footer of Sidebar */}
          <div className="p-3 border-t border-stone-200 space-y-2">
            <button
              type="button"
              onClick={() => onNavigate('/storybook')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-stone-600 hover:bg-stone-100 border border-dashed border-stone-300"
            >
              <span className="inline-flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-harvest-600" />
                <span>UI Design System</span>
              </span>
              <ExternalLink className="w-3 h-3 text-stone-400" />
            </button>
            <div className="text-[10px] text-stone-400 font-mono text-center">
              ATI DCFMS v1.0.4 • Procl. 1289/23
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex">
            <div
              className="fixed inset-0 bg-stone-900/50"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative w-64 max-w-xs bg-white h-full flex flex-col justify-between py-4 shadow-xl z-50">
              <div className="px-4 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                  <span className="font-bold text-sm text-stone-900">
                    {t('common.navigation', 'DCFMS Navigation')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 text-stone-400 hover:text-stone-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-2.5 bg-stone-50 border border-stone-200 text-xs">
                  <p className="font-mono font-bold text-stone-900">{currentRole}</p>
                  <p className="text-[11px] text-stone-500">
                    {currentUser?.fullName} ({currentUser?.region || 'Federal'})
                  </p>
                </div>

                <nav className="space-y-1">
                  {navItems.map((item) => (
                    <button
                      key={item.route}
                      type="button"
                      onClick={() => {
                        onNavigate(item.route);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left ${
                        currentPath === item.route
                          ? 'bg-stone-900 text-white font-semibold'
                          : 'text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {getNavIcon(item.iconName)}
                      <span className="truncate">{t(item.labelKey, item.route)}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('/storybook');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100"
                  >
                    <Palette className="w-4 h-4 text-harvest-600" />
                    <span>UI Design System</span>
                  </button>
                </nav>
              </div>

              <div className="px-4 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('common.logout', 'Sign Out')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
};
