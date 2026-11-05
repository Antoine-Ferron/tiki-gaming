# MiniGTA : règles et architecture

> Issue : #12. Catégorie **Solo**, **Sans compte** (`category: 'solo'`, `mode: 'solo'`).

MiniGTA est un jeu d'action en monde ouvert dans une ville moderne au contenu original. **Tout est généré par
le code** : ville, véhicules, personnages, textures et animations. Le jeu n'ajoute aucun asset externe, et sa
vignette est une capture de son propre rendu.

## 1. Le jeu en une phrase

Explore une ville de 2 km de côté à pied, en voiture, à moto, en hélicoptère ou en avion. Remplis des missions
pour gagner de l'argent et échappe à la police quand tu enfreins la loi.

## 2. Règles

| N° | Règle |
|----|-------|
| R1 | La ville est la même pour tous les joueurs (graine fixe, générée par le backend). |
| R2 | Une nouvelle partie commence avec **500 $**, sans armure et avec les poings. |
| R3 | Quatre missions, chacune payée **une seule fois** : Colis express (800 $), La fuite (1 500 $), Contrat au port (2 500 $), Commande spéciale (3 000 $). |
| R4 | Les billets lâchés en ville s'ajoutent à l'argent. |
| R5 | Armurerie : batte 100 $, pistolet 300 $, grenades 400 $, fusil à pompe 1 200 $, fusil d'assaut 1 500 $, sniper 2 500 $. Les munitions se vendent par lots, et l'armure 250 $. Un achat sans les fonds est refusé, sans débit. |
| R6 | Les crimes font monter le **niveau de recherche** (1 à 5 étoiles). Hors de vue de la police, le niveau finit par retomber. |
| R7 | Si tu meurs, les frais d'hôpital sont de 10 % de ton argent (100 $ minimum). Si tu es arrêté, la caution est de 15 % (200 $ minimum) et tu perds tes armes. Le solde ne descend jamais sous 0. |
| R8 | **Score** : tout l'argent gagné depuis le début de la partie (missions et billets). Les dépenses ne le font pas baisser. Il est plafonné à **1 000 000** (`scoreLimits.max` = `games.max_score`). |
| R9 | **Tremplins** : buttes de terre dans les parcs et en bord de route dans les collines, rampes de chargement sur le port, rampes en planches sur des chantiers. Générés par le backend (graine fixe), hors des routes empruntées par le trafic : une voiture lancée décolle et retombe. |
| R10 | **Bâtiments ouverts** : environ un bâtiment ordinaire sur cinq (maisons et immeubles) a un rez-de-chaussée accessible : porte de 1,5 m côté rue (trop étroite pour une voiture), pièce meublée, cloison percée d'un passage dans les plus profonds. Les étages restent fermés. |

## 3. Plateforme

| Sujet | Comportement |
|-------|--------------|
| Écran d'accueil | `.card` avec la progression sauvegardée, le bouton « Jouer » ou « Continuer » et le classement de l'argent gagné. |
| Partie | Dans la page, comme les autres jeux : carte 16:9 avec le classement en dessous. Le bouton « Plein écran » agrandit la seule zone de jeu. Un clic dans le jeu capture la souris pour la caméra. Échap ou P ouvre la pause (Reprendre, Réglages, Commandes, Quitter, Nouvelle partie). « Quitter » sauvegarde puis revient à l'accueil. |
| Sauvegarde | `ctx.save` après chaque transaction (mission, achat, réapparition, billets), à F5, à la planque et en quittant. `ctx.loadSave(saveSchema)` au chargement : une sauvegarde corrompue ou d'une autre version donne une nouvelle partie. |
| Score | `ctx.submitScore(argentGagné)` aux mêmes moments, seulement s'il bat le dernier score envoyé. |
| Invité | La sauvegarde reste dans le navigateur et aucun score n'est envoyé. L'accueil invite à se connecter. |
| Erreurs du SDK | Le message est affiché tel quel (notification en jeu ou texte d'erreur à l'accueil), sans bloquer la partie. |
| Mobile | Sans souris (pointeur grossier) ou sous 360 px de large : « Ce jeu se joue au clavier et à la souris, sur ordinateur. » |
| Réglages | Qualité graphique, densités et souris dans le `localStorage` de l'appareil (`mini-gta:settings`). |

### Chat et commandes

T ou Entrée ouvre le chat (en bas à gauche) : le jeu est en pause et les touches tapées ne pilotent pas le
joueur. Entrée exécute, Échap ferme, ↑/↓ rappellent les lignes précédentes, Tab complète la commande et son
argument. Les noms acceptent les accents ou non (« hélico » = « helico »).

| Commande | Effet |
|----------|-------|
| `/aide` | liste des commandes |
| `/summon <véhicule>` | fait apparaître un véhicule devant toi, posé sur le sol, sur une place dégagée : `sedan` (`berline`), `sport` (`sportive`), `suv`, `taxi`, `police`, `van` (`utilitaire`), `swat`, `bus`, `truck` (`camion`), `bike` (`moto`), `heli` (`helico`), `policeHeli`, `plane` (`avion`) |
| `/nettoyer` | retire les véhicules invoqués |
| `/tp <lieu>` | téléporte : `depart`, `planque`, `garage`, `armurerie`, `entrepot`/`port`, `hopital`, `commissariat`, `aerodrome`, `heliport` |
| `/heure <h>` | règle l'heure (`21`, `21h30`) |
| `/meteo <temps>` | `clair`, `nuageux`, `pluie` ou `auto` |
| `/recherche <0-5>` | règle le niveau de recherche |
| `/soigner` | rend toute la santé |
| `/armes` | donne toutes les armes avec des munitions |

Aucune commande ne touche à l'argent : il passe par le serveur.

## 4. Architecture

```
frontend/src/games/mini-gta/        backend/.../games/mini_gta/
├── MiniGtaGame.tsx  accueil        ├── api/        contrôleur /api/games/mini-gta
├── MiniGtaPlay.tsx  partie         ├── world/      génération de la ville, navigation
├── domain/          sauvegarde,    ├── missions/   catalogue des missions
│                    score, poste   ├── weapons/    caractéristiques et prix
├── net/api.ts       client API     ├── progress/   règles d'argent (sans état)
├── physics/         cannon-es      └── core/       RNG seedé, outils
├── game/ entities/ systems/        simulation à 60 Hz
├── world/ procgen/ render/         ville, modèles et rendu procéduraux
└── ui/ state/                      HUD, menus, stores
```

- **Backend sans état.** Il génère la ville et le catalogue une fois (graine 1337), calcule l'itinéraire GPS et
  applique les règles d'argent à la progression qu'on lui envoie. Il ne stocke rien.
- **Front.** Il fait tourner la simulation temps réel (physique, IA, trafic, police, tirs), car elle ne supporte
  pas la latence du réseau. React ne sert qu'à l'enveloppe (canvas, HUD, menus) : la simulation est en TypeScript
  impératif.
- **Chargement à la demande.** L'accueil est léger. Le moteur (`MiniGtaPlay`, Three.js et cannon-es) n'est
  téléchargé qu'au clic sur « Jouer ».

### API (`/api/games/mini-gta`, tag Swagger `mini-gta`)

| Méthode | Chemin | Corps → réponse |
|---------|--------|-----------------|
| GET | `/world` | Ville sérialisée (lue par `cityFromDto`) |
| GET | `/missions` | Catalogue des missions |
| GET | `/weapons` | Caractéristiques et prix des armes |
| GET | `/route?fromX&fromZ&toX&toZ` | Itinéraire `[{x, z}…]` |
| POST | `/missions/{id}/complete` | `{progress}` → `{rewarded, reward, progress}` |
| POST | `/shop/purchase` | `{progress, item, weapon?}` → `{ok, price, rounds, progress}` |
| POST | `/respawn` | `{progress, reason}` → `{fee, progress}` |

`progress` a le format de la sauvegarde : `{version: 1, money, totalEarned, armor, inventory, completedMissions, stats}`.

### Physique sans WebAssembly

La CSP de la plateforme (`script-src 'self'`) interdit la compilation WASM, donc Rapier. `physics/engine.ts`
reprend le sous-ensemble de l'API Rapier utilisé par le jeu, au-dessus de **cannon-es** :

- cannon-es ne simule que les contacts des corps mobiles (véhicules, débris, grenades). Sa broadphase ne cherche
  les paires qu'autour d'eux, dans une grille spatiale.
- Raycasts et tests de sphère passent par cette grille. Les obstacles de la ville ne tournent qu'autour de Y.
- Le véhicule est un port du *raycast vehicle* de Bullet, comme celui de Rapier. Une force moteur positive fait
  avancer vers +Z, et un braquage positif tourne **à gauche**.
- Le personnage utilise un contrôleur 2,5D : un cercle glisse contre des rectangles orientés, le sol vient du
  heightfield et du dessus des boîtes, avec une marche automatique de 45 cm et une accroche au sol.

## 5. Conventions propres au jeu

- Repère : X = est, Z = sud, Y = haut, le nord est −Z. Les modèles regardent vers +Z. Pour un cap `h`, l'avant
  vaut `(sin h, 0, cos h)`.
- Pas de `setState` par frame : le HUD est publié à 15 Hz, la minimap dessine dans un canvas.
- Draw calls : un mesh fusionné par matériau et par chunk, des props instanciés, une draw call par personnage et
  environ 7 par véhicule.
- Les couleurs des matériaux 3D sont en TypeScript. Celles de l'interface (HUD, menus, carte) passent par les
  tokens de la plateforme et des variables `--mini-gta-*` déclarées sur `.mini-gta-play`.
- `/world` porte `ramps` (`x, y, z, rot, length, width, height, kind`) et, pour un bâtiment ouvert, `hollow.floorHeight` (hauteur
  du rez-de-chaussée creux ; absent pour les bâtiments spéciaux, entièrement creux). Ces tirages sont faits après tout
  le reste (`rng.fork("entrances")`, `rng.fork("ramps")`) : le reste de la ville ne change pas.
- Les tremplins sont les seuls obstacles statiques inclinés : le contrôleur de personnage les contourne (on ne
  peut pas les gravir à pied).
- Les entités qui apparaissent près d'un trottoir sont posées sur le sol réel : les dalles des îlots sont 15 cm
  plus hautes que la route.
- Appuis de touches : la simulation lit `input.wasPressed` (gardé jusqu'au pas suivant), l'interface lit
  `input.wasPressedThisFrame`.

## 6. Tests

| Partie | Où | Ce qui est couvert |
|--------|-----|--------------------|
| Back | `backend/src/test/java/.../mini_gta` | génération et invariants de la ville, A*, catalogue, règles d'argent, API MockMvc, parcours `@SpringBootTest` avec CSRF |
| Domaine | `domain/*.test.ts` | schéma de sauvegarde, score à envoyer, poste compatible, format des montants |
| Physique | `physics/engine.test.ts` | raycasts, groupes, corps dynamiques et cinématiques, événements de contact, personnage (trottoir, mur, chute), véhicule (repos, avance vers +Z, braquage à gauche) |
| Simulation | `game/*.test.ts`, `systems/*.test.ts`, `entities/*.test.ts` | parties sans WebGL sur une portion de la vraie ville (`game/testing/harness.ts`, `game/fixtures`) : véhicules, joueur, trafic, missions, combat, police. Le harnais démarre une ville vide et fixe la graine de `Math.random` : chaque fichier tourne en moins de 3 s |
| Accueil | `MiniGtaGame.test.tsx` | invité, sauvegarde, sauvegarde corrompue, classement, erreur du SDK, écran tactile |
| Logique client | `core/`, `systems/`, `world/` | boucle à pas fixe, RNG, bus d'événements, armes, niveau de recherche, missions, reconstruction du monde |
| BDD, back | `backend/src/test/resources/.../mini_gta/features/*.feature` (Cucumber JVM, `MiniGtaFeaturesTest`) | R1, R3, R5, R7 (frais), R8 (gains), R9, R10 et GPS, en HTTP sur l'application réelle démarrée par la suite |
| BDD, front | `features/*.feature` (vitest-cucumber, `*.steps.test.ts`) | R2 et sauvegarde corrompue, R4, R6, R7 (armes perdues à l'arrestation), R8 (score envoyé, invité) |

Les scénarios Gherkin, en français, reprennent les règles de la section 2 avec leurs valeurs limites. Ils
n'emploient que le vocabulaire du joueur (noms des missions et des armes, « solde », « caution ») : la traduction
vers les identifiants de l'API se fait dans les étapes. Le rapport `backend/target/cucumber/mini-gta.html` (artefact
CI des rapports BDD) en est la documentation vivante. Les
messages d'erreur du contrôleur (« Mission inconnue. »…) sont remplacés par « Requête invalide. » par le
gestionnaire d'erreurs de la plateforme : les scénarios de refus vérifient donc le code HTTP.

`game/fixtures/world-spawn.json` est extrait de `GET /world` dans un rayon de 350 m autour du départ, terrain
retiré. Il faut le régénérer si le format du monde change.

### Lexique

Le code est en anglais. Chaque terme des règles et des scénarios correspond à un seul identifiant :

| Terme métier | Front | Back |
|--------------|-------|------|
| nouvelle partie | `newSave()` | `Progress.initial()` |
| solde | `money` | `Progress.money` |
| score, argent gagné | `totalEarned`, `scoreToSubmit()` | `Progress.totalEarned` |
| récompense de mission | `completeMission()` | `Transactions.completeMission()`, `MissionReward` |
| armurerie, achat | `purchase()` | `Transactions.purchase()`, `Purchase` |
| gilet | `armor` | `Purchase.Item.ARMOR` |
| lot de munitions | `ammoPack`, `ammoPrice` | `WeaponDef.ammoPack()`, `WeaponDef.ammoPrice()` |
| frais d'hôpital, caution | `respawn('dead' \| 'busted')` | `Transactions.respawn()`, `Respawn.Reason` |
| billets | `addMoney()` | — |
| niveau de recherche, étoiles | `WantedLevel`, `stars` | — |
| témoin | `witnessed` | — |
| zone de recherche | `searchRadius` | — |
| graine | — | `MiniGtaWorld.SEED` |
| donneur de missions | `missionGivers` | `Locations.missionGivers()` |
| tremplin | `ramps` | `Ramp`, `RampKind` |
| bâtiment ouvert | `hollow` | `Building.doorSide`, `Building.floorHeight` |

## 7. Hors périmètre

Contrôles tactiles, multijoueur, tables Supabase dédiées, smoke test navigateur en CI, choix de la graine.
