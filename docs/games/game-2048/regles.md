# 2048 : cahier des charges (version solo)

> Issue : #89. Scénarios exécutables : [`frontend/src/games/game-2048/features/`](../../../frontend/src/games/game-2048/features/).

---

## 1. Le jeu en une phrase

Un casse-tête sur une grille de 4 × 4 : **fais glisser toutes les tuiles d'un coup dans une direction ; deux tuiles de même valeur qui se rencontrent fusionnent. Atteins la tuile 2048.**

## 2. Les règles du jeu

| N° | Règle |
|----|-------|
| R1 | La grille fait **4 × 4** cases. Une partie commence avec **2 tuiles** posées au hasard. |
| R2 | **Un coup** = faire glisser **toutes** les tuiles vers le haut, le bas, la gauche ou la droite. Elles avancent jusqu'au bord ou jusqu'à la tuile suivante. |
| R3 | Deux tuiles **de même valeur** qui se rencontrent **fusionnent** en une tuile de valeur double. Une tuile ne fusionne **qu'une fois par coup** : `2 2 2 2` vers la gauche donne `4 4 . .`, pas `8 . . .`. |
| R4 | Quand trois tuiles égales se suivent, ce sont les deux plus proches du bord visé qui fusionnent : `2 2 2 .` vers la gauche donne `4 2 . .`. |
| R5 | Chaque fusion **rapporte la valeur de la tuile créée** : `4 + 4 → 8`, soit 8 points. Les points d'un coup s'additionnent (`2 2 4 4` vers la gauche → 4 + 8 = 12 points). |
| R6 | Après un coup qui a **bougé au moins une tuile**, une nouvelle tuile apparaît sur une **case vide** au hasard : un **2** dans 90 % des cas, un **4** sinon. |
| R7 | Un coup qui **ne bouge aucune tuile ne compte pas** : pas de nouvelle tuile, pas de point. |

## 3. Fin de partie

| N° | Règle |
|----|-------|
| F1 | **Victoire** dès qu'une tuile **2048** apparaît. Le jeu affiche « Tu as gagné ! » et propose **Continuer** (garder la grille et le score pour aller plus haut) ou **Nouvelle partie**. |
| F2 | Après avoir choisi Continuer, on ne regagne pas une deuxième fois : la partie se poursuit jusqu'à la défaite. |
| F3 | **Défaite** quand la grille est **pleine** et qu'**aucune fusion n'est possible** dans aucune direction. Le jeu affiche « Partie terminée » et le bouton **Nouvelle partie**. |
| F4 | Une partie est **terminée** par une défaite, ou quand le joueur lance une **Nouvelle partie** alors que son score est supérieur à 0 (il abandonne la partie en cours). |

## 4. Score, record et classement

| N° | Règle |
|----|-------|
| S1 | Le **score** de la partie est la somme des points des fusions (R5). Il est affiché en permanence, ainsi que le **meilleur score** du joueur. |
| S2 | **Pas de score maximal** : `scoreLimits` absent côté front, `max_score` à `null` en base. Le score reste un entier positif ou nul. |
| S3 | **Joueur connecté** : à la fin de chaque partie (F4), son score est envoyé au classement avec `ctx.submitScore`. Les métadonnées donnent la **plus grande tuile** atteinte et le **nombre de coups**. Le classement ne garde que le meilleur score de chaque joueur. |
| S4 | **Record** : le meilleur score est **sauvegardé** (`ctx.save`). Une partie moins bonne ne le fait jamais baisser. |
| S5 | **Invité** : le score n'est pas envoyé au classement, mais son record est gardé dans son navigateur. Le jeu l'invite à se connecter pour être classé. |
| S6 | **Score refusé** par le classement : le message d'erreur est affiché, et le record n'est pas sauvegardé, pour qu'une prochaine partie aussi bonne le renvoie. |
| S7 | **Coupure réseau** : le SDK garde le score sur l'appareil et l'enverra plus tard. Le record est sauvegardé et le joueur est prévenu (« Connexion perdue… »). |

## 5. Contrôles et affichage

| N° | Règle |
|----|-------|
| C1 | **Clavier** : les **flèches** (et `Z Q S D` / `W A S D`) jouent un coup. Les autres touches ne font rien. Les flèches ne font pas défiler la page pendant la partie. |
| C2 | La grille indique chaque tuile par **son nombre écrit** (pas par sa couleur seule) ; une case vide est annoncée comme vide aux lecteurs d'écran. |
| C3 | Jouable sur **téléphone** : la grille s'adapte à la largeur, sans défilement horizontal à 360 px. |
| C4 | Le style suit la [charte graphique](../../charte-graphique.md) : une `.card` pour la grille, une `.card` pour le classement, couleurs des tuiles en variables `--game-2048-*`. |

## 6. Hors périmètre (pour l'instant)

- Le glisser au doigt (swipe) sur téléphone.
- Annuler un coup, tailles de grille autres que 4 × 4.
- La vérification de la partie par le serveur (anti-triche).
- Les animations de glissement des tuiles.

---

## 7. Ce qu'on testera en TDD

Chaque règle devient un ou plusieurs tests, écrits **avant** le code.

| Règle | Exemple de test |
|-------|-----------------|
| R2    | `. 2 . 2` vers la gauche → `4 . . .` ; `2 4 8 16` vers la gauche → rien ne bouge. |
| R3    | `2 2 2 2` vers la gauche → `4 4 . .` (une seule fusion par tuile). |
| R4    | `2 2 2 .` vers la gauche → `4 2 . .` ; vers la droite → `. . 2 4`. |
| R5    | `2 2 4 4` vers la gauche → 12 points. |
| R6    | Avec un hasard fixé (stub), la nouvelle tuile apparaît sur la case vide choisie, et vaut 4 quand le tirage est ≥ 0,9. |
| R7    | Un coup qui ne bouge rien n'appelle pas l'apparition d'une tuile (spy). |
| F1    | Une fusion `1024 + 1024` → victoire ; continuer puis refaire 2048 ne regagne pas. |
| F3    | Grille pleine sans fusion → défaite ; grille pleine avec une fusion possible → la partie continue. |
| S4    | Record de 500, partie à 300 → le record reste 500. |
| S6/S7 | Avec les fakes de la plateforme (`FakeScores.failNext`) : refus → record non gardé ; coupure → record gardé. |

## 8. À valider ensemble

- [ ] Victoire avec Continuer / Nouvelle partie (F1, F2).
- [ ] Nouvelle partie en cours de jeu = fin de partie, score envoyé (F4).
- [ ] Contrôles `Z Q S D` / `W A S D` en plus des flèches (C1).
