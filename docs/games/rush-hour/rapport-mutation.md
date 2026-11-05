# Rush Hour : campagne de mutation (Stryker et Pitest)

> **Statut : fait.** Ce document garde la trace de la mutation du code de Rush Hour : ce que les outils ont relevé, ce qu'on en a conclu, ce qu'on a corrigé et ce que ça a changé. Il fait suite au [rapport SonarQube](rapport-sonarqube.md).
> Issue : #102 · Branche : `game/rush-hour/qualite-sonar` · Cours : J3_AM (mutation testing)

---

## 1. Pourquoi une campagne de mutation

Après l'analyse SonarQube, la couverture du front Rush Hour était de 96 % en lignes. Mais **une ligne exécutée n'est pas une ligne vérifiée** (cours J3_AM, « l'illusion de la couverture ») : un test peut passer sur une ligne sans contrôler son résultat.

La mutation mesure ce que la couverture ne voit pas. L'outil introduit un petit bug dans le code (un `>` changé en `>=`, un `+` en `-`, une condition remplacée par `true`…) puis relance les tests :

- un mutant **tué** (au moins un test échoue) : les tests protègent cette ligne ;
- un mutant **survivant** (tous les tests passent) : il manque un test, ou le code est en trop.

Le **score de mutation (MSI)** = (mutants tués + timeouts) / mutants. Le seuil du cours et de la plateforme est **75 %** sur le cœur métier.

## 2. Comment la campagne a été faite

- **Date** : 4 novembre 2026, sur la branche `game/rush-hour/qualite-sonar`.
- **Front, Stryker** : le domaine (`src/games/rush-hour/domain`) et le calcul du glissé (`components/drag.ts`). Les niveaux (`levels.ts`) et la réserve du générateur (`generatorLayouts.ts`) sont exclus : ce sont des données, et muter une carte de niveau n'apprend rien.
- **Back, Pitest** : les classes `fr.tikigaming.games.rush_hour`, avec les mutateurs `STRONGER` de la plateforme.
- **Point de départ** : Rush Hour ne faisait partie **d'aucune** campagne de mutation. La plateforme ne mutait que son propre domaine, l'authentification, la résilience et le jeu Dame.

Commandes utilisées (configuration temporaire pour viser seulement Rush Hour) :

```bash
# Front
npx stryker run <config qui reprend stryker.config.mjs avec mutate = domaine Rush Hour>
# Back
mvn -Pmutation test-compile org.pitest:pitest-maven:mutationCoverage \
  -DtargetClasses='fr.tikigaming.games.rush_hour.*' -DtargetTests='fr.tikigaming.games.rush_hour.*Test'
```

## 3. Ce que les outils ont rapporté

### Avant même de muter : Stryker ne démarrait pas

Le premier lancement a échoué pendant le passage à blanc :

```
contract.test.ts: ENOENT: no such file or directory,
open '…/frontend/.stryker-tmp/shared/games/rush-hour/contrat.json'
```

Stryker copie `frontend/` dans un bac à sable (`frontend/.stryker-tmp/sandbox-…`). Le test de contrat lisait le fichier partagé par un chemin fixe (`../../../../shared/…`), qui ne menait plus nulle part depuis ce bac à sable.

La CI ne l'avait jamais vu. Son lanceur Stryker ne fait tourner que les tests liés aux fichiers mutés, et Rush Hour n'était pas muté. **Ajouter Rush Hour à la configuration sans corriger ce chemin aurait fait tomber le job Stryker de la CI.**

### Premiers scores

| | Mutants | Tués + timeouts | Survivants | MSI |
|---|---|---|---|---|
| Front (Stryker) | 443 | 437 | 6 | **98,65 %** |
| Back (Pitest) | 153 | 145 | 8 | **95 %** |

Les deux scores dépassaient déjà largement 75 %, ce qui est attendu pour un domaine écrit en TDD. Restaient 14 mutants survivants à expliquer.

## 4. Diagnostic des survivants

On applique le protocole du cours : **isoler la ligne, identifier la faille, tuer le mutant**.

| Où | Mutant | Diagnostic | Catégorie |
|---|---|---|---|
| `generator.ts:11` | `random() * n` remplacé par `random() / n` | Le générateur prendrait **toujours la 1ʳᵉ disposition** de la réserve. Aucun test ne vérifiait que toute la réserve sert | ❌ test manquant |
| `session.ts:86` | `solve(…)?.[0]` remplacé par `solve(…)[0]` | Aucun test d'indice sur un **plateau sans solution** | ❌ test manquant |
| `session.ts:87` | `if (next)` remplacé par `if (true)` | Même cas : l'indice serait compté alors qu'il n'y en a pas | ❌ test manquant |
| `SolutionVerifier.java:79` | `delta > 0` remplacé par `true` | Aucun test de **recul contre un autre véhicule** : on ne testait que la sortie du plateau | ❌ test manquant |
| `SolutionVerifier.java:74` (2 mutants) | `target + length > SIZE` remplacé par `false`, `+` changé en `-` | Aucun test de **dépassement du bord droit**. Sans cette vérification, la voiture « déborde » sur la ligne suivante | ❌ test manquant |
| `SolutionVerifier.java:56` | `total != 0` remplacé par `false` | La fusion R6 perdue passait inaperçue : le test existant (X+1, X+1, X+2) donne 1 coup dans les deux cas | ❌ test manquant |
| `session.ts:85` | `if (this.solved) return null` remplacé par `false` | **Équivalent** : la solution d'un plateau gagné est vide, donc `null` de toute façon | 🧹 code en trop |
| `moves.ts:14` (2 mutants) | retrait du filtre « sauf le véhicule lui-même » | **Équivalents** : `moveRange` ne teste que les cases devant et derrière le véhicule, jamais les siennes | 🧹 code en trop |
| `SolutionVerifier.java:79-80` (2 mutants) | `delta > 0` changé en `delta >= 0` | **Équivalents** : `delta = 0` est refusé plus tôt (« Déplacement nul ») | ⚖️ équivalent assumé |
| `Solver.java:72` (2 mutants) | bornes de la boucle `indexOfRedCar` | **Équivalents** : `Board.parse` garantit une voiture rouge, la fin de la boucle n'est jamais atteinte | ⚖️ équivalent assumé |

En résumé :
- **8 mutants** révélaient **4 cas non testés** ;
- **3 mutants** révélaient **2 bouts de code inutiles** ;
- **4 mutants** sont équivalents, et on les garde. Ils protègent des gardes défensives : refus d'un plateau sans voiture rouge, sens d'un déplacement nul.

## 5. Ce qui a été fait

Dans l'ordre des commits :

| Commit | Ce qui a été fait |
|---|---|
| `test` | Le test de contrat cherche `shared/games/rush-hour/contrat.json` **en remontant les dossiers**. Il marche depuis le dépôt comme depuis le bac à sable de Stryker. |
| `test` | 3 tests back (`SolutionVerifierTest`) : recul contre un véhicule refusé, dépassement du bord droit refusé, coup fusionné suivi d'un autre véhicule (3 coups). |
| `test` | 2 tests front : chaque disposition de la réserve peut être tirée (`generator.test.ts`, 12 cas) ; plateau sans solution, ni indice ni indice compté (`session.test.ts`). |
| `refactor` | Suppression du filtre inutile dans `moveRange` et de la condition redondante dans `hint()`. |
| `chore` | **Rush Hour ajouté à la mutation de la CI** : `frontend/stryker.config.mjs` et profil `mutation` du `backend/pom.xml`, comme pour Dame. |

**Chaque nouveau test a été vérifié contre son mutant.** On réapplique la mutation à la main : le test échoue avec le mutant, et passe sur le vrai code. Par exemple, avec `random() / n`, le test du générateur échoue sur 11 des 12 dispositions (seule la n°0 reste tirée).

**Pourquoi supprimer du code plutôt qu'écrire un test ?** Un mutant équivalent ne peut être tué par aucun test, puisque le programme se comporte pareil. Quand la ligne ne sert à rien, la retirer est la bonne réponse : c'est la 3ᵉ loi du TDD, « n'écrire que le code strictement nécessaire ».

## 6. Résultats

| | Avant | Après |
|---|---|---|
| MSI front (domaine + `drag.ts`) | 98,65 % (6 survivants) | **100 %** (471 mutants neutralisés, voir § 8) |
| MSI back (`rush_hour`) | 95 % (8 survivants) | **97 %** (4 survivants, tous équivalents) |
| MSI back, projet entier (configuration CI) | — | **97 %** (392 / 403) |
| Rush Hour dans la mutation de la CI | non | **oui** |
| Cas limites non testés trouvés | — | **7** (4 + 3 révélés au § 8) |
| Bouts de code inutiles supprimés | — | **4** (2 + 2 révélés au § 8) |
| Tests Vitest Rush Hour | 295 | **311** |

## 7. Ce qu'il faut en retenir

- **Couverture ≠ vérification.** Avec 96 % de couverture en lignes, la mutation a quand même trouvé 4 cas limites que personne ne testait. Le plus parlant : un générateur qui ne tirerait plus qu'un seul plateau n'aurait fait échouer aucun test.
- **Un domaine écrit en TDD donne un MSI très haut dès le départ** (98,65 % et 95 %). C'est la preuve que les tests ont été écrits *avant* le code : chaque ligne est née pour faire passer un test.
- **Un mutant survivant n'est pas toujours un test manquant.** Ça peut être du code en trop (supprimé ici) ou un mutant équivalent (assumé et documenté).
- **La mutation a aussi testé l'outillage.** Elle a trouvé un test qui ne marchait que depuis un dossier précis, avant qu'il ne casse la CI.

## 8. Coût de la mutation en CI : de plus de 20 minutes à quelques minutes

### Ce qu'on a observé

Sur la PR, le job **Mutation (Stryker)** a dépassé **20 minutes**, contre 1 à 4 minutes pour les autres PR. Le nombre de tests unitaires n'y était pour rien : les 311 tests de Rush Hour tournent en 3 secondes, et Stryker ne relance pour chaque mutant que les tests qui couvrent sa ligne (`coverageAnalysis: 'perTest'`).

### Diagnostic

1. **Des mutants « statiques ».** Pour Stryker, un mutant est statique quand son code s'exécute **au chargement** d'un fichier de test, hors de tout test. Il ne sait alors plus quels tests le couvrent et relance **toute la suite** pour chacun. Chez nous, **295 mutants sur 477** l'étaient. Trois fichiers de test calculaient des données au chargement : la solution des 20 niveaux (`levels.test.ts`), le niveau 1 et sa solution (`RushHourGame.test.tsx`), un plateau dans le corps d'un `describe` (`moves.test.ts`). Un quatrième préchauffait le générateur dans un `beforeAll`, que Stryker compte aussi comme statique.
2. **Un cache incrémental invalidé.** La clé du cache de Stryker contient l'empreinte de `stryker.config.mjs`. En ajoutant Rush Hour à cette configuration, on a changé la clé : le job est reparti de zéro et a rejoué **tous** les mutants, ceux de la plateforme compris.
3. **Une machine plus petite.** La machine GitHub a 4 cœurs, contre 16 en local : une campagne de 6 minutes en local en dure facilement plus de 20 là-bas.

### Corrections

- **Données de test calculées au premier usage, dans un test** (une petite fonction `lazy`, ou un calcul dans chaque test), et un délai de 30 s par test au lieu du préchauffage. Le comportement testé ne change pas : 311 tests verts, y compris dans un ordre aléatoire.
- **Clé de secours pour le cache Stryker dans la CI** (`stryker-${{ runner.os }}-`). Après un changement de configuration, le job reprend le dernier rapport incrémental et ne rejoue que les mutants nouveaux ou touchés.

| Campagne Stryker Rush Hour (en local) | Avant | Après |
|---|---|---|
| Mutants statiques | 295 | **7** |
| Durée | 5 min 47 | **3 min 02** |
| Score de mutation | 100 % | **100 %** (471 mutants : 413 tués, 58 timeouts) |

### Effet inattendu : de faux « tués » révélés

En supprimant les calculs faits au chargement, **6 mutants de `board.ts` sont passés de « tué » à « survivant »**. Avant, un mutant qui cassait le parseur faisait planter le **chargement** d'un fichier de test entier, et Stryker comptait ça comme une victoire. Le mutant était tué pour une mauvaise raison. Une fois chaque mutant testé seulement par les tests qui le couvrent, les vrais trous sont apparus :

- **3 tests manquants** : un véhicule vertical en pointillés, en L, ou décalé d'une colonne. Seul le cas horizontal était testé. Les tests sont ajoutés ;
- **3 mutants équivalents**, et le code concerné est supprimé :
  - les ancres `^` et `$` de la regex sont inutiles, puisqu'on teste un seul caractère à la fois ;
  - en horizontal, vérifier que toutes les cases sont sur la même ligne ne sert à rien, puisque c'est ce qui définit « horizontal ».

**À retenir.** Un score de mutation peut lui aussi mentir, quand des mutants sont tués par effet de bord. Mesurer le *pourquoi* d'un mutant tué compte autant que le score.

Les 3 mutants équivalents du générateur (cache, positions déjà gagnées jamais tirées) peuvent apparaître comme survivants selon l'ordre d'exécution, parce que le cache des dispositions est partagé entre les tests d'un même processus. Ils n'ont pas d'effet sur ce que voit le joueur.
