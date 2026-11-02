# Charte graphique

Objectif : la plateforme et les jeux de toutes les équipes doivent avoir l'air d'un seul produit.
La source de vérité est `frontend/src/styles.css`. Cette charte explique comment s'en servir. En cas
d'écart entre les deux, c'est le CSS qui fait foi : corrigez la charte dans la même PR.

## Principes

1. **Thème sombre unique.** Pas de thème clair pour l'instant (`color-scheme: dark`).
2. **Une seule couleur d'accent**, l'orange, réservée à l'action principale et aux éléments interactifs.
3. **Tokens, jamais de valeurs en dur.** Couleurs, rayons et typographie passent par les variables CSS.
4. **Lisible avant tout.** Contrastes WCAG AA, focus visible et taille de texte suffisante sur mobile.

## Couleurs

### Tokens de base

| Token            | Valeur    | Usage                                                  | Contraste mesuré           |
|------------------|-----------|--------------------------------------------------------|----------------------------|
| `--bg`           | `#0f1020` | Fond de page, fond des champs de saisie                | —                          |
| `--surface`      | `#1a1c33` | Cartes, en-tête, panneaux de jeu                       | —                          |
| `--border`       | `#2c2f52` | Bordures et séparateurs (décoratif)                    | 1,3:1 sur surface ⚠️       |
| `--text`         | `#ecebff` | Texte principal                                        | 14,2:1 sur surface ✅       |
| `--muted`        | `#9a9cc4` | Texte secondaire, libellés, liens de navigation        | 6,3:1 sur surface ✅        |
| `--accent`       | `#ff8a3d` | Boutons principaux, liens, focus, survol, « moi » au classement | 7,1:1 sur surface ✅ |
| `--accent-text`  | `#1a0d00` | Texte posé sur l'accent (boutons)                      | 8,1:1 sur accent ✅         |
| `--error`        | `#ff6b6b` | Messages d'erreur                                      | 6,0:1 sur surface ✅        |
| `--success`      | `#4ade80` | Messages de confirmation                               | 9,6:1 sur surface ✅        |

### Catégories de jeux

Chaque catégorie a sa couleur, utilisée **uniquement** pour son étiquette (`.tag-<catégorie>`) et
jamais comme couleur d'action.

| Token          | Valeur    | Catégorie                 | Contraste sur surface |
|----------------|-----------|---------------------------|-----------------------|
| `--cat-solo`   | `#5cc8ff` | Solo · 1 joueur           | 8,9:1 ✅              |
| `--cat-duel`   | `#b794ff` | Duel · 2 joueurs          | 6,9:1 ✅              |
| `--cat-multi`  | `#f5d14a` | Multi · 3 joueurs et +    | 11,2:1 ✅             |

### Règles

- **Interdit** : écrire un code couleur (`#…`, `rgb(…)`) dans un composant ou un CSS de jeu, sauf pour déclarer une variable propre au jeu (voir [Jeux](#jeux)).
- Transparences : dériver d'un token avec `color-mix(in srgb, var(--accent) 12%, transparent)`, comme `.notice`.
- Texte : contraste ≥ **4,5:1** sur son fond. Éléments d'interface (bordure d'un bouton, pion, case) : ≥ **3:1**.
- Ne jamais transmettre une information **par la couleur seule** : les catégories ont un libellé, une erreur a un texte.
- ⚠️ `--border` n'atteint pas 3:1 : il ne suffit pas à délimiter une zone cliquable. Pour un élément de jeu interactif, utilisez `--muted` ou `--accent` comme contour.

## Typographie

Police système, sans téléchargement : `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.

| Élément                   | Taille     | Graisse | Remarque                               |
|---------------------------|------------|---------|----------------------------------------|
| Logo « Tiki Gaming »      | `1.2rem`   | 800     | `.brand`                               |
| Titre de page (`h1`)      | `2rem`     | 700     | interligne `1.2`                       |
| Titre de section (`h2`)   | `1.5rem`   | 700     | interligne `1.2`                       |
| Texte courant             | `1rem`     | 400     | interligne `1.5`                       |
| Libellé de formulaire     | `0.9rem`   | 400     | couleur `--muted`                      |
| Étiquette (`.tag`)        | `0.75rem`  | 400     | taille minimale autorisée              |
| Bouton                    | `1rem`     | 600     | `.big` : `2rem` pour l'action d'un jeu |

- Chiffres qui changent (scores, chronos, compteurs) : `font-variant-numeric: tabular-nums` pour éviter qu'ils sautent.
- Pas de texte en dessous de `0.75rem`, pas de texte entièrement en majuscules sur plus de quelques mots.

## Espacements, rayons, mise en page

- **Échelle d'espacement** : `0.25rem`, `0.5rem`, `0.75rem`, `1rem`, `1.5rem`, `2rem`. Entre deux blocs : `1rem` ; entre deux sections : `1.5rem`.
- **Rayons** : `--radius` (12px) pour les cartes ; 8px pour les boutons, champs, images et `.notice` ; 999px pour les étiquettes ; 20px pour `button.big`.
- **Largeur** : contenu centré, `max-width: 1000px`, marges latérales `1rem`.
- **Grilles** : `repeat(auto-fill, minmax(240px, 1fr))` pour le catalogue, `repeat(auto-fit, minmax(280px, 1fr))` pour une page de jeu (plateau + classement). Elles s'adaptent seules du mobile au bureau, sans media query.
- Tester chaque écran à **360px de large** : pas de défilement horizontal.

## Composants disponibles

À réutiliser tels quels plutôt que de les recréer.

| Classe / élément         | Rendu                                             |
|--------------------------|---------------------------------------------------|
| `.card`                  | Panneau : surface, bordure, rayon 12px, padding `1.25rem` |
| `button`, `.button`      | Action principale (fond accent)                   |
| `.small`                 | Bouton compact                                    |
| `button.link`            | Action secondaire présentée comme un lien         |
| `button.big`             | Grosse action de jeu (« Jouer », « Rejouer »)     |
| `.form` + `label` + `input` | Formulaire en colonne, `max-width: 420px`      |
| `.muted`, `.error`, `.success` | Texte secondaire, erreur, confirmation      |
| `.notice`                | Bandeau d'information teinté d'accent             |
| `.tags` + `.tag` (+ `.tag-solo`, `.tag-duel`, `.tag-multi`) | Étiquettes ; `<GameTags game={…} />` les génère |
| `.grid` + `.game-card`   | Catalogue de jeux                                 |
| `<Leaderboard />` (`.leaderboard`, `li.me`) | Classement ; la ligne du joueur courant est en accent |

### États

| État      | Règle                                                                     |
|-----------|---------------------------------------------------------------------------|
| Survol    | Bordure `--accent` sur les cartes cliquables ; soulignement sur les liens |
| Focus     | `outline: 2px solid var(--accent)`, décalé de 1px. **Ne jamais supprimer le focus** |
| Désactivé | `opacity: 0.6`, curseur normal                                            |
| Chargement | Texte `.muted` (« Chargement… ») ; libellé du bouton changé (« Connexion… ») |

## Jeux

Chaque jeu garde sa personnalité **dans son plateau**, mais l'enveloppe reste celle de la plateforme.

- **Structure** : un conteneur racine nommé d'après le slug (`<div className="mastermind">`). En général : une `.card` pour le plateau et une `.card` pour le classement, dans une grille comme `.clicker`.
- **CSS du jeu** : un fichier `frontend/src/games/<slug>/<slug>.css`, importé par le composant du jeu. Toutes les classes sont **préfixées par le slug** (`.mastermind-peg`), pour ne pas déborder sur les autres jeux. On ne modifie pas `styles.css` pour un seul jeu.
- **Couleurs propres au jeu** (pions, pièces, cases…) : déclarées en variables sur le conteneur racine, préfixées par le slug, avec les contrastes ci-dessus :
  ```css
  .mastermind {
    --mastermind-peg-red: #ef4444;
    --mastermind-peg-blue: #3b82f6;
  }
  ```
- **Boutons, textes, messages** : utiliser les composants de la plateforme (`button`, `.muted`, `.error`…).
- **Animations** : courtes (≤ 300 ms pour un retour d'interface) et désactivées si `prefers-reduced-motion: reduce`.
- **Clavier** : toute action de jeu doit être faisable au clavier, ou le jeu doit indiquer clairement qu'il se joue à la souris ou au toucher.
- **Vignette** (`thumbnail`) : 16:9, au moins 640×360, en `webp` ou `png`, dans `frontend/public/games/<slug>/`. Elle est décorative (`alt=""`), car le titre est affiché à côté.

## Rédaction

- **Français**, phrases courtes.
- **Tutoiement** pour s'adresser au joueur (« Choisis un jeu », « Connecte-toi pour apparaître au classement »).
- Boutons : un verbe à l'infinitif ou à la première personne (« Jouer », « Se connecter », « Créer mon compte »).
- Messages d'erreur : dire ce qui s'est passé et quoi faire (« Ce pseudo est déjà pris. »), sans code technique.
- Catégories et modes, toujours avec ces libellés : **Solo**, **Duel**, **Multi** ; **Sans compte**, **Compte requis**.

## À définir

- Logo et favicon (aujourd'hui : le texte « Tiki Gaming » en graisse 800).
- Thème clair éventuel.
- Bibliothèque d'icônes commune (aucune pour l'instant).
