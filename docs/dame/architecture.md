# Domaine Dames et tests unitaires — issue #18

## Livraison initiale — PR #93

La branche `game/dame/tests-unitaires`, fusionnée dans `dev` par la PR #93, livre le moteur Java pur et ses tests unitaires. Elle part de `dev` à `0317320` et reprend les étapes TDD du travail original en conservant l'auteur et leur ordre. Le travail complet reste conservé sur `game/dame/implementation` ; API, SDK, interface et tests d'intégration feront l'objet d'une livraison séparée.

Cette PR ne modifie aucun jeu existant, endpoint, catalogue frontend, migration ou configuration de sécurité. Elle étend seulement les cibles du profil PIT existant au package Dames, en conservant les cibles d'authentification, les mutateurs et le seuil de 75 %.

## Domaine et dépendances

`fr.tikigaming.games.dame` importe uniquement le JDK. Il n'utilise ni Spring, ni réseau, ni base, ni horloge ou hasard. Les tests emploient les vrais objets métier et des positions littérales construites par `DameTestSupport` ; ce constructeur de fixtures n'est pas un mock ou un stub.

| Type | Responsabilité |
|---|---|
| `Position` | Coordonnées immuables, entre 0 et 9 |
| `Board` | Plateau 10 × 10, copie immuable des pièces, placement initial 20/20 |
| `Player`, `Piece` | Camp et nature pion/dame, sans compte utilisateur |
| `Move` | Origine et parcours complet du coup |
| `GameRules` | Coups légaux, priorité et maximum de captures, dames volantes, promotion et statut |
| `Game` | Tour courant, application atomique, victoire et réinitialisation |
| `GameStatus` | En cours, victoire blanche ou noire |

Les nulles internationales restent hors de cette première livraison : aucune règle de répétition ou compteur n'est inventée. L'issue #18 reste ouverte. L'intégration technique est discutée dans la PR suivante ; le métier restera indépendant des futurs adaptateurs.

## Comprendre le traitement d'un coup


`Game.play` refuse d'abord une commande sur une partie terminée. `GameRules.apply` vérifie ensuite que le parcours demandé appartient à la liste des coups légaux et construit un nouveau plateau sans modifier l'ancien. Le camp suivant et son statut sont calculés avant toute affectation : un refus conserve donc plateau, tour et statut. Un coup complet accepté change le camp une fois, même s'il donne la victoire. `reset` reconstruit la position initiale, remet les blancs au trait et rétablit `IN_PROGRESS`.

Pour les rafles, `GameRules` utilise une recherche en profondeur (DFS) : il suit une possibilité de capture jusqu'à sa fin, puis revient explorer les autres possibilités. Chaque branche conserve son parcours et les victimes déjà prises. Les victimes restent présentes et bloquantes jusqu'à la fin du coup, mais ne peuvent pas être prises une seconde fois. Le moteur conserve ensuite les parcours complets qui prennent le plus de pièces, parmi toutes les pièces du camp actif. En l'absence de capture, il propose les déplacements ordinaires. La promotion est appliquée uniquement sur la dernière arrivée du parcours.

## Vérifications

- 224 cas métier verts dans 13 classes JUnit 5.
- RED historique rejoué sur `2b95d64` : 220 cas, 191 échecs, zéro erreur.
- GREEN `8f73f29` : les mêmes assertions passent, avec quatre régressions supplémentaires sur les positions reconstruites déjà terminales.
- `mvn clean verify` : 847 cas réussis, dont 224 Dames et 623 collectifs ; Checkstyle, Spotless et seuils JaCoCo verts.
- JaCoCo du domaine : 187/187 lignes et 128/128 branches, soit 100 %.

La couverture mesure l'exécution du code, pas la solidité des assertions. PIT mesure 149 mutations tuées sur 156 pour Dames, soit 95,51 %, sans timeout ni mutant non couvert. L'[analyse des sept survivants](mutation.md) distingue les équivalences argumentées d'une limite du contrat d'erreur. Voir l'[index des tests](tests-metier.md), la [stratégie](strategie-tests.md) et le [journal TDD](journal-tdd.md).

## Étape suivante — rencontres locales

La branche `game/dame/rencontres`, créée depuis `dev` à `e521099`, ajoute le
sous-package pur `matches` : `Match`, `MatchRepository` et `MatchService`.
Le service orchestre les noms des participants et la clôture à partir du résultat
du moteur ; il ne dépend que d'un port de persistance, d'une horloge et d'un
fournisseur d'identifiants. Le moteur initial reste inchangé.

Les tests distinguent un fake fonctionnel en mémoire, des stubs de réponse et de
panne, et des mocks d'interaction ciblés. Les règles, limites, résultats de
vérification et étapes restantes sont décrits dans [rencontres.md](rencontres.md).
La [persistance](persistance.md) dispose désormais d'un adaptateur PostgREST et
de tests Testcontainers sur les vrais services PostgreSQL/PostgREST. La table est
privée au backend et protège les transitions concurrentes. Le raccordement
API/interface reste à réaliser.

Les [scénarios Gherkin](bdd.md) des rencontres, prises et victoire sont exécutés
par `DameBddTest`. Les étapes Java utilisent le vrai moteur et `MatchService`
avec le fake de dépôt partagé : 12 cas automatisés sans Spring, réseau ou Docker.
Le rapport HTML est généré sous `backend/target/cucumber/dame.html` et publié en
artefact par le check backend CI.
