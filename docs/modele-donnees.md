# Modèle de données

Base Postgres hébergée par Supabase. Le schéma est versionné dans `supabase/migrations/`. Les types
TypeScript correspondants sont dans `frontend/src/lib/database.types.ts` (`npm run db:types` après
chaque migration).

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "1-1 (trigger)"
    PROFILES ||--o{ SCORES : "joue"
    PROFILES ||--o{ GAME_SAVES : "sauvegarde"
    GAMES ||--o{ SCORES : "concerne"
    GAMES ||--o{ GAME_SAVES : "concerne"

    AUTH_USERS {
        uuid id PK
        text email
        jsonb raw_user_meta_data "username à l'inscription"
    }
    PROFILES {
        uuid id PK,FK "→ auth.users.id"
        text username "unique (insensible à la casse)"
        text avatar_url
        timestamptz created_at
        timestamptz updated_at
    }
    GAMES {
        text slug PK
        text title
        text description
        text category "solo | duel | multi"
        boolean is_active
        timestamptz created_at
    }
    SCORES {
        bigint id PK
        uuid user_id FK "défaut auth.uid()"
        text game_slug FK
        bigint score
        jsonb metadata
        timestamptz created_at
    }
    GAME_SAVES {
        uuid user_id PK,FK "défaut auth.uid()"
        text game_slug PK,FK
        jsonb data
        timestamptz updated_at
    }
```

## Tables

### `profiles`

Profil public de chaque joueur, en relation 1-1 avec `auth.users`. Il est créé automatiquement à l'inscription.

| Colonne      | Type          | Contraintes                                                   |
|--------------|---------------|---------------------------------------------------------------|
| `id`         | `uuid`        | PK, FK `auth.users(id)` `on delete cascade`                   |
| `username`   | `text`        | `^[A-Za-z0-9_]{3,24}$`, unique sur `lower(username)`          |
| `avatar_url` | `text`        | nullable                                                      |
| `created_at` | `timestamptz` | défaut `now()`                                                |
| `updated_at` | `timestamptz` | maintenu par le trigger `profiles_set_updated_at`             |

Le motif du pseudo est dupliqué côté front dans `frontend/src/lib/validation.ts` : les deux doivent rester alignés.

### `games`

Catalogue des jeux : une ligne par jeu, ajoutée par une migration de l'équipe du jeu.

| Colonne       | Type          | Contraintes                                                       |
|---------------|---------------|-------------------------------------------------------------------|
| `slug`        | `text`        | PK, `^[a-z0-9]+(-[a-z0-9]+)*$`                                    |
| `title`       | `text`        | obligatoire                                                       |
| `description` | `text`        | nullable                                                          |
| `category`    | `text`        | **obligatoire, sans défaut**, `games_category_check` : `solo`, `duel`, `multi` |
| `is_active`   | `boolean`     | défaut `true` ; un jeu inactif n'accepte plus de nouveaux scores  |
| `created_at`  | `timestamptz` | défaut `now()`                                                    |

`category` doit correspondre au champ `category` de la `GameDefinition` du jeu
(`frontend/src/games/categories.ts`).

### `scores`

Historique des parties. Le client ne peut qu'insérer des lignes.

| Colonne      | Type          | Contraintes                                                    |
|--------------|---------------|----------------------------------------------------------------|
| `id`         | `bigint`      | PK, identité                                                   |
| `user_id`    | `uuid`        | FK `profiles(id)` `on delete cascade`, défaut `auth.uid()`      |
| `game_slug`  | `text`        | FK `games(slug)` `on delete cascade`                           |
| `score`      | `bigint`      | obligatoire, **plus haut = meilleur**                          |
| `metadata`   | `jsonb`       | défaut `{}` (durée, niveau… libre par jeu)                      |
| `created_at` | `timestamptz` | défaut `now()`                                                 |

Index : `(game_slug, score desc)` pour les classements, `(user_id)`.

### `game_saves`

Une sauvegarde JSON par joueur et par jeu.

| Colonne      | Type          | Contraintes                                                    |
|--------------|---------------|----------------------------------------------------------------|
| `user_id`    | `uuid`        | PK, FK `profiles(id)` `on delete cascade`, défaut `auth.uid()`  |
| `game_slug`  | `text`        | PK, FK `games(slug)` `on delete cascade`                       |
| `data`       | `jsonb`       | défaut `{}`                                                    |
| `updated_at` | `timestamptz` | maintenu par le trigger `game_saves_set_updated_at`            |

Un jeu arbitré par le serveur y écrit lui-même, avec la clé service. Pour SDV Civilisation, `data` vaut
`{ "version": n, "sealed": "…" }` : la partie complète (mains des IA comprises) est chiffrée et authentifiée
par le backend (AES-GCM, clé dérivée de son secret), pour que le joueur, qui peut lire sa ligne, ne puisse ni
la lire ni la modifier. `version` sert de verrou optimiste : le tour suivant n'est écrit que si la ligne est
encore à la version attendue.

### Vue `leaderboard`

Meilleur score par joueur et par jeu (`best_score`, `games_played`, `last_played_at`, avec `username`
et `avatar_url`). Elle est déclarée `security_invoker` et respecte donc la RLS de l'appelant.

## Droits et RLS

Toutes les tables ont la **RLS activée** et des privilèges explicites (pas de grants par défaut).

| Table / vue   | `anon` (invité) | `authenticated` (connecté)                                    |
|---------------|-----------------|---------------------------------------------------------------|
| `profiles`    | lecture         | lecture ; mise à jour de `username`, `avatar_url` de **son** profil |
| `games`       | lecture         | lecture (écriture uniquement par migration)                   |
| `scores`      | lecture         | lecture ; insertion de **ses** scores, sur un jeu actif       |
| `game_saves`  | —               | lecture / écriture / suppression de **ses** sauvegardes       |
| `leaderboard` | lecture         | lecture                                                       |

Pour une requête du front, « connecté » signifie que la requête porte le JWT émis par le backend Java
(voir [architecture.md](architecture.md#authentification)).

## Fonctions et triggers

| Objet                          | Rôle                                                                              |
|--------------------------------|-----------------------------------------------------------------------------------|
| `handle_new_user()` + trigger `on_auth_user_created` | Crée le profil à l'insertion dans `auth.users`. Le pseudo vient de `raw_user_meta_data.username` ; il est nettoyé et dédoublonné, avec repli sur `joueur_<id>` |
| `set_updated_at()`             | Maintient `updated_at` (`profiles`, `game_saves`)                                  |
| `find_auth_user_id(email)`     | `security definer`, exécutable **uniquement par `service_role`** : le backend retrouve le compte d'un email vérifié par Google |

## Migrations

| Fichier                                   | Contenu                                         |
|-------------------------------------------|-------------------------------------------------|
| `20261102000000_init_platform.sql`        | Schéma socle, RLS, jeu d'exemple `clicker`       |
| `20261102120000_auth_user_lookup.sql`     | Fonction `find_auth_user_id`                     |
| `20261102130000_game_categories.sql`      | Colonne `games.category` + contrainte            |

Les règles (une migration par changement, jamais modifiée une fois fusionnée, application en
production par l'équipe plateforme) sont dans [CONTRIBUTING.md](../CONTRIBUTING.md#migrations-de-base-de-données).

Exemple d'ajout d'un jeu au catalogue :

```sql
insert into public.games (slug, title, description, category)
values ('mastermind', 'Mastermind', 'Trouve la combinaison secrète en un minimum de coups.', 'solo');
```
