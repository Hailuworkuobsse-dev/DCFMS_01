#!/bin/bash
# DCFMS frontend<->backend integration test (through the BFF, like a browser).
# Run from the repo root: ./integration-test.sh   (expects backend/ and frontend/ beside it)
# Requires: PostgreSQL up (backend/.env DATABASE_URL), backend built, frontend deps.
# Ports used: 3000 (BFF), 3001 (API), 3100 (mock-mode check).
set -u
cd "$(dirname "$(readlink -f "$0")")" || exit 1
ROOT="$PWD"
[ -d "$ROOT/backend" ] || { echo "FATAL: $ROOT/backend not found"; exit 1; }
API=http://localhost:3000/api
BK=http://localhost:3001/api/v1
J=/tmp/jars; rm -rf $J; mkdir -p $J
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ❌ $1 -- $2"; }
jqp() { python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
  for k in sys.argv[1].split("."): d=d[k]
  print(d if d is not None else "")
except Exception: print("")' "$1"; }

# --- kill anything occupying our ports (robust: match by port, not cmdline) ---
killport() {
  pkill -9 -f "serve[r].ts" 2>/dev/null
  pkill -9 -f "node dist/mai[n]" 2>/dev/null
  sleep 1
}
waitlog() { # $1=logfile $2=success-pattern $3=fail-pattern $4=timeout
  local i
  for i in $(seq 1 ${4:-90}); do
    grep -q "$2" "$1" 2>/dev/null && return 0
    grep -q "$3" "$1" 2>/dev/null && return 1
    sleep 1
  done
  return 2
}
rm -f /tmp/it-backend.log /tmp/it-bff.log /tmp/it-bff-mock.log
killport
# --- start backend ---
(cd "$ROOT/backend" && node dist/main > /tmp/it-backend.log 2>&1 &)
# --- start BFF (production mode: serves built dist + API) ---
(cd "$ROOT/frontend" && NODE_ENV=development PORT=3000 BACKEND_URL=$BK BACKEND_ENABLED=true npx tsx server.ts > /tmp/it-bff.log 2>&1 &)
waitlog /tmp/it-backend.log "DCFMS API listening" "EADDRINUSE" 60 || { echo "FATAL: backend boot failed"; tail -5 /tmp/it-backend.log; exit 1; }
waitlog /tmp/it-bff.log "full-stack server running" "EADDRINUSE" 90 || { echo "FATAL: BFF boot failed"; tail -8 /tmp/it-bff.log; exit 1; }
curl -s $BK/health | grep -q '"ok"' && ok "backend health (:3001)" || bad "backend health" "$(tail -3 /tmp/it-backend.log)"
grep -q "Backend integration: ENABLED" /tmp/it-bff.log && ok "BFF boot with backend ENABLED (:3000)" || bad "BFF boot" "$(tail -5 /tmp/it-bff.log)"

echo "== AUTH via BFF =="
R=$(curl -s $API/auth/demo-accounts); echo "$R" | grep -q "contractor@acme.et" && ok "demo-accounts serves real seeded backend accounts" || bad "demo-accounts" "$R"
R=$(curl -s -c $J/contractor -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"contractor@acme.et","password":"Password123!"}')
echo "$R" | grep -q '"primaryRole":"Contractor"' && ok "contractor login → mapped AuthUser (Contractor)" || bad "contractor login" "$(echo $R|head -c 200)"
echo "$R" | grep -q '"contract:read' && ok "permissions computed from role matrix" || bad "permissions" "$(echo $R|head -c 150)"
R=$(curl -s -b $J/contractor -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"contractor@acme.et","password":"WRONGPASS1"}')
S=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"contractor@acme.et","password":"WRONGPASS1"}')
[ "$S" = "401" ] && ok "bad password → 401" || bad "bad password" "$S $R"
S=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"not-an-email","password":"x123456"}')
[ "$S" = "422" ] && ok "invalid identifier format → 422 (zod)" || bad "login validation" "$S"
R=$(curl -s -b $J/contractor $API/auth/me); echo "$R" | grep -q '"Contractor"' && ok "session cookie → /auth/me" || bad "me" "$R"
curl -s -c $J/farmer -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"+251911000004","password":"Password123!"}' > /tmp/farmerlogin.json
grep -q '"ProducerIndividual"' /tmp/farmerlogin.json && ok "farmer login by PHONE number" || bad "farmer login" "$(head -c 200 /tmp/farmerlogin.json)"
grep -q '"faydaId":"123456789012"' /tmp/farmerlogin.json && ok "farmer Fayda FIN attached from directory" || bad "faydaId" "$(head -c 200 /tmp/farmerlogin.json)"
curl -s -c $J/wboa -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"wboa@dcfms.et","password":"Password123!"}' > /dev/null
curl -s -c $J/fi -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"fi@cbe.et","password":"Password123!"}' > /dev/null
curl -s -c $J/admin -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@dcfms.et","password":"Password123!"}' > /dev/null
R=$(curl -s -b $J/wboa $API/auth/me); echo "$R" | grep -q '"WBoAWoreda"' && ok "WBoA login → WBoAWoreda role" || bad "wboa login" "$R"

echo "== DASHBOARD / CONTRACTS (backend data) =="
R=$(curl -s -b $J/wboa $API/dashboard)
echo "$R" | grep -q '"kpis"' && echo "$R" | grep -q "DCF-2026" && ok "dashboard: backend contracts + KPIs" || bad "dashboard" "$(echo $R|head -c 150)"
R=$(curl -s -b $J/contractor $API/contracts)
CID_OLD=$(echo "$R" | jqp "['data']") # unused guard
N=$(echo "$R" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["contracts"]))')
[ "${N:-0}" -ge 1 ] && ok "contracts list: $N contracts from backend" || bad "contracts list" "$R"

echo "== CONTRACT CREATE → SIGN → APPROVE (full lifecycle) =="
R=$(curl -s -b $J/contractor -X POST $API/contracts -H 'Content-Type: application/json' -d '{
 "templateId":"TPL-STANDARD","title":"Malt Barley Integration Test Contract","commodity":"Malt Barley","variety":"Traveller",
 "region":"Oromia","woreda":"Adama","kebele":"Kebele 01","producerType":"Individual","producerName":"Abebe Bekele",
 "producerFaydaId":"123456789012","farmerCount":1,"landAreaHa":2.5,"expectedQuantityQt":200,"qualityGrade":"Grade A",
 "deliveryWindowStart":"2026-11-01","deliveryWindowEnd":"2026-12-15","inputAdvanceObligations":"Seeds and fertilizer provided by contractor",
 "floorPriceEtbPerQt":3000,"agreedPriceEtbPerQt":3500,"pricingFormula":"Fixed price","exportOriented":false}')
CID=$(echo "$R" | jqp "contract.id"); CNO=$(echo "$R" | jqp "contract.contractNumber")
[ -n "$CID" ] && ok "wizard → backend contract $CNO (status $(echo "$R" | jqp 'contract.status'))" || bad "create contract" "$(echo $R|head -c 250)"
R=$(curl -s -b $J/contractor -X POST $API/contracts/$CID/request-otp)
OTP=$(echo "$R" | jqp "devOtp")
[ -n "$OTP" ] && ok "request-otp → devOtp $OTP (auto send-for-signature)" || bad "request-otp" "$R"
R=$(curl -s -b $J/contractor -X POST $API/contracts/$CID/sign-otp -H 'Content-Type: application/json' -d "{\"otp\":\"$OTP\",\"faydaId\":\"987654321012\",\"acceptDeclaration\":true,\"consent\":true}")
ST=$(echo "$R" | jqp "contract.status")
[ "$ST" = "PENDING_SIGNATURE" ] && ok "contractor OTP-signs → PENDING_SIGNATURE (farmer pending)" || bad "contractor sign" "$(echo $R|head -c 250)"
R=$(curl -s -b $J/farmer -X POST $API/contracts/$CID/request-otp)
OTP=$(echo "$R" | jqp "devOtp")
R=$(curl -s -b $J/farmer -X POST $API/contracts/$CID/sign-otp -H 'Content-Type: application/json' -d "{\"otp\":\"$OTP\",\"faydaId\":\"123456789012\",\"acceptDeclaration\":true,\"consent\":true}")
ST=$(echo "$R" | jqp "contract.status")
[ "$ST" = "Signed" ] && ok "farmer OTP-signs → all signed → 'Signed'" || bad "farmer sign" "$(echo $R|head -c 250)"
echo "$R" | grep -q '"producerSignedAt"' && ok "signature timestamps + Fayda hash surfaced" || bad "signature evidence" "$(echo $R|head -c 200)"
S=$(curl -s -o /dev/null -w '%{http_code}' -b $J/contractor -X POST $API/contracts/$CID/decision -H 'Content-Type: application/json' -d '{"action":"approve","reason":"test"}')
[ "$S" = "403" ] && ok "contractor cannot approve (BFF RBAC) → 403" || bad "approve RBAC" "$S"
R=$(curl -s -b $J/wboa -X POST $API/contracts/$CID/decision -H 'Content-Type: application/json' -d '{"action":"approve","reason":"Statutory compliance verified","notes":"Floor price OK"}')
ST=$(echo "$R" | jqp "contract.status")
[ "$ST" = "Approved" ] && ok "WBoA endorse → submit-approval+approve → 'Approved'" || bad "endorse" "$(echo $R|head -c 250)"
R=$(curl -s -b $J/farmer $API/contracts/$CID)
echo "$R" | grep -q '"contract"' && ok "farmer sees own contract detail (parties/signatures/versions)" || bad "detail" "$(echo $R|head -c 150)"

echo "== FINANCE: loan → decide → disburse → settlement =="
R=$(curl -s -b $J/farmer -X POST $API/loans/apply -H 'Content-Type: application/json' -d "{\"contractId\":\"$CID\",\"fiOrgId\":\"CBE\",\"applicantFaydaId\":\"123456789012\",\"applicantName\":\"Abebe Bekele\",\"principalEtb\":50000,\"cropCycle\":\"Meher 2026\"}")
LID=$(echo "$R" | jqp "loan.id"); LREF=$(echo "$R" | jqp "loan.loanRef")
[ -n "$LID" ] && ok "farmer applies loan $LREF (CBE, 50,000 ETB)" || bad "loan apply" "$(echo $R|head -c 250)"
R=$(curl -s -b $J/fi -X POST $API/loans/$LID/decision -H 'Content-Type: application/json' -d '{"action":"approve","reason":"Contract-backed credit, verified delivery history"}')
echo "$R" | grep -q '"status":"Approved"' && ok "FI approves loan via backend" || bad "loan decide" "$(echo $R|head -c 250)"
R=$(curl -s -b $J/fi -X POST $API/loans/$LID/disburse)
echo "$R" | grep -q '"status":"Disbursed"' && ok "FI disburses loan (new backend endpoint)" || bad "disburse" "$(echo $R|head -c 250)"
R=$(curl -s -b $J/contractor -X POST $API/settlements -H 'Content-Type: application/json' -d "{\"contractId\":\"$CID\",\"deliveryReference\":\"DEL-IT-0001\",\"deliveredKg\":5000,\"disbursementChannel\":\"Telebirr\"}")
GROSS=$(echo "$R" | jqp "settlement.grossAmountEtb"); DED=$(echo "$R" | jqp "settlement.loanDeductionEtb"); NET=$(echo "$R" | jqp "settlement.netPayoutEtb")
[ "$GROSS" = "175000.0" -o "$GROSS" = "175000" ] && [ "$DED" = "50000.0" -o "$DED" = "50000" ] && [ "$NET" = "125000.0" -o "$NET" = "125000" ] \
  && ok "settlement: 5000kg × 3500/qt = 175,000 gross − 50,000 loan = 125,000 net ✓" || bad "settlement math" "gross=$GROSS ded=$DED net=$NET $(echo $R|head -c 150)"
R=$(curl -s -b $J/fi $API/finance)
echo "$R" | grep -q '"financialInstitutions"' && echo "$R" | grep -q "$LREF" && ok "finance overview: loans+settlements+FI list" || bad "finance list" "$(echo $R|head -c 150)"

echo "== VOUCHERS: issue (contractor) → redeem (agro-dealer) =="
R=$(curl -s -b $J/contractor -X POST $API/vouchers/issue -H 'Content-Type: application/json' -d "{\"contractId\":\"$CID\",\"beneficiaryFaydaId\":\"123456789012\",\"beneficiaryName\":\"Abebe Bekele\",\"inputType\":\"NPS Fertilizer\",\"quantity\":100,\"unit\":\"kg\",\"valueEtb\":28000,\"assignedDealerOrgId\":\"dealer-adama-01\"}")
VNO=$(echo "$R" | jqp "voucher.voucherCode")
[ -n "$VNO" ] && ok "issue voucher $VNO (100kg NPS, 28,000 ETB)" || bad "issue voucher" "$(echo $R|head -c 250)"
curl -s -X POST $BK/auth/register -H 'Content-Type: application/json' -d '{"fullName":"Adama Agro Dealer","phone":"+251911000009","password":"Password123!","role":"AGRO_DEALER"}' > /dev/null
curl -s -c $J/dealer -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"+251911000009","password":"Password123!"}' > /dev/null
R=$(curl -s -b $J/dealer -X POST $API/vouchers/redeem -H 'Content-Type: application/json' -d "{\"voucherCode\":\"$VNO\",\"otpCode\":\"123456\"}")
echo "$R" | grep -q '"status":"Redeemed"' && ok "dealer redeems voucher → Redeemed" || bad "redeem" "$(echo $R|head -c 250)"
R=$(curl -s -b $J/farmer $API/vouchers)
echo "$R" | grep -q "$VNO" && ok "farmer sees own voucher" || bad "farmer vouchers" "$(echo $R|head -c 150)"

echo "== MONITORING / GRIEVANCES =="
curl -s -X POST $BK/auth/register -H 'Content-Type: application/json' -d '{"fullName":"Kebede Field Agent","phone":"+251911000011","password":"Password123!","role":"FIELD_AGENT","region":"Oromia","woreda":"Adama"}' > /dev/null
curl -s -c $J/agent -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"+251911000011","password":"Password123!"}' > /dev/null
R=$(curl -s -b $J/agent -X POST $API/monitoring -H 'Content-Type: application/json' -d "{\"contractId\":\"$CID\",\"cropStage\":\"Vegetative\",\"germinationRatePct\":92,\"inputAppliedCorrectly\":true,\"sideSellingRisk\":\"Low\",\"pestOrWeatherAlert\":\"None\",\"estimatedYieldQt\":210,\"gpsLat\":8.54,\"gpsLng\":39.27,\"qualityNotes\":\"Healthy crop stand, inputs applied on schedule\"}")
echo "$R" | grep -q '"reportCode"' && ok "field monitoring report → backend" || bad "monitoring create" "$(echo $R|head -c 250)"
R=$(curl -s -b $J/wboa $API/monitoring)
echo "$R" | grep -q '"advisories"' && ok "monitoring list (backend reports + advisory content)" || bad "monitoring list" "$(echo $R|head -c 150)"
R=$(curl -s -b $J/farmer -X POST $API/grievances -H 'Content-Type: application/json' -d "{\"contractId\":\"$CID\",\"category\":\"Payment Delay\",\"title\":\"Late payment for first delivery\",\"severity\":\"MEDIUM\",\"description\":\"Payment for the first delivery was delayed by two weeks beyond the contractual window.\"}")
GID=$(echo "$R" | jqp "grievance.id"); GCN=$(echo "$R" | jqp "grievance.caseNumber")
[ -n "$GID" ] && ok "farmer files grievance $GCN" || bad "grievance create" "$(echo $R|head -c 250)"
R=$(curl -s -b $J/wboa -X POST $API/grievances/$GID/escalate -H 'Content-Type: application/json' -d '{"reason":"Unresolved at contractor tier after SLA breach"}')
echo "$R" | grep -q '"status":"Escalated"' && ok "WBoA escalates grievance" || bad "escalate" "$(echo $R|head -c 250)"
curl -s -X POST $BK/auth/register -H 'Content-Type: application/json' -d '{"fullName":"Resolution Officer","phone":"+251911000010","password":"Password123!","role":"RESOLUTION_OFFICER"}' > /dev/null
curl -s -c $J/justice -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"+251911000010","password":"Password123!"}' > /dev/null
R=$(curl -s -b $J/justice -X POST $API/grievances/$GID/resolve -H 'Content-Type: application/json' -d '{"resolutionSummary":"Payment executed with bank confirmation; contractor warned per Proclamation 1289/2023."}')
echo "$R" | grep -q '"status":"Resolved"' && ok "resolution officer resolves grievance" || bad "resolve" "$(echo $R|head -c 250)"

echo "== ADMIN / AUDIT / RBAC =="
R=$(curl -s -b $J/admin $API/admin/users)
echo "$R" | grep -q "Abebe Bekele" && ok "admin/users → real backend users" || bad "admin users" "$(echo $R|head -c 150)"
R=$(curl -s -b $J/admin $API/admin/audit)
echo "$R" | grep -q '"entryHash"' && ok "admin/audit → backend immutable audit chain (mapped)" || bad "admin audit" "$(echo $R|head -c 150)"
S=$(curl -s -o /dev/null -w '%{http_code}' -b $J/farmer $API/admin/users)
[ "$S" = "403" ] && ok "farmer denied admin/users → 403" || bad "admin RBAC" "$S"
S=$(curl -s -o /dev/null -w '%{http_code}' $API/contracts)
[ "$S" = "401" ] && ok "no session → 401" || bad "unauth" "$S"
R=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)
[ "$R" = "200" ] && ok "SPA served at :3000 (production static)" || bad "SPA" "$R"

echo "== MOCK FALLBACK MODE (BACKEND_ENABLED=false) =="
(cd "$ROOT/frontend" && NODE_ENV=development PORT=3100 BACKEND_ENABLED=false npx tsx server.ts > /tmp/it-bff-mock.log 2>&1 &)
waitlog /tmp/it-bff-mock.log "full-stack server running" "EADDRINUSE" 90 || { echo "FATAL: mock BFF boot failed"; tail -8 /tmp/it-bff-mock.log; exit 1; }
R=$(curl -s -c $J/mock -X POST http://localhost:3100/api/auth/login -H 'Content-Type: application/json' -d '{"email":"alemu.farmer@ethio.et","password":"ati2025!"}')
echo "$R" | grep -q '"primaryRole"' && ok "mock login still works (fallback preserved)" || bad "mock login" "$(echo $R|head -c 200)"
R=$(curl -s -b $J/mock http://localhost:3100/api/contracts)
echo "$R" | grep -q "contractNumber" && ok "mock contracts served when backend disabled" || bad "mock contracts" "$(echo $R|head -c 150)"
grep -q "DISABLED" /tmp/it-bff-mock.log && ok "BFF logs integration mode at boot" || bad "mode log" ""

# cleanup
killport
echo ""
echo "INTEGRATION RESULT: $PASS passed, $FAIL failed"
