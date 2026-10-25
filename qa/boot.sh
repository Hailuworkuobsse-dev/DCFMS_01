#!/bin/bash
# QA boot (assumes schema migrated): seed + start backend & BFF, verify health
set -u
cd "$(dirname "$(readlink -f "$0")")/.." || exit 1
pkill -9 -f "node dist/mai[n]" 2>/dev/null
pkill -9 -f "loader.m[j]s server" 2>/dev/null
sleep 1
cd backend
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
echo "users: $(su postgres -c 'psql -t -A -d dcfms -c "SELECT COUNT(*) FROM \"User\""') | contracts: $(su postgres -c 'psql -t -A -d dcfms -c "SELECT COUNT(*) FROM \"Contract\""') | audits: $(su postgres -c 'psql -t -A -d dcfms -c "SELECT COUNT(*) FROM \"AuditLog\""')"
