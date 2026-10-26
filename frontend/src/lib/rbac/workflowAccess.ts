import type { PermissionScope, PermissionString, RoleId } from '../../types/api';

export type FunctionalWorkflowId =
  | `A${1 | 2 | 3 | 4 | 5 | 6}`
  | `B${1 | 2 | 3 | 4 | 5 | 6 | 7}`
  | `C${1 | 2 | 3 | 4 | 5 | 6}`
  | `D${1 | 2 | 3 | 4 | 5}`
  | `E${1 | 2 | 3 | 4}`
  | `F${1 | 2 | 3 | 4 | 5 | 6}`
  | `G${1 | 2 | 3}`;

export interface WorkflowActorAccess {
  roleId: RoleId;
  scope: PermissionScope;
  permissions: PermissionString[];
}

export interface WorkflowAccessDefinition {
  workflowId: FunctionalWorkflowId;
  actors: WorkflowActorAccess[];
}

const actor = (
  roleId: RoleId,
  scope: PermissionScope,
  ...permissions: PermissionString[]
): WorkflowActorAccess => ({ roleId, scope, permissions });

export const FUNCTIONAL_WORKFLOW_ACCESS: Record<
  FunctionalWorkflowId,
  WorkflowAccessDefinition
> = {
  A1: {
    workflowId: 'A1',
    actors: [
      actor('ProducerIndividual', 'own', 'farmer:create:own', 'farmer:update:own'),
      actor('ProducerCooperative', 'org', 'farmer:create:org', 'farmer:update:org'),
      actor('FieldAgent', 'woreda', 'farmer:create:woreda', 'farmer:update:woreda'),
      actor('KebeleOfficer', 'kebele', 'farmer:verify:kebele'),
    ],
  },
  A2: {
    workflowId: 'A2',
    actors: [
      actor('ProducerIndividual', 'own', 'parcel:create:own', 'parcel:read:own'),
      actor('WBoAWoreda', 'woreda', 'parcel:read:woreda', 'parcel:approve:woreda'),
      actor('SystemAdmin', 'all', 'parcel:read:all'),
    ],
  },
  A3: {
    workflowId: 'A3',
    actors: [
      actor('ProducerCooperative', 'org', 'cooperative:create:org', 'cooperative:update:org'),
      actor('EAAOfficer', 'federal', 'cooperative:read:federal', 'cooperative:verify:federal'),
      actor('FieldAgent', 'woreda', 'cooperative:create:woreda', 'cooperative:read:woreda'),
    ],
  },
  A4: {
    workflowId: 'A4',
    actors: [
      actor('Contractor', 'org', 'contractor:create:org', 'contractor:update:org'),
      actor('EAAOfficer', 'federal', 'contractor:approve:federal', 'contractor:verify:federal'),
      actor('MoAFederal', 'federal', 'contractor:approve:federal'),
      actor('RBoARegional', 'region', 'contractor:approve:region'),
      actor('WBoAWoreda', 'woreda', 'contractor:approve:woreda'),
    ],
  },
  A5: {
    workflowId: 'A5',
    actors: [
      actor('FinancialInstitution', 'org', 'provider:create:org', 'provider:update:org'),
      actor('Insurer', 'org', 'provider:create:org', 'provider:update:org'),
      actor('AgroDealer', 'org', 'provider:create:org', 'provider:update:org'),
      actor('ATISuperAdmin', 'all', 'provider:approve:all'),
    ],
  },
  A6: {
    workflowId: 'A6',
    actors: [actor('SystemAdmin', 'all', 'user:create:all', 'user:update:all', 'user:assign:all')],
  },
  B1: {
    workflowId: 'B1',
    actors: [
      actor('Contractor', 'org', 'contract:create:org', 'document:create:org'),
      actor('ProducerCooperative', 'org', 'contract:read:org'),
      actor('ProducerIndividual', 'own', 'contract:read:own', 'contract:sign:own'),
    ],
  },
  B2: {
    workflowId: 'B2',
    actors: [
      actor('Contractor', 'org', 'contract:read:org'),
      actor('ProducerCooperative', 'org', 'contract:read:org'),
      actor('ProducerIndividual', 'own', 'contract:read:own', 'contract:sign:own'),
      actor('WBoAWoreda', 'woreda', 'contract:read:woreda'),
    ],
  },
  B3: {
    workflowId: 'B3',
    actors: [
      actor('Contractor', 'org', 'contract:sign:org', 'signature:create:org'),
      actor('ProducerIndividual', 'own', 'contract:sign:own', 'signature:create:own'),
      actor('KebeleOfficer', 'kebele', 'contract:verify:kebele'),
    ],
  },
  B4: {
    workflowId: 'B4',
    actors: [
      actor('MoAFederal', 'federal', 'contract:approve:federal', 'contract:reject:federal'),
      actor('RBoARegional', 'region', 'contract:approve:region', 'contract:reject:region'),
      actor('WBoAWoreda', 'woreda', 'contract:approve:woreda', 'contract:reject:woreda'),
    ],
  },
  B5: {
    workflowId: 'B5',
    actors: [
      actor('ProducerIndividual', 'own', 'contract:read:own'),
      actor('ProducerCooperative', 'org', 'contract:read:org'),
      actor('Contractor', 'org', 'contract:read:org'),
      actor('WBoAWoreda', 'woreda', 'contract:read:woreda'),
    ],
  },
  B6: {
    workflowId: 'B6',
    actors: [
      actor('ProducerIndividual', 'own', 'document:read:own'),
      actor('ProducerCooperative', 'org', 'document:read:org'),
      actor('Contractor', 'org', 'document:read:org'),
      actor('Auditor', 'all', 'document:read:all', 'audit_log:read:all'),
    ],
  },
  B7: {
    workflowId: 'B7',
    actors: [
      actor('Contractor', 'org', 'contract:read:org'),
      actor('ProducerCooperative', 'org', 'contract:read:org'),
      actor('ProducerIndividual', 'own', 'contract:read:own'),
      actor('WBoAWoreda', 'woreda', 'contract:approve:woreda'),
    ],
  },
  C1: {
    workflowId: 'C1',
    actors: [
      actor('ProducerIndividual', 'own', 'farmer:read:own', 'loan:create:own'),
      actor('ProducerCooperative', 'org', 'farmer:read:org', 'loan:create:org'),
      actor('FinancialInstitution', 'org', 'loan:read:org'),
      actor('SystemAdmin', 'all', 'integration:read:all'),
    ],
  },
  C2: {
    workflowId: 'C2',
    actors: [
      actor('ProducerIndividual', 'own', 'loan:create:own', 'loan:read:own'),
      actor('ProducerCooperative', 'org', 'loan:create:org', 'loan:read:org'),
      actor('FinancialInstitution', 'org', 'loan:read:org', 'loan:approve:org', 'loan:update:org'),
    ],
  },
  C3: {
    workflowId: 'C3',
    actors: [
      actor('Contractor', 'org', 'contract:read:org', 'loan:create:org'),
      actor('ProducerIndividual', 'own', 'contract:read:own', 'loan:approve:own'),
      actor('FinancialInstitution', 'org', 'loan:create:org', 'loan:approve:org'),
    ],
  },
  C4: {
    workflowId: 'C4',
    actors: [
      actor('Contractor', 'org', 'input_voucher:create:org'),
      actor('FinancialInstitution', 'org', 'input_voucher:create:org'),
      actor('ProducerIndividual', 'own', 'input_voucher:read:own'),
      actor('AgroDealer', 'org', 'input_voucher:read:org', 'input_voucher:verify:org'),
    ],
  },
  C5: {
    workflowId: 'C5',
    actors: [
      actor('Insurer', 'org', 'insurance:create:org', 'insurance:approve:org'),
      actor('Contractor', 'org', 'insurance:create:org'),
      actor('ProducerIndividual', 'own', 'insurance:read:own'),
      actor('FinancialInstitution', 'org', 'insurance:read:org'),
    ],
  },
  C6: {
    workflowId: 'C6',
    actors: [
      actor('Contractor', 'org', 'settlement:create:org', 'settlement:read:org'),
      actor('FinancialInstitution', 'org', 'settlement:update:org', 'settlement:read:org'),
      actor('ProducerIndividual', 'own', 'settlement:read:own'),
      actor('ProducerCooperative', 'org', 'settlement:read:org'),
    ],
  },
  D1: {
    workflowId: 'D1',
    actors: [
      actor('Contractor', 'org', 'input_voucher:create:org', 'input_voucher:read:org'),
      actor('AgroDealer', 'org', 'input_voucher:verify:org'),
      actor('WBoAWoreda', 'woreda', 'input_voucher:read:woreda'),
      actor('FieldAgent', 'woreda', 'input_voucher:read:woreda', 'input_voucher:verify:woreda'),
    ],
  },
  D2: {
    workflowId: 'D2',
    actors: [
      actor('FieldAgent', 'woreda', 'monitoring:create:woreda', 'monitoring:read:woreda'),
      actor('Contractor', 'org', 'monitoring:create:org', 'monitoring:read:org'),
      actor('WBoAWoreda', 'woreda', 'monitoring:read:woreda'),
    ],
  },
  D3: {
    workflowId: 'D3',
    actors: [
      actor('ProducerIndividual', 'own', 'advisory:read:own'),
      actor('FieldAgent', 'woreda', 'advisory:create:woreda', 'advisory:read:woreda'),
      actor('SystemAdmin', 'all', 'advisory:create:all'),
    ],
  },
  D4: {
    workflowId: 'D4',
    actors: [
      actor('ProducerIndividual', 'own', 'price:read:own'),
      actor('Contractor', 'org', 'price:read:org'),
      actor('MoTRIOfficer', 'federal', 'price:read:federal', 'price:update:federal'),
    ],
  },
  D5: {
    workflowId: 'D5',
    actors: [
      actor('MoAFederal', 'federal', 'monitoring:read:federal', 'report:read:federal'),
      actor('RBoARegional', 'region', 'monitoring:read:region', 'report:read:region'),
      actor('WBoAWoreda', 'woreda', 'monitoring:read:woreda', 'report:read:woreda'),
      actor('MoTRIOfficer', 'federal', 'monitoring:read:federal', 'report:read:federal'),
      actor('ECCOfficer', 'federal', 'monitoring:read:federal', 'report:read:federal'),
    ],
  },
  E1: {
    workflowId: 'E1',
    actors: [
      actor('ProducerIndividual', 'own', 'grievance:create:own'),
      actor('ProducerCooperative', 'org', 'grievance:create:org'),
      actor('Contractor', 'org', 'grievance:create:org'),
    ],
  },
  E2: {
    workflowId: 'E2',
    actors: [
      actor('WBoAWoreda', 'woreda', 'grievance:update:woreda', 'grievance:assign:woreda'),
      actor('JusticeOfficer', 'federal', 'grievance:update:federal', 'grievance:assign:federal'),
    ],
  },
  E3: {
    workflowId: 'E3',
    actors: [
      actor('WBoAWoreda', 'woreda', 'grievance:escalate:woreda'),
      actor('JusticeOfficer', 'federal', 'grievance:escalate:federal'),
    ],
  },
  E4: {
    workflowId: 'E4',
    actors: [
      actor('JusticeOfficer', 'federal', 'grievance:update:federal'),
      actor('WBoAWoreda', 'woreda', 'grievance:update:woreda'),
      actor('ProducerIndividual', 'own', 'grievance:read:own'),
    ],
  },
  F1: {
    workflowId: 'F1',
    actors: [
      actor('MoAFederal', 'federal', 'dashboard:read:federal'),
      actor('RBoARegional', 'region', 'dashboard:read:region'),
      actor('WBoAWoreda', 'woreda', 'dashboard:read:woreda'),
      actor('ATISuperAdmin', 'all', 'dashboard:read:all'),
      actor('Contractor', 'org', 'dashboard:read:org'),
      actor('FinancialInstitution', 'org', 'dashboard:read:org'),
    ],
  },
  F2: {
    workflowId: 'F2',
    actors: [
      actor('MoAFederal', 'federal', 'report:read:federal', 'report:export:federal'),
      actor('RBoARegional', 'region', 'report:read:region', 'report:export:region'),
      actor('Contractor', 'org', 'report:read:org', 'report:export:org'),
      actor('Auditor', 'all', 'report:read:all', 'report:export:all'),
    ],
  },
  F3: {
    workflowId: 'F3',
    actors: [
      actor('MoAFederal', 'federal', 'report:read:federal'),
      actor('RBoARegional', 'region', 'report:read:region'),
      actor('ATISuperAdmin', 'all', 'report:read:all'),
      actor('Auditor', 'all', 'report:read:all'),
    ],
  },
  F4: {
    workflowId: 'F4',
    actors: [
      actor('FinancialInstitution', 'org', 'report:read:org', 'report:export:org'),
      actor('ATISuperAdmin', 'all', 'report:read:all', 'report:export:all'),
    ],
  },
  F5: {
    workflowId: 'F5',
    actors: [
      actor('Auditor', 'all', 'audit_log:read:all', 'audit_log:export:all'),
      actor('SystemAdmin', 'all', 'audit_log:read:all'),
      actor('ATISuperAdmin', 'all', 'audit_log:read:all', 'audit_log:export:all'),
    ],
  },
  F6: {
    workflowId: 'F6',
    actors: [
      actor('Auditor', 'all', 'report:read:all', 'report:export:all'),
      actor('ATISuperAdmin', 'all', 'report:read:all', 'report:export:all'),
      actor('MoAFederal', 'federal', 'report:read:federal', 'report:export:federal'),
    ],
  },
  G1: {
    workflowId: 'G1',
    actors: [
      actor('Auditor', 'all', 'audit_log:read:all', 'audit_log:export:all'),
      actor('SystemAdmin', 'all', 'audit_log:read:all'),
    ],
  },
  G2: {
    workflowId: 'G2',
    actors: [
      actor('SystemAdmin', 'all', 'integration:read:all', 'integration:update:all'),
      actor('ATISuperAdmin', 'all', 'integration:read:all', 'integration:update:all'),
    ],
  },
  G3: {
    workflowId: 'G3',
    actors: [
      actor('SystemAdmin', 'all', 'system_config:read:all', 'system_config:update:all'),
      actor('MoAFederal', 'federal', 'system_config:read:federal', 'system_config:update:federal'),
    ],
  },
};
