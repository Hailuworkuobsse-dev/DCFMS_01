Based on the ToR, the DCFMS should support the following **system roles** under a Role-Based Access Control (RBAC) model. These are distinct from project governance roles such as ATI, the Steering Committee, or the Technical Committee.

| Role | Description / Key Responsibilities |
|---|---|
| **Producer / Farmer** | Registers profile and land parcels, views contracts, signs digitally, accesses inputs/finance/advisory, submits grievances, tracks payments. |
| **Cooperative / Union / FPC / ABC / Intermediary** | Aggregates farmers, manages member profiles, facilitates linkage and contract signing, supports input distribution, collection, and settlement. |
| **Contractor / Off-taker / Buyer / Agro-processor / Exporter** | Creates and manages contracts, submits approval requests, provides inputs/support, monitors production, confirms delivery, initiates settlement. |
| **Financial Institution (Bank / MFI / Insurer)** | Receives credit-assessment data, manages loan/voucher workflows, integrates insurance, processes deductions and settlements. |
| **Agro-dealer / Input Supplier** | Validates and redeems digital input vouchers, tracks input distribution to contracted farmers. |
| **Government Authority / Regulator** | MoA, RBoA, WBoA, MoTRI, ECC, EAA users at federal/regional/woreda levels: review and approve contracts, verify actors, monitor compliance, generate regulatory reports. |
| **Field Agent / Extension Agent (DA / Agronomist)** | Submits field monitoring reports, verifies production progress and compliance, supports farmer onboarding and advisory services. |
| **Witness / Signing Authority** | Participates in contract signing events as a witness or authorized representative, as required by the contract workflow. |
| **Grievance / Dispute Resolution Officer** | Receives, tracks, escalates, and resolves grievances through the Contractor → WBoA → Court workflow. |
| **System Administrator** | Manages users, roles, permissions, system configuration, audit logs, integrations, and platform operations. |
| **Support / Helpdesk / Call Center Agent** | Provides user support, troubleshoots issues, logs tickets, and supports onboarding and field operations. |
| **Auditor / Compliance Officer** | Views immutable audit trails, generates compliance and security reports, and supports investigations without altering records. |
| **Report Viewer / Decision Maker** | Access role-specific dashboards and reports on contract performance, farmer reach, financial access, and compliance. |

These roles should be configurable and scoped by administrative level—federal, regional, zonal, woreda, and kebele—where applicable.

## Frontend role catalogue and matrix mapping

The frontend's canonical permission-bearing role IDs are the keys in
[`ROLE_REGISTRY`](../src/lib/rbac/roles.ts). They are the stable IDs stored in
`AuthUser.primaryRole` and `ScopedRoleAssignment.roleId`. Display names and
organization/job titles must be resolved to one of these IDs; they must not be
used as authorization identifiers.

`resolveRoleId` handles documented, capability-compatible aliases. It does not
infer a role from an unknown label. Administrative scope is separate from role:
the supported scope values are `own`, `org`, `kebele`, `woreda`, `zonal`,
`region`, `federal`, and `all`. `own` and `org` are distinct non-hierarchical
scopes; territorial scopes follow the kebele → woreda → zonal → region → federal
hierarchy; `all` is the explicit cross-scope grant.

| Functional-matrix persona / alternate name | Canonical frontend role |
|---|---|
| Farmer, FarmerIndividual, FarmerOutgrower, Producer | `ProducerIndividual` |
| Cooperative, PrimaryCooperative, CooperativeUnion, Union, FPC, ABC, Intermediary | `ProducerCooperative` |
| ContractorAgroProcessor, ContractorExporter, Off-taker, Buyer, Agro-processor, Exporter | `Contractor` |
| CommercialBank, Bank, MFI, FI | `FinancialInstitution` |
| InputSupplier | `AgroDealer` |
| MoA, RBoA, WBoA | `MoAFederal`, `RBoARegional`, `WBoAWoreda` |
| Kebele DA | `KebeleOfficer` |
| DA, ExtensionAgent, Agronomist | `FieldAgent` |
| MoTRFederal | `MoTRIOfficer` |
| RCoPARegional | `ECCOfficer` |
| CourtJudge | `JusticeOfficer` |
| ComplianceOfficer | `Auditor` |

These are compatibility aliases, not additional permission sets. A scoped
assignment must still carry the correct administrative or organization scope.
The following identities intentionally do **not** silently inherit a nearby
role's grants: `DataClerk`, `ZBoAZonal`, `Ombudsman`, and `Support/Helpdesk`.
They need explicit least-privilege profiles before they can be provisioned as
independent roles. A contract witness/signing authority is a workflow
assignment, not a standalone account role. A report viewer is a scoped report
capability on an existing role, not an elevated global persona.

### Functional workflow access map

[`workflowAccess.ts`](../src/lib/rbac/workflowAccess.ts) is the typed,
machine-readable mapping from every functional-matrix row (A1–G3) to the
canonical role IDs, scope, and minimum permission strings needed for that
workflow. The rows are keyed by the matrix's stable IDs so coverage can be
tested and reviewed without depending on page names.

This map records target policy requirements; it does not grant permissions or
replace server-side authorization. Existing role grants remain in
`ROLE_REGISTRY`; runtime UI, route, and API checks use the authenticated user's
active assignment and effective grants as described below.

## Runtime authorization

The client restores sessions only through `/api/auth/me`; it never auto-signs
in. Role and scope changes are limited to assignments returned for the
authenticated user and are confirmed by `/api/auth/switch-scope`. Direct page
navigation checks the active scope's permissions, and API handlers independently
check permissions and filter records to the active role and scope.

Seeded accounts and their preset credentials are development-only. The
development server explicitly runs with `NODE_ENV=development`; production
login fails closed until a real identity provider is configured. A missing or
invalid active scope receives no effective permissions.

## Operational workflow transitions

The finance screens use server-validated transitions rather than client-only
status changes. Producers and cooperatives can submit a contract-linked loan
application; only the financial institution assigned to that loan can approve
or reject it with a recorded rationale, and only an approved loan can be
disbursed. Duplicate active applications for the same applicant and contract,
requests above contract value, and unrecognized institutions are rejected.

Contractors can record a delivery against an approved or active contract.
Settlement value is computed from the contract price and delivered quantity,
outstanding disbursed-loan principal is deducted, and delivery references are
unique. The linked financial institution then releases and reconciles the
payout through separate state transitions.

Grievance intake binds the complainant to the authenticated identity and the
selected in-scope contract. Escalation proceeds one tier at a time and requires
the corresponding woreda, regional, or justice role plus a reason. Closure
requires a resolution summary. Loan decisions, settlement changes, and
grievance transitions are audit-logged.

## Cross-cutting field support

The Amharic and English catalogs are checked for matching keys in the test
suite. Changing language also updates the document language for assistive
technology, and the field inspection form exposes its controls with associated
labels and status/error announcements.

Field inspections can be captured in IndexedDB while offline. Each queued
submission is bound to the authenticated user and active scope at capture time;
sync only attempts it when that same user and scope are active. Server
authorization and validation still run when it reconnects. Failed syncs remain
queued and are announced to the user; queue storage failures are surfaced
instead of presenting a false success. Contract references needed to prepare
inspections are also cached per user and active scope; if none are available,
the form explains that an online connection is needed before offline capture.

The current demo server stores operational data in memory and does not provide
durable backups or disaster recovery. G4 backup/restore drills and RPO/RTO
targets require deployment infrastructure and are not represented as completed
by this frontend phase.