import type {
  AuthUser,
  PermissionAction,
  PermissionResource,
  PermissionScope,
  PermissionString,
  RoleId,
} from '../../types/api';

const SCOPE_HIERARCHY: Record<PermissionScope, number> = {
  own: 1,
  org: 2,
  woreda: 3,
  region: 4,
  federal: 5,
  all: 6,
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

  const grantedLevel = SCOPE_HIERARCHY[g.scope] ?? 0;
  const requiredLevel = SCOPE_HIERARCHY[r.scope] ?? 0;

  return grantedLevel >= requiredLevel;
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
  return roles.includes(activeRole);
}

export function getActiveRole(user: AuthUser | null): RoleId {
  if (!user) return 'ProducerIndividual';
  const scoped = user.scopedRoles.find((s) => s.id === user.activeScopeId);
  return scoped ? scoped.roleId : user.primaryRole;
}
