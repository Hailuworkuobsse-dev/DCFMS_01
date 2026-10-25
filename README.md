# DCFMS — Digital Contract Farming Management System

Full-stack platform digitizing Ethiopia's contract farming lifecycle (Proclamation No. 1289/2023): contracts with OTP e-signatures, input vouchers, tripartite finance, monitoring, grievances, analytics, and an immutable audit trail.

| Layer | Stack | Location |
|---|---|---|
| Backend API | NestJS 10 · TypeScript · Prisma 5 · PostgreSQL 15 | [`backend/`](backend/) |
| Frontend + BFF | React 18 · Vite 6 · Tailwind 4 · TanStack Query · Express BFF | [`frontend/`](frontend/) |
| Spec | Full backend implementation spec | [`backend/docs/code.md`](backend/docs/code.md) |
| Integration guide | Endpoint/shape mapping, modes, TODOs | [`docs/INTEGRATION.md`](docs/INTEGRATION.md) |

## Quick start (Docker — full stack)

```bash
docker compose up --build
```

- **App:** http://localhost:3000 — login with any seeded account below (password `Password123!`)
- **API:** http://localhost:3001/api/v1 — **Swagger:** http://localhost:3001/api/docs

### Seeded accounts

| Login (email or phone) | Role |
|---|---|
| `contractor@acme.et` | Contractor (Acme Agri Exports) |
| `+251911000004` | Farmer (Abebe Bekele, Fayda FIN 123456789012) |
| `moa@dcfms.et` | MoA federal approver |
| `wboa@dcfms.et` | WBoA officer (Oromia / Adama) |
| `fi@cbe.et` | Financial institution officer (CBE) |
| `admin@dcfms.et` | System administrator |

## Manual dev setup (no Docker)

```bash
# 1) PostgreSQL 15 running locally with database/user from backend/.env.example

# 2) Backend on :3001
cd backend
npm install && cp .env.example .env   # set PORT=3001
npx prisma migrate deploy && npx prisma db seed
npm run start:dev

# 3) Frontend + BFF on :3000 (proxies /api to the backend)
cd ../frontend
npm install && cp .env.example .env   # BACKEND_URL=http://localhost:3001/api/v1
npm run dev
```

Run the frontend **without** the backend (original in-memory demo mode): `npm run dev:mock`.

## Demo journey (works end-to-end)

1. Login as **contractor** → Contracts → *New Contract* wizard (pick Fayda FIN `123456789012` as producer) → creates a real backend contract (SHA-256 hashed, versioned).
2. On the contract page → **Authorize & Sign** → *Send OTP* → the dev-intercepted 6-digit code appears → sign. Login as the **farmer** and repeat → contract becomes **Signed**.
3. Login as **WBoA** → **Endorse Agreement** → contract becomes **Approved**.
4. As the **farmer** → Finance → apply for a loan against the contract; as **FI** → approve + disburse.
5. As the **contractor** → create a settlement for a delivery → loan principal is deducted automatically from the payout.
6. Contractor issues an **input voucher** → register/login an Agro-Dealer → redeem it.
7. File/escalate/resolve a **grievance**; submit **monitoring** reports; inspect the **audit chain** as admin.

## Tests

```bash
cd backend && bash smoke-test.sh        # 33 API-level checks (backend only, :3000)
bash integration-test.sh                # 42 checks through the frontend BFF (backend :3001 + web :3000)
cd frontend && npm run lint && npm run test
```

## Repository notes

- `frontend/node_modules` and `dist/` are currently committed; consider adding a root `.gitignore` and removing them to shrink the repo.
- External systems (Fayda, NMIS, 8028, SMS, payment rails, insurance) are stubbed with `TODO(integration)` markers — see `docs/INTEGRATION.md`.
