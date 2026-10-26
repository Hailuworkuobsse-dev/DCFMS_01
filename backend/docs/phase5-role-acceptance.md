# Phase 5 — Role-by-role contract acceptance testing

## Scope and test status

This phase covers create, read, edit, sign, approve, reject, export, amend, and close against each applicable role and scope. Acceptance is **not complete** until the matrix below is executed against a seeded test database and API server. The automated test added in this phase checks route-level least-privilege metadata; it does not replace end-to-end HTTP tests.

## Inventory discrepancy that blocks a truthful 19-persona pass

The frontend `ROLE_REGISTRY` currently has 18 canonical roles:
`ATISuperAdmin`, `SystemAdmin`, `MoAFederal`, `RBoARegional`, `WBoAWoreda`, `KebeleOfficer`, `MoTRIOfficer`, `ECCOfficer`, `EAAOfficer`, `JusticeOfficer`, `Contractor`, `ProducerIndividual`, `ProducerCooperative`, `FinancialInstitution`, `Insurer`, `AgroDealer`, `FieldAgent`, and `Auditor`.

The backend `Role` enum currently contains 16 *different identifiers*. The API therefore cannot truthfully run the requested 18 frontend personas end-to-end until an explicit, reviewed frontend-to-backend identity/role mapping is defined. Do not map unknown personas to a more privileged role as a workaround.

The controlled-commodity verification capability is represented in frontend permissions as `contract:verify` for the federal MoTRI persona, but the backend contract controller has no dedicated controlled-commodity verification endpoint or explicit verifier role guard yet. This is a blocker, not a passed test.

## Action-by-role matrix

Legend: **Route** = explicit controller role metadata; **Service** = service enforces ownership, party identity, integrity, and/or jurisdiction; **Gap** = endpoint or canonical role mapping is missing; **N/A** = action does not apply to that role. A green route-metadata test is not evidence that the full action succeeded.

| Backend role | Create | Read | Edit | Sign | Approve / reject | Export | Amend | Close |
|---|---|---|---|---|---|---|---|---|
| FARMER | N/A | Service | N/A | Service: contract party | N/A | Gap: no export endpoint | N/A | N/A |
| COOPERATIVE | N/A | Service | N/A | N/A until party model supports it | N/A | Gap | N/A | N/A |
| CONTRACTOR | Route + service | Service | Route + service | Service: creator + OTP | N/A | Gap | Route + service | Route + service |
| FI_OFFICER | N/A | Service/scope | N/A | N/A | N/A | Gap | N/A | N/A |
| AGRO_DEALER | N/A | Service/scope | N/A | N/A | N/A | Gap | N/A | N/A |
| FIELD_AGENT | N/A | Service/scope | N/A | N/A | N/A | Gap | N/A | N/A |
| WBOA_OFFICER | N/A | Scoped service | N/A | N/A | Route + scoped service | Gap | Review route + scope | N/A |
| RBOA_OFFICER | N/A | Scoped service | N/A | N/A | Route + scoped service | Gap | Review route + scope | N/A |
| MOA_OFFICER | N/A | Federal service | N/A | N/A | Route + federal scope | Gap | Review route + scope | N/A |
| MOTRI_OFFICER | N/A | Federal service | N/A | N/A | Route + service policy | Gap | Review route + service policy | N/A |
| ECC_OFFICER | N/A | Federal service | N/A | N/A | Route + service policy | Gap | Review route + service policy | N/A |
| EAA_OFFICER | N/A | Federal service | N/A | N/A | Route + service policy | Gap | Review route + service policy | N/A |
| RESOLUTION_OFFICER | N/A | Service/scope | N/A | N/A | N/A | Gap | N/A | N/A |
| AUDITOR | N/A | Service | N/A | N/A | N/A | Gap | N/A | N/A |
| SYSTEM_ADMIN | Template administration only | Service | Template administration only | N/A | Template approval only | Gap | N/A | N/A |
| SUPPORT_AGENT | N/A | Service/scope | N/A | N/A | N/A | Gap | N/A | N/A |

The table describes current route/service policy visible in the repository, not successful live test results. Exact permission decisions must be verified with HTTP requests using accounts seeded for each role and scope.

## Required test cases

For every canonical role, run the following where applicable:
1. **Positive authorization:** valid record in the user's own/organization/territorial scope.
2. **Negative authorization:** same request against another party's record.
3. **Scope boundary:** regional, zonal, woreda, kebele and federal boundary checks as appropriate.
4. **State transition:** action succeeds only from a valid lifecycle state.
5. **Integrity:** sign, approve, amend, execute and close are blocked after tampering.
6. **Audit evidence:** every accepted/rejected decision records actor, scope, timestamp, reason and resulting state.
7. **Data minimization:** unauthorized reads and exports disclose no contract or signature evidence.

## Known implementation gaps to close before sign-off

- No contract export endpoint exists in the current controller.
- Controlled-commodity verification has no dedicated backend endpoint/guard.
- Frontend's 18 role IDs do not match backend's 16 `Role` enum values; a least-privilege mapping and migration plan are required.
- Existing OTP signing supports contractor/farmer parties; cooperative signing is not enabled by the current party schema.
- Build, Prisma validation, unit tests and end-to-end tests must be run in CI before marking this phase accepted.
