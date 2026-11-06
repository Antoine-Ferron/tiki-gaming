# Matrice de traçabilité (RTM) — Démineur

Chaque exigence de [`REGLES.md`](../frontend/src/games/demineur/REGLES.md) tracée vers le(s) test(s)
qui la couvre, tous niveaux confondus (boîte blanche comme boîte noire). Complète le
[cahier de recette](cahier-de-recette-demineur.md) (UAT manuel) côté preuves automatisées.

| # | Exigence (REGLES.md) | Niveau | Test(s) |
|---|---|---|---|
| R1 | Grille de dimensions `rows × cols` | Unitaire | `logic.test.ts` — *crée une grille aux dimensions demandées* |
| R2 | Exactement `mineCount` mines placées | Unitaire + Fuzzing | `logic.test.ts` — *place exactement le nombre de mines demandé* ; `logic.fuzz.test.ts` — *createGrid produit toujours les bonnes dimensions et le bon nombre de mines* |
| R3 | Placement des mines piloté par le générateur injecté | Unitaire (Stub) | `logic.test.ts` — *place les mines aux positions fournies par le générateur injecté (Stub)* |
| R4 | Niveaux de difficulté (Débutant/Intermédiaire/Expert) | E2E + Smoke | `e2e/demineur.spec.ts` — *changer de difficulté redimensionne la grille* ; `e2e/smoke.spec.ts` (Débutant, parcours critique) |
| R5 | `adjacentMines` = mines dans les 8 cases voisines | Fuzzing | `logic.fuzz.test.ts` — *adjacentMines compte uniquement les mines voisines (vérifié par un calcul indépendant)* |
| R6 | Révéler une mine → défaite immédiate | BDD + Composant + E2E | `demineur.feature` (exemple ligne 0,0 → perdue) ; `DemineurGame.test.tsx` — *révéler une mine perd la partie* ; `e2e/demineur.spec.ts` — *révéler une mine termine la partie en défaite* |
| R7 | Case `adjacentMines > 0` se révèle seule | BDD | `demineur.feature` (exemple ligne 1,1 → en cours) |
| R8 | Case vide (`adjacentMines = 0`) → cascade sur les voisines | BDD + Fuzzing | `demineur.feature` — *Révéler une case vide déclenche une cascade* ; `logic.fuzz.test.ts` — *revealCell ne plante jamais... et ne déplace aucune mine* |
| R9 | Révéler une case déjà révélée ou flaguée → aucun effet | BDD | `demineur.feature` — *Révéler une case déjà révélée ne fait rien* ; *Un drapeau empêche la révélation* |
| R10 | Poser / retirer un drapeau sur une case non révélée | BDD + Composant + E2E | `demineur.feature` — *Un drapeau empêche la révélation* ; *Retirer un drapeau permet à nouveau la révélation* ; `DemineurGame.test.tsx` — *un clic droit pose un drapeau...* ; `e2e/demineur.spec.ts` — *un clic droit pose puis retire un drapeau* |
| R11 | `toggleFlag` hors grille → aucun effet (robustesse) | Unitaire + Fuzzing | `logic.test.ts` — *ne fait rien si les coordonnées sont hors de la grille* ; `logic.fuzz.test.ts` — *toggleFlag ne plante jamais et est sa propre inverse* |
| R12 | Victoire : toutes les cases non minées révélées | BDD + Fuzzing | `demineur.feature` (exemple ligne 2,2 → gagnée) ; `logic.fuzz.test.ts` — *getOutcome renvoie toujours un état valide* |
| R13 | Score = `max(0, mineCount × 100 − elapsedSeconds)` | Unitaire + BDD + Fuzzing | `logic.test.ts` — *pondère le score par 100 points par mine, pas par centième* ; `score.feature` (4 exemples) ; `logic.fuzz.test.ts` — *jamais négatif*, *monotonies croissante/décroissante* |
| R14 | Score envoyé via `ctx.submitScore`, ignoré en invité | Composant + Intégration | `DemineurGame.test.tsx` — *invite l'invité à se connecter uniquement en fin de partie* ; `tests/integration/scores.test.ts` (bornes `max_score`, PostgreSQL réel) |

## Exigences transversales (hors REGLES.md)

| # | Exigence | Niveau | Preuve |
|---|---|---|---|
| T1 | Accessibilité WCAG 2.1 AA | E2E (axe-core) | `e2e/accessibilite.spec.ts` — *page de jeu (démineur) : conforme WCAG 2.1 AA* |
| T2 | Absence de faille de sécurité dynamique | DAST | `quality/reports/zap-report-demineur.html` — 0 FAIL, 3 WARN mineurs |
| T3 | Dette technique / qualimétrie statique | SAST | `quality/sonar-demineur.sh` — Quality Gate passé, 0 bug/vulnérabilité |
| T4 | Résilience de la suite de tests elle-même | Mutation | Stryker — 100% (`logic.ts`) |
| T5 | Parcours critique disponible après déploiement | Smoke | `e2e/smoke.spec.ts` — accueil → grille jouable, < 2s |

**Couverture** : 14/14 exigences fonctionnelles tracées, 5/5 exigences transversales.
