#!/usr/bin/env bash
# Démarre Prismine pour de vrai sur une base locale jetable, sans jamais toucher à la base de l'équipe :
# Postgres + vraies migrations + PostgREST (quality/docker-compose.yml), proxy /rest/v1, puis le backend Java.
#   bash quality/prismine-local.sh           # le backend écoute sur http://localhost:8080
# Le script affiche ensuite la commande qui lance le front. Connexion et Realtime ne sont pas disponibles : on joue en
# invité. Le backend est lancé hors de backend/, donc sans lire backend/.env et ses clés réelles.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
secret='tiki-quality-local-jwt-secret-0123456789'

jwt() {
  node -e "
    const crypto = require('node:crypto')
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const body = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ role: process.argv[1], exp: 4102444800 })
    console.log(body + '.' + crypto.createHmac('sha256', process.argv[2]).update(body).digest('base64url'))
  " "$1" "$secret"
}

docker compose -f "$root/quality/docker-compose.yml" up -d --wait db
(cd "$root/frontend" && npm run -s quality:seed)
docker compose -f "$root/quality/docker-compose.yml" up -d rest

node "$root/quality/rest-proxy.mjs" &
proxy=$!
trap 'kill "$proxy" 2>/dev/null || true' EXIT

jar="$(ls "$root"/backend/target/*.jar 2>/dev/null | grep -v original | head -n 1 || true)"
if [ -z "$jar" ]; then
  mvn -B -q -f "$root/backend/pom.xml" package -DskipTests -Djacoco.skip=true
  jar="$(ls "$root"/backend/target/*.jar | grep -v original | head -n 1)"
fi

cat <<EOF

Pour le front, dans un autre terminal :
  cd frontend
  VITE_SUPABASE_URL=http://localhost:54331 VITE_SUPABASE_ANON_KEY=$(jwt anon) npm run dev
Puis ouvre http://localhost:5173/games/prismine

EOF

cd "$(mktemp -d)"
GOOGLE_CLIENT_ID=local-client-id \
GOOGLE_CLIENT_SECRET=local-client-secret \
SUPABASE_URL=http://localhost:54331 \
SUPABASE_ANON_KEY="$(jwt anon)" \
SUPABASE_SERVICE_ROLE_KEY="$(jwt service_role)" \
SUPABASE_JWT_SECRET="$secret" \
TIKI_PRISMINE_MAXSTARTSPERWINDOW="${TIKI_PRISMINE_MAXSTARTSPERWINDOW:-30}" \
  java "${JAVA_OPTS:--Xmx512m}" -jar "$jar"
