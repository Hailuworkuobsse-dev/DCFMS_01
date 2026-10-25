# Role-Based Access Control (RBAC) Specification
## Ethiopian Contract Farming Proclamation No. 1289/2023

### 1. Role Catalogue (18 Roles)

| Tier | Role ID | Scope | Focus Area |
|------|---------|-------|------------|
| **Platform Admin** | `ATISuperAdmin` | `all` | National system health, platform KPIs, inter-agency gateways |
| | `SystemAdmin` | `all` | Infrastructure telemetry, database latencies, background queues |
| | `DataClerk` | `woreda` | Woreda paper registry conversion, Fayda e-KYC validation |
| **Government Oversight** | `MoAFederal` | `federal` | Strategic food security quotas, inter-regional trade balance |
| | `RBoARegional` | `region` | Regional production targets, seasonal input allocations |
| | `ZBoAZonal` | `region` | Zonal aggregation, woreda performance comparison |
| | `WBoAWoreda` | `woreda` | Statutory contract endorsement, tripartite dispute conciliation |
| | `KebeleDA` | `woreda` | Plot geotagging, biometric verification, crop health inspections |
| **Regulatory & Justice** | `MoTRFederal` | `federal` | Buyer commercial licensing, statutory minimum price floor checks |
| | `RCoPARegional` | `region` | Primary cooperative bylaws audit, union dividend oversight |
| | `Ombudsman` | `federal` | Independent oversight, fair contract clauses, anti-exploitation |
| | `CourtJudge` | `woreda` | Judicial dispute hearings, binding awards, escrow lien release |
| **Value Chain Actors** | `FarmerIndividual` | `own` | Direct smallholder contract terms, input vouchers, grain delivery |
| | `FarmerOutgrower` | `own` | Commercial outgrower scheme member quotas |
| | `PrimaryCooperative` | `woreda` | Kebele-level aggregation, warehouse intake, group credit |
| | `CooperativeUnion` | `region` | Multi-woreda union, secondary aggregation, industrial supply |
| | `ContractorAgroProcessor`| `org` | Flour mill / malting plant demand, escrow deposits, off-take |
| | `ContractorExporter` | `org` | Export commodity procurement (Sesame, Coffee, Soybean) |
| | `InputSupplier` | `org` | Certified seeds & fertilizer vouchers, agro-dealer redemption |
| | `CommercialBank` | `org` | Tripartite escrow vaults, seasonal credit, off-take settlements |

### 2. Permission String Grammar

```
permission := resource ":" action ":" scope
resource   := "contract" | "farmer" | "contractor" | "linkage" | "input_voucher"
            | "settlement" | "monitoring" | "grievance" | "report" | "audit_log"
            | "loan" | "insurance" | "system_config" | "price"
action     := "create" | "read" | "update" | "delete" | "approve" | "sign"
            | "reject" | "escalate" | "export" | "assign" | "verify"
scope      := "own" | "org" | "woreda" | "region" | "federal" | "all"
```
