import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { api } from './lib/api/client';
import { AppShell } from './components/shell/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardRouterPage } from './features/dashboards/DashboardRouterPage';
import { ContractListPage } from './features/contracts/ContractListPage';
import { ContractCreateWizardPage } from './features/contracts/ContractCreateWizardPage';
import { ContractDetailPage } from './features/contracts/ContractDetailPage';
import { StatutoryReviewPage } from './features/contracts/StatutoryReviewPage';
import { LinkagePage } from './features/linkage/LinkagePage';
import { InputsPage } from './features/inputs/InputsPage';
import { FinancePage } from './features/finance/FinancePage';
import { MonitoringPage } from './features/monitoring/MonitoringPage';
import { GrievancesPage } from './features/grievances/GrievancesPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { AdminPage } from './features/admin/AdminPage';
import { ComponentCatalogPage } from './features/storybook/ComponentCatalogPage';
import { LoadingState, NotFoundState } from './components/primitives/States';
import { ProtectedRoute } from './components/primitives/PermissionGate';
import type { PermissionScope, PermissionString } from './types/api';

const LandingPage = lazy(() =>
  import('./features/landing/LandingPage').then((module) => ({ default: module.LandingPage }))
);

function getRoutePermissions(path: string, scope: PermissionScope | undefined): PermissionString[] {
  if (!scope) return [];
  if (path === '/dashboard' || path === '/storybook') return [`dashboard:read:${scope}`];
  if (path === '/contracts/new') return [`contract:create:${scope}`];
  if (path === '/statutory-review') return [`contract:approve:${scope}`];
  if (path === '/contracts' || path.startsWith('/contracts/')) return [`contract:read:${scope}`];
  if (path === '/linkage') return [`linkage:read:${scope}`];
  if (path === '/inputs') return [`input_voucher:read:${scope}`];
  if (path === '/finance') {
    return [`loan:read:${scope}`, `insurance:read:${scope}`, `settlement:read:${scope}`];
  }
  if (path === '/monitoring') return [`monitoring:read:${scope}`];
  if (path === '/grievances') return [`grievance:read:${scope}`];
  if (path === '/reports') return [`report:read:${scope}`];
  if (path === '/admin') return [`user:read:${scope}`];
  return [];
}

export default function App() {
  const { user, activeScope, setSession, setAuthChecked } = useAppStore();
  const location = useLocation();
  const routerNavigate = useNavigate();
  const currentPath = location.pathname;
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  const navigate = (path: string) => {
    routerNavigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      let restoredSession = false;
      try {
        const res = await api.auth.me();
        if (res.user) {
          restoredSession = true;
          setSession(res.user, res.permissions);
        }
      } catch (err) {
        console.error('Unable to restore the DCFMS session:', err);
        if (mounted) {
          setInitializationError(
            'We could not verify your session. Check your connection and sign in again.'
          );
        }
      } finally {
        if (mounted) {
          setAuthChecked(true);
          setIsInitializing(false);
          if (!restoredSession && location.pathname !== '/login' && location.pathname !== '/') {
            routerNavigate('/login', { replace: true });
          }
        }
      }
    };
    void checkAuth();
    return () => {
      mounted = false;
    };
  }, [setSession, setAuthChecked, location.pathname, routerNavigate]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <LoadingState message="Initializing Digital Contract Farming Management System..." />
      </div>
    );
  }

  if (currentPath === '/') {
    if (user) {
      return <Navigate to="/dashboard" replace />;
    }

    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-stone-100"><LoadingState message="Loading DCFMS landing page..." /></div>}>
        <LandingPage onLoginNavigate={() => routerNavigate('/login')} />
      </Suspense>
    );
  }

  if (!user) {
    if (currentPath === '/login') {
      return (
        <LoginPage
          onSuccess={() => {
            setInitializationError(null);
            navigate('/dashboard');
          }}
          initialError={initializationError}
        />
      );
    }

    return <Navigate to="/" replace />;
  }

  if (currentPath === '/login') {
    return <Navigate to="/dashboard" replace />;
  }

  const renderContent = () => {
    if (currentPath === '/dashboard') {
      return <DashboardRouterPage onNavigate={navigate} />;
    }

    if (currentPath === '/statutory-review') {
      return <StatutoryReviewPage onNavigate={navigate} />;
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

    if (currentPath === '/login') {
      return <Navigate to="/dashboard" replace />;
    }

    return <NotFoundState />;
  };

  const requiredPermissions = getRoutePermissions(currentPath, activeScope?.scopeType);

  return (
    <AppShell currentPath={currentPath} onNavigate={navigate}>
      <ProtectedRoute requiredAnyPermissions={requiredPermissions}>
        {renderContent()}
      </ProtectedRoute>
    </AppShell>
  );
}
