# Rush Hour : stratégie de tests

> **Livrable MSPR 4.1, « stratégie et matrice des tests »** (cours J1_AM). Ce document justifie, chiffres à l'appui, ce qui est testé à chaque étage et pourquoi, en partant des risques du jeu. Chiffres au 4 novembre 2026.
> Branche : `game/rush-hour/stryker-fast-check-pact`

---

## 1. Le principe

On ne teste pas « le plus possible ». On teste **chaque risque à l'étage le plus bas qui sait le détecter** : c'est là que le test est le plus rapide, le plus stable et le moins cher (cours J1_AM, loi de Boehm et pyramide de Cohn). On ne monte d'un étage que pour ce que l'étage du dessous ne peut pas voir :

- **le réseau** entre le jeu et le serveur → contrats ;
- **le navigateur réel** (mise en page, souris) → E2E ;
- **la charge** → k6 ;
- **la vigilance des tests eux-mêmes** → mutation.

Rush Hour s'y prête bien. Ses règles (déplacements, solveur, score, génération) sont du **code pur, sans entrée-sortie**, écrit en TDD : l'essentiel se teste en tests unitaires, en millisecondes.

## 2. Matrice risques × étages

| Risque | Gravité | Étages qui le couvrent | Tests | Pourquoi cet étage |
|---|---|---|---|---|
| **Triche au classement** : un score envoyé sans avoir vraiment joué | Haute | TU (rejeu, barème) · MockMvc (422, 404, 400) · Pact (forme de l'API) · contrat partagé | ~60 | Le serveur doit rejouer **lui-même** : on teste le rejeu en TU, puis la frontière HTTP |
| **Règles fausses** : un véhicule traverse un obstacle, un coup est mal compté | Haute | TU + valeurs limites · propriétés (fast-check) · mutation | ~90 | Logique pure : le TU est l'étage le plus rapide, et la mutation prouve que les assertions ont du mordant |
| **Le jeu et le serveur divergent** : mêmes niveaux, mêmes règles ? | Haute | Contrat partagé (`contrat.json`, lu des deux côtés) · Pact | 79 | Ni le front ni le back seul ne peuvent voir une divergence : il faut un fichier commun |
| **Score faux** (barème) | Haute | TU + valeurs limites · BDD (plan du scénario) · propriétés | ~35 | Règle métier : en Gherkin pour être lisible par le métier, et en TU pour les frontières |
| **Progression perdue** : record effacé, mauvais niveau débloqué | Moyenne | Services avec Fakes · BDD | ~30 | Interaction avec la sauvegarde de la plateforme : les Fakes simulent pannes et coupures sans réseau |
| **Plateau généré impossible ou hors difficulté** | Moyenne | TU (graines fixes) · mutation | 23 | Hasard injecté : graine fixe = reproductible |
| **Interface** : geste souris, clavier, messages d'erreur | Moyenne | Composant (Testing Library) · E2E (Playwright) | 24 | Le clavier et les erreurs en composant ; le **vrai geste** seulement en E2E (jsdom n'a pas de mise en page) |
| **Accessibilité** | Moyenne | E2E + axe-core (WCAG 2.1 AA) | 1 audit × 3 navigateurs | Les règles WCAG se vérifient sur la page réellement rendue |
| **Charge / saturation** du serveur | Moyenne | k6 (seuils P95 / P99) | 1 scénario | Seul un test de charge voit un problème de performance |
| **Tests qui mentent** : couverture sans vérification | Transverse | Mutation (Stryker, Pitest) · contrôle des générateurs fast-check | — | La couverture dit « exécuté », la mutation dit « vérifié » |

## 3. La pyramide, en chiffres

| Étage | Front | Back | Total | Part | Durée |
|---|---|---|---|---|---|
| **Unitaire** (domaine, services avec doublures, propriétés) | 207 | 41 | **248** | **67 %** | ~3 s au total |
| **Contrat** (règles partagées, Pact) | 39 + 2 | 38 | **79** | **21 %** | < 1 s (+ vérification Spring) |
| **Composant / web** (Testing Library, MockMvc) | 20 | 5 | **25** | **7 %** | ~2 s |
| **BDD** (fonctionnel, à l'échelle unitaire) | 14 scénarios | — | **14** | **4 %** | < 1 s |
| **E2E** (Playwright, 3 navigateurs) | 3 + 1 audit | — | **4** | **1 %** | ~10 s |
| **Charge** (k6) | — | 1 scénario | **1** | — | 30 s en CI |
| **Total** | | | **~370** | | |

Le détail du front : 180 tests unitaires du domaine, 17 tests de services, 10 propriétés.

La forme est bien celle de la pyramide de Cohn (environ 70 % / 20 % / 10 %), et **pas celle du cône glacé** : rien n'est testé seulement par l'interface. Il y a peu d'E2E, et c'est voulu : le cours les réserve aux parcours critiques. Ici, ce sont le geste principal du joueur, gagner un niveau, et l'accessibilité.

Une précision sur le comptage : Vitest affiche 321 tests pour le front, parce qu'il compte chaque étape Gherkin (55) au lieu de chaque scénario (14), et chaque ligne des tests paramétrés (`test.each`).

## 4. Les garde-fous de la suite elle-même

| Garde-fou | Résultat | Ce qu'il prouve |
|---|---|---|
| **Couverture** (SonarQube) | front 96 % en lignes, back 99 % | Le code est exécuté par les tests |
| **Mutation** (Stryker, Pitest) | front 100 %, back 97 % (seuil 75 %) | Les tests **détectent** un code modifié |
| **Propriétés** (fast-check) | 10 propriétés, 2 200 tirages | Les règles tiennent hors des exemples choisis |
| **Traçabilité** (RTM) | 9 exigences, chacune avec au moins un cas nominal et un cas d'erreur | Aucune règle du cahier des charges n'est orpheline |
| **Anti-flaky** | horloge et hasard injectés, suite lancée dans un ordre aléatoire | Pas de test qui dépend de la machine ou de l'ordre |
| **CI en paliers** | lint → TU → intégration → mutation et E2E → k6 et Sonar | Un échec arrête tout au plus tôt (fail-fast) |

## 5. Ce que cette stratégie a trouvé

Trois anomalies, chacune à un étage différent. C'est la preuve que chaque étage sert :

| Anomalie | Trouvée par | Étage |
|---|---|---|
| BUG-04 : glissé asymétrique (demi-case ignorée vers la gauche) | test rouge de `dropDelta` | Unitaire (TDD) |
| BUG-05 : boutons de niveau non conformes au critère WCAG 2.5.3 | audit axe | E2E |
| BUG-06 : serveur saturé à 200 parties/s (solveur relancé à chaque requête) | test de stress | Charge (k6) |

La mutation a en plus trouvé **7 cas limites non testés** et **4 bouts de code inutiles**, alors que la couverture était déjà de 96 %.

## 6. Choix écartés, et pourquoi

| Pas fait | Raison |
|---|---|
| Testcontainers propre à Rush Hour | Rush Hour n'a pas de table à lui. La plateforme teste déjà avec un vrai Postgres la ligne du catalogue et le plafond de score (`max_score`). |
| Glisser-déposer testé dans jsdom | jsdom ne calcule aucune mise en page. Le calcul est testé en TU, le geste en E2E. |
| Chaos / disjoncteur côté serveur | L'endpoint de Rush Hour n'appelle aucun service externe. Côté jeu, la dégradation gracieuse (score gardé hors ligne, messages d'erreur) est testée. |
| Séance Three Amigos | Non tenue : les scénarios Gherkin ont été écrits par le développeur seul. C'est une limite assumée (anti-pattern « BDD sans le métier »). |
| Recette (UAT) exécutée | 4 fiches prêtes (TC-UAT-07 à 10), à jouer par un humain sur l'application déployée. |
