import type {
  AuthUser,
  PermissionAction,
  PermissionResource,
  PermissionScope,
  PermissionString,
  RoleId,
} from '../../types/api';

const ADMIN_SCOPE_HIERARCHY: Partial<Record<PermissionScope, number>> = {
  kebele: 1,
  woreda: 2,
  zonal: 3,
  region: 4,
  federal: 5,
};

export interface ParsedPermission {
  resource: PermissionResource;
  action: PermissionAction;
  scope: PermissionScope;
}

export function parsePermission(perm: PermissionString): ParsedPermission {
  const [resource, action, scope] = perm.split(':') as [
    PermissionResource,
    PermissionAction,
    PermissionScope,
  ];
  return { resource, action, scope };
}

export function permissionSatisfies(
  granted: PermissionString,
  required: PermissionString
): boolean {
  const g = parsePermission(granted);
  const r = parsePermission(required);

  if (g.resource !== r.resource) return false;
  if (g.action !== r.action) return false;

  if (g.scope === 'all') return true;
  if (g.scope === 'own' || g.scope === 'org' || r.scope === 'own' || r.scope === 'org' || r.scope === 'all') {
    return g.scope === r.scope;
  }

  return (ADMIN_SCOPE_HIERARCHY[g.scope] ?? 0) >= (ADMIN_SCOPE_HIERARCHY[r.scope] ?? 0);
}

export function hasResourceAction(
  permissions: PermissionString[],
  resource: PermissionResource,
  action: PermissionAction,
  scope: PermissionScope = 'own'
): boolean {
  const target: PermissionString = `${resource}:${action}:${scope}`;
  return permissions.some((granted) => permissionSatisfies(granted, target));
}

export function checkPermissionList(
  userPermissions: PermissionString[],
  requiredPermissions: PermissionString[]
): boolean {
  if (requiredPermissions.length === 0) return true;
  return requiredPermissions.every((req) =>
    userPermissions.some((granted) => permissionSatisfies(granted, req))
  );
}

export function hasAnyRole(user: AuthUser | null, roles: RoleId[]): boolean {
  if (!user) return false;
  const activeRole = getActiveRole(user);
  return activeRole !== null && roles.includes(activeRole);
}

export function getActiveRole(user: AuthUser | null): RoleId | null {
  if (!user) return null;
  const scoped = user.scopedRoles.find((s) => s.id === user.activeScopeId);
  return scoped?.roleId ?? null;
}
