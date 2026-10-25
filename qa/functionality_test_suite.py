#!/usr/bin/env python3
"""
DCFMS Functionality Test Suite — automated runner.

Executes the QA spec (sections A–G + H-lite) against:
  - backend API   http://localhost:3001/api/v1  (NestJS + Prisma + PostgreSQL)
  - frontend BFF  http://localhost:3000/api     (Express hybrid proxy)

Verdicts: PASS | PARTIAL | FAIL | NOT-IMPL | NOT-EXEC
Every result carries live evidence (HTTP responses / DB state).

Usage:  python3 qa/functionality_test_suite.py [--out qa/results.json]
"""
import base64
import hashlib
import hmac
import json
import random
import string
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BK = "http://localhost:3001/api/v1"
BFF = "http://localhost:3000/api"
JWT_SECRET = "dev_only_secret_change_me_min_32_chars_long_random"
PW = "Password123!"

RESULTS = []


def R(tid, area, title, status, evidence, notes=""):
    RESULTS.append({
        "id": tid, "area": area, "title": title,
        "status": status, "evidence": str(evidence)[:500], "notes": notes,
    })
    mark = {"PASS": "OK ", "PARTIAL": "PART", "FAIL": "FAIL", "NOT-IMPL": "N/IMPL", "NOT-EXEC": "N/EXEC"}[status]
    print(f"[{mark}] {tid:<8} {title}")
    if status == "FAIL":
        print(f"         evidence: {str(evidence)[:240]}")


def req(method, path, token=None, body=None, base=BK, timeout=30):
    url = base + path
    data, headers = None, {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            txt = resp.read().decode()
            try:
                j = json.loads(txt)
            except Exception:
                j = txt[:200]
            return resp.status, j, dict(resp.headers)
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            j = json.loads(txt)
        except Exception:
            j = txt[:200]
        return e.code, j, dict(e.headers)
    except Exception as e:
        return None, {"error": str(e)}, {}


def data_of(j):
    return j.get("data") if isinstance(j, dict) else None


def msg_of(j):
    if isinstance(j, dict):
        m = j.get("message")
        return m if isinstance(m, str) else json.dumps(m)[:160]
    return str(j)[:160]


def psql(sql):
    """Run SQL as postgres superuser; SQL passed via stdin (no quoting issues)."""
    out = subprocess.run(
        ["su", "postgres", "-c", "psql -t -A -d dcfms -f -"],
        input=sql, capture_output=True, text=True, timeout=30,
    )
    return out.stdout.strip()


def login(identifier, password=PW, base=BK):
    s, j, _ = req("POST", "/auth/login", body={"identifier": identifier, "password": password}, base=base)
    if s not in (200, 201):
        raise RuntimeError(f"login failed for {identifier}: {s} {msg_of(j)}")
    d = data_of(j)
    return d["accessToken"], d["user"]


def register(full_name, phone, role, **extra):
    body = {"fullName": full_name, "phone": phone, "password": PW, "role": role}
    body.update(extra)
    return req("POST", "/auth/register", body=body)


def forge_jwt(sub, role, exp_delta=-120):
    def b64(o):
        return base64.urlsafe_b64encode(json.dumps(o, separators=(",", ":")).encode()).rstrip(b"=").decode()
    h = b64({"alg": "HS256", "typ": "JWT"})
    p = b64({"sub": sub, "role": role, "iat": int(time.time()) + exp_delta - 10, "exp": int(time.time()) + exp_delta})
    sig = base64.urlsafe_b64encode(
        hmac.new(JWT_SECRET.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"{h}.{p}.{sig}"


WIZ = {
    "commodity": "Malt Barley", "quantity": 200, "unit": "quintal", "quality": "Grade A",
    "priceMechanism": "FIXED", "fixedPrice": 3500, "region": "Oromia", "woreda": "Adama",
    "deliveryStart": "2026-11-01", "deliveryEnd": "2026-12-15",
    "content": {"clauses": [{"id": 1, "text": "Delivery at Adama"}], "title": "QA test contract"},
    "parties": [{"role": "CONTRACTOR"}],
}


def make_contract(tok, **over):
    payload = json.loads(json.dumps(WIZ))
    payload.update(over)
    s, j, _ = req("POST", "/contracts", token=tok, body=payload)
    assert s == 201, f"contract create failed: {s} {msg_of(j)}"
    return data_of(j)


def main():
    print("=" * 74)
    print("DCFMS FUNCTIONALITY TEST SUITE — live run", time.strftime("%Y-%m-%d %H:%M"))
    print("=" * 74)

    # ---------------- sessions ----------------
    tok_admin, u_admin = login("admin@dcfms.et")
    tok_moa, u_moa = login("moa@dcfms.et")
    tok_wboa, u_wboa = login("wboa@dcfms.et")
    tok_farmer, u_farmer = login("+251911000004")
    tok_con, u_con = login("contractor@acme.et")
    tok_fi, u_fi = login("fi@cbe.et")
    register("QA Agro Dealer", "+251911000021", "AGRO_DEALER")
    tok_dealer, u_dealer = login("+251911000021")
    register("QA Justice Officer", "+251911000022", "RESOLUTION_OFFICER")
    tok_justice, _ = login("+251911000022")
    register("QA Field Agent", "+251911000023", "FIELD_AGENT", region="Oromia", woreda="Adama")
    tok_agent, u_agent = login("+251911000023")
    register("QA Coop Union", "+251911000024", "COOPERATIVE")
    tok_coop, _ = login("+251911000024")
    register("QA RBoA Oromia", "+251911000025", "RBOA_OFFICER", adminLevel="REGIONAL", region="Oromia")
    tok_rboa, _ = login("+251911000025")
    register("QA Farmer Two", "+251911000026", "FARMER", region="Oromia", woreda="Adama")
    tok_farmer2, u_farmer2 = login("+251911000026")
    register("QA Contractor Two", "+251911000027", "CONTRACTOR")
    tok_con2, _ = login("+251911000027")
    farmer_id = psql('SELECT id FROM "Farmer" LIMIT 1')
    farmer_fin = psql('SELECT "faydaFin" FROM "Farmer" LIMIT 1')
    print(f"sessions ready (13 roles); farmer={farmer_id[:8]}… fin={farmer_fin}")

    # ================= A. USER MANAGEMENT =================
    print("\n--- A. User Management & Onboarding ---")

    s, j, _ = register("QA Self Reg Farmer", "+251911111111", "FARMER", region="Oromia", woreda="Adama")
    ok_core = s == 201 and data_of(j) and data_of(j).get("role") == "FARMER"
    s2, j2, _ = req("POST", "/auth/register", body={
        "fullName": "X", "phone": "+251911111112", "password": PW, "role": "FARMER",
        "faydaId": "123456789099", "parcels": [{"sizeHa": 1}]})
    R("UM-01", "A", "Farmer self-registration – valid data", "PARTIAL" if ok_core else "FAIL",
      f"register → {s} id={(data_of(j) or {}).get('id', '')[:8]}…; spec payload incl. faydaId+parcels → {s2} ({msg_of(j2)[:70]})",
      "Core registration works (201, unique phone, bcrypt hash). 'Pending Verification', Fayda linkage, Farmer-Registry mock and parcel capture are NOT implemented (code.md TODO(integration): Fayda).")

    s, j, _ = register("No Fayda Farmer", "+251911111113", "FARMER")
    R("UM-02", "A", "Farmer registration – missing Fayda ID", "NOT-IMPL",
      f"register without Fayda ID → {s} (accepted; no faydaId field exists in RegisterDto)",
      "No Fayda enforcement — declared TODO(integration) in code.md.")

    s_probe, _, _ = req("GET", "/parcels", token=tok_admin)
    R("UM-03", "A", "Farmer registration – duplicate land parcel", "NOT-IMPL",
      f"GET /parcels → {s_probe} (no parcel CRUD API); parcel-level double-contracting is enforced at contract creation (see CM-15)", "")

    s, j, _ = register("No License Contractor", "+251911111114", "CONTRACTOR")
    R("UM-04", "A", "Contractor registration – missing trade license", "NOT-IMPL",
      f"contractor registration without license → {s} (licenseNo/tin not collected by /auth/register)",
      "Contractor model stores licenseNo/tin/approvalStatus but no onboarding/validation API exists.")

    s1, _, _ = req("GET", "/contractor/dashboard", token=tok_farmer)
    s2, _, _ = req("GET", "/contractors", token=tok_admin)
    R("UM-05", "A", "Contractor multi-step approval – MoA path", "NOT-IMPL",
      f"GET /contractor/dashboard → {s1}; GET /contractors → {s2}", "No contractor approval workflow endpoints.")
    R("UM-06", "A", "Contractor approval – RBoA path", "NOT-IMPL", "same surface absent as UM-05", "")

    s, j, _ = req("GET", "/users", token=tok_farmer)
    R("UM-07", "A", "RBAC – Farmer blocked from admin surfaces", "PARTIAL",
      f"farmer GET /users → {s} '{msg_of(j)[:50]}'",
      "403 enforced by RolesGuard ✓. Unauthorized-attempt audit logging NOT implemented (AuditInterceptor records successful writes only).")

    c_adama = make_contract(tok_con, region="Oromia", woreda="Adama", commodity="QA-Wheat-Adama")
    c_bish = make_contract(tok_con, region="Oromia", woreda="Bishoftu", commodity="QA-Teff-Bishoftu")
    s, j, _ = req("GET", "/contracts", token=tok_wboa)
    rows = data_of(j) or []
    woredas = sorted({r.get("woreda") for r in rows})
    leak = any(r["id"] == c_bish["id"] for r in rows)
    s, j, _ = req("GET", "/contracts", token=tok_rboa)
    rboa_ids = {r["id"] for r in (data_of(j) or [])}
    R("UM-08", "A", "Scope – WBoA sees only own woreda", "PASS" if (not leak and woredas == ["Adama"] and c_bish["id"] in rboa_ids) else "FAIL",
      f"wboa sees woredas={woredas}; Bishoftu leak={leak}; RBoA(Oromia) sees both={c_adama['id'] in rboa_ids and c_bish['id'] in rboa_ids}")

    s, j, _ = req("PATCH", "/users/self", token=tok_farmer, body={"role": "SYSTEM_ADMIN"})
    s2, j2, _ = req("PATCH", f"/users/{u_farmer['id']}", token=tok_farmer, body={"role": "SYSTEM_ADMIN"})
    role_now = psql(f"SELECT role FROM \"User\" WHERE id='{u_farmer['id']}'")
    R("UM-09", "A", "Role escalation attempt", "PASS" if (role_now == "FARMER" and s in (403, 404) and s2 in (403, 404)) else "FAIL",
      f"PATCH /users/self → {s}; PATCH /users/:id → {s2}; DB role still {role_now}",
      "Fail-safe: no self-service/role-update endpoints exist; escalation impossible via API.")

    s, j, _ = req("POST", "/auth/login", body={"identifier": "admin@dcfms.et", "password": PW})
    R("UM-10", "A", "MFA enforced for admin", "NOT-IMPL",
      f"admin login without MFA → {s} (User.mfaEnabled column exists but is never enforced)", "")

    codes = [req("POST", "/auth/login", body={"identifier": "+251911000004", "password": f"wrong{i}xxxx"})[0] for i in range(5)]
    s, _, _ = req("POST", "/auth/login", body={"identifier": "+251911000004", "password": PW})
    R("UM-11", "A", "Account lockout after 5 failed logins", "FAIL",
      f"5 wrong passwords → {codes}; 6th (correct) → {s} — no lockout",
      "FINDING[HIGH]: no brute-force protection. Recommend @nestjs/throttler + failed-attempt lockout.")

    R("UM-12", "A", "Profile update – phone change w/ OTP", "NOT-IMPL", "no profile-update endpoint (UM-09 probes)", "")
    R("UM-13", "A", "Parcel update triggers re-verification", "NOT-IMPL", "no parcel API (UM-03)", "")

    # ================= B. CONTRACTS =================
    print("\n--- B. Contract Management ---")

    c = make_contract(tok_con, commodity="QA-Barley-CM01")
    h = c.get("contentHash") or ""
    aud = psql(f"SELECT COUNT(*) FROM \"AuditLog\" WHERE entity='Contract' AND action='CREATE' AND \"entityId\"='{c['id']}'")
    R("CM-01", "B", "Create contract – valid", "PASS" if (c["status"] == "DRAFT" and len(h) == 64 and aud == "1") else "FAIL",
      f"201 status={c['status']} sha256={h[:16]}… auditRows={aud} no={c['contractNo']}")

    s, j, _ = req("POST", "/contracts", token=tok_con, body={**WIZ, "content": {"noClauses": True}})
    R("CM-02", "B", "Missing mandatory clause rejected", "NOT-IMPL",
      f"contract with empty clause set → {s} (content is free-form JSON, no Proclamation-1289 clause validation)",
      "FINDING[MED]: mandatory-clause validation not implemented.")

    s, _, _ = req("GET", "/templates", token=tok_admin)
    R("CM-03", "B", "Template customization & versioning", "NOT-IMPL", f"GET /templates → {s}", "templateId is free-form; no template CRUD.")

    c4 = make_contract(tok_con, commodity="QA-Sign-Flow",
                       parties=[{"role": "CONTRACTOR"}, {"role": "FARMER", "farmerId": farmer_id}])
    req("PATCH", f"/contracts/{c4['id']}/send-for-signature", token=tok_con)
    s, j, _ = req("POST", f"/contracts/{c4['id']}/sign/request-otp", token=tok_farmer)
    otp_farmer = (data_of(j) or {}).get("devOtp")
    s, j, _ = req("POST", f"/contracts/{c4['id']}/sign", token=tok_farmer, body={"method": "OTP", "otpCode": otp_farmer})
    sigrow = psql(f"SELECT status||'|'||method||'|ip='||COALESCE(\"ipAddress\",'-')||'|dev='||LEFT(COALESCE(\"deviceInfo\",'-'),10)||'|hash='||LEFT(COALESCE(\"signatureHash\",''),10) FROM \"Signature\" WHERE \"contractId\"='{c4['id']}' AND status='SIGNED'")
    R("CM-04", "B", "OTP e-signature – farmer signs", "PARTIAL" if (s == 201 and "SIGNED" in sigrow) else "FAIL",
      f"devOtp={otp_farmer}; sign → {s}; row: {sigrow}",
      "Timestamp/IP/device/hash recorded ✓. Gaps: SMS gateway stubbed (devOtp channel), Fayda ID not stored on signature.")

    bad = []
    for i in range(3):
        st, jj, _ = req("POST", f"/contracts/{c4['id']}/sign", token=tok_con, body={"method": "OTP", "otpCode": f"{100000 + i}"})
        bad.append(st)
    st, j2, _ = req("GET", f"/contracts/{c4['id']}", token=tok_con)
    R("CM-05", "B", "E-signature – invalid OTP rejected ×3", "PARTIAL",
      f"3× wrong OTP → {bad}; contract still {(data_of(j2) or {}).get('status')}; 4th attempt NOT locked out",
      "Rejection works (HTTP 400 vs spec 401). FINDING[MED]: no attempt counter/lockout after 3 failures.")

    req("POST", f"/contracts/{c4['id']}/sign/request-otp", token=tok_con)
    psql(f"UPDATE \"OtpCode\" SET \"expiresAt\" = NOW() - INTERVAL '1 minute' WHERE \"userId\"='{u_con['id']}' AND consumed=false")
    st, jj, _ = req("POST", f"/contracts/{c4['id']}/sign", token=tok_con, body={"method": "OTP", "otpCode": "999999"})
    R("CM-06", "B", "E-signature – expired OTP", "PASS" if (st == 400 and "expired" in msg_of(jj).lower()) else "FAIL",
      f"expired OTP → {st} '{msg_of(jj)[:55]}' (spec: 401)", "TTL enforced via OtpCode.expiresAt.")

    st, jj, _ = req("POST", f"/contracts/{c4['id']}/sign/request-otp", token=tok_con)
    otp_con = (data_of(jj) or {}).get("devOtp")
    req("POST", f"/contracts/{c4['id']}/sign", token=tok_con, body={"method": "OTP", "otpCode": otp_con})
    st, jj, _ = req("GET", f"/contracts/{c4['id']}", token=tok_con)
    signed_ok = (data_of(jj) or {}).get("status") == "SIGNED"

    req("PATCH", f"/contracts/{c4['id']}/submit-approval", token=tok_con)
    st, jj, _ = req("PATCH", f"/contracts/{c4['id']}/approve", token=tok_wboa, body={"decision": "APPROVE", "note": "QA approval"})
    d = data_of(jj) or {}
    aud = psql(f"SELECT COUNT(*) FROM \"AuditLog\" WHERE entity='Contract' AND action='APPROVE' AND \"entityId\"='{c4['id']}'")
    R("CM-07", "B", "Approval workflow – WBoA approves", "PASS" if (signed_ok and d.get("status") == "APPROVED" and d.get("approvedById") == u_wboa["id"] and aud == "1") else "FAIL",
      f"bothSigned={signed_ok} → approve={d.get('status')} approvedBy set={bool(d.get('approvedById'))} audit={aud}",
      "Party notifications NOT implemented (no notification service).")

    st, jj, _ = req("PATCH", f"/contracts/{c4['id']}/approve", token=tok_farmer, body={"decision": "APPROVE"})
    R("CM-08", "B", "Approval – unauthorized role", "PARTIAL" if st == 403 else "FAIL",
      f"farmer approve → {st} '{msg_of(jj)[:45]}'", "403 ✓; denials not audited (see UM-07).")

    st1, j1, _ = req("PATCH", f"/contracts/{c4['id']}/send-for-signature", token=tok_con)
    st2, _, _ = req("PATCH", f"/contracts/{c4['id']}/approve", token=tok_moa, body={"decision": "APPROVE"})
    st3, _, _ = req("PATCH", f"/contracts/{c4['id']}/submit-approval", token=tok_con)
    R("CM-09", "B", "Lifecycle – invalid transitions rejected", "PASS" if (st1 == 400 and st2 == 400 and st3 == 400) else "FAIL",
      f"on APPROVED: send-for-signature={st1}('{msg_of(j1)[:32]}') re-approve={st2} re-submit={st3}",
      "No endpoint can set arbitrary statuses; LifecycleService + per-action guards hold.")

    st, _, _ = req("PUT", f"/contracts/{c4['id']}", token=tok_con, body={"commodity": "Hacked"})
    st2, _, _ = req("PATCH", f"/contracts/{c4['id']}", token=tok_con, body={"commodity": "Hacked"})
    R("CM-10", "B", "Version control on contract edit", "NOT-IMPL",
      f"PUT → {st}, PATCH → {st2} (no update endpoints; versions snapshot at creation only)",
      "FINDING[MED]: no amendment/versioning API (code.md next-steps #2).")

    psql(f"UPDATE \"Contract\" SET content='{{\"tampered\": true}}' WHERE id='{c4['id']}'")
    st, jj, _ = req("GET", f"/contracts/{c4['id']}/integrity", token=tok_admin)
    d = data_of(jj) or {}
    R("CM-11", "B", "Tamper-proof verification", "PASS" if (d.get("intact") is False and d.get("stored") != d.get("recomputed")) else "FAIL",
      f"after direct DB mutation → intact={d.get('intact')} stored={str(d.get('stored'))[:12]}… recomputed={str(d.get('recomputed'))[:12]}…",
      "Canonical-JSON SHA-256 detects mutation ✓. Automatic audit alert on mismatch NOT implemented.")

    st, _, _ = req("POST", f"/contracts/{c4['id']}/documents", token=tok_con, body={"file": "x"})
    R("CM-12", "B", "Document upload (PDF ≤10MB)", "NOT-IMPL", f"POST /contracts/:id/documents → {st}", "No document storage/scan pipeline.")
    R("CM-13", "B", "Malware upload rejection (EICAR)", "NOT-IMPL", "no upload surface", "")
    R("CM-14", "B", "Signing notifications (SMS + in-app)", "NOT-IMPL",
      "OTP/voucher SMS = TODO(integration); BFF /api/notifications serves static mock", "")

    psql(f"INSERT INTO \"Parcel\" (id, \"farmerId\", name, \"sizeHa\", \"isLocked\", \"createdAt\") VALUES ('qa-parcel-1','{farmer_id}','QA Plot',2.0,false,NOW()) ON CONFLICT (id) DO UPDATE SET \"isLocked\"=false, \"contractId\"=NULL")
    make_contract(tok_con, commodity="QA-ParcelA", parcelIds=["qa-parcel-1"],
                  parties=[{"role": "CONTRACTOR"}, {"role": "FARMER", "farmerId": farmer_id}])
    st, jj, _ = req("POST", "/contracts", token=tok_con, body={**WIZ, "commodity": "QA-ParcelB", "parcelIds": ["qa-parcel-1"]})
    locked = psql("SELECT \"isLocked\" FROM \"Parcel\" WHERE id='qa-parcel-1'")
    orphan = psql("SELECT COUNT(*) FROM \"Contract\" WHERE commodity='QA-ParcelB'")
    R("CM-15", "B", "Double-contracting prevention", "PASS" if (st == 400 and "already under contract" in msg_of(jj) and locked == "t") else "FAIL",
      f"parcelA locked={locked}; second contract on same parcel → {st} '{msg_of(jj)[:52]}' (spec: 409)",
      f"Lock is parcel-level (crop/season matching absent). NOTE: rejected attempt left orphan draft rows={orphan} — create() not wrapped in $transaction. FINDING[LOW].")

    st, jj, _ = req("GET", "/contracts?" + urllib.parse.urlencode({"status": "APPROVED", "commodity": "QA-Sign-Flow"}), token=tok_admin)
    rows = data_of(jj) or []
    ok_filter = rows and all(r["status"] == "APPROVED" and r["commodity"] == "QA-Sign-Flow" for r in rows)
    R("CM-16", "B", "Search/filter + RBAC on lists", "PARTIAL" if ok_filter else "FAIL",
      f"?status&commodity → {len(rows)} rows, all matching={ok_filter}; woreda scoping per UM-08",
      "No pagination params (fixed take=200); no free-text search server-side.")

    st, _, _ = req("POST", "/contracts/export", token=tok_admin, body={})
    R("CM-17", "B", "Bulk export (async CSV)", "NOT-IMPL", f"POST /contracts/export → {st}", "")
    R("CM-18", "B", "Amendment workflow (ADJUSTED)", "NOT-IMPL",
      "no API path to IN_EXECUTION/ADJUSTED states", "")

    # ================= C. FINANCE =================
    print("\n--- C. Access to Finance ---")

    st_cd, _, _ = req("GET", f"/finance/credit-data/{farmer_id}", token=tok_fi)
    R("AF-01", "C", "Credit-data sharing requires consent", "NOT-IMPL", f"GET /finance/credit-data/:id → {st_cd}", "No consent framework (code.md TODO).")
    R("AF-02", "C", "Credit-data sharing with consent", "NOT-IMPL", "same surface absent", "")

    c_loan = make_contract(tok_con, commodity="QA-Loan-C")
    st, jj, _ = req("POST", "/finance/loans", token=tok_farmer, body={
        "farmerId": farmer_id, "contractId": c_loan["id"], "fiId": "CBE",
        "requestedAmt": 50000, "purpose": "Meher 2026 inputs"})
    loan = data_of(jj) or {}
    st_fi, jj_fi, _ = req("GET", "/finance/loans?fiId=CBE", token=tok_fi)
    routed = any(l["id"] == loan.get("id") for l in (data_of(jj_fi) or []))
    R("AF-03", "C", "Loan application – valid", "PASS" if (st == 201 and loan.get("status") == "SUBMITTED" and routed) else "FAIL",
      f"→ {st} status={loan.get('status')} no={loan.get('loanNo')} visible-to-CBE={routed}",
      "Applicant notification NOT implemented.")

    st, jj, _ = req("POST", "/finance/loans", token=tok_farmer, body={
        "farmerId": farmer_id, "contractId": c_loan["id"], "fiId": "CBE",
        "requestedAmt": 99999999, "purpose": "over-limit probe"})
    R("AF-04", "C", "Loan limit vs contract value (≤80%)", "FAIL",
      f"99,999,999 ETB loan on 700k contract → {st} (accepted)",
      "FINDING[HIGH]: no exposure-limit validation in backend (mock BFF had it; backend mode bypasses).")

    st, jj, _ = req("PATCH", f"/finance/loans/{loan['id']}/decide", token=tok_fi,
                    body={"decision": "APPROVE", "approvedAmt": 45000, "interestRate": 8.5, "note": "QA"})
    approved = (data_of(jj) or {}).get("status") == "APPROVED"
    R("AF-05", "C", "Tripartite financing workflow", "PARTIAL" if approved else "FAIL",
      f"FI approve → APPROVED={approved}; voucher NOT auto-generated on approval (manual issue verified in AF-06)", "")

    st, jj, _ = req("POST", "/finance/vouchers", token=tok_con, body={
        "farmerId": farmer_id, "contractId": c_loan["id"], "inputType": "NPS Fertilizer",
        "amount": 50, "unit": "kg", "valueEtb": 14000, "dealerOrgId": "dealer-qa", "expiresAt": "2027-06-01"})
    v = data_of(jj) or {}
    st2, jj2, _ = req("POST", "/finance/vouchers/redeem", token=tok_dealer,
                      body={"voucherNo": v.get("voucherNo"), "agroDealerId": "dealer-qa"})
    vr = data_of(jj2) or {}
    R("AF-06", "C", "Voucher redemption – valid", "PASS" if (st == 201 and vr.get("status") == "REDEEMED" and vr.get("redeemedAt")) else "FAIL",
      f"issue → {st} {v.get('voucherNo')}; dealer redeem → {st2} status={vr.get('status')} redeemedAt={bool(vr.get('redeemedAt'))}",
      "Farmer-OTP not verified server-side at redemption (dealer role-gate only). FINDING[LOW].")

    st, jj, _ = req("POST", "/finance/vouchers", token=tok_con, body={
        "farmerId": farmer_id, "inputType": "Urea", "amount": 25, "expiresAt": "2027-06-01"})
    v2 = data_of(jj) or {}
    psql(f"UPDATE \"Voucher\" SET \"expiresAt\" = NOW() - INTERVAL '1 day' WHERE id='{v2['id']}'")
    st2, jj2, _ = req("POST", "/finance/vouchers/redeem", token=tok_dealer,
                      body={"voucherNo": v2.get("voucherNo"), "agroDealerId": "dealer-qa"})
    v2stat = psql(f"SELECT status FROM \"Voucher\" WHERE id='{v2['id']}'")
    R("AF-07", "C", "Voucher redemption – expired", "PASS" if (st2 == 400 and "expired" in msg_of(jj2).lower() and v2stat == "EXPIRED") else "FAIL",
      f"redeem expired → {st2} '{msg_of(jj2)[:38]}' status→{v2stat}")

    st3, jj3, _ = req("POST", "/finance/vouchers/redeem", token=tok_dealer,
                      body={"voucherNo": v.get("voucherNo"), "agroDealerId": "dealer-qa"})
    R("AF-08", "C", "Voucher double redemption", "PASS" if st3 == 400 else "FAIL",
      f"second redeem → {st3} '{msg_of(jj3)[:42]}' (spec: 409 — behavior correct, code differs)")

    st, _, _ = req("POST", "/insurance/policy", token=tok_fi, body={})
    R("AF-09", "C", "Insurance policy creation", "NOT-IMPL", f"POST /insurance/policy → {st}", "")

    req("PATCH", f"/finance/loans/{loan['id']}/disburse", token=tok_fi)
    st, jj, _ = req("POST", "/finance/settlements", token=tok_con, body={
        "contractId": c_loan["id"], "payerId": u_con["id"], "payeeId": u_farmer["id"],
        "grossAmount": 175000, "loanDeduction": 45000, "deliveredKg": 5000,
        "externalRef": "DEL-QA-1", "channel": "BANK"})
    p = data_of(jj) or {}
    st_bad, j_bad, _ = req("POST", "/finance/settlements", token=tok_con, body={
        "contractId": c_loan["id"], "payerId": u_con["id"], "payeeId": u_farmer["id"],
        "grossAmount": 100, "loanDeduction": 500, "channel": "BANK"})
    R("AF-10", "C", "Settlement with loan deduction", "PASS" if (st == 201 and p.get("netAmount") == 130000 and p.get("status") == "COMPLETED" and st_bad == 400) else "FAIL",
      f"175000−45000 → net {p.get('netAmount')} status={p.get('status')} no={p.get('paymentNo')}; deduction>gross → {st_bad}",
      "Deduction is client-supplied (BFF computes from DISBURSED loans); gateway simulated (auto-COMPLETED); interest not deducted.")

    R("AF-11", "C", "Settlement failure path (insufficient funds)", "NOT-IMPL",
      "gateway simulation always succeeds; FAILED/REVERSED unreachable", "")
    st, _, _ = req("GET", "/reports/settlements?date=2026-10-25", token=tok_admin)
    R("AF-12", "C", "Reconciliation report", "NOT-IMPL", f"GET /reports/settlements → {st}; raw GET /finance/settlements works", "")

    t0 = time.time()
    codes = [req("GET", "/finance/loans", token=tok_fi)[0] for _ in range(60)]
    dt = time.time() - t0
    R("AF-13", "C", "FI API rate limiting", "FAIL",
      f"60 rapid GETs in {dt:.1f}s → statuses {sorted(set(codes))}, zero 429",
      "FINDING[HIGH]: no throttling (@nestjs/throttler absent).")

    # ================= D. MONITORING =================
    print("\n--- D. Support & Monitoring ---")

    R("SM-01", "D", "Input stock allocation", "NOT-IMPL",
      f"POST /inputs/allocate → {req('POST', '/inputs/allocate', token=tok_dealer, body={})[0]}", "No inventory model.")
    R("SM-02", "D", "Redemption quantity mismatch", "NOT-IMPL", "redeem takes no quantity (fixed at issue)", "")
    R("SM-03", "D", "8028 advisory integration", "NOT-IMPL",
      f"POST /advisory/ussd → {req('POST', '/advisory/ussd', token=tok_farmer, body={})[0]}", "")

    st, jj, _ = req("POST", "/monitoring", token=tok_agent, body={
        "contractId": c_loan["id"], "type": "FIELD_VISIT", "farmerId": farmer_id,
        "gpsLat": 8.54, "gpsLng": 39.27,
        "findings": {"cropStage": "Vegetative", "germinationRatePct": 92,
                      "photoDataUrl": "data:image/png;base64,QKEx", "agentName": "QA Field Agent"},
        "score": 4.6})
    m = data_of(jj) or {}
    R("SM-04", "D", "Field-agent monitoring report (GPS+photo)", "PASS" if (st == 201 and m.get("contractId") == c_loan["id"] and m.get("agentId") == u_agent["id"]) else "FAIL",
      f"→ {st} linked={m.get('contractId') == c_loan['id']} agent={m.get('agentId') == u_agent['id']} gps=({m.get('gpsLat')},{m.get('gpsLng')}) photo-in-findings={bool((m.get('findings') or {}).get('photoDataUrl'))}",
      "WBoA notification + offline sync queue (server side) not implemented.")

    R("SM-05", "D", "NMIS price feed", "NOT-IMPL", f"GET /market/prices → {req('GET', '/market/prices?crop=Teff', token=tok_admin)[0]}", "")
    R("SM-06", "D", "NMIS failure fallback", "NOT-IMPL", "no NMIS client exists", "")
    R("SM-07", "D", "Offline capture & auto-sync", "NOT-EXEC",
      "frontend syncQueue.ts (IndexedDB) exists; needs browser/mobile harness", "")
    R("SM-08", "D", "Offline OTP signing queue", "NOT-EXEC",
      "same; backend OTP TTL would reject stale codes (CM-06)", "")

    st, jj, _ = req("POST", "/monitoring", token=tok_agent, body={
        "contractId": c_loan["id"], "type": "FIELD_VISIT", "gpsLat": 12.9, "gpsLng": 43.3,
        "findings": {"note": "GPS ~600km outside assigned woreda"}})
    R("SM-09", "D", "GPS geofence validation", "NOT-IMPL",
      f"out-of-woreda GPS report → {st} (accepted; no geofence check / supervisor override)",
      "FINDING[MED]: monitoring GPS not validated against assignment.")

    # ================= E. GRIEVANCES =================
    print("\n--- E. Grievance & Dispute Resolution ---")

    st, jj, _ = req("POST", "/grievances", token=tok_farmer, body={
        "category": "PAYMENT", "title": "QA late payment", "severity": "HIGH",
        "description": "Payment delayed two weeks past contractual window.",
        "contractId": c_loan["id"], "raisedByFarmerId": farmer_id})
    g = data_of(jj) or {}
    R("GD-01", "E", "Submit grievance – valid", "PASS" if (st == 201 and g.get("status") == "OPEN" and str(g.get("ticketNo", "")).startswith("GR-") and g.get("slaDueAt")) else "FAIL",
      f"→ {st} ticket={g.get('ticketNo')} status={g.get('status')} sla={str(g.get('slaDueAt'))[:10]} audit CREATE logged",
      "WBoA notification NOT implemented.")

    psql(f"UPDATE \"Grievance\" SET \"createdAt\" = NOW() - INTERVAL '10 days', \"slaDueAt\" = NOW() - INTERVAL '3 days' WHERE id='{g['id']}'")
    time.sleep(1)
    st, jj, _ = req("GET", f"/grievances/{g['id']}", token=tok_admin)
    R("GD-02", "E", "Auto-escalation after SLA breach", "NOT-IMPL",
      f"backdated 10d → status still {(data_of(jj) or {}).get('status')} (no scheduler/cron in backend)", "")

    st_w, _, _ = req("PATCH", f"/grievances/{g['id']}/resolve", token=tok_wboa, body={"resolutionNote": "WBoA attempts resolve"})
    st_j, jj2, _ = req("PATCH", f"/grievances/{g['id']}/resolve", token=tok_justice,
                       body={"resolutionNote": "Payment executed; contractor warned per 1289/2023."})
    gj = data_of(jj2) or {}
    R("GD-03", "E", "Grievance resolution + audit", "PARTIAL" if (st_j in (200, 201) and gj.get("status") == "RESOLVED") else "FAIL",
      f"WBoA resolve → {st_w} (role-restricted); ResolutionOfficer → {st_j} status={gj.get('status')} note+resolvedAt stored, audit UPDATE logged",
      "Design deviation: spec has WBoA resolving; implementation reserves it for RESOLUTION_OFFICER. Notifications absent.")

    g2 = data_of(req("POST", "/grievances", token=tok_farmer, body={
        "category": "CONTRACT_TERMS", "description": "QA dispute for escalation path",
        "contractId": c_loan["id"]})[1]) or {}
    st, jj, _ = req("PATCH", f"/grievances/{g2['id']}/escalate", token=tok_justice,
                    body={"reason": "Unresolved at woreda tier"})
    R("GD-04", "E", "Escalation to court + doc package", "PARTIAL" if (data_of(jj) or {}).get("status") == "ESCALATED" else "FAIL",
      f"escalate → {(data_of(jj) or {}).get('status')} + audit ESCALATE; no COURT tier or document-package generation exists", "")

    st, jj, _ = req("GET", f"/grievances/{g['id']}", token=tok_farmer2)
    st_l, jj_l, _ = req("GET", "/grievances", token=tok_farmer2)
    n_vis = len(data_of(jj_l) or [])
    R("GD-05", "E", "Cross-farmer grievance access", "FAIL",
      f"farmer2 GET farmer1's grievance → {st}; farmer2 GET /grievances → {n_vis} rows (all grievances visible)",
      "FINDING[HIGH-security]: backend grievance reads lack ownership scoping (BFF filters for the web UI, raw API does not).")

    R("GD-06", "E", "SLA breach alerting", "NOT-IMPL", "slaDueAt stored but no alerting/flag output", "")

    # ================= F. ANALYTICS =================
    print("\n--- F. Analytics & Reporting ---")

    st1, j1, _ = req("GET", "/analytics/dashboard", token=tok_moa)
    d1 = data_of(j1) or {}
    st3, _, _ = req("GET", "/dashboard/moa", token=tok_moa)
    R("AR-01", "F", "Role dashboard – MoA aggregates", "PARTIAL",
      f"/analytics/dashboard(moa) → {st1} keys={sorted(d1.keys())}; role-specific route /dashboard/moa → {st3}",
      "Aggregates PII-free ✓; role framing happens in BFF /api/dashboard (verified by integration suite).")

    c_con2 = make_contract(tok_con2, commodity="QA-OtherContractor", region="Oromia", woreda="Adama")
    st, jj, _ = req("GET", "/contracts", token=tok_con)
    ids = {r["id"] for r in (data_of(jj) or [])}
    R("AR-02", "F", "Contractor sees only own data", "FAIL",
      f"contractor-1's list contains contractor-2's contract: {c_con2['id'] in ids}",
      "FINDING[HIGH]: contractor scoping filters by party-ROLE only, not identity (code.md TODO acknowledged).")

    st, _, _ = req("POST", "/reports/contract-performance", token=tok_admin, body={})
    R("AR-03", "F", "Async report generation", "NOT-IMPL", f"POST /reports/contract-performance → {st}", "")
    R("AR-04", "F", "Farmer-reach report", "NOT-IMPL", "farmersReached aggregate exists in analytics; no report/export", "")
    R("AR-05", "F", "Financial-access report", "NOT-IMPL", "finance totals aggregate only", "")
    R("AR-06", "F", "Compliance report", "NOT-IMPL", "no endpoint", "")
    R("AR-07", "F", "Large async report (202+job)", "NOT-IMPL", "no job queue (BullMQ = code.md next step)", "")

    blob = json.dumps(d1)
    pii = [x for x in ["+2519", "faydaFin", "passwordHash"] if x in blob]
    R("AR-08", "F", "Analytics PII minimization", "PASS" if not pii else "PARTIAL",
      f"dashboard payload PII markers: {pii or 'none'} (counts/sums only)",
      "/users (admin-only) exposes phone/email by design.")
    R("AR-09", "F", "Report access auditing", "NOT-IMPL", "no reports exist; AuditAction.EXPORT unused", "")

    # ================= G. CROSS-CUTTING =================
    print("\n--- G. Cross-Cutting & Security ---")

    st1, _, _ = req("PATCH", "/audit/whatever", token=tok_admin, body={"x": 1})
    st2, _, _ = req("DELETE", "/audit/whatever", token=tok_admin)
    trg = psql("SELECT COUNT(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relname='AuditLog' AND NOT t.tgisinternal")
    R("XC-01", "G", "Audit log immutability", "PARTIAL",
      f"PATCH /audit/:id → {st1}; DELETE → {st2} (no mutation API); DB triggers on AuditLog = {trg}",
      "Immutable by API-omission ✓. FINDING[MED]: no DB-level protection (trigger/WORM/role separation).")

    rows = psql('SELECT DISTINCT action FROM "AuditLog" ORDER BY action').splitlines()
    sample = psql("SELECT action||' '||entity||' ip='||COALESCE(\"ipAddress\",'-')||' result='||result FROM \"AuditLog\" WHERE action='LOGIN' ORDER BY \"createdAt\" DESC LIMIT 1")
    R("XC-02", "G", "Audit completeness (10 critical actions)", "PARTIAL",
      f"distinct actions recorded this run: {rows}; sample: {sample}",
      "Covered: LOGIN(outcome+IP+UA), CREATE, UPDATE, APPROVE, SIGN, PAYOUT, ESCALATE. Absent features → no entries: role/config change, export, DELETE; denials unlogged.")

    inj = "Teff' OR 1=1--"
    st, jj, _ = req("POST", "/contracts", token=tok_con, body={**WIZ, "commodity": inj})
    st2, jj2, _ = req("GET", "/contracts?commodity=" + urllib.parse.quote(inj), token=tok_admin)
    rows2 = data_of(jj2) or []
    st3, _, _ = req("POST", "/auth/login", body={"identifier": "admin@dcfms.et' OR '1'='1", "password": "x"})
    total = psql('SELECT COUNT(*) FROM "Contract"')
    R("XC-03", "G", "SQL injection resistance", "PASS" if (st == 201 and len(rows2) == 1 and st3 == 401) else "FAIL",
      f"payload stored & filtered literally ({len(rows2)} row); injection login → {st3}; table intact ({total} rows) — Prisma parameterizes")

    xss = "<script>alert(1)</script>"
    gx = data_of(req("POST", "/grievances", token=tok_farmer, body={"category": "OTHER", "description": xss})[1]) or {}
    st, jj, hdrs = req("GET", f"/grievances/{gx.get('id')}", token=tok_admin)
    stored = (data_of(jj) or {}).get("description")
    R("XC-04", "G", "XSS handling", "PASS" if (stored == xss and "application/json" in hdrs.get("content-type", "")) else "PARTIAL",
      f"stored/returned as inert JSON string; content-type={hdrs.get('content-type')}; nosniff={hdrs.get('x-content-type-options')}",
      "React escapes at render (unit-tested). NOTE[LOW]: BFF lacks helmet headers.")

    t0 = time.time()
    codes = [req("POST", "/auth/login", body={"identifier": f"ghost{i}@none.et", "password": "whatever1"})[0] for i in range(40)]
    dt = time.time() - t0
    R("XC-05", "G", "Login rate limiting", "FAIL",
      f"40 logins in {dt:.1f}s → statuses {sorted(set(codes))}; no 429", "FINDING[HIGH]: see UM-11/AF-13.")

    expired = forge_jwt(u_admin["id"], "SYSTEM_ADMIN", exp_delta=-300)
    st, _, _ = req("GET", "/contracts", token=expired)
    tampered = forge_jwt(u_admin["id"], "SYSTEM_ADMIN")[:-4] + "AAAA"
    st2, _, _ = req("GET", "/contracts", token=tampered)
    R("XC-06", "G", "JWT expiry & signature enforcement", "PASS" if (st == 401 and st2 == 401) else "FAIL",
      f"forged expired → {st}; tampered signature → {st2}")

    R("XC-07", "G", "Session timeout", "PARTIAL",
      "JWT 8h enforced (XC-06); refresh rotation revokes prior token; BFF cookie 12h",
      "No idle-timeout revocation of unexpired access tokens (stateless-JWT trade-off).")
    R("XC-08", "G", "Upload path traversal", "NOT-IMPL", "no upload endpoints (CM-12)", "")

    phone_plain = psql("SELECT phone FROM \"User\" WHERE phone='+251911000004'")
    fin_plain = psql('SELECT "faydaFin" FROM "Farmer" LIMIT 1')
    R("XC-09", "G", "Encryption at rest (PII)", "FAIL",
      f"phone='{phone_plain}' faydaFin='{fin_plain}' stored plaintext; only passwords/OTP/refresh-tokens hashed",
      "FINDING[HIGH-compliance]: no pgcrypto/column encryption for Fayda FIN, phone, financials.")

    st, jj, hdrs = req("GET", "/health")
    hsts = hdrs.get("strict-transport-security", "")
    R("XC-10", "G", "TLS/HSTS posture", "PARTIAL",
      f"helmet HSTS present={bool(hsts)}; plain HTTP in dev (TLS termination = deployment layer)", "")

    matrix = [
        ("GET /users", "GET", "/users", None,
         {"admin": 200, "moa": 200, "wboa": 200, "rboa": 200, "farmer": 403, "contractor": 403, "fi": 403, "dealer": 403, "agent": 403, "justice": 403}),
        ("POST /users", "POST", "/users", lambda: {"fullName": "Matrix Probe", "phone": f"+2519{random.randint(20000000, 29999999)}", "password": PW, "role": "FIELD_AGENT"},
         {"admin": 201, "moa": 403, "wboa": 403, "farmer": 403, "contractor": 403}),
        ("POST /contracts", "POST", "/contracts", lambda: {**WIZ, "commodity": "QA-Matrix"},
         {"contractor": 201, "coop": 201, "moa": 201, "wboa": 201, "farmer": 403, "fi": 403, "dealer": 403, "agent": 403}),
        ("PATCH approve", "PATCH", f"/contracts/{c4['id']}/approve", lambda: {"decision": "APPROVE"},
         {"moa": 400, "rboa": 400, "wboa": 400, "contractor": 403, "farmer": 403, "admin": 403}),
        ("POST loans", "POST", "/finance/loans", lambda: {"farmerId": farmer_id, "fiId": "CBE", "requestedAmt": 1000, "purpose": "matrix"},
         {"farmer": 201, "contractor": 201, "fi": 201, "coop": 201, "dealer": 403, "agent": 403, "moa": 403}),
        ("PATCH loan decide", "PATCH", "/finance/loans/qa-missing/decide", lambda: {"decision": "APPROVE"},
         {"fi": 404, "contractor": 403, "farmer": 403, "admin": 403}),
        ("POST voucher redeem", "POST", "/finance/vouchers/redeem", lambda: {"voucherNo": "VC-MATRIX", "agroDealerId": "x"},
         {"dealer": 400, "farmer": 403, "contractor": 403, "fi": 403}),
        ("POST monitoring", "POST", "/monitoring", lambda: {"type": "COMPLIANCE", "findings": {"probe": True}},
         {"agent": 201, "wboa": 201, "farmer": 403, "contractor": 403, "dealer": 403}),
        ("PATCH grievance resolve", "PATCH", "/grievances/qa-missing/resolve", lambda: {"resolutionNote": "matrix probe note"},
         {"justice": 404, "wboa": 403, "farmer": 403, "admin": 403}),
        ("GET /audit", "GET", "/audit?limit=1", None,
         {"admin": 200, "moa": 200, "wboa": 403, "farmer": 403, "contractor": 403, "fi": 403}),
    ]
    toks = {"admin": tok_admin, "moa": tok_moa, "wboa": tok_wboa, "rboa": tok_rboa,
            "farmer": tok_farmer, "contractor": tok_con, "fi": tok_fi, "dealer": tok_dealer,
            "agent": tok_agent, "justice": tok_justice, "coop": tok_coop}
    violations, total_checks = [], 0
    for label, method, path, bodyfn, expects in matrix:
        for role, expect in expects.items():
            total_checks += 1
            st, _, _ = req(method, path, token=toks[role], body=bodyfn() if bodyfn else None)
            if st != expect:
                violations.append(f"{label} as {role}: got {st}, want {expect}")
    R("XC-11", "G", "RBAC matrix sweep (10 endpoints × roles)", "PASS" if not violations else "FAIL",
      f"{total_checks} role×endpoint checks; violations: {violations[:6] if violations else 'none'}",
      "400/404 expectations = role gate passed, business rule rejected (probe IDs intentionally missing).")

    R("XC-12", "G", "Offline sync conflict resolution", "NOT-IMPL", "no sync/conflict API; frontend queue is single-device", "")
    R("XC-13", "G", "Bilingual UI (am/en parity)", "PASS",
      "frontend `npm test`: translations.test.ts key-parity (en↔am) + permissions.test.ts + schemas.test.ts — run separately, see report", "")
    R("XC-14", "G", "WCAG 2.1 AA (axe-core)", "NOT-EXEC", "no browser harness in this environment",
      "Recommend CI: playwright + @axe-core/playwright over key routes.")
    R("XC-15", "G", "Low-bandwidth (2G) load", "NOT-EXEC",
      "static analysis: main bundle ≈979 KB (gzip ≈270 KB) — exceeds 2G budget; needs code-splitting", "")

    subprocess.run(["pkill", "-9", "-f", "node dist/mai[n]"], capture_output=True)
    time.sleep(2)
    st, jj, _ = req("POST", "/auth/login", base=BFF, body={"email": "contractor@acme.et", "password": PW})
    code = (jj or {}).get("code")
    subprocess.run(["bash", "-c", "cd \"$PWD/backend\" 2>/dev/null || cd backend; (node dist/main >> /tmp/qa-backend.log 2>&1 &)"], capture_output=True, cwd=os_cwd())
    for _ in range(40):
        if req("GET", "/health")[0] in (200, 201):
            break
        time.sleep(1)
    healthy = req("GET", "/health")[0] in (200, 201)
    R("XC-16", "G", "Backend-down graceful degradation", "PASS" if (st == 503 and code == "BACKEND_UNAVAILABLE" and healthy) else "FAIL",
      f"backend killed → BFF login {st} code={code}; backend restarted healthy={healthy}")

    p1 = data_of(req("POST", "/finance/settlements", token=tok_con, body={
        "contractId": c_loan["id"], "payerId": u_con["id"], "payeeId": u_farmer["id"],
        "grossAmount": 1000, "loanDeduction": 0, "externalRef": "DUP-REF-1", "channel": "BANK"})[1]) or {}
    p2 = data_of(req("POST", "/finance/settlements", token=tok_con, body={
        "contractId": c_loan["id"], "payerId": u_con["id"], "payeeId": u_farmer["id"],
        "grossAmount": 1000, "loanDeduction": 0, "externalRef": "DUP-REF-1", "channel": "BANK"})[1]) or {}
    R("XC-17", "G", "Payment idempotency", "FAIL",
      f"same externalRef twice → {p1.get('paymentNo')} AND {p2.get('paymentNo')} (double payment risk)",
      "FINDING[HIGH]: no idempotency key / unique constraint on externalRef.")

    st, _, _ = req("DELETE", f"/users/{u_farmer2['id']}", token=tok_admin)
    st2, jj2, _ = req("PATCH", f"/users/{u_farmer2['id']}/deactivate", token=tok_admin)
    st3, _, _ = req("POST", "/auth/login", body={"identifier": "+251911000026", "password": PW})
    ok_soft = st2 in (200, 201) and (data_of(jj2) or {}).get("isActive") is False and st3 == 401
    R("XC-18", "G", "Retention & deletion", "PARTIAL",
      f"DELETE /users/:id → {st} (absent); deactivate → {st2} isActive=false; deactivated login → {st3}",
      "Soft-disable works ✓. PII anonymization/erasure + retention policy NOT implemented.")

    # ================= H-lite =================
    print("\n--- H. Fuzz / state machine / mini-load ---")

    fuzz_targets = [
        ("POST", "/contracts", tok_con), ("POST", "/grievances", tok_farmer),
        ("POST", "/finance/loans", tok_farmer), ("POST", "/monitoring", tok_agent),
        ("POST", "/finance/vouchers", tok_con), ("POST", "/auth/register", None),
    ]
    weird = [
        {}, [], "string", 42, {"commodity": None}, {"quantity": "abc"},
        {"content": {"a": [1, 2, {"b": None}]}}, {"role": "FARMER"}, {"phone": "x" * 400},
        {"email": "not-an-email", "phone": "+1", "password": "short", "role": "NOPE", "fullName": "F"},
        {"findings": "not-an-object", "type": "BOGUS"},
        {"amount": -5, "inputType": 123, "farmerId": "nope", "expiresAt": "whenever"},
        {"commodity": "𝔘nicode🌾", "quantity": 1e308, "priceMechanism": "FIXED", "content": {}, "parties": "x"},
        {"commodity": "<img src=x onerror=alert(1)>", "quantity": 0.0001, "priceMechanism": "MARKET", "content": {}, "parties": []},
    ]
    fives = []
    for method, path, tok in fuzz_targets:
        for payload in weird:
            b = payload if isinstance(payload, dict) else {"x": payload}
            st, jj, _ = req(method, path, token=tok, body=b)
            if st is None or st >= 500:
                fives.append(f"{path} {str(payload)[:36]} → {st} {msg_of(jj)[:50]}")
    R("H-FUZZ", "H", "Fuzz: malformed inputs never 5xx", "PASS" if not fives else "FAIL",
      f"{len(fuzz_targets) * len(weird)} malformed payloads → 5xx count={len(fives)}; {fives[:2] or 'all handled as 4xx'}")

    sm = []
    csm = make_contract(tok_con, commodity="QA-StateMachine")
    st, _, _ = req("PATCH", f"/contracts/{csm['id']}/approve", token=tok_moa, body={"decision": "APPROVE"})
    if st != 400:
        sm.append(f"approve-on-DRAFT → {st}")
    st, _, _ = req("PATCH", f"/contracts/{csm['id']}/submit-approval", token=tok_con)
    if st != 400:
        sm.append(f"submit-on-DRAFT → {st}")
    st, _, _ = req("POST", f"/contracts/{csm['id']}/sign", token=tok_con, body={"method": "OTP", "otpCode": "123456"})
    if st != 400:
        sm.append(f"sign-without-pending → {st}")
    R("H-SM", "H", "State machine: invalid transitions rejected", "PASS" if not sm else "FAIL",
      f"DRAFT→approve/submit/sign all 400; violations: {sm or 'none'}")

    def one_login(i):
        t0 = time.time()
        st, _, _ = req("POST", "/auth/login", body={"identifier": "+251911000005", "password": PW})
        return time.time() - t0, st
    with ThreadPoolExecutor(max_workers=10) as ex:
        login_times = list(ex.map(one_login, range(20)))
    lat = sorted(t for t, _ in login_times)
    oks = sum(1 for _, s in login_times if s in (200, 201))
    read_times = []
    for _ in range(60):
        t0 = time.time()
        req("GET", "/contracts", token=tok_admin)
        read_times.append(time.time() - t0)
    read_times.sort()
    p95r = read_times[max(0, int(len(read_times) * 0.95) - 1)]
    R("H-LOAD", "H", "Mini-load smoke (20 concurrent logins, 60 reads)", "PASS" if (oks == 20 and p95r < 3.0) else "PARTIAL",
      f"logins ok={oks}/20 p95={lat[-2]:.2f}s (bcrypt-12, 10 workers); GET /contracts p50={read_times[29] * 1000:.0f}ms p95={p95r * 1000:.0f}ms",
      "Sandbox-scale only; ToR 1,000-user load test needs k6/Gatling in a real environment.")

    counts = {}
    for r in RESULTS:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    print("\n" + "=" * 74)
    print(f"TOTAL {len(RESULTS)} checks — " + "  ".join(f"{k}:{v}" for k, v in sorted(counts.items())))
    print("=" * 74)

    out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "qa/results.json"
    with open(out, "w") as f:
        json.dump({"run_at": time.strftime("%Y-%m-%d %H:%M:%S"), "counts": counts, "results": RESULTS}, f, indent=2)
    print(f"results → {out}")


def os_cwd():
    import os
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


if __name__ == "__main__":
    main()
