import { describe, expect, it } from '@jest/globals';
import 'reflect-metadata';
import { ContractsController } from './contracts.controller';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';

/**
 * These tests are deliberately focused on server-side route policy. Service-level
 * authorization and scope checks remain covered by contracts.service.spec.ts.
 * They also make the registered backend role inventory explicit so frontend /
 * backend role drift is visible instead of silently granting a nearby role.
 */
describe('Phase 5 contract role acceptance — route policy', () => {
  const roleValues = Object.values(Role);

  it('keeps the backend role inventory unique and non-empty', () => {
    expect(roleValues.length).toBeGreaterThan(0);
    expect(new Set(roleValues).size).toBe(roleValues.length);
  });

  it.each([
    ['create', [Role.CONTRACTOR]],
    ['saveDraft', [Role.CONTRACTOR]],
    ['sendForSignature', [Role.CONTRACTOR]],
    ['submitForApproval', [Role.CONTRACTOR]],
    ['approve', [Role.MOA_OFFICER, Role.RBOA_OFFICER, Role.WBOA_OFFICER, Role.MOTRI_OFFICER, Role.ECC_OFFICER, Role.EAA_OFFICER]],
    ['proposeAmendment', [Role.CONTRACTOR]],
    ['submitAmendment', [Role.CONTRACTOR]],
    ['reviewAmendment', [Role.MOA_OFFICER, Role.RBOA_OFFICER, Role.WBOA_OFFICER, Role.MOTRI_OFFICER, Role.ECC_OFFICER, Role.EAA_OFFICER]],
    ['closeContract', [Role.CONTRACTOR]],
  ])('declares least-privilege route roles for %s', (methodName: string, expectedRoles: Role[]) => {
    const handler = (ContractsController.prototype as any)[methodName];
    expect(handler).toBeDefined();
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(expectedRoles);
  });

  it('does not permit role metadata to be inferred from UI-only roles', () => {
    // The backend currently defines 16 Role enum values; the frontend registry
    // defines 18 different identifiers. This test records the actual API contract.
    expect(roleValues).toContain('CONTRACTOR');
    expect(roleValues).toContain('MOA_OFFICER');
    expect(roleValues).not.toContain('ATISuperAdmin');
    expect(roleValues).not.toContain('KebeleOfficer');
  });
});
