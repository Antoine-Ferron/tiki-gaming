# Rush Hour : sécurité de l'endpoint de vérification

> **Statut : fait.** Ce document garde la trace de l'analyse de sécurité de `POST /api/games/rush-hour/levels/{level}/results` : les risques OWASP examinés, la limite par client ajoutée en TDD, et le scan dynamique ZAP (cours J4_PM).
> Suite de #102 (PR #114) · Branche : `game/rush-hour/stryker-fast-check-pact`

---

## 1. Les risques examinés (OWASP API Top 10)

| Risque | Pour cet endpoint | Statut |
|---|---|---|
| **BOLA / IDOR** (accéder à l'objet d'un autre en changeant un identifiant) | L'endpoint ne reçoit **aucun identifiant de joueur ni de ressource privée** : seulement un numéro de niveau (public) et une liste de coups. Le score est enregistré par la plateforme **pour le joueur de la session**, jamais pour un identifiant envoyé par le navigateur. C'est le « contrôle de propriété strict » du cours. | ✅ Par conception |
| **Données non fiables** (le client ment) | Le serveur ne croit pas le score envoyé : il **rejoue les coups** et calcule lui-même le score (anti-triche). Une partie impossible est refusée en **422**. | ✅ Testé (TU, MockMvc, Pact) |
| **Validation à la frontière** | Véhicule = une lettre majuscule (regex), au plus 500 coups, indices ≥ 0, champs obligatoires : sinon **400**. | ✅ Testé (`RushHourControllerTest`) |
| **Consommation de ressources sans limite** (API4) | Avant : aucune limite, et chaque requête relançait le solveur (BUG-06). Après : coût par requête quasi nul (BUG-06 corrigé), **et au plus 60 parties vérifiées par minute et par client**, sinon **429**. | ✅ Ajouté en TDD (section 2) |
| **CSRF** | Toute requête qui modifie quelque chose exige le jeton `X-XSRF-TOKEN` (plateforme). | 🏛️ Testé par la plateforme |
| **Secrets** | Aucun secret dans le code de Rush Hour. | ✅ |

## 2. La limite par client, en TDD

| Étape | Commit | Ce qui a été fait |
|---|---|---|
| 🔴 Rouge | `test` | `ResultRateLimiterTest` : au plus N demandes par minute et par client. Valeurs limites N-1, N, N+1 ; nouvelle minute à 59 s (refusé) et 60 s (accepté) ; clients indépendants. **Horloge injectée** : on avance le temps sans attendre une vraie minute. |
| 🟢 Vert | `feat` | `ResultRateLimiter` : fenêtre fixe d'une minute, ouverte par la première demande ; 60 par défaut (`tiki.rush-hour.max-results-per-minute`) ; mémoire bornée (fenêtres terminées oubliées au-delà de 10 000 clients). |
| 🔴 Rouge | `test` | `RushHourRateLimitTest` (MockMvc, limite réduite à 2) : la 3ᵉ partie du même client → **429** avec un message pour le joueur ; un autre client n'est pas gêné. |
| 🟢 Vert | `feat` | Le contrôleur consulte la limite avec **l'adresse du joueur** (via `X-Forwarded-For` derrière le proxy, `server.forward-headers-strategy`) ; réponse 429 documentée dans OpenAPI. |
| CI | `ci` | Le test de charge k6 envoie tout depuis une seule adresse : il mesure la capacité du serveur, pas la limite. Celle-ci est donc relevée **pour ce job seulement**. |

**Pourquoi 60 par minute ?** Un joueur termine un niveau en quelques secondes au mieux. Et une salle de classe peut partager la même adresse IP : une limite trop basse bloquerait de vrais joueurs.

**Vérifié en vrai** : backend lancé avec une limite de 3, puis 4 parties envoyées : les 3 premières reçoivent `200`, la 4ᵉ reçoit `429 {"error":"Trop de parties envoyées : réessaie dans une minute."}`.

## 3. Le scan dynamique (DAST) avec OWASP ZAP

La CI de la plateforme lance ZAP en mode *baseline* (passif), mais seulement sur les adresses racines du front et de l'API : **notre endpoint n'y passait pas**. On a donc lancé un **scan d'API** à partir de la description OpenAPI, sur le backend local :

```bash
docker run --rm --network host -v "$PWD:/zap/wrk:rw" zaproxy/zap-stable:2.17.0 \
  zap-api-scan.py -t http://localhost:8080/v3/api-docs -f openapi -r zap-api.html -J zap-api.json -I
```

**Résultat pour tout le backend** : `FAIL-NEW: 0 · WARN-NEW: 6 · PASS: 115`.

**Pour l'endpoint de Rush Hour** :

| Alerte | Risque | Analyse |
|---|---|---|
| Cookie sans HttpOnly | Faible | C'est le cookie `XSRF-TOKEN` : il **doit** être lisible par JavaScript, pour que le front recopie le jeton dans l'en-tête de chaque requête (protection CSRF « double soumission »). Choix voulu de la plateforme. |
| Cookie sans attribut SameSite | Faible | Même cookie `XSRF-TOKEN`. Le cookie de session, lui, est `SameSite=Lax` et `HttpOnly` (`application.yml`). |
| Contenu non stockable, réponse de gestion de session | Informatif | Normal pour une API. |

**Aucune alerte haute ni moyenne sur Rush Hour.** Les autres alertes concernent d'autres jeux ou la plateforme (par exemple une erreur 500 de Mastermind exposée).

**Limite du scan, à dire honnêtement** : les attaques actives de ZAP sur notre `POST` ont été **arrêtées en amont par la protection CSRF** (réponse 403). Le scan prouve donc surtout que l'endpoint n'est pas attaquable sans jeton. La robustesse face à des entrées malveillantes est couverte par les tests : validation (400), parties impossibles (422), fuzzing du parseur (fast-check).

## 4. Ce qu'il faut en retenir

- **BOLA ne se corrige pas ici : il ne se pose pas**, parce que l'identité vient de la session et non de la requête. C'est un choix de conception à défendre, pas une faille.
- **La sécurité se teste comme le reste** : la limite par client a été écrite en TDD, aux valeurs limites, avec une horloge injectée.
- **Un scanner a des angles morts** : ZAP n'a pas pu passer la protection CSRF. On le sait, on le dit, et les tests couvrent ce qu'il ne voit pas.
