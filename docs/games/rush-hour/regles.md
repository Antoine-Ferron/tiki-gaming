# Rush Hour : cahier des charges (version solo)

> **Statut : proposition à valider.** Ce document décrit ce que le jeu doit faire, en mots simples, pour que tout le monde soit d'accord avant de coder.
> Périmètre : le jeu **solo**, c'est-à-dire le **mode Niveaux** (niveaux 1 à 20) et le **mode Génération**. Le Duel et la génération par IA (LLM) viendront plus tard.
> Issue : #6. Détail des tests : [TDD-rush-hour.md](TDD-rush-hour.md).

---

## 1. Le jeu en une phrase

Un casse-tête de parking : **fais glisser les voitures et les camions pour libérer le passage à la voiture rouge, et fais-la sortir du plateau en un minimum de coups.**

## 2. Les règles du jeu

| N° | Règle |
|----|-------|
| R1 | Le plateau est une grille de **6 × 6** cases. |
| R2 | Il y a des **voitures** (2 cases) et des **camions** (3 cases), posés à l'horizontale ou à la verticale. |
| R3 | La **voiture rouge** est toujours horizontale, sur la **3ᵉ ligne**. La **sortie** est au bord droit de cette ligne. |
| R4 | Un véhicule ne bouge **que dans son sens** : un véhicule horizontal va à gauche ou à droite, un vertical en haut ou en bas. Il ne tourne jamais. |
| R5 | Un véhicule **ne traverse ni les bords ni les autres véhicules** : il s'arrête contre le premier obstacle. |
| R6 | **Un coup** = faire glisser **un** véhicule, **quelle que soit la distance**. Glisser une voiture de 3 cases d'un seul geste = 1 coup. Déplacer à nouveau le même véhicule juste après (par exemple case par case au clavier) prolonge le même coup. |
| R7 | **Victoire** : la voiture rouge touche la sortie. |
| R8 | Chaque plateau a un **nombre minimal de coups** pour être résolu (l'« optimal »), calculé par le jeu. |

## 3. Mode Niveaux

20 plateaux conçus à l'avance, du plus facile au plus difficile.

| N° | Règle |
|----|-------|
| N1 | Il y a **20 niveaux**, numérotés de 1 à 20. |
| N2 | La difficulté augmente : **1 à 6 = Facile**, **7 à 13 = Moyen**, **14 à 20 = Difficile** (voir les plages au § 5). |
| N3 | Au départ, **seul le niveau 1 est ouvert**. Terminer un niveau ouvre le suivant (le score obtenu n'a pas d'importance). |
| N4 | On peut rejouer un niveau déjà terminé autant de fois qu'on veut. |
| N5 | Pour chaque niveau, le jeu garde le **meilleur score** du joueur. Rejouer moins bien ne fait jamais baisser son record. |
| N6 | Chaque niveau est **toujours résoluble** (vérifié automatiquement par un test). |

## 4. Mode Génération

Le joueur choisit une difficulté et reçoit un plateau **nouveau**, créé par le jeu.

> **MVP : génération par algorithme, sans IA.** Le plateau est créé par un programme dans le jeu lui-même (au hasard, puis vérifié). Aucun LLM n'est utilisé.
> La génération par **LLM** est une évolution possible **après le MVP** (voir § 10) : elle demanderait un service côté serveur pour cacher la clé de l'API, et chaque plateau proposé par l'IA serait de toute façon vérifié par le même solveur.

| N° | Règle |
|----|-------|
| G1 | Le joueur choisit **Facile**, **Moyen** ou **Difficile**. |
| G2 | Le jeu place la voiture rouge et des véhicules **au hasard**, puis **vérifie** que le plateau respecte les règles R1 à R3, qu'il est **résoluble**, et que sa difficulté (§ 5) est **celle demandée**. Sinon, il recommence avec un autre tirage. |
| G3 | Le joueur ne voit **jamais** un plateau impossible ou hors difficulté. |
| G4 | La génération prend **moins de 2 secondes**, même en Difficile, et l'écran ne se fige pas pendant ce temps. |
| G5 | Un plateau généré se joue exactement comme un niveau (mêmes règles, même score). |
| G6 | Bouton « Nouveau plateau » pour en générer un autre de la même difficulté. |

## 5. Difficulté

### Le calcul

La difficulté d'un plateau dépend **d'un seul chiffre : son nombre minimal de coups** (R8), c'est-à-dire le plus petit nombre de coups qu'il faut pour sortir la voiture rouge.

Ce chiffre est calculé par un **solveur** intégré au jeu :

1. Il part du plateau de départ.
2. Il essaie **tous les coups possibles** (chaque véhicule, dans chaque sens, sur chaque distance) : ça donne tous les plateaux atteignables en **1 coup**.
3. Depuis chacun d'eux, il essaie à nouveau tous les coups : ça donne les plateaux atteignables en **2 coups**. Et ainsi de suite, en ignorant les plateaux déjà vus.
4. Le premier plateau où la voiture rouge touche la sortie donne le **nombre minimal de coups**. Si plus aucun nouveau plateau n'est atteignable, le plateau est **impossible**.

Comme il avance « niveau de coups par niveau de coups », le premier chemin trouvé est forcément **le plus court** (c'est un *parcours en largeur*). Le même solveur sert aussi à donner les **indices** (P5) et à calculer le **score** (§ 7).

### Les plages

| Difficulté | Nombre minimal de coups | Exemple                           |
|------------|-------------------------|-----------------------------------|
| —          | 0 à 2                   | Trop facile : **refusé**          |
| Facile     | 3 à 8                   | Il faut déplacer 2 ou 3 véhicules pour libérer la route |
| Moyen      | 9 à 16                  | Il faut d'abord déplacer des véhicules qui en bloquent d'autres |
| Difficile  | 17 et plus              | Longues chaînes de blocages, plusieurs allers-retours |

Ce sont les **mêmes plages** pour les 20 niveaux (N2) et pour la Génération (G1). Exemple : un plateau qui se résout au minimum en 12 coups est **Moyen**, qu'il soit un niveau ou un plateau généré.

> **Limite connue** : le nombre de coups est une mesure simple, pas parfaite. Deux plateaux à 10 coups ne paraissent pas toujours aussi durs à un humain. Les plages seront **ajustées après des essais** avec de vrais joueurs (§ 12).

## 6. Pendant une partie

| N° | Règle |
|----|-------|
| P1 | On voit le **nombre de coups joués** et le **minimum possible** (ex. « Coups : 5 (min. 3) »). |
| P2 | Un **chrono** tourne depuis le début de la partie et s'arrête à la victoire. Il est affiché, mais **ne compte pas dans le score**. |
| P3 | **Annuler** : revient au plateau d'avant le dernier coup, et retire ce coup du compteur. Sans coup joué, le bouton est désactivé. |
| P4 | **Recommencer** : remet le plateau de départ, le compteur, les indices et le chrono à zéro. |
| P5 | **Indice** : le jeu montre le véhicule à bouger (sens et distance) pour se rapprocher de la solution la plus courte. Chaque indice coûte des points (§ 7). |
| P6 | Une fois la partie gagnée, on ne peut plus bouger les véhicules : écran de victoire avec le score, et les boutons **Rejouer** et **Niveau suivant** (ou **Nouveau plateau** en Génération). |

## 7. Score

```
score = 1000 − 50 × (coups joués − minimum) − 200 × indices utilisés
```

Le score **ne descend jamais sous 0** et ne dépasse jamais 1000.

| Exemple (minimum = 10 coups)       | Score |
|------------------------------------|-------|
| 10 coups, aucun indice (parfait)   | 1000  |
| 11 coups, aucun indice             | 950   |
| 10 coups, 1 indice                 | 800   |
| 12 coups, 2 indices                | 500   |
| 30 coups ou plus, aucun indice     | 0     |

## 8. Progression, sauvegarde et classement

| N° | Règle |
|----|-------|
| S1 | La progression (niveaux terminés, records) est **sauvegardée automatiquement** à chaque victoire. |
| S2 | **Joueur connecté** : la sauvegarde suit son compte. **Invité** : elle reste dans son navigateur, et le jeu l'invite à se connecter pour être classé. |
| S3 | **Classement** : chaque joueur a un **score total** = la somme de ses records sur les 20 niveaux (maximum 20 000). Il ne fait que monter. |
| S4 | Les plateaux de la **Génération ne comptent pas** dans le classement (sinon on pourrait gonfler son total en jouant à l'infini). Le joueur voit à la place ses **statistiques** : nombre de plateaux réussis et meilleur score, par difficulté. |
| S5 | **Envoi du score** : quand le score total augmente, le jeu l'envoie avec `ctx.submitScore` (le SDK de la plateforme), et met dans les **métadonnées** le niveau joué et la **liste des coups**. Le score total ne peut pas dépasser **20 000** (`scoreLimits` du jeu et `max_score` en base). |
| S6 | **Vérification par le serveur (anti-triche)** : le backend sait **rejouer** une liste de coups sur un plateau, et la refuse si un coup est illégal (sortie du plateau, traversée d'un véhicule) ou si la voiture rouge n'est pas sortie. Il pourra s'appuyer sur les coups envoyés en métadonnées (S5) pour vérifier une partie. |

## 9. Contrôles et affichage

| N° | Règle |
|----|-------|
| C1 | **Souris et doigt** : on attrape un véhicule et on le fait glisser. Il suit le geste, s'arrête contre les obstacles, et se cale sur une case quand on le lâche. |
| C2 | **Clavier** : Tab pour choisir un véhicule, flèches pour le déplacer d'une case. |
| C3 | Jouable sur **téléphone** (plateau qui s'adapte à la largeur de l'écran). |
| C4 | Les véhicules sont dessinés comme de vraies voitures et de vrais camions vus de dessus. La voiture rouge se distingue au premier coup d'œil. |

## 10. Hors périmètre (pour l'instant)

- Le **Duel 1 contre 1**.
- La génération de plateaux par **IA (LLM)**. Le MVP utilise uniquement l'algorithme du § 4.
- Les étoiles, l'historique des plateaux générés et le partage d'un plateau.

---

## 11. Ce qu'on testera en TDD

Chaque règle ci-dessus devient un ou plusieurs tests, écrits **avant** le code. Quelques exemples :

| Règle | Exemple de test |
|-------|-----------------|
| R5    | Une voiture collée à un camion ne peut pas avancer vers lui. |
| R6    | Glisser la voiture rouge de 4 cases compte **1** coup. |
| R7    | La voiture rouge contre le bord droit → gagné ; une case avant → pas encore gagné. |
| N3    | Niveau 2 fermé tant que le niveau 1 n'est pas terminé, ouvert dès qu'il l'est (même avec 0 point). |
| N5    | Record de 800, nouveau score de 799 → le record reste 800. |
| §5    | 8 coups → Facile, 9 coups → Moyen, 16 → Moyen, 17 → Difficile, 2 → refusé. |
| §7    | Le score ne descend jamais sous 0, même avec 1000 coups de trop. |
| G3    | Tout plateau généré est valide, résoluble et dans sa plage de difficulté. |
| S6    | (Back) Les coups « camion C descend de 1, voiture rouge avance de 2 » sur le niveau 1 → acceptés ; « voiture rouge avance de 2 » seule → refusé (elle traverserait le camion). |

---

## 12. À valider ensemble

Cocher quand l'équipe est d'accord :

- [ ] Répartition des 20 niveaux : 6 Facile, 7 Moyen, 7 Difficile (N2).
- [ ] Difficulté = nombre minimal de coups calculé par le solveur (§ 5).
- [ ] Plages de difficulté : 3–8 / 9–16 / 17+, à ajuster après des essais (§ 5).
- [ ] Génération par algorithme dans le MVP, LLM plus tard (§ 4).
- [ ] Barème : −50 par coup en trop, −200 par indice (§ 7).
- [ ] Le temps est affiché mais ne compte pas dans le score (P2).
- [ ] La Génération ne compte pas dans le classement (S4).
- [ ] Les invités peuvent jouer sans compte (S2).
- [ ] Le score passe par `ctx.submitScore`, avec le niveau et la liste des coups en métadonnées (S5).
- [ ] Le backend sait vérifier une liste de coups (S6). Code dans `backend/.../games/rush_hour/`, à faire relire par l'équipe plateforme.
