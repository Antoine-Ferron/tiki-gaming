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
| R5bis | **Un tir qui touche fait rejouer le même joueur** ; la main ne passe que sur un tir entièrement à l'eau. Pour une salve ou une frappe (mode augmenté, §4), il suffit qu'une seule case touche. |
| R6 | Un navire est **coulé** quand toutes ses cases ont été touchées. |
| R7 | **Victoire** : couler tous les navires adverses. Le score tient compte du nombre de tirs et de touches (voir `computeScore`). |

## 3. Mode local vs mode en ligne

| | Local (même appareil) | En ligne |
|---|---|---|
| Connexion | Pas de compte requis | Compte requis (socle WebSocket, authentifié par la session HTTP) |
| Placement | Chaque joueur place sa flotte, l'appareil passe de main en main | Chaque joueur place la sienne en privé, sur son propre appareil |
| Code de partie | — | Un code à partager pour rejoindre la partie (créer/rejoindre, voir `ctx.realtime`) |
| Coupure réseau ou rechargement de page | — | Peut être repris en rejoignant la même salle (voir ci-dessous) |

Le protocole en ligne est entièrement décentralisé : **aucune flotte ne quitte jamais le navigateur de
son propriétaire**. Un tir diffuse seulement la case visée ; seul le joueur visé (qui connaît sa propre
flotte) calcule touché/coulé et diffuse le résultat. Il n'y a donc **aucun paquet backend** pour ce jeu
(le socle générique de `fr.tikigaming.realtime` relaie déjà tout ce dont il a besoin) — conformément à
la règle du dépôt : un jeu sans logique serveur n'a pas de package backend.

### Reprise après coupure ou rechargement

Le socle générique n'a aucune notion de déconnexion (pas d'évènement de session côté serveur) et
`joinRoom` est idempotent : rejoindre la même salle avec le même compte renvoie le même siège qu'avant,
indéfiniment (jusqu'à la purge de la salle après 1 h d'inactivité, ou un départ explicite). Rejoindre la
salle après une coupure ou un rechargement reprend donc la partie **exactement là où elle en était** —
flotte déjà placée, tirs déjà échangés, tour en cours — sans nouveau placement ni faux signal d'abandon
envoyé à l'adversaire :

- La flotte et la progression de la bataille (tirs, touchés, navires coulés, tour) sont sauvegardées sur
  cet appareil (`localStorage`) à chaque évolution, et effacées dès que la partie se termine (victoire,
  défaite, ou abandon réel).
- Un seul angle mort, inhérent à l'absence d'historique côté serveur (relais pur, voir ci-dessus) :
  une action de l'adversaire envoyée **pendant** la coupure elle-même (entre la perte de connexion et la
  reconnexion) n'est jamais rejouée au retour, puisqu'elle n'a jamais été reçue. En pratique, une coupure
  ou un rechargement ne dure que quelques secondes : ce blanc, quand il existe, reste minime.
- Un abandon reste définitif dans tous les autres cas (l'adversaire ferme réellement sa salle, ou la
  salle expire après 1 h d'inactivité) : `L'adversaire a quitté la partie...` s'affiche alors sans
  possibilité de reprise, comme avant.

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
