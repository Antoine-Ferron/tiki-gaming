# Stratégie de tests — dames internationales

Stratégie prévue pour les étapes successives : voir le [backlog](backlog.md) et les [décisions d’architecture](architecture.md). Les deux premiers tests de US-01 (dimensions et cases vides) sont GREEN ; leurs résultats RED puis GREEN sont consignés dans le [journal TDD](journal-tdd.md).

## Niveaux et outils

- **Unitaires** : JUnit 5 et AssertJ via `spring-boot-starter-test` existant. Java pur, sans Spring, I/O, base ni variables d’environnement. Mockito, déjà fourni par le starter, seulement si un futur port nécessite un double ; utiliser de vrais objets Board et Piece pour les règles.
- **Frontend** : Vitest est désormais fourni par `dev` pour les tests unitaires TypeScript (`npm test`). Aucun test React/Dames supplémentaire n'est ajouté à cette étape.
- **Intégration** : Spring Boot Test et MockMvc après validation de l’API. Vérifier DTO, validation, sérialisation, erreurs, accès invité, CSRF et appel du vrai moteur. Une tranche MVC avec service simulé ne remplace pas une intégration du moteur réel. Persistance éventuelle dans une base de test isolée uniquement.
- **E2E** : Playwright envisagé, absent des dépendances actuelles. Justifier son ajout lors de cette étape future. React avec backend réel, aucun moteur simulé ; services de données éventuels isolés. Partie complète déterministe depuis l’état initial jusqu’à victoire puis réinitialisation ; deux personnes sur le même ordinateur, invité et connecté ; clavier et largeur 360 px. Attendre la résolution de la session du shell. Pas d’IA ni de multijoueur réseau.

## Matrice prévue

| US | Unitaire | Intégration future | E2E futur |
|---|---|---|---|
| 01 | 100 cases, parité, bornes, vide | DTO plateau | Plateau accessible 10 × 10 |
| 02 | 20/20, centre vide, occupation | État initial exposé | Placement |
| 03 | Blancs d’abord, alternance | Commande hors tour | Indication du tour |
| 04 | Diagonales avant des deux camps | Coup accepté / état renvoyé | Déplacer un pion |
| 05 | Classes invalides, atomicité | Entrées invalides / erreur stable | Refus compréhensible |
| 06 | Captures dans quatre directions | Retrait sérialisé | Capture visible |
| 07 | Obligation globale de prise | Refus du coup simple | Prise obligatoire |
| 08 | Rafles, maximum global, égalité | Parcours atomique | Rafle complète |
| 09 | Promotion finale, passage puis sortie | Nature sérialisée | Dame identifiable sans couleur seule |
| 10 | Dame volante, obstacles, rafles | Coups autorisés | Déplacement à distance |
| 11 | Élimination, blocage, terminal | Refus après fin | Partie complète et résultat |
| 12 | Restauration, indépendance | Nouvelle partie isolée | Rejouer |

Intégration et E2E dépendent de la validation du SDK/API : aucun endpoint n’existe actuellement. Préparer une suite reproductible de coups légaux depuis la position initiale pour l’E2E complet. Les positions proches de la fin le complètent sans le remplacer ; les fixtures spéciales restent dans l’environnement de test, sans endpoint de triche en production.

## Partitions d’équivalence et valeurs limites

| Entrée | Partitions | Limites |
|---|---|---|
| Position | Intérieure / extérieure, jouable / claire | -1, 0, 1, 8, 9, 10 sur chaque axe ; coins |
| Origine | Vide / alliée / adverse | Dernière pièce du camp, bord |
| Destination | Libre / alliée / adverse | Origine identique, bord |
| Déplacement pion | Avant / arrière / orthogonal / saut | Distance 0, 1, 2, supérieure à 2 |
| Capture | Aucune / une / plusieurs, avant / arrière | 0, 1, 2 prises ; maximum moins un / maximum |
| Rafle | Minoritaire / maximale unique / maximales à égalité | Deux branches égales, maximum par autre pièce |
| Dame | Diagonale libre / allié / adversaire / deux obstacles | Distance 1 à 9, zéro ou plusieurs arrivées après prise |
| Promotion | Hors rangée / arrivée finale / passage puis sortie | Lignes 0, 9 ; fin sur 1, 8 |
| Fin | Mobile / bloqué / sans pièce | 0 ou 1 pièce ; 0 ou 1 coup légal |
| Réinitialisation | Initiale / en cours / terminée | Deux réinitialisations successives |

Tests paramétrés pour directions et coordonnées ; sélectionner des représentants plutôt qu’un produit cartésien inutile. Documenter les fixtures par coordonnées, avec un diagramme si nécessaire.

## Invariants métier

1. Plateau 10 × 10, occupation des seules cases jouables, une pièce au plus par case.
2. Déplacement simple : effectifs conservés ; capture : retrait exact des adversaires pris, sans perte du camp actif.
3. Camp inchangé ; promotion sans création de pièce supplémentaire.
4. Un camp actif, changement uniquement après un coup complet accepté.
5. Refus : plateau, tour, historique et statut inchangés ; aucune mutation partielle.
6. Rafle avec la même pièce ; aucune double capture ; pièces prises bloquantes jusqu’au retrait final selon la spécification proposée.
7. Coup accepté parmi les coups légaux après obligation et maximum de captures.
8. État terminal stable ; nouvelle partie indépendante des anciennes références mutables.

## Exemples AAA — scénarios documentaires

**US-01 : dimensions**

- Arrange : aucune dépendance ; conventions du backlog.
- Act : créer un plateau vide via la future API Board.
- Assert : 10 lignes × 10 colonnes, 100 positions, 50 jouables, aucune pièce. Introduire ces attentes une par une pour des cycles courts.

**US-07 : capture disponible ailleurs**

- Arrange : blancs au trait ; blanc en (6,1), noir en (5,2), arrivée (4,3) libre ; autre blanc en (6,5), destination (5,4) libre ; aucune autre pièce.
- Act : demander (6,5) → (5,4).
- Assert : refus, car la prise par (6,1) est obligatoire ; état complet et tour inchangés.

**US-08 : prise majoritaire**

- Arrange : fixture dessinée proposant deux parcours complets de deux et trois prises ; aucun parcours plus long ailleurs.
- Act : demander le parcours de deux prises.
- Assert : refus sans mutation. Dans un scénario distinct, le parcours de trois prises est accepté, avec retrait exact de trois adversaires à la fin.

**US-09 : passage sur la rangée de promotion**

- Arrange : pion blanc en (2,1), noirs en (1,2) et (1,4), arrivées (0,3) et (2,5) libres, aucun autre obstacle.
- Act : rafle (2,1) → (0,3) → (2,5).
- Assert : deux prises, pièce toujours pion car arrivée finale hors rangée de promotion.

## Cycles RED / GREEN / REFACTOR

1. Lire l’US et sélectionner un seul comportement observable.
2. Écrire un test minimal dans `backend/src/test/java/fr/tikigaming/games/dame/`. Ajouter uniquement les signatures nécessaires pour observer un échec comportemental explicite.
3. Exécuter le test ciblé, conserver commande et échec attendu. Un problème de dépendances ou d’environnement n’est pas une preuve RED métier.
4. Implémenter le minimum de Java pur ; exécuter le test ciblé puis la suite backend.
5. Refactorer si nécessaire sans ajouter de comportement, garder les tests verts, puis passer au scénario suivant.
6. Après modification React : format, lint, tests Vitest et build ; côté Java : Spotless et `mvn verify`. Intégration et E2E quand les couches correspondantes existent.

US-03 commence par le camp initial ; son alternance complète se vérifie avec les premiers déplacements de US-04. Ne pas créer toutes les classes avant leur besoin dans les tests.

## Commandes prévues

```bash
# Racine, Java 21 et Maven disponibles
mvn -f backend/pom.xml -Dtest=BoardTest test
mvn -f backend/pom.xml test
mvn -f backend/pom.xml spotless:apply
mvn -f backend/pom.xml spotless:check checkstyle:check
mvn -f backend/pom.xml verify

# Frontend, installation verrouillée si nécessaire
cd frontend
npm ci
npm run format:check
npm run lint
npm test
npm run build
```

`BoardTest` contient les deux premiers tests de US-01, actuellement GREEN. Maven 3.9.11 est disponible avec Java 21 (installation détaillée dans le journal). Aucun wrapper Maven ni script E2E présent ; les tests unitaires frontend utilisent Vitest. Aucun credential Supabase nécessaire pour les tests unitaires métier.

La CI utilise Node 24 pour le frontend et Java 21 pour le backend. `verify` lance Checkstyle, la compilation, les tests et Spotless ; pendant RED, il s'arrête à l'échec du test. Exécuter `spotless:check` séparément permet de confirmer le format même dans cet état. Ne pas désactiver le test pour obtenir une CI verte. Pour formater, utiliser `npm run format` côté frontend (ou Prettier ciblé sur les fichiers modifiés) et `mvn spotless:apply` côté backend.

## Commits TDD proposés

Exemples de messages pour les prochains cycles TDD, lorsque les commits sont autorisés :

1. `test(dame): décrit les dimensions du damier (RED) (#18)` : test et signatures minimales, échec métier observé.
2. `feat(dame): initialise les dimensions du damier (GREEN) (#18)` : implémentation minimale, suite verte.
3. `refactor(dame): clarifie la représentation du plateau (#18)` : seulement si nécessaire, tests verts.

Conserver commandes et résultats RED/GREEN dans le journal de travail et la future PR. La fusion collective en squash ne conservera pas nécessairement ces commits dans `dev` : les traces doivent rester consultables dans la branche et la PR avant fusion. Dernier état soumis à revue vert ; future PR vers `dev`, liée à #18, en draft pendant le travail puis prête à relire une fois terminée avec CI verte ; revue plateforme pour le backend. Aucun push, commit, PR ou nouvelle issue automatique.
