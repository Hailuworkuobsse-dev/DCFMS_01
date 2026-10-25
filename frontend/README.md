# Ethiopian Digital Contract Farming Management System (DCFMS)
## Agricultural Transformation Institute (ATI) — Federal Democratic Republic of Ethiopia

A production-grade, role-based, bilingual (English/Amharic), low-bandwidth-tolerant web application that digitizes the entire Ethiopian contract farming lifecycle under **Proclamation No. 1289/2023**.

---

### Core Architectural Highlights

1. **Defense-in-Depth RBAC Model (`src/lib/rbac/`):**
   - **18 Distinct Stakeholder Roles** across Platform Administration, Government Oversight, Regulatory & Justice, and Value Chain Actors.
   - Fine-grained permission strings in the format `resource:action:scope` (e.g., `contract:approve:woreda`).
   - Hierarchical scope enforcement: `own < org < woreda < region < federal < all`.
   - UI enforcement primitives: `<Can permission="...">`, `<RoleGate roles={[...]}>`, and `<ProtectedRoute>`.

2. **Bilingual Amharic & English Localization (`src/lib/i18n/`):**
   - Full dictionary translation (`en` and `am`).
   - System typography configured with Google Fonts `Noto Sans Ethiopic` preventing tofu rendering (`▯`) in monospace and headings.
   - Dynamic `html[lang="am"]` line-height adjustment.

3. **Low-Bandwidth & Offline Tolerance for Remote Woredas:**
   - 3G/2G optimized shell caching via Service Worker.
   - IndexedDB offline mutation queue (`src/lib/offline/syncQueue.ts`) for Development Agent (DA) field inspections and contract registrations.
   - Recharts animated clip-paths disabled (`isAnimationActive={false}`) for instant rendering on low-power mobile devices.

4. **Statutory Tripartite Governance (Proclamation No. 1289/2023):**
   - **Digital Signatures & Fayda e-KYC**: 12-digit national ID and SMS/USSD OTP verification.
   - **WBoA Woreda Bureau Endorsement**: Statutory registration stamp required before contract execution.
   - **Tripartite Escrow**: Commercial Bank of Ethiopia (CBE) guaranteed buyer escrow accounts.
   - **Mandatory 15-Day Mediation**: Tripartite conciliation at Woreda Agricultural Offices before civil court litigation.
   - **Tamper-Evident Audit Ledger**: SHA-256 chained transaction logs.

---

### Quick Start & Development

```bash
# Install dependencies
bun install   # or npm install

# Run unit tests (RBAC permission matrix & Zod schemas)
npm test

# Run full-stack dev server (Express + Vite on Port 3000)
npm run dev
```

The Express API and frontend are served together; the UI uses cookie-backed `/api` requests by default. Set `VITE_API_BASE_URL` in the frontend environment to change the API base path before starting the server or building the frontend. Keep `/api` for the integrated Express server.
