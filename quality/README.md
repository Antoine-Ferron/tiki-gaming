# Qualimétrie

Trois analyses qui complètent les tests (`CONTRIBUTING.md` → *Tests*) : **SonarQube** (qualité statique,
couverture, dette), **k6** (latence sous charge) et **OWASP ZAP** (sécurité dynamique). Tout tourne en local dans
Docker, sur des données factices : **aucune de ces commandes ne vise la production**.

Les rapports sont écrits dans `quality/reports/` (ignoré par git). En CI, les jobs `performance`, `dast` et `sonar`
les publient en artefacts.

## SonarQube

```bash
sh quality/sonar-local.sh
```

Le script démarre une instance SonarQube Community jetable (http://localhost:9000), régénère la couverture
(`npm run test:coverage` côté front, `mvn verify` avec JaCoCo côté backend), lance l'analyse et attend le
**Quality Gate** (*Sonar way* : sur le nouveau code, 0 nouveau problème, couverture ≥ 80 %, duplication ≤ 3 %).
La synthèse est dans `quality/reports/sonar-summary.txt`.

- La configuration est dans `sonar-project.properties`, à la racine du dépôt (sources, tests, couverture, faux positifs écartés).
- Le scanner tourne sur la machine (`npx @sonar/scan`) : dans la VM de Docker Desktop, l'analyse TypeScript manque de mémoire.
- Le jeton d'analyse local est gardé dans `quality/.sonar-token` (ignoré par git) ; `docker compose -f quality/docker-compose.yml --profile sonar down -v` repart de zéro.

**En CI (SonarQube Cloud)** : le job `sonar` s'active dès que le secret `SONAR_TOKEN` existe. Une fois pour toutes :
importer le dépôt sur [sonarcloud.io](https://sonarcloud.io) (organisation `eanathos`, clé `EAnathos_tiki-gaming`),
désactiver l'*Automatic Analysis* du projet, puis ajouter le jeton dans *Settings → Secrets and variables → Actions*.

## k6 : charge du lobby

```bash
docker compose -f quality/docker-compose.yml up -d --wait db
(cd frontend && npm run quality:seed)          # migrations du dépôt + 1 000 joueurs et 10 000 scores factices
docker compose -f quality/docker-compose.yml up -d rest
HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose -f quality/docker-compose.yml run --rm k6
```

- `db` : même image que la production (`supabase/postgres` 17.11) ; `rest` : PostgREST, l'API REST de Supabase, avec la même RLS.
- Le backend Java doit tourner sur la machine (port 8080) pour le scénario `session` ; `BACKEND_URL=` le désactive.
- Scénarios (`k6/lobby.js`), à débit constant pendant `K6_DURATION` (30 s par défaut) :

| Scénario       | Débit     | Requête                                                             |
|----------------|-----------|---------------------------------------------------------------------|
| `leaderboard`  | 100 req/s | Top 10 du Clicker (vue `leaderboard`), en visiteur                  |
| `submit_score` | 20 req/s  | Envoi de score d'un joueur connecté (JWT signé, RLS + `max_score`)  |
| `session`      | 50 req/s  | `GET /api/auth/session` du backend                                  |

- **Seuils bloquants** : P95 < 300 ms pour chaque scénario, moins de 1 % d'erreurs, plus de 99 % de vérifications réussies.

## ZAP : scan DAST

```bash
(cd frontend && npm run build && npx vite preview --host 0.0.0.0 --port 4173)   # front buildé, avec ses en-têtes
docker compose -f quality/docker-compose.yml run --rm zap zap-baseline.py \
  -t http://host.docker.internal:4173/ -c /zap/rules/rules.tsv -r zap-front.html
docker compose -f quality/docker-compose.yml run --rm zap zap-baseline.py \
  -t http://host.docker.internal:8080/ -c /zap/rules/rules.tsv -r zap-api.html
```

- Scan **baseline**, donc passif : ZAP explore et analyse les réponses sans envoyer d'attaque. Le backend local est
  branché sur le Supabase de production, et un scan actif y créerait de vrais comptes.
- Le front buildé est servi avec les en-têtes de `frontend/security-headers.ts`. **L'hébergement de production doit
  envoyer les mêmes** (voir le README, *Contraintes pour le déploiement*).
- `zap/rules.tsv` : les alertes corrigées sont en `FAIL`, pour qu'une régression casse la CI. Les risques acceptés
  sont en `IGNORE`, chacun avec sa justification :

| Règle | Alerte                         | Décision et justification                                                        |
|-------|--------------------------------|----------------------------------------------------------------------------------|
| 10020 | Anti-clickjacking              | Corrigée : `X-Frame-Options: DENY` et CSP `frame-ancestors 'none'`              |
| 10021 | X-Content-Type-Options         | Corrigée : `nosniff` (front) ; posé par Spring Security côté backend             |
| 10038 | Content-Security-Policy        | Corrigée : CSP stricte, sans `unsafe-inline` ni `eval`                           |
| 10055 | CSP avec joker                 | Corrigée : `img-src` limité au front et au Supabase du projet                    |
| 10063 | Permissions-Policy             | Corrigée : caméra, micro, géolocalisation, paiement et USB désactivés            |
| 10027 | Commentaires suspects          | Acceptée : mots génériques dans le code minifié des dépendances, rien de sensible |
| 10049 | Mise en cache                  | Acceptée : informatif ; les réponses de l'API sont volontairement non stockables |
| 10109 | Application web moderne        | Acceptée : informatif (un spider AJAX serait plus complet)                       |
| 90004 | Cross-Origin-Embedder-Policy   | Acceptée : `require-corp` bloquerait les ressources Supabase sans en-tête CORP ; COOP `same-origin` suffit, l'app n'utilise pas `SharedArrayBuffer` |
