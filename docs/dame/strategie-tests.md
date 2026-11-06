# Stratégie des tests unitaires — dames internationales

> **Document historique des étapes de développement.** Les mesures et les
> mentions « à réaliser » ci-dessous se rapportent à leurs lots respectifs.
> Pour le périmètre livré et les limites actuelles, voir le [bilan Dames](README.md).

## Périmètre et choix des doublures

Cette première PR porte sur le métier pur : 224 cas JUnit 5/AssertJ, sans Spring, I/O, base, réseau, attente ou état global partagé. `Board`, `Piece`, `Position` et `GameRules` sont exécutés réellement. `DameTestSupport` construit des fixtures explicites, sans calculer les résultats attendus avec le moteur.

Une doublure sera utilisée lorsqu'une dépendance externe réelle devra être contrôlée. Aucune dépendance de ce type n'existe dans le moteur actuel ; ajouter des mocks de ses objets simples masquerait le comportement à vérifier. Les tests d'intégration, API et interface sont réservés à une PR distincte, conformément au découpage demandé par l'utilisateur.

La démarche combine boîte noire (partitions, limites, invariants) et boîte blanche (couverture des branches et mutation). Les durées Surefire, qui incluent l'instrumentation et le démarrage JVM, ne certifient pas un seuil absolu inférieur à 5 ms pour chaque première invocation.

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
- Act : créer un plateau vide via l'API Board.
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

## RED, GREEN et preuves

Les étapes originales sont reprises dans cette branche en ne gardant que le domaine, ses tests et leur documentation : `d7d1bb4` (initialisation), `faed34f` (premiers tests), `2b95d64` (RED global), `8f73f29` (GREEN). Le commit RED a été rejoué sur cette base : 220 cas, 191 échecs, zéro erreur. Le GREEN ciblé passe 224 cas ; les quatre cas supplémentaires concernent le statut de parties reconstruites déjà terminales. Aucun test n'est désactivé ni affaibli.

Le contrôle complet `mvn clean verify` réussit avec 847 cas (224 Dames, 623 collectifs). JaCoCo mesure 100 % des lignes et branches du domaine. Cette mesure ne constitue pas un score de mutation.

Le profil Maven `mutation` existant conserve les cibles d'authentification et reçoit `fr.tikigaming.games.dame.*` et ses tests. Les mutateurs `STRONGER` et le seuil de 75 % sont conservés ; aucun nouvel outil ou dépendance ajouté. Résultat mesuré : Dames 149/156 mutants tués (95,51 %), profil complet 213/220 (96,82 %), sans timeout ni absence de couverture. Les sept survivants sont analysés dans [mutation.md](mutation.md), sans nouvelle exclusion.

## Commandes

```bash
# Depuis la racine, Java 21 et Maven disponibles
mvn -f backend/pom.xml '-Dtest=fr.tikigaming.games.dame.*Test' test
mvn -f backend/pom.xml spotless:apply
mvn -f backend/pom.xml clean verify
mvn -f backend/pom.xml -Pmutation test-compile org.pitest:pitest-maven:mutationCoverage
```

Rapports : `backend/target/surefire-reports/`, `backend/target/site/jacoco/`, `backend/target/pit-reports/`. La CI collective conserve tous ses contrôles et seuils. La PR vise `dev`, référence #18 sans la fermer et requiert la revue plateforme pour le package serveur et le profil Maven. Aucun test d'intégration propre à Dames n'est ajouté dans cette livraison.
