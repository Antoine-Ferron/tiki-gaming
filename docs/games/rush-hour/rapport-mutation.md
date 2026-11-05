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
| MSI front (domaine + `drag.ts`) | 98,65 % (6 survivants) | **100 %** (436 mutants neutralisés) |
| MSI back (`rush_hour`) | 95 % (8 survivants) | **97 %** (4 survivants, tous équivalents) |
| MSI back, projet entier (configuration CI) | — | **97 %** (392 / 403) |
| Rush Hour dans la mutation de la CI | non | **oui** |
| Cas limites non testés trouvés | — | **4** |
| Bouts de code inutiles supprimés | — | **2** |
| Tests Vitest Rush Hour | 295 | **308** |

## 7. Ce qu'il faut en retenir

- **Couverture ≠ vérification.** Avec 96 % de couverture en lignes, la mutation a quand même trouvé 4 cas limites que personne ne testait. Le plus parlant : un générateur qui ne tirerait plus qu'un seul plateau n'aurait fait échouer aucun test.
- **Un domaine écrit en TDD donne un MSI très haut dès le départ** (98,65 % et 95 %). C'est la preuve que les tests ont été écrits *avant* le code : chaque ligne est née pour faire passer un test.
- **Un mutant survivant n'est pas toujours un test manquant.** Ça peut être du code en trop (supprimé ici) ou un mutant équivalent (assumé et documenté).
- **La mutation a aussi testé l'outillage.** Elle a trouvé un test qui ne marchait que depuis un dossier précis, avant qu'il ne casse la CI.

**Coût.** La campagne complète du front prend environ 6 minutes en local, dont 61 % pour les mutants « statiques » (des valeurs définies au niveau du module, qui obligent à relancer toute la suite de tests). Le back prend environ 1 minute. Sur les PR, la CI lance Stryker et Pitest en mode **incrémental** : seuls les mutants des fichiers modifiés sont rejoués.
