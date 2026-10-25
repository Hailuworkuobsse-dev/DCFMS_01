import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePermission,
  permissionSatisfies,
  hasAnyRole,
  getActiveRole,
} from './permissions';
import { ROLE_REGISTRY } from './roles';
import type { AuthUser, RoleId } from '../../types/api';

test('ROLE_REGISTRY defines all 18 required roles with non-empty permissions', () => {
  const expectedRoles: RoleId[] = [
    'ATISuperAdmin',
    'SystemAdmin',
    'MoAFederal',
    'RBoARegional',
    'WBoAWoreda',
    'KebeleOfficer',
    'MoTRIOfficer',
    'ECCOfficer',
    'EAAOfficer',
    'JusticeOfficer',
    'Contractor',
    'ProducerIndividual',
    'ProducerCooperative',
    'FinancialInstitution',
    'Insurer',
    'AgroDealer',
    'FieldAgent',
    'Auditor',
  ];

  for (const roleId of expectedRoles) {
    const roleDef = ROLE_REGISTRY[roleId];
    assert.ok(roleDef, `Role ${roleId} must exist in ROLE_REGISTRY`);
    assert.ok(roleDef.permissions.length > 0, `Role ${roleId} must have at least one permission`);
    assert.equal(roleDef.id, roleId);
  }
});

test('parsePermission splits resource:action:scope accurately', () => {
  const parsed = parsePermission('contract:approve:woreda');
  assert.equal(parsed.resource, 'contract');
  assert.equal(parsed.action, 'approve');
  assert.equal(parsed.scope, 'woreda');
});

test('permissionSatisfies enforces scope hierarchy strictly', () => {
  assert.equal(permissionSatisfies('contract:read:all', 'contract:read:woreda'), true);
  assert.equal(permissionSatisfies('contract:read:region', 'contract:read:woreda'), true);
  assert.equal(permissionSatisfies('contract:read:own', 'contract:read:woreda'), false);
  assert.equal(permissionSatisfies('contract:read:all', 'contract:approve:all'), false);
  assert.equal(permissionSatisfies('contract:read:all', 'user:read:all'), false);
});

test('Contractor vs ProducerIndividual vs Auditor permission isolation', () => {
  const contractorPerms = ROLE_REGISTRY.Contractor.permissions;
  const farmerPerms = ROLE_REGISTRY.ProducerIndividual.permissions;
  const auditorPerms = ROLE_REGISTRY.Auditor.permissions;

  assert.ok(contractorPerms.includes('contract:create:org'));
  assert.ok(!farmerPerms.includes('contract:create:org'));
  assert.ok(!auditorPerms.includes('contract:create:all'));
  assert.ok(auditorPerms.includes('audit_log:read:all'));
  assert.ok(!farmerPerms.includes('audit_log:read:all'));
});

test('hasAnyRole and getActiveRole respect scoped role switching', () => {
  const mockUser: AuthUser = {
    id: 'usr-1',
    email: 'officer@wboa.gov.et',
    fullName: 'Bekele Desta',
    fullNameAm: 'በቀለ ደስታ',
    primaryRole: 'WBoAWoreda',
    activeScopeId: 'scope-2',
    scopedRoles: [
      { id: 'scope-1', roleId: 'WBoAWoreda', scopeType: 'woreda', scopeLabel: "Ada'a Woreda" },
      { id: 'scope-2', roleId: 'RBoARegional', scopeType: 'region', scopeLabel: 'Oromia Regional Desk' },
    ],
  };

  assert.equal(getActiveRole(mockUser), 'RBoARegional');
  assert.equal(hasAnyRole(mockUser, ['RBoARegional']), true);
  assert.equal(hasAnyRole(mockUser, ['ATISuperAdmin']), false);
});
