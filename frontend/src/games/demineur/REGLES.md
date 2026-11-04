# Règles du Démineur

Jeu solo (jouable en invité). Référence pour l'implémentation en TDD : chaque règle ci-dessous
doit être couverte par un test dans [logic.test.ts](logic.test.ts) avant d'être codée dans
[logic.ts](logic.ts).

## Grille

- La grille est un tableau 2D de cases (`rows` × `cols`).
- `mineCount` mines sont placées aléatoirement, une seule par case.
- Niveaux de difficulté (classiques du démineur) :

  | Niveau        | Dimensions | Mines |
  | ------------- | ---------- | ----- |
  | Débutant      | 9 × 9      | 10    |
  | Intermédiaire | 16 × 16    | 40    |
  | Expert        | 30 × 16    | 99    |

## Case

Chaque case a :

- `mine` : contient une mine ou non (caché au joueur jusqu'à révélation).
- `revealed` : révélée ou encore masquée.
- `flagged` : marquée d'un drapeau par le joueur (case suspectée minée, non révélable tant que le drapeau est posé).
- `adjacentMines` : nombre de mines dans les 8 cases adjacentes (0 à 8), affiché une fois la case révélée.

## Révélation d'une case

- Le joueur révèle une case non révélée et non flaguée.
- Si la case est minée → défaite immédiate.
- Si la case a `adjacentMines > 0` → elle se révèle seule et affiche ce nombre.
- Si la case a `adjacentMines === 0` (case « vide ») → elle se révèle et déclenche la révélation
  en cascade de ses voisines (qui, si elles sont aussi vides, cascadent à leur tour).
- Révéler une case déjà révélée ou flaguée n'a aucun effet.

## Drapeaux

- Le joueur peut poser ou retirer un drapeau sur une case non révélée.
- Une case flaguée ne peut pas être révélée (il faut d'abord retirer le drapeau).

## Fin de partie

- **Défaite** : une case minée est révélée.
- **Victoire** : toutes les cases non minées sont révélées (peu importe l'état des drapeaux sur
  les mines restantes).

## Score

- Calculé à la victoire, à partir du temps écoulé et du nombre de mines (plus rapide et plus de
  mines = meilleur score) : `score = max(0, mineCount × 100 − elapsedSeconds)`.
- Envoyé via `ctx.submitScore` (ignoré en mode invité, voir [index.ts](index.ts)).
