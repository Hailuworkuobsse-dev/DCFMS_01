import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from './store/useAppStore';
import { api } from './lib/api/client';
import { AppShell } from './components/shell/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardRouterPage } from './features/dashboards/DashboardRouterPage';
import { ContractListPage } from './features/contracts/ContractListPage';
import { ContractCreateWizardPage } from './features/contracts/ContractCreateWizardPage';
import { ContractDetailPage } from './features/contracts/ContractDetailPage';
import { LinkagePage } from './features/linkage/LinkagePage';
import { InputsPage } from './features/inputs/InputsPage';
import { FinancePage } from './features/finance/FinancePage';
import { MonitoringPage } from './features/monitoring/MonitoringPage';
import { GrievancesPage } from './features/grievances/GrievancesPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { AdminPage } from './features/admin/AdminPage';
import { ComponentCatalogPage } from './features/storybook/ComponentCatalogPage';
import { LoadingState } from './components/primitives/States';
import { ProtectedRoute } from './components/primitives/PermissionGate';

export default function App() {
  const { t } = useTranslation();
  const { isAuthenticated, setSession, logout } = useAppStore();
  const [currentPath, setCurrentPath] = useState<string>(
    window.location.pathname === '/' ? '/dashboard' : window.location.pathname
  );
  const [isInitializing, setIsInitializing] = useState(true);

  // Sync route on popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/dashboard');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Check auth session
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.auth.me();
        if (res.user) {
          setSession(res.user, res.permissions);
        } else {
          // If no active session, auto-login with default persona for smooth prototype evaluation
          const loginRes = await api.auth.login('superadmin@ati.gov.et', 'ati2025!');
          setSession(loginRes.user, loginRes.permissions);
        }
      } catch (err) {
        // Fallback for offline mode or network errors
        console.warn('Auth check fallback:', err);
      } finally {
        setIsInitializing(false);
      }
    };
    checkAuth();
  }, [setSession]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <LoadingState message="Initializing Digital Contract Farming Management System..." />
      </div>
    );
  }

  if (!isAuthenticated && currentPath === '/login') {
    return <LoginPage onSuccess={() => navigate('/dashboard')} />;
  }

  const renderContent = () => {
    if (currentPath === '/login') {
      return <LoginPage onSuccess={() => navigate('/dashboard')} />;
    }

    if (currentPath === '/dashboard') {
      return <DashboardRouterPage onNavigate={navigate} />;
    }

    if (currentPath === '/contracts/new') {
      return <ContractCreateWizardPage onNavigate={navigate} />;
    }

    if (currentPath.startsWith('/contracts/')) {
      const contractId = currentPath.replace('/contracts/', '');
      return <ContractDetailPage contractId={contractId} onNavigate={navigate} />;
    }

    if (currentPath === '/contracts') {
      return <ContractListPage onNavigate={navigate} />;
    }

    if (currentPath === '/linkage') {
      return <LinkagePage onNavigate={navigate} />;
    }

    if (currentPath === '/inputs') {
      return <InputsPage onNavigate={navigate} />;
    }

    if (currentPath === '/finance') {
      return <FinancePage onNavigate={navigate} />;
    }

    if (currentPath === '/monitoring') {
      return <MonitoringPage onNavigate={navigate} />;
    }

    if (currentPath === '/grievances') {
      return <GrievancesPage onNavigate={navigate} />;
    }

    if (currentPath === '/reports') {
      return <ReportsPage onNavigate={navigate} />;
    }

    if (currentPath === '/admin') {
      return <AdminPage onNavigate={navigate} />;
    }

    if (currentPath === '/storybook') {
      return <ComponentCatalogPage />;
    }

    // Default to dashboard
    return <DashboardRouterPage onNavigate={navigate} />;
  };

  return (
    <AppShell currentPath={currentPath} onNavigate={navigate}>
      <ProtectedRoute>{renderContent()}</ProtectedRoute>
    </AppShell>
  );
}
