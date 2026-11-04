# Rush Hour : tests de propriété et fuzzing (fast-check)

> **Statut : fait.** Ce document garde la trace des tests de propriété ajoutés au domaine de Rush Hour : ce qu'on a voulu vérifier, les pièges rencontrés, et comment on s'est assuré que ces tests attrapent de vrais bugs (cours J3_AM, fuzzing).
> Suite de #102 (PR #114) · Branche : `game/rush-hour/stryker-fast-check-pact` · Fait suite au [rapport de mutation](rapport-mutation.md)

---

## 1. Le principe

Un test classique vérifie **un exemple** : « 11 coups pour un minimum de 10 → 950 points ». Un test de propriété vérifie **une règle sur des centaines d'entrées tirées au hasard** : « quelle que soit la partie, le score reste entre 0 et 1000 ». Quand une entrée casse la règle, **fast-check la réduit au plus petit contre-exemple** et affiche la graine pour rejouer exactement le même tirage.

Le **fuzzing** en est un cas particulier : envoyer des entrées inattendues, voire absurdes, pour vérifier que le code ne plante jamais autrement que prévu.

Ces tests complètent les valeurs limites (BVA) écrites en TDD, sans les remplacer. Les valeurs limites testent les frontières qu'on connaît. Les propriétés cherchent celles qu'on n'a pas imaginées.

## 2. Ce qui est vérifié

| Fichier | Propriété | Règle | Tirages |
|---|---|---|---|
| `domain/board.property.test.ts` | **Fuzzing** : toute grille est acceptée, ou refusée avec l'un des 5 messages prévus ; jamais une autre erreur | R1–R3 | 500 |
| | **Aller-retour** : un plateau accepté, redessiné à partir des véhicules lus, redonne exactement la même grille | R1–R3 | 500 |
| | Un plateau accepté respecte les règles : véhicules de 2 ou 3 cases, dans la grille, sans chevauchement, voiture rouge sur sa ligne | R1–R3 | 500 |
| `domain/session.property.test.ts` | Après n'importe quelle suite de coups légaux (niveaux 1, 10 et 20), tout annuler ramène au plateau de départ ; il n'y a jamais plus de coups comptés que de glissements | P3, R6 | 3 × 100 |
| `domain/score.property.test.ts` | Le score est un entier entre 0 et 1000 ; un coup en trop ou un indice de plus ne le fait jamais monter | § 7 | 100 |
| `components/drag.property.test.ts` | Le décalage reste dans les cases libres ; au lâcher, la case la plus proche, à moins d'une demi-case, et la même dans les deux sens | C1 | 100 |

Les **10 propriétés** tournent en **0,25 s** au total.

Choix techniques :
- **des `expect` dans la propriété**, et non un `return true/false`. fast-check traite l'exception comme un échec, et Sonar y reconnaît des assertions : pas de faux positif « test sans assertion » (S2699), contrairement aux tests fast-check de la plateforme ;
- **des cibles rapides**. Une propriété sur le générateur de plateaux a été essayée puis retirée : elle coûtait 17 s et ne trouvait rien que les autres tests ne trouvent déjà. Stryker l'aurait en plus relancée pour chacun des 79 mutants du générateur (voir le [rapport de mutation](rapport-mutation.md), § 8).

## 3. Deux pièges, et comment on les a vus

### Un fuzzing qui ne testait rien

Le premier générateur tirait chaque case au hasard. On a mesuré ce qu'il produisait sur 5 000 grilles : **aucune n'était acceptée**. Plus de la moitié avaient la mauvaise taille, et les autres avaient des lettres éparpillées qui ne formaient jamais un vrai véhicule. La propriété « un plateau accepté respecte les règles » passait donc **sans jamais rien vérifier**.

Correction : on **construit des plateaux valides** en posant des véhicules au hasard, puis on en **abîme** une partie (une case changée, une ligne ou une case en trop ou en moins). Nouvelle mesure :

| Résultat sur 5 000 grilles | Part |
|---|---|
| Plateau accepté | **52 %** |
| Mauvaise taille | 25 % |
| Véhicule de mauvaise longueur, en morceaux, caractère interdit, voiture rouge mal placée | le reste |

**À retenir** : un test de propriété qui passe ne prouve rien tant qu'on n'a pas regardé ce qu'il tire.

### Un bug connu que le hasard ne trouvait pas

On a réintroduit le BUG-04 (`Math.round`, glissé asymétrique) pour vérifier que la propriété de l'arrondi le détecte. Les deux arrondis ne diffèrent **qu'aux demi-cases exactes** (-0,5, -1,5…), et un nombre décimal tiré au hasard n'y tombe presque jamais : **le bug passait**.

Correction : le générateur propose aussi des demi-cases exactes. Le BUG-04 est maintenant trouvé, avec le contre-exemple **`-1.5`**.

Autre détail : `Math.round(-0)` renvoie `-0`, que `toBe` distingue de `0`. La comparaison se fait avec `===`, qui les confond comme le jeu.

## 4. Preuve que les propriétés attrapent de vrais bugs

Chaque propriété a été vérifiée contre une panne réintroduite à la main, puis le code a été restauré :

| Panne réintroduite | Propriété qui échoue | Contre-exemple réduit par fast-check |
|---|---|---|
| BUG-04 : `Math.round(offset)` | arrondi symétrique | `-1.5` |
| Continuité horizontale non vérifiée | aller-retour lecture/dessin | `["......","AA.A..","XX....", …]` : un véhicule en deux morceaux accepté |
| `undo()` qui n'annule plus le premier coup | annulation totale | `[[2, 0]]` : un seul coup suffit |

## 5. Résultats

| | Avant | Après |
|---|---|---|
| Tests de propriété Rush Hour | 0 | **10** (2 200 tirages par exécution) |
| Tests Vitest Rush Hour | 311 | **321** |
| Durée de la suite Rush Hour | ~3 s | ~3 s (+0,25 s) |
| Cas de test dans la RTM | 31 | **36** (TC-RH-31 à 35) |

Aucun nouveau bug trouvé dans le code actuel : le domaine écrit en TDD, puis passé à la mutation, tenait déjà. Les propriétés servent maintenant de **filet** : elles retrouvent les bugs connus, et elles explorent à chaque exécution des combinaisons qu'aucun test d'exemple ne couvre.
