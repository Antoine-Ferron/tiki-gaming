# Prismine : runbook de mise en production

Ce qu'un ingénieur d'astreinte doit savoir pour déployer Prismine, vérifier le déploiement et revenir en arrière. Le
déploiement général de la plateforme est décrit dans le [README](../../../README.md#déploiement-coolify).

## 1. Prérequis

| Élément | Valeur |
|---------|--------|
| Serveur | Java 21, image `backend` du `docker-compose.yml` racine |
| Base | Supabase, migrations `20261105150000` à `20261105150002` appliquées |
| Secrets | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, documentés dans `backend/.env.example` et injectés par Coolify, jamais commités |
| Réglages facultatifs | `tiki.prismine.max-starts-per-window` (30 par défaut), `tiki.resilience.prismine.failure-threshold` (5), `tiki.resilience.prismine.open-duration` (30 s) |

## 2. Déploiement

L'ordre compte : la base d'abord, le code ensuite. Sans les migrations, « Jouer » renvoie une erreur 502.

1. Vérifier que le job `CI (verdict)` est vert sur le commit à livrer.
2. Appliquer les migrations, dans `frontend/` : `npm run db:migrate`.
3. Contrôler le catalogue : `npm run db:sql -- "select slug from public.games where slug = 'prismine'"` renvoie une ligne.
4. Déployer les services `backend` et `frontend` depuis Coolify.
5. Lancer les contrôles de fumée de la partie 3.

## 3. Contrôles de fumée

Moins de 30 secondes au total. Si l'un échoue, passer directement à la partie 4, sans enquêter d'abord.

```bash
# Santé : le serveur répond et pose ses cookies
curl -fsS -o /dev/null "$URL/api/auth/session"

# Parcours clé : une expédition complète d'invité, 5 fois, avec les seuils des SLO
BACKEND_URL="$URL" K6_PROFILE=smoke docker compose -f quality/docker-compose.yml run --rm k6 run --quiet /quality/k6/prismine.js
```

Mesuré en local le 6 novembre 2026 : le profil `smoke` se termine en 3 secondes.

Attention : ce parcours crée 5 expéditions d'invité, purgées au bout de 24 h, et consomme le quota de démarrages de
l'adresse qui le lance.

## 4. Retour arrière

**Objectif du cours : moins de 2 minutes. Ce délai n'a jamais été mesuré sur Prismine**, faute d'environnement de
préproduction. Le test reste à faire avant une vraie mise en production.

1. Dans Coolify, redéployer l'image précédente de `backend` et de `frontend`.
2. Relancer le contrôle de santé.
3. Ne pas toucher à la base : les migrations sont **rétrocompatibles**, selon le principe *Expand and Contract*.

| Migration | Effet sur l'ancienne version |
|-----------|------------------------------|
| `add_game_prismine` | Ajoute une ligne au catalogue : le jeu reste listé tant qu'elle existe |
| `prismine_runs` | Nouvelle table, ignorée par l'ancienne version |
| `prismine_score_per_run` | Index unique limité aux scores de Prismine |

Pour retirer le jeu du catalogue après le retour arrière, décider avec l'équipe plateforme : aucune procédure n'a été
testée.

## 5. Pannes connues

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| 502 sur toute action, log `PostgREST a répondu 404` | Migrations non appliquées | Partie 2, étape 2 |
| 502, log `Supabase injoignable` | Supabase en panne ou lent | Vérifier l'état de Supabase |
| 503 immédiat, log `Disjoncteur de Prismine ouvert` | 5 pannes consécutives : plus aucun appel pendant 30 s | Attendre : le circuit se referme seul au retour de Supabase |
| 429 au démarrage | Plus de 30 expéditions en 10 minutes depuis une adresse | Normal contre les abus, à ajuster si une école partage la même adresse |
| Log `Purge des expéditions Prismine abandonnées impossible` | Supabase indisponible pendant la purge horaire | Nouvel essai automatique une heure plus tard |

## 6. Décision Go / No-Go

État relevé le 6 novembre 2026 sur la branche `game/prismine/implementation`. **Décision actuelle : No-Go**, tant que
les lignes « Non » ou « À confirmer » ne sont pas levées.

| Critère | État | Preuve |
|---------|------|--------|
| CI complète verte | À confirmer | La PR #40 est en brouillon : seul le premier palier tourne |
| Quality Gate SonarQube | À confirmer | Mesure locale antérieure, à refaire en CI |
| Scan ZAP sans alerte bloquante | Voir le rapport | [rapport-securite.md](rapport-securite.md) |
| Faille DAST High ou Critical | Voir le rapport | [rapport-securite.md](rapport-securite.md) |
| Seuils de charge (P95, P99, erreurs) | Oui, en local | [rapport-charge-k6.md](rapport-charge-k6.md) |
| Aucun secret en clair | Oui | Secrets injectés, `.env` ignorés par git |
| Traçabilité RTM sans rupture | Oui | `npm run rtm:check` |
| Runbook écrit | Oui | Ce document |
| Retour arrière testé | **Non** | Partie 4 |
| Recette UAT signée | **Non** | Fiches `TC-UAT-16` à `20` à exécuter |
| Accord ingénierie, métier, exploitation | **Non** | Relecture de la PR à obtenir |
