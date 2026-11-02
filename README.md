# Tiki Gaming

Espace de jeux en ligne : comptes joueurs, catalogue de jeux, scores, classements et sauvegardes.

- **Jeux solo** : jouables sans compte (mode invité : sauvegarde locale, scores non classés).
- **Jeux multijoueur** : connexion obligatoire.

**Stack**
- `frontend/` : Vite · React 19 · TypeScript · React Router · supabase-js (données uniquement)
- `backend/` : Java 21 · Spring Boot 3.5 · Spring Security OAuth2 Client · Maven (authentification)
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

Le backend Java gère toute l'authentification (Google, email/mot de passe, réinitialisation) et une
session HTTP (cookie `JSESSIONID`, `HttpOnly`, `SameSite=Lax`). Les comptes restent dans `auth.users` de
Supabase : le backend appelle l'API Auth de Supabase côté serveur, puis émet pour le front un JWT
signé avec le secret JWT du projet (`sub` = id utilisateur, `role` = `authenticated`). supabase-js
l'utilise pour les requêtes, et la RLS (`auth.uid()`) fonctionne sans changement.

| Endpoint                          | Rôle                                                        |
|-----------------------------------|-------------------------------------------------------------|
| `GET  /api/auth/session`          | Utilisateur courant + JWT Supabase (1 h), émet le cookie CSRF |
| `GET  /api/auth/google?redirect=` | Démarre la connexion Google                                 |
| `POST /api/auth/login`            | Email + mot de passe                                        |
| `POST /api/auth/signup`           | Inscription (pseudo dans `data.username`)                   |
| `POST /api/auth/password/forgot`  | Envoi du lien de réinitialisation                           |
| `POST /api/auth/password/reset`   | Nouveau mot de passe via le jeton du lien                   |
| `POST /api/auth/password`         | Changement de mot de passe (connecté)                       |
| `POST /api/auth/logout`           | Déconnexion                                                 |

Les `POST` exigent l'en-tête `X-XSRF-TOKEN` (copie du cookie `XSRF-TOKEN`), géré par `frontend/src/lib/api.ts`.

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

### Contraintes pour le déploiement (à redéfinir)

- Le backend Java tourne à part, avec les variables de `backend/.env.example`, `FRONTEND_URL` = URL de
  prod et `COOKIE_SECURE=true`.
- `/api/*`, `/oauth2/*` et `/login/oauth2/*` doivent être servis sur **la même origine que le front**
  (reverse proxy / rewrites) pour que le cookie de session reste first-party.
- Ajouter `<URL de prod>/login/oauth2/code/google` aux redirect URIs du client OAuth Google.

## Architecture

```
backend/src/main/java/fr/tikigaming/
├── config/SecurityConfig.java         OAuth2 Google, CSRF cookie, session
└── auth/
    ├── AuthController.java            Endpoints /api/auth/*
    ├── GoogleLoginSuccessHandler.java Rattache le compte Google à auth.users
    ├── SupabaseAuthClient.java        Appels à l'API Auth / RPC Supabase (service_role)
    └── SupabaseTokenService.java      JWT au format Supabase pour la RLS
frontend/src/
├── main.tsx                 Router + AuthProvider
├── App.tsx                  Déclaration des routes
├── lib/
│   ├── api.ts               Appels au backend (cookie de session + CSRF)
│   ├── session.ts           Session backend + JWT, rafraîchi avant expiration
│   ├── supabase.ts          Client Supabase unique (clé anon + JWT du backend)
│   └── database.types.ts    Types générés depuis la base
├── auth/
│   ├── AuthContext.ts       useAuth() → user, profile, refreshSession, signOut…
│   ├── AuthProvider.tsx     Lit la session du backend, charge le profil
│   └── ProtectedRoute.tsx   ProtectedRoute / GuestOnlyRoute
├── components/              Layout, Leaderboard…
├── pages/                   Login, Signup, ForgotPassword, UpdatePassword, Profile, Home, Game
└── games/
    ├── types.ts             Contrat GameDefinition / GameContext  ← à lire en premier
    ├── sdk.ts               Implémentation du GameContext (scores, saves, classement)
    ├── registry.ts          Catalogue des jeux
    └── clicker/             Jeu d'exemple = template
supabase/migrations/         Schéma SQL versionné (partagé)
frontend/scripts/db.mjs      Outil local : migrations + requêtes SQL directes
```

### Modèle de données

| Table / vue    | Rôle                                         | Lecture          | Écriture client                |
|----------------|----------------------------------------------|------------------|--------------------------------|
| `profiles`     | Pseudo/avatar, créé auto à l'inscription     | tout le monde    | son propre profil              |
| `games`        | Catalogue (slug, titre, actif)               | tout le monde    | aucune (migrations)            |
| `scores`       | Une ligne par partie                         | tout le monde    | insert de ses scores seulement |
| `game_saves`   | Sauvegarde JSON par joueur × jeu             | les siennes      | les siennes                    |
| `leaderboard`  | Vue : meilleur score par joueur × jeu        | tout le monde    | —                              |

Toutes les tables ont la **RLS activée**.

### Sécurité

- Le front n'utilise **que la clé `anon`**. La clé `service_role` contourne la RLS : elle ne doit jamais
  apparaître dans ce dépôt ni dans une variable `VITE_*`. Usage réservé au backend Java et aux scripts serveur.
- Le secret JWT permet de forger des jetons pour n'importe quel utilisateur : il reste dans `backend/.env`.
- `.env` est ignoré par git.
- En mode invité, aucune écriture n'est faite en base : seule la lecture publique (catalogue, classement) est utilisée.
- Les scores sont envoyés par le client, donc falsifiables. Pour un jeu compétitif, valider la partie
  côté serveur (Edge Function) avant d'insérer le score.

## Contribuer

Règles de branches, workflow de PR et création d'un jeu : voir [CONTRIBUTING.md](CONTRIBUTING.md).
