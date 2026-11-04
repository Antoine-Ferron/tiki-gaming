# Niveaux de service (SLI, SLO, SLA) et budget d'erreur

Ce que la plateforme promet aux joueurs, comment on le mesure, et ce qu'on fait quand la promesse n'est pas tenue.
Les seuils sont vérifiés en CI par k6 ([quality/k6/lobby.js](../quality/k6/lobby.js), job `Performance (k6)`) ;
les patrons de résilience sont décrits plus bas.

## Le triptyque

- **SLI** (indicateur) : ce qu'on mesure, en continu.
- **SLO** (objectif interne) : la cible de l'équipe, toujours **plus stricte** que le SLA, pour garder une marge.
- **SLA** (engagement) : ce qu'on promettrait à un client. Tiki Gaming est un projet de cours sans contrat : le
  SLA est indicatif, il sert à dimensionner la marge du SLO.

| Parcours | SLI | SLO (interne) | SLA (indicatif) |
|----------|-----|---------------|-----------------|
| Lecture du classement (`GET /leaderboard`, PostgREST) | latence des réponses 2xx | P95 < 300 ms, P99 < 500 ms | P95 < 1 s |
| Envoi d'un score (`POST /api/scores` → `public.scores`) | latence | P95 < 300 ms, P99 < 500 ms | P95 < 1 s |
| Session (`GET /api/auth/session`, backend Java) | latence | P95 < 300 ms, P99 < 500 ms | P95 < 1 s |
| Vérification d'une partie de Rush Hour (`POST /api/games/rush-hour/levels/{level}/results`, niveau 20 = pire cas) | latence | P95 < 300 ms, P99 < 500 ms | P95 < 1 s |
| Toutes les requêtes du lobby | taux d'erreur (5xx, timeouts) | < 1 % | < 2 % |
| Plateforme | disponibilité mensuelle | **99,5 %** | **99,0 %** |

### Pourquoi ces valeurs

- **300 ms** : en dessous, l'affichage du classement en fin de partie paraît instantané ; au-delà, le joueur voit un
  chargement. Le P99 à 500 ms borne la « traîne » : 1 joueur sur 100 au pire attend une demi-seconde.
- **1 %** d'erreurs : un score refusé pour panne n'est pas perdu (le front le garde sur l'appareil, `scoreQueue`),
  donc quelques échecs sont tolérables ; plus, et le classement se décale visiblement.
- **99,5 %** : 100 % est absurde (coût infini) ; 99,5 % laisse assez de marge pour livrer souvent.

## Budget d'erreur

**Budget = 100 % − SLO.** Pour une disponibilité de 99,5 % sur 30 jours (43 200 minutes) :

| | Calcul | Budget |
|---|--------|--------|
| SLO 99,5 % | 0,5 % × 43 200 min | **216 min** (3 h 36) d'indisponibilité par mois |
| SLA 99,0 % | 1,0 % × 43 200 min | 432 min (7 h 12) |
| Taux d'erreur < 1 % | 1 % × 170 req/s × 3 600 s | ≈ 6 100 requêtes en échec par heure de charge nominale |

Règle d'usage :

- **budget restant > 0** : on livre normalement ;
- **budget épuisé** : gel des nouvelles fonctionnalités, tout l'effort va à la fiabilité (correctifs, tests) jusqu'à
  ce que le budget se reconstitue sur la période glissante.

Limite assumée : la production n'a pas encore de supervision (pas de métriques continues Vercel/Supabase). Les SLI
sont donc mesurés **avant** la production, en CI, sur un environnement miroir (même image PostgreSQL, mêmes
migrations, même RLS, 1 000 joueurs et 10 000 scores factices).

## Mesure : profils k6

```bash
docker compose -f quality/docker-compose.yml up -d --wait db rest   # base miroir + PostgREST
K6_PROFILE=load docker compose -f quality/docker-compose.yml run --rm k6
```

| Profil (`K6_PROFILE`) | Charge injectée | Objectif | En CI |
|-----------------------|-----------------|----------|-------|
| `smoke` | 1 utilisateur, 5 itérations | le système répond à froid | — |
| `load` (défaut) | débit nominal constant : 100 req/s classement, 20 req/s scores, 50 req/s session, 30 s | SLO en régime de croisière | **bloquant** |
| `stress` | montée par paliers jusqu'à 8× le nominal (8 min) | charge maximale, mode d'effondrement | — |
| `spike` | ×10 en 5 s, maintenu 30 s, puis retour | encaisser un pic et s'en remettre | — |
| `soak` | moitié du nominal pendant 2 h (`K6_DURATION`) | fuites mémoire, épuisement des pools | — |

Les seuils (`thresholds`) sont les SLO : si l'un est dépassé, k6 sort en erreur et la CI échoue.

### Résultats mesurés (environnement local, 4 novembre 2026)

| Profil | Requêtes | Erreurs | Classement P95 / P99 | Scores P95 / P99 | Verdict |
|--------|----------|---------|----------------------|------------------|---------|
| `smoke` | 10 | 0 % | 9,8 / 9,9 ms | 4,9 / 4,9 ms | SLO tenus |
| `load` (30 s, comme en CI) | 3 602 | 0 % | 8,1 / 11,2 ms | 31,8 / 116,1 ms | SLO tenus |
| `spike` (×10) | 32 034 | 8,2 % | 23,5 / 31,7 s | 22,6 / 30,8 s | **SLO violés** |
| `load` juste après le spike | — | 0 % | 592,7 / 773,1 ms | 562,3 / 698,9 ms | **SLO violés** |

Le pic ×10 (≈ 1 000 req/s sur le classement) sature l'unique PostgREST local : les requêtes s'accumulent, la latence
explose puis des erreurs apparaissent. C'est la charge de rupture de cet environnement, pas de la production
(Supabase mutualise et met à l'échelle). Le run `load` lancé juste après montre un second effet : les milliers de
scores insérés pendant le pic ralentissent la vue `leaderboard`, qui agrège toute la table à chaque lecture ; sur une
base réinitialisée, les SLO sont de nouveau tenus. Pistes si ce pic devenait réaliste : mettre le classement en cache
(il change seulement à chaque fin de partie), ou le servir par une vue matérialisée.

## Résilience : quand une dépendance tombe

Le backend appelle Supabase ; une panne de Supabase ne doit pas bloquer le backend ni faire perdre un score.

| Patron | Où | Comportement | Preuve |
|--------|----|--------------|--------|
| Timeouts | `spring.http.clients` (application.yml) | connexion 2 s, lecture 3 s : un appel lent est abandonné au lieu de bloquer un thread | `SupabaseScoresChaosTest` |
| Disjoncteur (circuit breaker) | `fr.tikigaming.resilience.CircuitBreaker`, devant l'insertion des scores | 5 pannes consécutives → ouvert 30 s : réponse 503 immédiate, sans appel réseau ; puis un appel d'essai (semi-ouvert) referme ou rouvre | `CircuitBreakerTest` (horloge simulée), `SupabaseScoresChaosTest` |
| Dégradation gracieuse | front, `scoreQueue` | un score refusé pour panne (502, 503, coupure) est gardé sur l'appareil et renvoyé à la partie suivante | `scores.feature`, E2E « Supabase en panne » |

`SupabaseScoresChaosTest` place **Toxiproxy** (Testcontainers) entre le client et un faux PostgREST, puis injecte :

- une **latence de 1 200 ms** : chaque appel est abandonné au timeout (≈ 500 ms dans le test), le disjoncteur s'ouvre
  au 3e, et l'appel suivant répond 503 en moins de 100 ms ;
- une **coupure brutale** (proxy désactivé) : 502 puis 503, aucun appel ne passe ; quand le réseau revient, l'appel
  d'essai passe et le circuit se referme ;
- une **panne courte** (sous le seuil) : le circuit ne s'ouvre jamais.
