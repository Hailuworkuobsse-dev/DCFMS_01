# DCFMS Backend

Digital Contract Farming Management System (DCFMS) — API backend.

**Stack:** NestJS 10 · TypeScript · Prisma 5 · PostgreSQL 15 · Docker
**Layout:** Modular monolith — each module (auth, users, contracts, finance, monitoring, grievances, analytics, audit) can be split into a microservice later.

## Modules

| Module | Responsibilities |
|---|---|
| `auth` | Register, login, JWT access/refresh, OTP issue/verify, bcrypt hashing, login audit |
| `users` | List / create / deactivate users; RBAC + administrative scope |
| `contracts` | Create with SHA-256 content hash + versioning, parcel locking (no double-contracting), send-for-signature, OTP e-signature, approval workflow (MoA/RBoA/WBoA), integrity verification, lifecycle state machine |
| `finance` | Loans (create/decide), input vouchers (issue/redeem), settlements with loan deduction |
| `monitoring` | Field-agent monitoring reports (GPS, findings, score) |
| `grievances` | Intake → assign → escalate → resolve workflow with SLA |
| `analytics` | Scoped dashboard aggregates + contract performance rates |
| `audit` | Append-only audit log + admin query API |

Cross-cutting: global `JwtAuthGuard`, `RolesGuard`, administrative `ScopeGuard`, `AuditInterceptor`, response `TransformInterceptor`, `AllExceptionsFilter`, Helmet, global `ValidationPipe`, Swagger UI.

## Running It

```bash
# 1. Install
npm install
cp .env.example .env

# 2. Start Postgres
docker compose up -d db

# 3. Create schema + seed
npx prisma migrate dev --name init
npx prisma db seed

# 4. Run dev
npm run start:dev
# → API:    http://localhost:3000/api/v1
# → Swagger: http://localhost:3000/api/docs
```

Full stack (db + api) via Docker:

```bash
cp .env.example .env
docker compose up --build
```

## Seeded Test Accounts (password: `Password123!`)

| Phone | Role |
|---|---|
| `+251911000001` | SYSTEM_ADMIN |
| `+251911000002` | MOA_OFFICER (federal approver) |
| `+251911000003` | WBOA_OFFICER (Oromia / Adama) |
| `+251911000004` | FARMER (Abebe Bekele, linked Farmer record) |
| `+251911000005` | CONTRACTOR (Acme Agri Exports) |
| `+251911000006` | FI_OFFICER (CBE) |

## Sample Request Flow

```bash
# Login (contractor)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"+251911000005","password":"Password123!"}'
# → { success: true, data: { accessToken, refreshToken, user } }

TOKEN=<accessToken>

# Create contract
curl -X POST http://localhost:3000/api/v1/contracts \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"commodity":"Malt Barley","quantity":500,"priceMechanism":"FIXED","fixedPrice":3500,
       "content":{"clauses":[]},"region":"Oromia","woreda":"Adama",
       "parties":[{"role":"CONTRACTOR"},{"role":"FARMER","farmerId":"<farmerId>"}]}'

# Send for signatures → request OTP → sign (in dev the OTP is printed to the API console)
curl -X PATCH http://localhost:3000/api/v1/contracts/<id>/send-for-signature -H "Authorization: Bearer $TOKEN"
curl -X POST  http://localhost:3000/api/v1/contracts/<id>/sign/request-otp  -H "Authorization: Bearer $TOKEN"
curl -X POST  http://localhost:3000/api/v1/contracts/<id>/sign \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"method":"OTP","otpCode":"<code from console>"}'

# Submit for approval, then approve as MoA officer
curl -X PATCH http://localhost:3000/api/v1/contracts/<id>/submit-approval -H "Authorization: Bearer $TOKEN"
curl -X PATCH http://localhost:3000/api/v1/contracts/<id>/approve \
  -H "Authorization: Bearer $MOA_TOKEN" -H 'Content-Type: application/json' \
  -d '{"decision":"APPROVE"}'

# Tamper-evidence check
curl http://localhost:3000/api/v1/contracts/<id>/integrity -H "Authorization: Bearer $TOKEN"
```

## Implemented vs. Pending

**Runnable today:** auth (JWT + refresh + OTP), RBAC + scope guards, users, contract lifecycle with OTP e-signature + hashing/versioning + parcel locking, loans, vouchers, settlements, grievances, monitoring reports, scoped analytics, append-only audit log with query API, Swagger, validation, exception filter, Helmet, Docker.

**Marked `TODO(integration)`** — awaiting external systems: Fayda OTP / FaydaPass VC signing (`signature.service.ts`), SMS delivery (`otp.service.ts`, `vouchers.service.ts`), payment gateway (`settlement.service.ts`), NMIS price feed / 8028 advisory / OpenAgriNet / insurance triggers, contractor-scoped listing (`contracts.service.ts`), Redis caching, object storage, SIEM log shipping, DR drills.

**Recommended next steps:** integration adapter clients under `src/integrations/`, `ContractVersion` snapshots on every edit, BullMQ queues for async reports/payment retries, contract PDF rendering with QR + hash, E2E tests (`@nestjs/testing` + supertest), `before`-state capture in `AuditInterceptor`, migrations as a separate init job in production.
