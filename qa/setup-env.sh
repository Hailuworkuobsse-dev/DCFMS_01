#!/bin/bash
# QA environment setup: clean DB, fresh migrate+seed, boot backend (:3001) + BFF (:3000)
set -u
cd "$(dirname "$(readlink -f "$0")")/.." || exit 1
[ -d backend ] || { echo "FATAL: run from repo (backend/ not found)"; exit 1; }

pg_ctlcluster 15 main start 2>/dev/null || true
sleep 1
# kill previous servers (patterns bracketed to avoid self-match)
pkill -9 -f "node dist/mai[n]" 2>/dev/null
pkill -9 -f "loader.m[j]s server" 2>/dev/null
sleep 1

su postgres -c "psql -q -d dcfms -c 'DROP SCHEMA public CASCADE;' -c 'CREATE SCHEMA public AUTHORIZATION dcfms;'" || exit 1
echo "schema dropped/recreated"

cd backend
npx prisma migrate deploy 2>&1 | tail -1
npx prisma db seed 2>&1 | tail -1

(node dist/main > /tmp/qa-backend.log 2>&1 &)
cd ../frontend
(NODE_ENV=development PORT=3000 npx tsx server.ts > /tmp/qa-bff.log 2>&1 &)

for i in $(seq 1 90); do
  curl -s -m 2 -o /dev/null http://localhost:3001/api/v1/health && curl -s -m 2 -o /dev/null http://localhost:3000/api/auth/me && break
  sleep 1
done
echo "backend health: $(curl -s -m 3 http://localhost:3001/api/v1/health | head -c 80)"
echo "bff mode: $(grep -o 'Backend integration.*' /tmp/qa-bff.log | head -1)"
echo "users seeded: $(su postgres -c 'psql -t -A -d dcfms -c "SELECT COUNT(*) FROM \"User\""')"
echo "contracts seeded: $(su postgres -c 'psql -t -A -d dcfms -c "SELECT COUNT(*) FROM \"Contract\""')"
