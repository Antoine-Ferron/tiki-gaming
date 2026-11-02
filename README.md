# Tiki Gaming

Espace de jeux en ligne : comptes joueurs, catalogue de jeux, scores, classements et sauvegardes, sur **Supabase**.

- **Jeux solo** : jouables sans compte (mode invité : sauvegarde locale, scores non classés).
- **Jeux multijoueur** : connexion obligatoire.

**Stack** : Vite · React 19 · TypeScript · React Router · Supabase (Auth + Postgres + RLS)

## Démarrage

```bash
npm install
cp .env.example .env        # puis renseigner URL + clé anon
npm run dev                 # http://localhost:5173
```

### Base de données

Renseigner `SUPABASE_PROJECT_REF` et `SUPABASE_DB_PASSWORD` dans `.env`, puis :

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

## Déploiement (Vercel)

- Chaque push sur `main` déploie en production ; chaque pull request obtient une URL de preview.
- Variables d'environnement Vercel : **uniquement** `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
- `vercel.json` renvoie toutes les routes vers `index.html` (routing côté client) et met en cache longue durée `/assets/*`.
- Supabase → Authentication → URL Configuration : Site URL = URL de prod ; Redirect URLs = URL de prod `/**`
  et `https://*-<équipe-vercel>.vercel.app/**` pour les previews.

## Architecture

```
src/
├── main.tsx                 Router + AuthProvider
├── App.tsx                  Déclaration des routes
├── lib/
│   ├── supabase.ts          Client Supabase unique (clé anon)
│   └── database.types.ts    Types générés depuis la base
├── auth/
│   ├── AuthContext.ts       useAuth() → session, user, profile, signOut…
│   ├── AuthProvider.tsx     Écoute la session Supabase, charge le profil
│   └── ProtectedRoute.tsx   ProtectedRoute / GuestOnlyRoute
├── components/              Layout, Leaderboard…
├── pages/                   Login, Signup, ForgotPassword, UpdatePassword, Profile, Home, Game
└── games/
    ├── types.ts             Contrat GameDefinition / GameContext  ← à lire en premier
    ├── sdk.ts               Implémentation du GameContext (scores, saves, classement)
    ├── registry.ts          Catalogue des jeux
    └── clicker/             Jeu d'exemple = template
supabase/migrations/         Schéma SQL versionné
scripts/db.mjs               Outil local : migrations + requêtes SQL directes
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
  apparaître dans ce dépôt ni dans une variable `VITE_*`. Usage réservé aux Edge Functions / scripts serveur.
- `.env` est ignoré par git.
- En mode invité, aucune écriture n'est faite en base : seule la lecture publique (catalogue, classement) est utilisée.
- Les scores sont envoyés par le client, donc falsifiables. Pour un jeu compétitif, valider la partie
  côté serveur (Edge Function) avant d'insérer le score.

## Ajouter un jeu

Voir [CONTRIBUTING-GAMES.md](CONTRIBUTING-GAMES.md).
