# Contract drafting and negotiation (B1–B2)

## Data migration
Run the backend Prisma migration and regenerate the client before starting the API:

```bash
npx prisma migrate deploy
npx prisma generate
```

The migration creates contract template, comment, annex, and change-acceptance tables and seeds one approved English-language standard template. The seeded legal clauses are a starter template and must be reviewed by authorized Ethiopian legal counsel before production use.

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
