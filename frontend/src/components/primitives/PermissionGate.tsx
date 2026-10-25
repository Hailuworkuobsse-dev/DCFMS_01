import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import {
  hasResourceAction,
  hasAnyRole,
  checkPermissionList,
} from '../../lib/rbac/permissions';
import { ForbiddenState, LoadingState } from './States';
import type { PermissionAction, PermissionResource, PermissionScope, PermissionString, RoleId } from '../../types/api';

interface CanProps {
  permission?: PermissionString;
  resource?: PermissionResource;
  action?: PermissionAction;
  scope?: PermissionScope;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({
  permission,
  resource,
  action,
  scope = 'own',
  children,
  fallback = null,
}) => {
  const { permissions } = useAppStore();

  let allowed = false;
  if (permission) {
    allowed = checkPermissionList(permissions, [permission]);
  } else if (resource && action) {
    allowed = hasResourceAction(permissions, resource, action, scope);
  }

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

interface RoleGateProps {
  roles: RoleId[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RoleGate: React.FC<RoleGateProps> = ({ roles, children, fallback = null }) => {
  const { user } = useAppStore();
  const allowed = hasAnyRole(user, roles);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: RoleId[];
  anyResources?: PermissionResource[];
  action?: PermissionAction;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  roles,
  anyResources,
  action = 'read',
}) => {
  const { user, permissions, authChecked } = useAppStore();
  const location = useLocation();

  if (!authChecked) {
    return <LoadingState message="Checking security credentials..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0) {
    if (!hasAnyRole(user, roles)) {
      return <ForbiddenState />;
    }
  }

  if (anyResources && anyResources.length > 0) {
    const hasAny = anyResources.some((res) => hasResourceAction(permissions, res, action));
    if (!hasAny) {
      return <ForbiddenState />;
    }
  }

  return <>{children}</>;
};
