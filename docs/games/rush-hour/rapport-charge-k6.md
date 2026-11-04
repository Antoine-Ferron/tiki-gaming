# Rush Hour : test de charge de la vérification des parties (k6)

> **Statut : fait, anomalie corrigée.** Ce document garde la trace du test de charge de l'endpoint de vérification des parties : ce qu'on a mesuré, l'anomalie trouvée (BUG-06), sa correction en TDD et le gain mesuré (cours J4_AM, SRE et k6).
> Suite de #102 (PR #114) · Branche : `game/rush-hour/stryker-fast-check-pact`

---

## 1. Pourquoi tester la charge de cet endpoint

À la fin de chaque niveau, le jeu envoie la partie à `POST /api/games/rush-hour/levels/{level}/results` : le serveur rejoue les coups et calcule le score (anti-triche, S6). En lisant le service, on voit qu'il **lance le solveur (parcours en largeur) à chaque requête** pour connaître le minimum de coups du niveau, **avant même de regarder les coups envoyés**. Une partie truquée d'un seul coup coûte donc autant qu'une vraie.

Le cours le dit : on **mesure avant d'optimiser**. On ajoute donc un scénario k6 avec des seuils, puis on regarde jusqu'où ça tient.

## 2. Le scénario

Ajouté au script k6 de la plateforme (`quality/k6/lobby.js`), qui tourne déjà en CI (job *Performance (k6)*) :

- **`rush_hour_verify`**, actif quand le backend est fourni (`BACKEND_URL`), comme le scénario `session` ;
- **le pire cas** : une partie gagnante du **niveau 20** (26 coups, le minimum), trouvée par le solveur du jeu ;
- le jeton **CSRF** est lu dans le cookie posé par le backend, comme le fait le navigateur ;
- **20 parties vérifiées par seconde** en charge nominale (`constant-arrival-rate`) ;
- **les mêmes seuils que le reste de la plateforme**, ajoutés à `docs/slo.md` : P95 < 300 ms, P99 < 500 ms, moins de 1 % d'erreurs. Si un seuil est dépassé, k6 renvoie un code d'erreur et la CI échoue.

## 3. Mesures avant correction

Backend local, mesure de la seule requête de vérification :

| Profil | Charge | P95 | P99 | Itérations abandonnées | SLO |
|---|---|---|---|---|---|
| Load (nominal) | 20 parties/s | 62 ms | 65 ms | 0 | ✅ |
| Stress ×5 | 100 parties/s | 122 ms | 172 ms | 1 | ✅ |
| Stress ×10 | 200 parties/s | **2,7 s** | **3,0 s** | **2 059** | ❌ |

La charge nominale passe largement. Mais le serveur **s'effondre entre 100 et 200 parties par seconde**, et ce sur une machine de développement à 16 cœurs : une machine de production plus petite tomberait plus tôt. Comme une partie truquée d'un seul coup coûte autant qu'une vraie, **n'importe qui pourrait saturer le serveur à peu de frais**.

C'est l'anomalie **BUG-06**, inscrite dans la RTM : sévérité S2 (majeure), priorité P2.

## 4. Correction, en TDD

Le minimum d'un niveau **ne change jamais** : il suffit de le calculer une fois.

| Étape | Commit | Ce qui a été fait |
|---|---|---|
| 🔴 Rouge | `test` | `LevelsTest` : `Levels.minimum(n)` donne le minimum du solveur pour les niveaux 1, 2, 10, 19 et 20, et rien pour 0, 21 ou -1. Version vide : 5 échecs (« expected: OptionalInt[3] but was: OptionalInt.empty »). |
| 🟢 Vert | `feat` | `Levels.minimum(n)` : calculé par le solveur au premier besoin, puis gardé dans une `ConcurrentHashMap`, sûre quand plusieurs requêtes arrivent ensemble. |
| 🔵 Refactor | `refactor` | `LevelResultService` lit `Levels.minimum(level)` au lieu de relancer le solveur. |

Le contrat partagé (`ContractTest`) et le contrat Pact vérifient toujours les mêmes minimums et les mêmes réponses : le comportement ne change pas, seul le coût change.

## 5. Mesures après correction

Mêmes charges, même machine :

| Charge | P95 avant | P95 après | P99 après | Erreurs / abandons après |
|---|---|---|---|---|
| 20 parties/s | 62 ms | **2,7 ms** | 4,4 ms | 0 / 0 |
| 100 parties/s | 122 ms | **1,3 ms** | 1,4 ms | 0 / 0 |
| 200 parties/s | **2,7 s** ❌ | **1,1 ms** | 1,3 ms | 0 / 0 |
| 400 parties/s | — | **0,8 ms** | 1,1 ms | 0 / 0 |

Le temps de réponse est divisé par **plus de 20** à la charge nominale. Le serveur tient maintenant **au moins 400 parties par seconde** sans dégradation, à plus de 250 fois sous le seuil. BUG-06 est close.

## 6. Ce qu'il faut en retenir

- **Les tests fonctionnels ne voient pas la performance.** Tous les tests passaient, Sonar et la mutation étaient au vert, mais le serveur s'effondrait sous la charge.
- **Mesurer avant d'optimiser.** La charge nominale passait : sans test de stress, on n'aurait rien vu. Et sans la mesure, on aurait pu optimiser autre chose, comme le rejeu des coups, qui ne coûtait presque rien.
- **La correction reste en TDD.** Même une optimisation commence par un test rouge, puis les filets existants (contrats, mutation) garantissent que le comportement ne change pas.
- **Un seuil k6 en CI** protège maintenant cette performance : une régression bloquerait la PR.

**Limites.** Ces mesures ont été faites en local, sur 16 cœurs. La CI les rejoue à la charge nominale, sur une machine plus petite. Le test de stress (×10) n'est pas lancé en CI, parce qu'il prendrait trop de temps.
