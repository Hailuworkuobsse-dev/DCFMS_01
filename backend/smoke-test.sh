#!/bin/bash
# DCFMS end-to-end smoke test: starts the API, exercises the full contract
# lifecycle + finance + grievance + monitoring + analytics + audit, then stops.
set -u
cd "$(dirname "$(readlink -f "$0")")" || exit 1
API=http://localhost:3000/api/v1
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ❌ $1 -- $2"; }

# --- boot server (clean any stale instance first; [n] trick avoids pkill self-match) ---
pkill -9 -f "node dist/mai[n]" 2>/dev/null; sleep 1
node dist/main > /tmp/dcfms-server.log 2>&1 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT
for i in $(seq 1 30); do
  curl -s -o /dev/null "$API/auth/login" && break
  sleep 1
done
sleep 2
grep -q "EADDRINUSE" /tmp/dcfms-server.log && { echo "FATAL: port 3000 still occupied"; exit 1; }

jqget() { python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    for k in sys.argv[1].split("."):
        d = d[k]
    print(d if d is not None else "")
except Exception:
    print("")
' "$1"; }

echo "== 1. LOGIN (contractor / farmer / MoA / admin) =="
R=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"identifier":"+251911000005","password":"Password123!"}')
CT=$(echo "$R" | jqget "data.accessToken"); CONTRACTOR_ID=$(echo "$R" | jqget "data.user.id")
[ -n "$CT" ] && ok "contractor login" || bad "contractor login" "$R"
R=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"identifier":"+251911000004","password":"Password123!"}')
FT=$(echo "$R" | jqget "data.accessToken"); FARMER_USER_ID=$(echo "$R" | jqget "data.user.id")
[ -n "$FT" ] && ok "farmer login" || bad "farmer login" "$R"
R=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"identifier":"+251911000002","password":"Password123!"}')
MT=$(echo "$R" | jqget "data.accessToken")
[ -n "$MT" ] && ok "MoA login" || bad "MoA login" "$R"
R=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"identifier":"+251911000001","password":"Password123!"}')
AT=$(echo "$R" | jqget "data.accessToken"); RT=$(echo "$R" | jqget "data.refreshToken")
[ -n "$AT" ] && ok "admin login" || bad "admin login" "$R"

echo "== 2. BAD LOGIN + REFRESH =="
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"identifier":"+251911000001","password":"wrongpass"}')
[ "$CODE" = "401" ] && ok "bad password → 401" || bad "bad password" "got $CODE"
R=$(curl -s -X POST $API/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT\"}")
echo "$R" | grep -q accessToken && ok "token refresh" || bad "token refresh" "$R"

echo "== 3. UNAUTH + RBAC =="
CODE=$(curl -s -o /dev/null -w '%{http_code}' $API/contracts)
[ "$CODE" = "401" ] && ok "no token → 401" || bad "no token" "got $CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/users -H "Authorization: Bearer $CT" -H 'Content-Type: application/json' -d '{"fullName":"X","phone":"+251900000000","password":"password123","role":"FIELD_AGENT"}')
[ "$CODE" = "403" ] && ok "contractor cannot create users → 403" || bad "RBAC users" "got $CODE"

echo "== 4. USERS (admin) =="
R=$(curl -s "$API/users?role=FARMER" -H "Authorization: Bearer $AT")
echo "$R" | grep -q 'Abebe' && ok "list users (filter role=FARMER)" || bad "list users" "$R"
FARMER_ID=$(su postgres -c "psql -t -A -d dcfms -c \"SELECT id FROM \\\"Farmer\\\" LIMIT 1\"" | head -1)
[ -n "$FARMER_ID" ] && ok "farmer record: $FARMER_ID" || bad "farmer record" "missing"

echo "== 5. CONTRACT LIFECYCLE =="
R=$(curl -s -X POST $API/contracts -H "Authorization: Bearer $CT" -H 'Content-Type: application/json' -d "{\"commodity\":\"Malt Barley\",\"quantity\":500,\"priceMechanism\":\"FIXED\",\"fixedPrice\":3500,\"content\":{\"clauses\":[{\"id\":1,\"text\":\"Delivery at Adama\"}],\"b\":{\"a\":1}},\"region\":\"Oromia\",\"woreda\":\"Adama\",\"parties\":[{\"role\":\"CONTRACTOR\"},{\"role\":\"FARMER\",\"farmerId\":\"$FARMER_ID\"}]}")
CID=$(echo "$R" | jqget "data.id"); CNO=$(echo "$R" | jqget "data.contractNo")
[ -n "$CID" ] && [ "$CID" != "None" ] && ok "create contract $CNO" || bad "create contract" "$R"
R=$(curl -s $API/contracts/$CID/integrity -H "Authorization: Bearer $CT")
echo "$R" | grep -q '"intact": *true\|"intact":true' && ok "integrity intact=true (canonical JSONB hash)" || bad "integrity" "$R"
R=$(curl -s -X PATCH $API/contracts/$CID/send-for-signature -H "Authorization: Bearer $CT")
echo "$R" | grep -q PENDING_SIGNATURES && ok "send-for-signature → PENDING_SIGNATURES (2 signature rows)" || bad "send-for-signature" "$R"

# contractor requests OTP (dev server prints code)
curl -s -X POST $API/contracts/$CID/sign/request-otp -H "Authorization: Bearer $CT" > /dev/null
sleep 1
OTP=$(grep -o '\[OTP DEV\] SIGN for '"$CONTRACTOR_ID"': [0-9]*' /tmp/dcfms-server.log | tail -1 | grep -o '[0-9]\{6\}$')
R=$(curl -s -X POST $API/contracts/$CID/sign -H "Authorization: Bearer $CT" -H 'Content-Type: application/json' -d "{\"method\":\"OTP\",\"otpCode\":\"$OTP\"}")
echo "$R" | grep -q signatureHash && ok "contractor OTP sign (code $OTP)" || bad "contractor sign" "$R (otp=$OTP)"

# farmer signs
curl -s -X POST $API/contracts/$CID/sign/request-otp -H "Authorization: Bearer $FT" > /dev/null
sleep 1
OTP=$(grep -o '\[OTP DEV\] SIGN for '"$FARMER_USER_ID"': [0-9]*' /tmp/dcfms-server.log | tail -1 | grep -o '[0-9]\{6\}$')
R=$(curl -s -X POST $API/contracts/$CID/sign -H "Authorization: Bearer $FT" -H 'Content-Type: application/json' -d "{\"method\":\"OTP\",\"otpCode\":\"$OTP\"}")
echo "$R" | grep -q signatureHash && ok "farmer OTP sign (code $OTP)" || bad "farmer sign" "$R (otp=$OTP)"
R=$(curl -s $API/contracts/$CID -H "Authorization: Bearer $CT")
echo "$R" | grep -q '"status": *"SIGNED"\|"status":"SIGNED"' && ok "all signed → contract SIGNED" || bad "status SIGNED" "$(echo $R | head -c 200)"

R=$(curl -s -X PATCH $API/contracts/$CID/submit-approval -H "Authorization: Bearer $CT")
echo "$R" | grep -q PENDING_APPROVAL && ok "submit-approval → PENDING_APPROVAL" || bad "submit-approval" "$R"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH $API/contracts/$CID/approve -H "Authorization: Bearer $CT" -H 'Content-Type: application/json' -d '{"decision":"APPROVE"}')
[ "$CODE" = "403" ] && ok "contractor cannot approve → 403" || bad "approve RBAC" "got $CODE"
R=$(curl -s -X PATCH $API/contracts/$CID/approve -H "Authorization: Bearer $MT" -H 'Content-Type: application/json' -d '{"decision":"APPROVE"}')
echo "$R" | grep -q '"status": *"APPROVED"\|"status":"APPROVED"' && ok "MoA approve → APPROVED" || bad "MoA approve" "$(echo $R | head -c 200)"

echo "== 6. FINANCE =="
R=$(curl -s -X POST $API/finance/loans -H "Authorization: Bearer $CT" -H 'Content-Type: application/json' -d "{\"farmerId\":\"$FARMER_ID\",\"contractId\":\"$CID\",\"fiId\":\"CBE\",\"requestedAmt\":50000,\"purpose\":\"inputs\"}")
LID=$(echo "$R" | jqget "data.id")
[ -n "$LID" ] && [ "$LID" != "None" ] && ok "create loan" || bad "create loan" "$R"
R=$(curl -s -X PATCH $API/finance/loans/$LID/decide -H "Authorization: Bearer $(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"identifier":"+251911000006","password":"Password123!"}' | jqget "data.accessToken")" -H 'Content-Type: application/json' -d '{"decision":"APPROVE","approvedAmt":45000,"interestRate":8.5}')
echo "$R" | grep -q APPROVED && ok "FI approves loan (45,000 ETB @ 8.5%)" || bad "loan decide" "$R"
R=$(curl -s -X POST $API/finance/vouchers -H "Authorization: Bearer $CT" -H 'Content-Type: application/json' -d "{\"farmerId\":\"$FARMER_ID\",\"contractId\":\"$CID\",\"inputType\":\"SEED\",\"amount\":100,\"expiresAt\":\"2027-01-01\"}")
VNO=$(echo "$R" | jqget "data.voucherNo")
[ -n "$VNO" ] && [ "$VNO" != "None" ] && ok "issue voucher $VNO" || bad "issue voucher" "$R"
DT=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"identifier":"+251911000007","password":"Password123!"}' | jqget "data.accessToken")
R=$(curl -s -X POST $API/auth/register -H 'Content-Type: application/json' -d '{"fullName":"Adama Agro Dealer","phone":"+251911000007","password":"Password123!","role":"AGRO_DEALER"}')
DT=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"identifier":"+251911000007","password":"Password123!"}' | jqget "data.accessToken")
R=$(curl -s -X POST $API/finance/vouchers/redeem -H "Authorization: Bearer $DT" -H 'Content-Type: application/json' -d "{\"voucherNo\":\"$VNO\",\"agroDealerId\":\"dealer-1\"}")
echo "$R" | grep -q REDEEMED && ok "agro-dealer redeems voucher" || bad "redeem voucher" "$R"
R=$(curl -s -X POST $API/finance/settlements -H "Authorization: Bearer $CT" -H 'Content-Type: application/json' -d "{\"contractId\":\"$CID\",\"payerId\":\"contractor-1\",\"payeeId\":\"$FARMER_ID\",\"grossAmount\":100000,\"loanDeduction\":45000,\"channel\":\"BANK\"}")
echo "$R" | grep -q '"netAmount": *55000\|"netAmount":55000' && ok "settlement: 100k gross − 45k loan = 55k net" || bad "settlement" "$R"

echo "== 7. MONITORING / GRIEVANCE =="
FAT=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"identifier":"+251911000003","password":"Password123!"}' | jqget "data.accessToken")
R=$(curl -s -X POST $API/monitoring -H "Authorization: Bearer $FAT" -H 'Content-Type: application/json' -d "{\"contractId\":\"$CID\",\"type\":\"FIELD_VISIT\",\"farmerId\":\"$FARMER_ID\",\"gpsLat\":8.54,\"gpsLng\":39.27,\"findings\":{\"growth\":\"good\"},\"score\":4.2}")
echo "$R" | grep -q FIELD_VISIT && ok "field agent submits monitoring report" || bad "monitoring" "$R"
R=$(curl -s -X POST $API/grievances -H "Authorization: Bearer $FT" -H 'Content-Type: application/json' -d '{"category":"PAYMENT","description":"Late payment for delivery","raisedByFarmerId":"'"$FARMER_ID"'"}')
GID=$(echo "$R" | jqget "data.id"); GTN=$(echo "$R" | jqget "data.ticketNo")
[ -n "$GID" ] && [ "$GID" != "None" ] && ok "farmer raises grievance $GTN" || bad "grievance create" "$R"
R=$(curl -s -X PATCH $API/grievances/$GID/resolve -H "Authorization: Bearer $(curl -s -X POST $API/auth/register -H 'Content-Type: application/json' -d '{"fullName":"Res Off","phone":"+251911000008","password":"Password123!","role":"RESOLUTION_OFFICER"}' > /dev/null; curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"identifier":"+251911000008","password":"Password123!"}' | jqget "data.accessToken")" -H 'Content-Type: application/json' -d '{"resolutionNote":"Payment scheduled next week"}')
echo "$R" | grep -q RESOLVED && ok "resolution officer resolves grievance" || bad "grievance resolve" "$R"

echo "== 8. ANALYTICS + AUDIT =="
R=$(curl -s $API/analytics/dashboard -H "Authorization: Bearer $MT")
echo "$R" | grep -q contractsByStatus && ok "analytics dashboard: $(echo "$R" | head -c 220)" || bad "dashboard" "$R"
R=$(curl -s $API/analytics/contract-performance -H "Authorization: Bearer $MT")
echo "$R" | grep -q completionRate && ok "contract performance" || bad "performance" "$R"
R=$(curl -s "$API/audit?limit=5" -H "Authorization: Bearer $AT")
echo "$R" | grep -q '"action"' && ok "audit trail query (admin)" || bad "audit" "$R"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$API/audit?limit=5" -H "Authorization: Bearer $CT")
[ "$CODE" = "403" ] && ok "contractor denied audit → 403" || bad "audit RBAC" "got $CODE"
echo "$R" | grep -q '"action"' && su postgres -c "psql -t -A -d dcfms -c 'SELECT action, entity, result FROM \"AuditLog\" ORDER BY \"createdAt\" DESC LIMIT 6'" | sed 's/^/     audit| /'

echo "== 9. VALIDATION + SWAGGER =="
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/contracts -H "Authorization: Bearer $CT" -H 'Content-Type: application/json' -d '{"commodity":"x"}')
[ "$CODE" = "400" ] && ok "DTO validation rejects bad payload → 400" || bad "validation" "got $CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/docs)
[ "$CODE" = "200" ] && ok "Swagger UI at /api/docs" || bad "swagger" "got $CODE"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
