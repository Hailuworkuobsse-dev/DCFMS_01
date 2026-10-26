# Contract drafting and negotiation (B1–B2)

## Data migration
Run the backend Prisma migration and regenerate the client before starting the API:

```bash
npx prisma migrate deploy
npx prisma generate
```

The migration creates contract template, comment, annex, and change-acceptance tables and seeds one approved English-language standard template. The seeded legal clauses are a starter template and must be reviewed by authorized Ethiopian legal counsel before production use. The repository did not contain a prior baseline migration when this work was inspected, so this additive migration assumes the existing DCFMS schema (including `Contract`, `Farmer`, `Parcel`, and `User`) has already been initialized. A clean database needs a baseline migration for the complete schema before `migrate deploy` can work from empty.

## Endpoints

- `GET /contracts/templates?commodity=Wheat` — approved templates.
- `POST /contracts/templates` — create a draft template (system administrator only).
- `PATCH /contracts/templates/:id/approve` — approve a template (system administrator only).
- `GET /contracts/party-lookup?q=ab` — verified producer lookup (approved contractor only; at least two characters).
- `PATCH /contracts/:id/draft` — save a new draft version with `expectedVersion`, structured `content`, and optional `changeSummary`.
- `GET /contracts/:id/versions` — ordered versions and hashes.
- `GET /contracts/:id/comments` and `POST /contracts/:id/comments` — clause-linked negotiation comments.
- `GET /contracts/:id/annexes` and `POST /contracts/:id/annexes` — annex metadata, structured notes, optional HTTPS link, and checksum.
- `GET /contracts/:id/change-acceptances` and `POST /contracts/:id/change-acceptances` — per-party acceptance or request for changes for a specific version.

## Workflow controls

- A new contract must reference an approved template.
- Required template clauses cannot be removed or left blank; locked clauses cannot be removed or edited; clause keys must be unique.
- Party lookup returns active registered farmers who have at least one unlocked parcel. Contract creation rechecks producer ownership, account status, geographic consistency, parcel ownership, and parcel availability.
- Contract creation and parcel locking happen in one database transaction.
- Draft edits are creator-only and use optimistic version checks. Each saved version receives a SHA-256 content hash.
- Comments, annex proposals, and version responses are restricted to contracting parties. A draft cannot be submitted for signature until every producer and the contractor have accepted the latest version.

## Current boundary
Annex binary uploads and object-storage integration are not implemented here. Annexes currently support structured notes and optional HTTPS links. Tests have been added but must be executed in CI/local development before merging.


## Phase 3 — signing and statutory approval

- Signing OTPs are sent through the configured `SMS_GATEWAY_URL` using a bearer token and JSON payload `{ to, sender, message }`. The endpoint must return a 2xx response. Production refuses to issue an OTP when gateway configuration or delivery is unavailable; development may expose a test OTP only outside production. OTP requests use a configurable resend cooldown and failed verification attempts are locked after the configured maximum.
- Signers must have an active account and registered phone. Farmer signers must be the registered farmer linked to a contract party. Contractor signers must be the creator of the contract and have an approved contractor registration with a licence number and TIN. OTP is required for every signature.
- Signing verifies the current contract content hash. Each signature creates a SHA-256 evidence record binding signer, role, contract content hash, timestamp, authority basis, IP address and user-agent. Evidence can be retrieved from `GET /contracts/:id/signature-evidence` by a contracting party or an authorized scoped officer/auditor.
- `GET /contracts/review-queue` returns contracts in `PENDING_APPROVAL` only. WBoA reviewers are restricted to their region and woreda; RBoA reviewers to their region; MoA reviewers use federal access. Review decisions are `APPROVE`, `REJECT`, or `RETURN_FOR_CORRECTION`. Reject/return requires a reason and every decision is recorded in `ContractReviewAction` and the audit log.
- A returned contract may be edited by its contractor creator. Edits create a new version and return the contract to `DRAFT`; all parties must accept the new latest version and re-sign before it can be resubmitted for statutory approval.

### Production integration gates

The code now has a configurable SMS HTTP adapter, but a real provider account, endpoint contract, credentials, sender registration, delivery receipts, rate limits and provider-specific request/response mapping must be configured and tested in the target environment. No SMS provider credentials are included in the repository. FaydaPass cryptographic verification remains disabled. Signature evidence is application-level tamper-evidence, not a qualified digital-signature certificate or legal opinion. Validate statutory routing and signature requirements with the relevant Ethiopian authorities before production use.


## Phase 4 — lifecycle, integrity, amendments and closure (B5–B7)

### Lifecycle and notifications
- `GET /contracts/:id/events` returns the contract's append-only lifecycle event ledger. State changes, signing, version responses, negotiation comments, annex additions, milestones, amendments and closure append SHA-256 chained event records.
- Contract parties receive in-app notifications for lifecycle events. `GET /contracts/notifications?unreadOnly=true` lists only the authenticated user's notifications; `PATCH /contracts/notifications/:notificationId/read` marks one as read.
- `PATCH /contracts/:id/start-execution` permits the contract creator to move a statutorily approved and integrity-verified contract into execution.
- `GET/POST /contracts/:id/milestones` and `PATCH /contracts/:id/milestones/:milestoneId` manage required execution milestones, due dates, status, completion identity and evidence.

### Integrity checks
- `GET /contracts/:id/integrity` recomputes the live contract content hash, every saved version hash and previous-version link, annex checksums, and the chained lifecycle event hashes.
- The Phase 4 migration adds `ContractVersion.previousHash` and backfills existing version links. Integrity checks block execution, amendment proposal and closure when checks fail.
- Event hashes are application-level tamper evidence. They are not a substitute for database permissions, immutable/WORM storage, external timestamping, backups or independent audit retention.

### Formal amendments and re-approval
- `GET/POST /contracts/:id/amendments` lists or proposes an amendment with a base version, structured proposed content and mandatory reason.
- `PATCH /contracts/:id/amendments/:amendmentId/submit` submits the amendment for statutory review.
- `PATCH /contracts/:id/amendments/:amendmentId/review` allows a scoped statutory reviewer to approve or reject it; rejection requires a reason.
- Approval applies a new version, clears the prior statutory approval, and returns the contract to `DRAFT`. Every party must accept the new version, all required signatories must sign again, and the contract must go through statutory approval again.

### Formal closure
- `POST /contracts/:id/closure` records a formal fulfilment closure, final content hash, notes and optional evidence; it requires execution status, a successful integrity check and every required milestone marked complete.
- Closure advances the contract to `COMPLETED` and releases its parcel locks. `GET /contracts/:id/closure` retrieves the closure record.

### Phase 4 deployment notes
- The migration is additive and depends on the existing DCFMS schema and Phase 2/3 migrations being initialized and applied in order. A clean database still requires a complete baseline migration.
- The frontend lifecycle panel is embedded in contract detail. Backend tests, Prisma schema validation/client generation, migration application, frontend lint and build still must run in CI or the deployment environment before merge.
