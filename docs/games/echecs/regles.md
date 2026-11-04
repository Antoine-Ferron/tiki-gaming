# Échecs : cahier des charges (V1, deux joueurs sur le même écran)

Issue : #5 · Équipe : Jeux Classiques · Responsable : Youssef

Seules les règles listées ici sont implémentées (et testées) : tout le reste est hors périmètre.
Référence des règles : le **Règlement des échecs de la FIDE**. En cas de doute, c'est lui qui tranche.

---

## 1. Le jeu en une phrase

Deux joueurs s'affrontent sur un échiquier de 8 × 8 cases ; le premier qui **met le roi adverse en échec et mat**
gagne, et la partie peut aussi finir par **nulle**.

## Format

| Élément      | Valeur                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| Catégorie    | `duel` (2 joueurs)                                                         |
| Mode         | `solo` : jouable sans compte                                               |
| Joueurs      | 2 humains sur le même écran, à tour de rôle (V1) ; contre une IA plus tard |
| Durée        | Jusqu'au mat, à la nulle ou à l'abandon                                    |
| Score envoyé | **Aucun en V1** (on ne se classe pas contre soi-même) — voir § 9           |
| Sauvegarde   | Partie en cours (`ctx.save`), reprise au chargement                        |

## Répartition front / back

| Côté | Rôle |
| ---- | ---- |
| **Back** (`backend/.../games/echecs/`) | **Fait autorité** : contient toutes les règles (moteur Java pur, sans I/O), dit quels coups sont légaux et si la partie est finie. |
| **Front** (`frontend/src/games/echecs/`) | **Affiche** l'échiquier, envoie les coups, sauvegarde la partie via `ctx`. Ne contient aucune règle. |

---

## 2. L'échiquier (E)

| #  | Règle |
| -- | ----- |
| E1 | 64 cases : colonnes `a` à `h` (gauche → droite côté Blancs), rangées `1` à `8` (bas → haut côté Blancs). |
| E2 | Une case se nomme colonne + rangée : `a1`, `e4`, `h8`. Toute autre écriture (`i1`, `a9`, `a0`, `e44`, vide) est refusée. |
| E3 | La case `h1` est claire (en bas à droite de chaque joueur). |
| E4 | Position de départ : rangée 1 `T C F D R F C T` (Blancs), rangée 2 pions blancs, rangées 7-8 pareil pour les Noirs. Dame sur sa couleur (`d1`, `d8`), rois en `e1` / `e8`. |
| E5 | Les **Blancs commencent**, puis les joueurs alternent. |
| E6 | Une position complète s'écrit en **FEN** (une ligne de texte). Position de départ : `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`. |

## 3. Déplacements des pièces (D)

| #  | Pièce | Déplacement | Capture |
| -- | ----- | ----------- | ------- |
| D1 | Toutes | Une pièce ne va jamais sur une case occupée par une pièce de **sa** couleur ; elle **capture** une pièce adverse en prenant sa place. | — |
| D2 | **Roi** | 1 case dans les 8 directions | idem |
| D3 | **Dame** | Toute distance en ligne droite (colonne, rangée, diagonale), sans sauter | idem |
| D4 | **Tour** | Toute distance en colonne ou rangée, sans sauter | idem |
| D5 | **Fou** | Toute distance en diagonale, sans sauter | idem |
| D6 | **Cavalier** | En « L » (2 + 1), **saute** par-dessus les pièces | idem |
| D7 | **Pion** | 1 case vers l'avant si elle est vide ; **2 cases** depuis sa rangée de départ (2 pour les Blancs, 7 pour les Noirs) si les deux cases sont vides. Ne recule jamais. | **Uniquement** 1 case en diagonale vers l'avant |

## 4. Coups spéciaux (S)

| #  | Règle |
| -- | ----- |
| S1 | **Petit roque** : roi `e1→g1`, tour `h1→f1` (Noirs : `e8→g8`, `h8→f8`). **Grand roque** : roi `e1→c1`, tour `a1→d1` (Noirs : `e8→c8`, `a8→d8`). |
| S2 | Roque autorisé **seulement si** : (1) le roi n'a jamais bougé ; (2) la tour concernée n'a jamais bougé ; (3) toutes les cases entre eux sont vides ; (4) le roi n'est pas en échec ; (5) le roi ne traverse pas une case attaquée ; (6) le roi n'arrive pas sur une case attaquée. La **tour**, elle, peut être attaquée. |
| S3 | Le droit au roque est **perdu définitivement** si le roi bouge (les deux côtés) ou si la tour bouge ou est capturée (son côté). |
| S4 | **Prise en passant** : un pion qui vient d'avancer de 2 cases à côté d'un pion adverse peut être pris comme s'il n'avait avancé que d'1 case. Uniquement **au coup suivant immédiatement**. |
| S5 | La prise en passant est refusée si elle laisse son propre roi en échec (cas des deux pions qui disparaissent d'une même rangée). |
| S6 | **Promotion** : un pion qui atteint la dernière rangée devient **obligatoirement**, au choix, une dame, une tour, un fou ou un cavalier de sa couleur (jamais un roi, jamais rester pion). Par avance ou par capture. |

## 5. Échec et coups légaux (L)

| #  | Règle |
| -- | ----- |
| L1 | **Échec** : le roi est attaqué par au moins une pièce adverse. |
| L2 | Un coup est **illégal** s'il laisse ou met **son propre roi en échec** (pièce clouée, roi sur une case attaquée, échec ignoré). |
| L3 | Les deux rois ne sont jamais sur des cases voisines. |
| L4 | En échec double (deux attaquants), seul un déplacement du roi est possible. |
| L5 | Un coup illégal est **refusé** et la position ne change pas. |

## 6. Fins de partie (F)

| #  | Fin | Condition | Résultat |
| -- | --- | --------- | -------- |
| F1 | **Échec et mat** | Roi en échec et aucun coup légal | Victoire de l'adversaire |
| F2 | **Pat** | Roi **pas** en échec et aucun coup légal | Nulle |
| F3 | **Matériel insuffisant** | Roi contre roi ; roi + fou contre roi ; roi + cavalier contre roi ; roi + fou contre roi + fou, fous sur des cases de même couleur | Nulle |
| F4 | **Triple répétition** | Même position 3 fois (mêmes pièces, même joueur au trait, mêmes droits de roque et de prise en passant) | Nulle (automatique en V1) |
| F5 | **Règle des 50 coups** | 100 demi-coups de suite sans capture ni mouvement de pion | Nulle (automatique en V1) |
| F6 | **Abandon** | Un joueur abandonne | Victoire de l'adversaire |
| F7 | **Nulle par accord** | Un joueur propose, l'autre accepte | Nulle |
| F8 | Une partie terminée **n'accepte plus aucun coup**. | | |

Résultat affiché : `1-0`, `0-1` ou `½-½`, avec la raison (mat, pat, matériel insuffisant, répétition, 50 coups,
abandon, accord).

---

## 7. Pendant une partie (P)

| #  | Règle |
| -- | ----- |
| P1 | Cliquer une pièce du joueur au trait **surligne ses coups légaux** ; cliquer une case surlignée joue le coup. |
| P2 | Un coup illégal remet la pièce à sa place, sans message bloquant. |
| P3 | Le dernier coup joué et le roi en échec sont surlignés ; le joueur au trait est affiché. |
| P4 | Promotion : une fenêtre propose dame, tour, fou, cavalier ; fermer la fenêtre annule le coup. |
| P5 | L'historique des coups s'affiche en notation algébrique (`1. e4 e5 2. Cf3 …`). |
| P6 | Boutons : **Nouvelle partie**, **Annuler le coup**, **Abandonner**, **Proposer nulle**, **Retourner l'échiquier**. |
| P7 | En fin de partie : résultat + raison, boutons « Rejouer ». |

## 8. Sauvegarde (SV)

| #   | Règle |
| --- | ----- |
| SV1 | Après chaque coup, la partie est sauvegardée avec `ctx.save` : position de départ (FEN) + liste des coups joués. |
| SV2 | Au chargement, si une partie existe : proposer **Reprendre** ou **Nouvelle partie**. |
| SV3 | Une sauvegarde illisible ou corrompue est ignorée (nouvelle partie), sans planter le jeu. |
| SV4 | En fin de partie, la sauvegarde est effacée (`ctx.clearSave`). |
| SV5 | En invité, la sauvegarde est locale au navigateur (géré par `ctx`). |

## 9. Score et classement

En V1 (deux joueurs sur le même écran), **aucun score n'est envoyé** : pas de `scoreLimits`, pas de `max_score`.
Le score viendra avec le mode contre l'IA (voir § 12).

## 10. Contrôles et affichage

- Clic sur la pièce puis sur la case d'arrivée (glisser-déposer en bonus).
- Jouable de 360 px de large (mobile) au grand écran ; cases annoncées aux lecteurs d'écran (`e4, cavalier blanc`).
- CSS du jeu préfixé `echecs-`, charte graphique de la plateforme, tutoiement.

## 11. Hors périmètre (pour l'instant)

IA · pendule · score et classement · partie en ligne entre deux comptes · variantes (Chess960…) · import PGN ·
classement Elo.

---

## 12. Ce qu'on testera en TDD

Chaque règle devient un ou plusieurs tests, écrits **avant** le code (moteur côté back, JUnit). Quelques exemples :

| Règle | Exemple de test |
| ----- | --------------- |
| E2 | `a1` → colonne 0, rangée 0 ; `h8` → colonne 7, rangée 7 ; `i1`, `a9`, `a0` → refusés. |
| E6 | Lire puis réécrire une FEN redonne exactement la même FEN. |
| D6 | Cavalier au centre → 8 coups ; au bord → 4 ; dans le coin `a1` → **2**. |
| D7 | Pion en `e2` → `e3` et `e4` possibles ; pion en `e3` → seulement `e4` ; case devant occupée → aucun coup. |
| S2 | Chacune des 6 conditions du roque, violée seule → roque refusé ; tour attaquée → roque accepté. |
| S4 | Prise en passant juste après le double pas → acceptée ; un coup plus tard → refusée. |
| S6 | Pion en 7ᵉ rangée qui avance → doit choisir dame / tour / fou / cavalier. |
| L2 | Pièce clouée sur son roi → ne peut pas quitter la ligne. |
| F1 | Mat du berger (`e4 e5 Fc4 Cc6 Dh5 Cf6 Dxf7#`) → `1-0`, raison « mat ». |
| F2 | `7k/5Q2/6K1/8/8/8/8/8 b` → pat, `½-½`. |
| F5 | 99 demi-coups sans prise ni pion → en cours ; 100 → nulle. |
| Global | **Perft** : depuis la position de départ, 20 positions à 1 coup, 400 à 2, 8 902 à 3 (valeurs de référence publiques). |

Les critères d'acceptation sont aussi écrits en **Gherkin** (scénarios en français : position FEN → coup → résultat),
exécutés sur le moteur.

---

## 13. À valider ensemble

Cocher quand l'équipe est d'accord :

- [ ] Le moteur des règles est côté **back** (`backend/.../games/echecs/`), le front ne fait qu'afficher. À faire relire par l'équipe plateforme.
- [ ] V1 = deux joueurs sur le même écran, **sans score ni classement** (§ 9).
- [ ] Triple répétition et 50 coups : nulle **automatique** (au lieu de « sur réclamation » comme en club) (F4, F5).
- [ ] « Annuler le coup » autorisé sans limite en V1 (P6).
- [ ] Catégorie `duel`, mode `solo` (jouable sans compte).
- [ ] Mode contre l'IA et son score : dans une prochaine version.
