# 2048 : lancer les tests

Toutes les commandes front se lancent depuis `frontend/`.

| Tests | Commande |
|---|---|
| Unitaires, BDD (Gherkin), fuzzing, composant | `npx vitest run src/games/game-2048` |
| Intégration (jeu + SDK) | `npx vitest run src/games/game-2048/game-2048.integration.test.tsx` |
| Couverture | `npx vitest run src/games/game-2048 --coverage` |
| Mutation (Stryker) | `npx stryker run --mutate "src/games/game-2048/{domain,services}/*.ts,src/games/game-2048/keyboard.ts,!src/**/*.test.ts"` |
| E2E (Playwright) | `npx playwright test game-2048` |
| SonarQube (depuis la racine) | `sh quality/sonar-local.sh` |

## Charge (k6), depuis la racine

Le classement du 2048 sous 50 requêtes/s pendant 30 s. Seuils : P95 < 300 ms, P99 < 500 ms, moins de 1 % d'erreurs.

```bash
docker compose -f quality/docker-compose.yml up -d --wait db
(cd frontend && npm run quality:seed)
docker compose -f quality/docker-compose.yml up -d rest
docker compose -f quality/docker-compose.yml run --rm k6 run /quality/k6/game-2048.js
docker compose -f quality/docker-compose.yml down -v
```

Résultat du 5 novembre 2026 : 1 502 requêtes, 0 % d'erreurs, P95 = 5,5 ms, P99 = 7,2 ms.
