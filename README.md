# Tiki Gaming

Espace de jeux en ligne : comptes joueurs, catalogue de jeux, scores, classements et sauvegardes.

- Chaque jeu a une **catégorie** : **Solo** (1 joueur), **Duel** (2 joueurs) ou **Multi** (3 joueurs et +).
- Indépendamment de sa catégorie, un jeu est **sans compte** (mode invité : sauvegarde locale, scores
  non classés) ou à **compte requis**.

**Stack**
- `frontend/` : Vite · React 19 · TypeScript · React Router · supabase-js (données uniquement)
- `backend/` : Java 21 · Spring Boot 4.1 · Spring Security OAuth2 Client · Maven (authentification)
- Supabase : Postgres + RLS (et `auth.users` comme registre des comptes)

## Démarrage

```bash
# Backend (http://localhost:8080)
cp backend/.env.example backend/.env      # puis renseigner Google + Supabase
mvn -f backend/pom.xml spring-boot:run

# Front (http://localhost:5173) — proxifie /api, /oauth2 et /login/oauth2 vers le backend
cd frontend
npm install
cp .env.example .env                      # puis renseigner URL + clé anon
npm run dev
```

### Authentification

Le backend Java gère toute l'authentification (Google, email/mot de passe, réinitialisation) et la
session. Il émet pour le front un JWT au format Supabase, qui permet à la RLS de reconnaître le joueur.
Le fonctionnement et les endpoints sont décrits dans [docs/architecture.md](docs/architecture.md#authentification).

#### Configurer Google

1. Google Cloud Console → APIs & Services → Credentials → **OAuth client ID** (type *Web application*).
2. **Authorized redirect URIs** : `http://localhost:5173/login/oauth2/code/google` et
   `<URL de prod>/login/oauth2/code/google`.
3. Reporter Client ID / Secret dans `backend/.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).

Un compte Google est rattaché au compte Supabase de même email (email vérifié par Google obligatoire),
sinon un compte est créé et le trigger `handle_new_user` crée le profil.

#### Secrets Supabase du backend

`SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API) et `SUPABASE_JWT_SECRET` (Project Settings → JWT
Keys → *Legacy JWT secret*). Le secret JWT doit être celui qui sert à vérifier les jetons du projet. Si
le projet passe aux clés de signature asymétriques, il faudra adapter `SupabaseTokenService`.

### Base de données

Dans `frontend/`, renseigner `SUPABASE_PROJECT_REF` et `SUPABASE_DB_PASSWORD` dans `.env`, puis :

```bash
npm run db:migrate                                   # applique les migrations non encore appliquées
npm run db:sql -- "select * from public.games"       # requête SQL directe (admin, contourne la RLS)
npm run db:sql -- -f chemin/requete.sql
```

Les migrations appliquées sont suivies dans `supabase_migrations.schema_migrations` (même table que la
CLI Supabase : `npx supabase db push` reste utilisable). Après une migration, régénérer les types avec
`npm run db:types` (nécessite `npx supabase login`).

### Configuration Auth (Dashboard → Authentication → URL Configuration)

- **Site URL** : l'URL de production
- **Redirect URLs** : `http://localhost:5173/**` et l'URL de prod `/**` (nécessaire pour la confirmation d'email et le reset de mot de passe)

### Déploiement (Coolify)

`docker-compose.yml` (racine) déploie deux services : seul `frontend` est exposé publiquement, `backend`
ne publie aucun port et n'est joignable que depuis `frontend` sur le réseau Docker interne.

- `frontend` : nginx sert le build Vite et reverse-proxifie `/api/*`, `/oauth2/*`, `/login/oauth2/*` et
  `/ws` vers `backend` — nécessaire pour que le cookie de session reste **sur la même origine** (voir
  `frontend/nginx.conf.template`). Il envoie aussi les en-têtes de sécurité de
  `frontend/security-headers.ts` (CSP, `X-Frame-Options`, `nosniff`, `Permissions-Policy`…), vérifiés par
  le scan ZAP de [quality/](quality/README.md).
- `backend` : mêmes variables que `backend/.env.example`, avec `COOKIE_SECURE=true` et
  `SWAGGER_ENABLED=false`.
- Variables à renseigner dans Coolify (resource > Environment Variables) : voir
  [.env.production.example](.env.production.example). `SERVICE_FQDN_FRONTEND_80` est généré par Coolify ;
  reporter ce domaine dans `FRONTEND_URL`.
- Ajouter `<domaine front>/login/oauth2/code/google` aux redirect URIs du client OAuth Google, et le
  renseigner comme **Site URL** / dans les **Redirect URLs** de Supabase (Dashboard → Authentication → URL
  Configuration, voir ci-dessus).

## Documentation

| Document                                             | Contenu                                                     |
|------------------------------------------------------|-------------------------------------------------------------|
| [docs/architecture.md](docs/architecture.md)         | Briques, flux d'authentification, structure du code, modèle et catégories des jeux, sécurité |
| [docs/modele-donnees.md](docs/modele-donnees.md)     | Schéma, tables, RLS et droits, fonctions, migrations        |
| [docs/charte-graphique.md](docs/charte-graphique.md) | Couleurs, typographie, composants, règles pour les jeux, rédaction |
| [docs/ci.md](docs/ci.md)                             | La CI étape par étape : ce qui est vérifié, les seuils, que faire quand un check échoue |
| [CONTRIBUTING.md](CONTRIBUTING.md)                   | Branches, PR, commits, création d'un jeu                    |
| [quality/README.md](quality/README.md)               | Qualimétrie : SonarQube, charge k6 (P95), scan DAST ZAP     |
| [docs/slo.md](docs/slo.md)                           | SLI / SLO / SLA, budget d'erreur, profils k6, résilience (timeouts, disjoncteur, Toxiproxy) |
| [specs/rtm-matrix.md](specs/rtm-matrix.md)           | Matrice de traçabilité : exigences ↔ tests ↔ anomalies, vérifiée en CI |
| [specs/cahier-de-recette.md](specs/cahier-de-recette.md) | Recette utilisateur (UAT) : critères d'entrée et de sortie, fiches, procès-verbal |

## Contribuer

Règles de branches, workflow de PR et création d'un jeu : voir [CONTRIBUTING.md](CONTRIBUTING.md).
