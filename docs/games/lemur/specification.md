# LemurTiki — spécification des exigences

> Statut : **brouillon à valider** avant tout développement (issue #19).
> Source : le Game Design Document « LemurTiki », adapté aux règles de la plateforme Tiki.
> Chaque exigence porte un identifiant (`EF-…` fonctionnelle, `ENF-…` non fonctionnelle) et des critères
> d'acceptation en Gherkin : ce sont les premiers tests à écrire, en rouge, avant le code.

## 1. Vision

Un maki (lémurien à queue annelée) grimpe un baobab de Madagascar en rebondissant de branche en branche.
Une fossa le poursuit par en dessous et accélère sans cesse. Le joueur ne dirige que la gauche et la droite,
et doit monter le plus haut possible en une seule vie. Les parties durent de 1 à 3 minutes. Genre : runner
vertical, dans l'esprit de Doodle Jump ou Panda Jump.

## 2. Périmètre

| Version        | Contenu                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP**        | Rebond automatique, direction, bords reliés, caméra, branches normales infinies, fossa, score, game over, rejouer, pause, clavier et tactile, envoi du score, classement, mode invité, sauvegarde |
| **V1 (bonus)** | Branches mobiles et fragiles, gousses de vanille, mangue (super saut), décor selon la hauteur                                                                                                     |
| Hors périmètre | Sons et musique, sprites, particules, tremblement d'écran, animation de capture, skins, plusieurs personnages, multijoueur                                                                        |

Le MVP doit être jouable de bout en bout avant d'attaquer la V1.

## 3. Intégration à la plateforme

Le GDD prévoyait une API Spring Boot dédiée aux scores. Sur Tiki, la plateforme fournit déjà ce service :
le jeu n'a **pas de backend propre**. Cela tranche les questions ouvertes du GDD.

| Question du GDD                      | Réponse sur la plateforme                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| Comment le lobby lance-t-il le jeu ? | Route `/games/lemur` de la même app React, composant chargé à la demande (`lazy`) |
| Comment identifier le joueur ?       | `ctx.player` (ou `null` en invité) ; le jeu n'importe jamais `@/lib/supabase`     |
| Points Tiki = score ?                | Oui : le score de la partie est envoyé tel quel par `ctx.submitScore`             |
| Qui gère le classement ?             | La plateforme : `ctx.getLeaderboard`, `ctx.getMyBest`, table `public.scores`      |
| Anti-triche                          | `scoreLimits.max` côté front et `games.max_score` en base (politique RLS)         |

Déclaration : slug `lemur`, titre « LemurTiki », catégorie `solo`, mode `solo` (jouable sans compte).

## 4. Paramètres de jeu

Valeurs de départ, **à équilibrer** en jouant : les tests vérifient les règles (« plus large en haut »,
« jamais au-dessus du saut »), pas qu'une valeur exacte reste figée. Unités : 1 m = 10 px du monde.

| Paramètre                  | Valeur initiale                            |
| -------------------------- | ------------------------------------------ |
| Monde visible              | 360 × 640 px                               |
| Hauteur d'un saut normal   | ≈ 22 m                                     |
| Super saut (mangue)        | ≈ 3 × un saut normal                       |
| Écart entre deux branches  | 6 m au départ → 19 m vers 2 000 m          |
| Branches mobiles           | dès 50 m, de 10 % à 30 %                   |
| Branches fragiles          | dès 150 m, de 10 % à 30 %                  |
| Gousse de vanille          | sur 12 % des branches, +10 points          |
| Mangue                     | sur 3 % des branches, dès 100 m            |
| Vitesse de la fossa        | 4 m/s, +1,2 m/s tous les 100 m, max 20 m/s |
| Retard maximal de la fossa | 40 m sous le bas de l'écran                |
| Score maximal accepté      | 100 000                                    |

## 5. Exigences fonctionnelles

### Fonctionnalité 1 — Le maki

| ID     | Exigence                                                                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EF-1.1 | La partie commence avec le maki sur une branche centrée au pied du baobab (hauteur 0 m).                                                                                         |
| EF-1.2 | Le maki rebondit automatiquement quand il touche le dessus d'une branche **en descendant**.                                                                                      |
| EF-1.3 | Il traverse les branches **en montant**.                                                                                                                                         |
| EF-1.4 | Le joueur dirige le maki à gauche ou à droite ; sans commande, il ne bouge pas latéralement.                                                                                     |
| EF-1.5 | Les bords sont reliés : sortir d'un côté fait réapparaître le maki de l'autre.                                                                                                   |
| EF-1.6 | Le maki (30 px de large) touche une branche dès qu'une partie de son corps est au-dessus d'elle, y compris à cheval sur un bord relié ; un simple contact d'arête ne suffit pas. |

```gherkin
# language: fr
Fonctionnalité: Déplacement du maki

  Scénario: Le maki rebondit sur une branche touchée en descendant
    Étant donné une branche normale sous le maki
    Et le maki qui descend vers elle
    Quand il touche le dessus de la branche
    Alors il repart vers le haut avec la vitesse d'un saut normal

  Scénario: Le maki traverse une branche en montant
    Étant donné une branche juste au-dessus du maki
    Et le maki qui monte
    Quand il passe la hauteur de la branche
    Alors il continue de monter sans rebondir

  Scénario: Le maki sort par un bord et revient par l'autre
    Étant donné le maki contre le bord gauche
    Quand le joueur le dirige vers la gauche
    Alors le maki réapparaît contre le bord droit
```

### Fonctionnalité 2 — La caméra

| ID     | Exigence                                                            |
| ------ | ------------------------------------------------------------------- |
| EF-2.1 | La caméra monte avec le maki quand il dépasse le milieu de l'écran. |
| EF-2.2 | La caméra ne redescend jamais.                                      |

```gherkin
  Scénario: La caméra ne redescend jamais
    Étant donné le maki monté à 100 m
    Quand il redescend à 90 m
    Alors la caméra reste à la hauteur atteinte
```

### Fonctionnalité 3 — Les branches

| ID     | Exigence                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------- |
| EF-3.1 | Des branches sont générées à l'infini au-dessus de l'écran, et retirées une fois sous l'écran.     |
| EF-3.2 | L'écart entre deux branches grandit avec la hauteur, sans jamais dépasser la hauteur d'un saut.    |
| EF-3.3 | _(V1)_ Une branche mobile glisse horizontalement et repart dans l'autre sens contre un bord.       |
| EF-3.4 | _(V1)_ Une branche fragile casse après un rebond.                                                  |
| EF-3.5 | _(V1)_ Aucune branche spéciale sous son seuil (50 m mobile, 150 m fragile).                        |
| EF-3.6 | _(V1)_ Une branche fragile est toujours suivie d'une branche normale : le chemin reste praticable. |

```gherkin
  Scénario: Une branche est toujours atteignable
    Quand des branches sont générées jusqu'à 3 000 m
    Alors l'écart entre deux branches successives reste inférieur à la hauteur d'un saut normal

  Plan du scénario: Les branches spéciales n'apparaissent qu'à partir de leur seuil
    Quand des branches sont générées jusqu'à <hauteur>
    Alors aucune branche <type> n'apparaît sous <seuil>

    Exemples:
      | hauteur | type    | seuil |
      | 1000 m  | mobile  | 50 m  |
      | 1000 m  | fragile | 150 m |

  Scénario: Une branche fragile casse après un rebond
    Étant donné le maki qui descend sur une branche fragile
    Quand il rebondit dessus
    Alors la branche est cassée
    Et le maki ne peut plus rebondir dessus
```

### Fonctionnalité 4 — Les bonus _(V1)_

| ID     | Exigence                                                                   |
| ------ | -------------------------------------------------------------------------- |
| EF-4.1 | Une gousse de vanille ramassée au contact rapporte 10 points et disparaît. |
| EF-4.2 | Une mangue ramassée déclenche un super saut et disparaît.                  |
| EF-4.3 | Une branche fragile ne porte jamais de bonus.                              |

```gherkin
  Scénario: Ramasser une gousse de vanille
    Étant donné une gousse de vanille sur le chemin du maki
    Quand le maki la touche
    Alors le score augmente de 10 points
    Et la gousse disparaît
```

### Fonctionnalité 5 — La fossa

| ID     | Exigence                                                                          |
| ------ | --------------------------------------------------------------------------------- |
| EF-5.1 | La fossa part sous l'écran et monte en continu.                                   |
| EF-5.2 | Sa vitesse augmente tous les 100 m de hauteur atteinte, sans dépasser un maximum. |
| EF-5.3 | Elle ne reste jamais à plus de 40 m sous le bas de l'écran.                       |
| EF-5.4 | Hors de l'écran, un indicateur affiche sa distance en mètres.                     |

```gherkin
  Plan du scénario: La fossa accélère avec la hauteur, jusqu'à un maximum
    Étant donné le maki monté à <hauteur>
    Alors la fossa monte à <vitesse>

    Exemples:
      | hauteur  | vitesse  |
      | 0 m      | 4 m/s    |
      | 99 m     | 4 m/s    |
      | 100 m    | 5,2 m/s  |
      | 10000 m  | 20 m/s   |
```

### Fonctionnalité 6 — Fin de partie et score

| ID     | Exigence                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------- |
| EF-6.1 | Game over si le maki tombe sous le bas de l'écran.                                             |
| EF-6.2 | Game over si la fossa le rattrape.                                                             |
| EF-6.3 | Après le game over, plus rien ne bouge et aucune commande n'a d'effet.                         |
| EF-6.4 | Score = hauteur maximale en mètres (arrondie à l'inférieur) + 10 points par gousse de vanille. |
| EF-6.5 | Le score ne dépasse jamais 100 000.                                                            |

```gherkin
  Scénario: La fossa rattrape le maki
    Étant donné la fossa juste sous le maki
    Quand la partie avance
    Alors la partie est terminée
    Et la cause est « la fossa a attrapé le maki »

  Scénario: Le score compte la hauteur maximale et la vanille
    Étant donné le maki monté au plus haut à 123,9 m
    Et 2 gousses de vanille ramassées
    Alors le score est de 143
```

### Fonctionnalité 7 — Écrans et commandes

| ID     | Exigence                                                                                                                          |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| EF-7.1 | Un **menu** présente le jeu, les commandes et le record, avec un bouton « Jouer ».                                                |
| EF-7.2 | En partie, l'interface affiche la hauteur, le score, la zone du décor et un bouton « Pause ».                                     |
| EF-7.3 | Clavier : flèches ou Q / D (A / D en QWERTY) pour diriger ; Échap ou P pour la pause.                                             |
| EF-7.4 | Tactile : toucher la moitié gauche ou droite de l'écran de jeu dirige le maki.                                                    |
| EF-7.5 | La **pause** fige la partie ; « Reprendre » la relance là où elle était.                                                          |
| EF-7.6 | La partie se met en pause automatiquement quand l'onglet est masqué.                                                              |
| EF-7.7 | L'**écran de fin** affiche la cause, le score, la hauteur, la vanille et le record, et « Rejouer » relance une partie en un clic. |
| EF-7.8 | _(V1)_ Le décor change avec la hauteur : forêt sèche, canopée (300 m), coucher de soleil (800 m), nuit étoilée (1 500 m).         |

```gherkin
Fonctionnalité: Écrans de LemurTiki

  Scénario: Mettre en pause au clavier
    Étant donné une partie en cours
    Quand le joueur appuie sur Échap
    Alors il voit l'écran « Pause »
    Et le maki ne bouge plus
    Quand il appuie sur P
    Alors la partie reprend

  Scénario: Rejouer après un game over
    Étant donné l'écran de fin
    Quand le joueur choisit « Rejouer »
    Alors une nouvelle partie commence à 0 m
```

### Fonctionnalité 8 — Plateforme : scores, invité, sauvegarde

| ID     | Exigence                                                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| EF-8.1 | À la fin d'une partie, le score est envoyé une seule fois par `ctx.submitScore(score, { heightMeters, vanilla, cause, durationMs })`.           |
| EF-8.2 | Le classement (top 10, ligne du joueur en accent) et le meilleur score personnel sont rafraîchis après l'envoi.                                 |
| EF-8.3 | En invité (`ctx.player === null`), le jeu se joue normalement et l'écran de fin invite à se connecter pour apparaître au classement.            |
| EF-8.4 | La sauvegarde (`ctx.save`) garde le nombre de parties, la vanille récoltée au total et le meilleur score ; une sauvegarde invalide est ignorée. |
| EF-8.5 | Une erreur de la plateforme (réseau, score refusé, score mis en attente) affiche son message au joueur sans bloquer la partie suivante.         |

```gherkin
Fonctionnalité: LemurTiki sur la plateforme

  Scénario: Le score d'une partie terminée est envoyé une fois
    Étant donné un joueur connecté
    Quand il termine une partie avec 150 m et 1 gousse de vanille
    Alors un score de 160 est enregistré pour lui
    Et le classement affiche 160 sur sa ligne

  Scénario: Un invité joue sans être classé
    Étant donné un invité
    Quand il termine une partie
    Alors aucun score n'est enregistré
    Et il voit « Connecte-toi pour apparaître au classement. »
    Et sa sauvegarde locale compte une partie jouée

  Scénario: Une coupure réseau n'empêche pas de rejouer
    Étant donné un joueur connecté et la connexion coupée
    Quand il termine une partie
    Alors il voit le message de score gardé sur l'appareil
    Et il peut choisir « Rejouer »
```

## 6. Exigences non fonctionnelles

| ID    | Exigence                                                                                                                                                                                                              | Vérification                 |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| ENF-1 | **Déterminisme** : la logique reçoit son tirage aléatoire en paramètre ; même graine = même partie.                                                                                                                   | Tests unitaires              |
| ENF-2 | **Pas de temps fixe** (1/60 s) : même comportement à 30 et à 144 images par seconde.                                                                                                                                  | Tests unitaires              |
| ENF-3 | **Séparation** : logique en TypeScript pur, sans React ni canvas ; React ne se re-rend pas à chaque image.                                                                                                            | Revue, tests unitaires       |
| ENF-4 | **Performance** : 60 images par seconde sur un mobile milieu de gamme.                                                                                                                                                | Test manuel                  |
| ENF-5 | **Accessibilité** (charte) : tout se joue au clavier, focus visible, contrastes ≥ 3:1 pour les éléments de jeu, types de branches distingués par la forme et pas seulement la couleur, aucune violation axe sérieuse. | Tests de composants, E2E axe |
| ENF-6 | **Mise en page** : jouable de 360 px de large au bureau, sans défilement horizontal ; pas de défilement de la page pendant le jeu tactile.                                                                            | E2E, test manuel             |
| ENF-7 | **Charte** : CSS dans `lemur.css`, classes préfixées `lemur`, couleurs du jeu en variables `--lemur-*`, textes en français au tutoiement.                                                                             | Revue                        |
| ENF-8 | **Robustesse** : aucune exception non gérée si la plateforme échoue ; une sauvegarde corrompue ne bloque pas le jeu.                                                                                                  | Tests de composants          |
| ENF-9 | **Qualité** : `format`, `lint`, `test` et `build` passent ; score de mutation ≥ 75 % sur la logique du jeu.                                                                                                           | CI, Stryker                  |

## 7. Stratégie de test

Chaque exigence est vérifiée au niveau le plus bas possible, conformément à CONTRIBUTING.

| Niveau                                 | Fichier                                                  | Couvre                                                                                                                     |
| -------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **BDD** (Gherkin, vitest-cucumber)     | `src/games/lemur/features/*.feature` + `*.steps.test.ts` | Les scénarios ci-dessus (EF-1 à EF-6, EF-8) : les étapes appellent la logique et le SDK avec ses fakes, jamais l'interface |
| **Unitaire** (Vitest)                  | `src/games/lemur/*.test.ts`                              | Détails de la logique : frontières, paramètres, ENF-1, ENF-2                                                               |
| **Composant** (Testing Library, jsdom) | `src/games/lemur/LemurGame.test.tsx`                     | Écrans et commandes (EF-7), invité et erreurs (EF-8.3, EF-8.5), ENF-8                                                      |
| **Intégration** (Testcontainers)       | `tests/integration/catalog.test.ts` (existant)           | Ligne `lemur` en base alignée avec `index.ts`                                                                              |
| **E2E** (Playwright)                   | `e2e/` (un parcours)                                     | Accueil → LemurTiki → partie → fin, audit axe (ENF-5, ENF-6)                                                               |
| **Manuel**                             | —                                                        | Rendu canvas, sensations de jeu, équilibrage, ENF-4                                                                        |

## 8. Questions ouvertes

- Faut-il garder Q / D comme touches principales (claviers AZERTY) et ajouter A / D pour le QWERTY ?
- Les valeurs du §4 conviennent-elles comme point de départ, avant l'équilibrage ?
- Vignette du catalogue : qui la produit (16:9, 640 × 360 minimum) ?
