# Prismine : sécurité

Le risque principal de Prismine est la triche : lire la carte cachée, jouer à la place d'un autre ou déclarer un faux
score. Ce rapport relie chaque risque de l'OWASP Top 10 qui concerne le jeu à sa protection et à sa preuve.

## Scan dynamique (DAST, OWASP ZAP)

**Le scan ZAP n'a pas pu être lancé en local** : le 6 novembre 2026, Docker Desktop a planté à chaque téléchargement de
l'image ZAP (erreur WSL `0xc00000fd`). Il n'y a donc aucun résultat ZAP propre à Prismine à ce jour.

Le job `DAST (ZAP baseline)` de la CI scanne le front et le backend, mais il ne tourne que lorsque la PR n'est plus en
brouillon. À savoir pour lire son rapport :

- c'est un scan **passif**, sans attaque injectée ;
- il part de la racine du site, sans jouer d'expédition : il ne prouve rien sur le contrôle d'accès de Prismine.

```bash
docker compose -f quality/docker-compose.yml run --rm zap zap-baseline.py \
  -t http://host.docker.internal:8080/api/games/prismine/runs/00000000-0000-4000-8000-000000000001 \
  -c /zap/rules/rules.tsv -r zap-prismine.html
```

## Contrôle manuel (6 novembre 2026)

Sur le serveur Java local, requête `GET` sur une route de Prismine :

| Vérification | Résultat |
|--------------|----------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Cache-Control` | `no-cache, no-store, max-age=0, must-revalidate` |
| `POST` sans jeton CSRF | Refusé, 403 |

La CSP est posée par le front en production (`frontend/security-headers.ts`, `default-src 'self'`) : elle n'a pas été
contrôlée sur un déploiement réel.

## Risques OWASP et preuves

| Risque | Attaque sur Prismine | Protection | Preuve |
|--------|----------------------|------------|--------|
| A01 Broken Access Control, BOLA | Lire ou jouer l'expédition d'un autre avec son identifiant | Le serveur compare le propriétaire et répond 404 | `PrismineControllerTest` › `anotherPlayerCanNeitherReadNorPlayNorEndARun` |
| A01 Broken Access Control | Lire la carte cachée directement dans la base | RLS sans lecture pour les joueurs | `prismine-runs.test.ts`, sur un vrai Postgres |
| A01 Broken Access Control | Déclarer un faux score | Le serveur refuse tout score envoyé par un joueur | `PrismineScoreValidatorTest`, scénario BDD |
| A03 Injection | Envoyer une carte ou un bord forgés | Validation à l'entrée, requêtes par paramètres PostgREST | `PrismineControllerTest`, contrat Pact |
| A02 Cryptographic Failures | Récupérer la carte dans une réponse | Ni la carte d'un étage en cours ni sa graine ne sortent du serveur | `PrismineControllerTest`, script k6 |
| A04, A07 Abus | Remplir la table avec des expéditions | 30 démarrages par adresse en 10 minutes, puis 429 ; purge après 24 h | `StartLimiterTest`, `PrismineServiceTest` |
| A05 Security Misconfiguration | Lire une erreur technique | Message générique, détail seulement dans les logs | `SupabaseAdaptersTest` |

## Secrets

Aucune clé dans le dépôt. Les secrets sont documentés dans `backend/.env.example` et injectés à l'exécution par Coolify
(facteur III des Twelve-Factor Apps). `quality/prismine-local.sh` n'utilise que le secret de test de l'environnement local
et ne lit pas `backend/.env`.

## Risques acceptés

- **Expédition d'invité** : le serveur ne compare pas de propriétaire, n'importe qui connaissant l'identifiant peut la
  lire ou la jouer. L'identifiant est un UUID aléatoire, impossible à deviner, et une expédition d'invité ne classe aucun
  score. Le risque est donc faible, mais il existe.
- **Limite de démarrages** : elle compte par adresse. Des joueurs derrière une même adresse la partagent, et un attaquant
  avec plusieurs adresses la contourne.
- **Scan actif** : aucun n'a été lancé sur Prismine.
