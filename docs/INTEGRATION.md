# Frontend ⇄ Backend Integration Guide

How the React frontend (served by an Express **BFF** in `frontend/server.ts`) integrates with the NestJS backend (`backend/`, `/api/v1`).

```
Browser (React SPA)
   │  fetch /api/*  (httpOnly cookie session, frontend JSON shapes)
   ▼
Express BFF — frontend/server.ts
   │  ├─ RBAC middleware (role permission matrix, unchanged mock semantics)
   │  ├─ zod validation (unchanged schemas)
   │  └─ backendAdapter.ts
   │        • Bearer JWT to backend (auto-refresh on 401)
   │        • unwraps { success, data } envelope
   │        • maps Prisma shapes/enums ⇄ frontend domain types
   ▼
NestJS API — backend/ (:3001 in dev, /api/v1)
   ▼
PostgreSQL (Prisma)
```

## Modes

| Mode | Env | Behavior |
|---|---|---|
| **Integrated** (default) | `BACKEND_ENABLED=true`, `BACKEND_URL=http://localhost:3001/api/v1` | Auth + core modules hit the real backend; features without backend equivalents stay on the in-memory store (see below) |
| **Mock-only** | `BACKEND_ENABLED=false` (or `npm run dev:mock`) | Original behavior: everything in-memory, demo OTP `123456` |

If the backend is unreachable while integrated, BFF responses return `503 BACKEND_UNAVAILABLE` (login) or the mapped backend error — it never silently mixes sources mid-request.

## Endpoint mapping

| Frontend (`/api`) | Backend (`/api/v1`) | Notes |
|---|---|---|
| `POST /auth/login` | `POST /auth/login` `{identifier,password}` | email **or** phone; JWT stored server-side in the cookie session; farmer Fayda FIN attached via directory |
| `GET /auth/me`, `POST /auth/logout`, `POST /auth/switch-scope` | — (session-local) | scope switching is a BFF-session concept |
| `GET /dashboard` | `GET /analytics/dashboard`, `/analytics/contract-performance`, module lists | KPIs/series computed from live rows; linkages/insurances/integrations/competency from mock store |
| `GET/POST /contracts`, `GET /contracts/:id` | `GET/POST /contracts`, `GET /contracts/:id` | wizard payload is stored as the contract `content` JSON (hashed + versioned by the backend); farmer party resolved from Fayda FIN via `/directory/farmers` |
| `POST /contracts/:id/request-otp` *(new)* | `PATCH /contracts/:id/send-for-signature` (if DRAFT) + `POST /contracts/:id/sign/request-otp` | returns `devOtp` **only when backend `NODE_ENV!=production`** until an SMS gateway is wired |
| `POST /contracts/:id/sign-otp` | `POST /contracts/:id/sign` `{method:'OTP',otpCode}` | auto send-for-signature when DRAFT; status advances to `Signed` when all parties signed |
| `POST /contracts/:id/decision` | `PATCH …/submit-approval` (if SIGNED) + `PATCH …/approve` | approve/reject with note |
| `GET /vouchers`, `POST /vouchers/issue`, `POST /vouchers/redeem` | `GET /finance/vouchers`, `POST /finance/vouchers`, `POST /finance/vouchers/redeem` | expiry auto-set +90 days; dealer id from session; farmer resolved from Fayda FIN |
| `GET /finance` | `GET /finance/loans` + `GET /finance/settlements` | insurances from mock store; FI list is a static registry (TODO: backend FI registry) |
| `POST /loans/apply` / `:id/decision` / `:id/disburse` | `POST /finance/loans`, `PATCH …/decide`, `PATCH …/disburse` | disburse endpoint added for this integration |
| `POST /settlements` | `POST /finance/settlements` | gross computed from contract price × delivered kg; **outstanding DISBURSED loan principal deducted automatically**; channel map Telebirr→MOBILE_MONEY, CBE_Birr/Bank_Transfer→BANK |
| `POST /settlement/:id/release` / `reconcile` | ack of backend payment state | backend gateway simulation completes payments immediately; distinct release/reconcile persistence is a TODO |
| `GET/POST /monitoring` | `GET/POST /monitoring` | report fields ride in the backend `findings` JSON |
| `GET/POST /grievances`, `:id/escalate`, `:id/resolve` | `GET/POST /grievances`, `PATCH …/escalate`, `PATCH …/resolve` | category text → backend enum; title/severity columns added for this integration |
| `GET /admin/users`, `GET /admin/audit` | `GET /users`, `GET /audit` | audit rows mapped into the hash-chain display shape (`entryHash` derived per row) |
| Mock-only (no backend equivalent yet) | — | `/search`, `/notifications`, `/linkage*`, `/competency*`, `/reports*`, `/admin/matrix`, `/admin/flags`, `/vouchers/:id/verify-agent`, `POST /admin/users`, insurances, advisories, integrations health |

## Role & scope mapping

Backend `Role` → frontend `RoleId` (drives the existing permission matrix):

`SYSTEM_ADMIN→SystemAdmin · MOA_OFFICER→MoAFederal · RBOA_OFFICER→RBoARegional · WBOA_OFFICER→WBoAWoreda · MOTRI_OFFICER→MoTRIOfficer · ECC_OFFICER→ECCOfficer · EAA_OFFICER→EAAOfficer · RESOLUTION_OFFICER→JusticeOfficer · CONTRACTOR→Contractor · FARMER→ProducerIndividual · COOPERATIVE→ProducerCooperative · FI_OFFICER→FinancialInstitution · AGRO_DEALER→AgroDealer · FIELD_AGENT→FieldAgent · AUDITOR→Auditor · SUPPORT_AGENT→FieldAgent`

Government/oversight roles take their scope from the backend `adminLevel` (FEDERAL→federal, REGIONAL→region, WOREDA→woreda, KEBELE→kebele); value-chain actors always use their role default (`org` / `own` / `woreda`) so the mock permission semantics keep working. The backend **additionally** enforces its own RBAC + administrative scoping on every call.

## Status mapping (backend → UI)

- Contracts: `DRAFT→Draft · PENDING_SIGNATURES→PENDING_SIGNATURE · SIGNED→Signed · PENDING_APPROVAL→Signed · APPROVED→Approved · IN_EXECUTION→ACTIVE · COMPLETED→Completed · ADJUSTED→Adjusted · REJECTED→Rejected · CANCELLED→TERMINATED`
- Vouchers: `ISSUED→Issued · REDEEMED→Redeemed · EXPIRED→Expired · CANCELLED→CANCELLED`
- Loans: `SUBMITTED→Submitted · UNDER_REVIEW→UnderAssessment · APPROVED→Approved · REJECTED→Rejected · DISBURSED→Disbursed · REPAYING→ACTIVE · CLOSED→Completed · DEFAULTED→PENDING`
- Settlements: `PENDING/PROCESSING/FAILED→PENDING · COMPLETED→SETTLED`
- Grievances: `OPEN→Submitted · IN_REVIEW→InMediation · ESCALATED→Escalated · RESOLVED/CLOSED→Resolved`

## Backend additions made for this integration

- `GET /api/v1/health` (public) — used by compose/dev tooling
- `GET /api/v1/directory/farmers|orgs` — authenticated actor directory (names, Fayda FINs, ids) for display + party resolution
- `PATCH /api/v1/finance/loans/:id/disburse` (FI only) — completes the loan lifecycle
- `POST /contracts/:id/sign/request-otp` returns `devOtp` in non-production (SMS gateway is a TODO)
- Columns: `Voucher.valueEtb`, `Voucher.dealerOrgId`, `Payment.deliveredKg`, `Grievance.title`, `Grievance.severity` (migration `integration_extras`)
- `GET /audit` supports `entityId` filter; login response includes email/phone/kebele
- `submit-approval` also allowed for MoA/RBoA/WBoA; `POST /finance/loans` also allowed for FARMER (self-service credit applications)

## Security notes

- Browser never sees backend JWTs: tokens live in the BFF's server-side session map, keyed by the existing httpOnly `dcfms_session` cookie.
- `devOtp` is returned **only** when the backend runs with `NODE_ENV!=production`; in production OTPs must reach users via the SMS gateway (`backend/src/auth/otp.service.ts` → `TODO(integration)`).
- Seed credentials (`Password123!`) are for development only.

## Known gaps / TODO(integration)

1. SMS gateway for OTP + voucher notifications (Ethio Telecom / Twilio).
2. Fayda e-KYC / FaydaPass VC signing (backend stub `signWithFaydaPass`).
3. Real payment rails (currently simulated auto-complete) + persisted release/reconcile states.
4. Backend registries for financial institutions, agro-dealers, insurers (UI uses static/mock lists).
5. Linkage/cluster matching, contractor competency certification, advisories (8028), NMIS prices, reports/export queue — mock-only until backend modules exist.
6. BFF session store is in-memory (single instance); move to Redis for horizontal scaling.
7. Insurance module (schema + endpoints) not yet in the backend.
