# Bataille navale : règles

> Jeu `duel` (voir [architecture.md](../../architecture.md#catégories)), `mode: 'solo'` : le mode local
> est jouable sans compte, le mode en ligne demande une connexion (voir §3).

## 1. Le jeu en une phrase

Coule toute la flotte adverse avant qu'elle ne coule la tienne : chacun place sa flotte en secret, puis
on tire à tour de rôle sur la grille de l'autre.

## 2. Règles de base

| N° | Règle |
|----|-------|
| R1 | Le plateau est une grille de **10 × 10** cases, une par joueur. |
| R2 | La flotte compte **5 navires** : Porte-avions (5), Croiseur (4), Contre-torpilleur (3), Sous-marin (3), Torpilleur (2). |
| R3 | Un navire est posé à l'horizontale ou à la verticale, sans déborder de la grille ni chevaucher un autre navire. |
| R4 | Placement **au hasard** (un clic) ou **manuel** (clic pour poser, bouton pour tourner l'orientation). |
| R5 | Les deux flottes placées, on tire à tour de rôle sur la grille adverse. Une case déjà tirée ne compte pas deux fois. |
| R6 | Un navire est **coulé** quand toutes ses cases ont été touchées. |
| R7 | **Victoire** : couler tous les navires adverses. Le score tient compte du nombre de tirs et de touches (voir `computeScore`). |

## 3. Mode local vs mode en ligne

| | Local (même appareil) | En ligne |
|---|---|---|
| Connexion | Pas de compte requis | Compte requis (socle WebSocket, authentifié par la session HTTP) |
| Placement | Chaque joueur place sa flotte, l'appareil passe de main en main | Chaque joueur place la sienne en privé, sur son propre appareil |
| Code de partie | — | Un code à partager pour rejoindre la partie (créer/rejoindre, voir `ctx.realtime`) |
| Coupure réseau ou rechargement de page | — | Termine la partie immédiatement (l'autre camp en est informé), **sans reprise** : il faut recommencer |

Le protocole en ligne est entièrement décentralisé : **aucune flotte ne quitte jamais le navigateur de
son propriétaire**. Un tir diffuse seulement la case visée ; seul le joueur visé (qui connaît sa propre
flotte) calcule touché/coulé et diffuse le résultat. Il n'y a donc **aucun paquet backend** pour ce jeu
(le socle générique de `fr.tikigaming.realtime` relaie déjà tout ce dont il a besoin) — conformément à
la règle du dépôt : un jeu sans logique serveur n'a pas de package backend.

## 4. Mode augmenté (optionnel)

Activable avant de démarrer (local ou en ligne). Trois bonus, chacun **à usage unique** par partie et
par joueur, débloqués par la progression de ce joueur (jamais par une monnaie à dépenser — pas d'état à
synchroniser entre les deux camps) :

| Bonus | Effet | Débloqué après |
|-------|-------|-----------------|
| Salve | Tire 3 cases en un seul tour | avoir coulé 1 navire adverse |
| Radar | Révèle l'occupation d'une zone 3×3, sans la marquer comme tirée | 5 tirs envoyés |
| Frappe nucléaire | Tire sur un bloc 3×3 entier (jusqu'à 9 cases, borné à la grille) | 10 tirs envoyés |

Utiliser un bonus consomme le tour, comme un tir normal.

## 5. Fichiers

```
frontend/src/games/bataille-navale/
├── logic.ts                 Règles pures : placement, tir, score, zones (radar/frappe), déblocages
├── network.ts                Protocole en ligne : réducteur pur (aucun accès réseau direct)
├── useNetGame.ts              Câble `network.ts` sur une RealtimeConnection (ctx.realtime)
├── FleetPlacementBoard.tsx    Placement manuel ou aléatoire, clavier et souris
├── BatailleNavaleGame.tsx     Orchestrateur : menu, mode local, mode en ligne
└── bataille-navale.css        Styles du jeu (tokens --bn-*, animations courtes)
```
