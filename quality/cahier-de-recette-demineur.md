# Cahier de recette — Démineur

## Contexte

Validation fonctionnelle (UAT) du jeu **Démineur**, du point de vue d'un joueur, indépendamment
des tests automatisés unitaires/BDD/mutation. Chaque scénario ci-dessous est rejouable manuellement
et est également couvert par un test End-to-End (Playwright) servant de non-régression.

## Périmètre

Jeu Démineur uniquement (`frontend/src/games/demineur`). Hors périmètre : authentification,
plateforme (lobby, autres jeux).

## Environnement de test

- Application lancée en local : `http://localhost:5173`
- Navigateur à jour (Chromium/Firefox/WebKit)
- Deux profils testés : visiteur **invité** et joueur **connecté**

## Légende statut

| Statut | Signification |
|---|---|
| ✅ OK | Conforme au résultat attendu |
| ❌ KO | Non conforme — anomalie à consigner |
| ⚠️ Partiel | Conforme avec réserve |

## Scénarios

| # | Scénario | Préconditions | Étapes | Résultat attendu | Statut | Test automatisé associé |
|---|---|---|---|---|---|---|
| 1 | Révélation d'une case sûre | Grille affichée | 1. Clic gauche sur une case | La case se révèle (désactivée, affiche son contenu) ; si 0 mine adjacente, les cases voisines se révèlent en cascade | ✅ OK | `e2e/demineur.spec.ts` — *un clic gauche révèle une case* ; `demineur.feature` |
| 2 | Défaite sur révélation d'une mine | Grille affichée | 1. Révéler une case contenant une mine | Le message « Perdu » s'affiche, toute la grille est désactivée | ✅ OK | `e2e/demineur.spec.ts` — *révéler une mine termine la partie en défaite* |

## Synthèse

- **2/2** scénarios conformes.
- Aucune anomalie bloquante constatée.
- Couverture croisée avec la suite E2E Playwright (`frontend/e2e/demineur.spec.ts`) et les tests composant (`DemineurGame.test.tsx`), garantissant la non-régression de ce cahier de recette.
