#!/usr/bin/env sh
# Analyse SonarQube locale : instance Community jetable (quality/docker-compose.yml, profil sonar) + scanner npm.
#   sh quality/sonar-local.sh        → résultats sur http://localhost:9000 et dans quality/reports/sonar-summary.txt
# Prérequis : Docker, Node et Java ; la couverture est régénérée par le script (npm run test:coverage, mvn verify).
set -eu
cd "$(dirname "$0")/.."
ROOT=$(pwd)
SONAR=http://localhost:9000
TOKEN_FILE=quality/.sonar-token # ignoré par git

docker compose -f quality/docker-compose.yml --profile sonar up -d --wait sonarqube

if [ ! -s "$TOKEN_FILE" ]; then
  # Instance locale fraîche : identifiants par défaut de l'image, uniquement pour générer un jeton d'analyse.
  curl -sf -u admin:admin -X POST "$SONAR/api/user_tokens/generate" -d "name=local-$(date +%s)" -d type=GLOBAL_ANALYSIS_TOKEN |
    sed -E 's/.*"token":"([^"]+)".*/\1/' >"$TOKEN_FILE"
fi

(cd frontend && VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npm run -s test:coverage >/dev/null)
(cd backend && mvn -q -B verify >/dev/null)

# Scanner lancé sur la machine (lanceur npm officiel) : dans la VM Docker, l'analyse TypeScript manque de mémoire.
SONAR_HOST_URL=$SONAR SONAR_TOKEN="$(cat "$TOKEN_FILE")" npx --yes @sonar/scan@5.0.2 -Dsonar.qualitygate.wait=true || true

# Synthèse lisible : Quality Gate et métriques principales (quality/reports/ est ignoré par git, absent d'un clone neuf).
mkdir -p quality/reports
KEY=EAnathos_tiki-gaming
METRICS=alert_status,bugs,vulnerabilities,security_hotspots,code_smells,coverage,duplicated_lines_density,sqale_index,sqale_rating,reliability_rating,security_rating,cognitive_complexity,ncloc
curl -sf -u "$(cat "$TOKEN_FILE"):" "$SONAR/api/measures/component?component=$KEY&metricKeys=$METRICS" |
  node -e 'const m=JSON.parse(require("fs").readFileSync(0)).component.measures;for(const x of m)console.log(x.metric.padEnd(26),x.value)' |
  tee quality/reports/sonar-summary.txt
