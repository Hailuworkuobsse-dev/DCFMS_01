import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePermission,
  permissionSatisfies,
  hasAnyRole,
  getActiveRole,
} from './permissions';
import { ROLE_REGISTRY, resolveRoleId } from './roles';
import { FUNCTIONAL_WORKFLOW_ACCESS } from './workflowAccess';
import type { AuthUser, PermissionScope, RoleId } from '../../types/api';

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
  assert.equal(permissionSatisfies('contract:read:woreda', 'contract:read:kebele'), true);
  assert.equal(permissionSatisfies('contract:read:region', 'contract:read:zonal'), true);
  assert.equal(permissionSatisfies('contract:read:own', 'contract:read:woreda'), false);
  assert.equal(permissionSatisfies('contract:read:org', 'contract:read:woreda'), false);
  assert.equal(permissionSatisfies('contract:read:woreda', 'contract:read:org'), false);
  assert.equal(permissionSatisfies('contract:read:all', 'contract:approve:all'), false);
  assert.equal(permissionSatisfies('contract:read:all', 'user:read:all'), false);
});

test('role aliases resolve only to registered canonical role IDs', () => {
  assert.equal(resolveRoleId('Farmer'), 'ProducerIndividual');
  assert.equal(resolveRoleId('Primary Cooperative'), 'ProducerCooperative');
  assert.equal(resolveRoleId('ContractorExporter'), 'Contractor');
  assert.equal(resolveRoleId('Commercial Bank'), 'FinancialInstitution');
  assert.equal(resolveRoleId('Kebele DA'), 'KebeleOfficer');
  assert.equal(resolveRoleId('MoTR Federal'), 'MoTRIOfficer');
  assert.equal(resolveRoleId('RCoPA Regional'), 'ECCOfficer');
  assert.equal(resolveRoleId('MoA'), 'MoAFederal');
  assert.equal(resolveRoleId('unmapped role'), null);
  assert.equal(ROLE_REGISTRY.KebeleOfficer.defaultScope, 'kebele');
});

test('finance workflow permissions match the operational actors', () => {
  assert.ok(ROLE_REGISTRY.ProducerIndividual.permissions.includes('loan:create:own'));
  assert.ok(ROLE_REGISTRY.ProducerCooperative.permissions.includes('loan:create:org'));
  assert.ok(ROLE_REGISTRY.FinancialInstitution.permissions.includes('loan:approve:org'));
  assert.ok(ROLE_REGISTRY.FinancialInstitution.permissions.includes('settlement:update:org'));
  assert.ok(ROLE_REGISTRY.Contractor.permissions.includes('settlement:create:org'));
});

test('every functional matrix workflow maps valid role, permission, and scope entries', () => {
  const expectedWorkflowIds = [
    'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
    'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7',
    'C1', 'C2', 'C3', 'C4', 'C5', 'C6',
    'D1', 'D2', 'D3', 'D4', 'D5',
    'E1', 'E2', 'E3', 'E4',
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
    'G1', 'G2', 'G3',
  ];
  const validScopes: PermissionScope[] = [
    'own', 'org', 'kebele', 'woreda', 'zonal', 'region', 'federal', 'all',
  ];
  const actualWorkflowIds = Object.keys(FUNCTIONAL_WORKFLOW_ACCESS).sort();

  assert.deepEqual(actualWorkflowIds, expectedWorkflowIds.sort());
  for (const [workflowId, definition] of Object.entries(FUNCTIONAL_WORKFLOW_ACCESS)) {
    assert.equal(definition.workflowId, workflowId);
    assert.ok(definition.actors.length > 0, `${workflowId} must identify at least one role`);

    for (const actor of definition.actors) {
      assert.ok(ROLE_REGISTRY[actor.roleId], `${workflowId} references unknown role ${actor.roleId}`);
      assert.ok(validScopes.includes(actor.scope), `${workflowId} uses invalid scope ${actor.scope}`);
      assert.ok(actor.permissions.length > 0, `${workflowId}/${actor.roleId} must declare permissions`);
      for (const permission of actor.permissions) {
        assert.equal(parsePermission(permission).scope, actor.scope);
      }
    }
  }
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
  assert.equal(
    getActiveRole({ ...mockUser, activeScopeId: 'missing-scope' }),
    null
  );
  assert.equal(hasAnyRole({ ...mockUser, activeScopeId: 'missing-scope' }, ['WBoAWoreda']), false);
});
