# SDV Civilisation — spécification des règles

Jeu de civilisation à cartes en **trois âges**. Chaque joueur développe sa civilisation : il construit
des bâtiments, produit des ressources, progresse en science, arme son armée et érige une merveille.
Le joueur qui termine avec le plus de **points de victoire** gagne.

Seules les règles listées ici sont implémentées (et testées) : tout le reste est hors périmètre.

## Format

| Élément      | Valeur                                                                   |
| ------------ | ------------------------------------------------------------------------ |
| Catégorie    | `multi` (3 joueurs et +)                                                 |
| Mode         | `solo` : jouable sans compte, contre 2 IA (multijoueur en ligne à venir) |
| Joueurs      | 3 assis en cercle : le joueur et 2 IA ; à terme 3 à 7 joueurs en ligne   |
| Durée        | 3 âges de 6 tours                                                        |
| Score envoyé | total de points de victoire du joueur (`ctx.submitScore`)                |
| Sauvegarde   | état complet de la partie en cours (`ctx.save`), reprise au chargement   |

## Mise en place

1. Il faut entre **3 et 7 joueurs**.
2. Chaque joueur commence avec **3 pièces** et aucune carte construite.
3. Chaque joueur reçoit un **plateau de merveille** différent, tiré au hasard.
4. La merveille fournit une **ressource de départ** gratuite, produite à chaque tour.
5. Chaque joueur a un **voisin de gauche** et un **voisin de droite** (le premier et le dernier joueur
   sont voisins).
6. Les cartes sont réparties en **trois paquets**, un par âge. La composition de chaque paquet dépend
   du nombre de joueurs : certaines cartes sont retirées selon la configuration.
7. La partie commence à l'**âge 1**.

### Les âges

| Âge | Contenu du paquet                                     | Sens de passage |
| --- | ----------------------------------------------------- | --------------- |
| 1   | Ressources de base, développement initial             | gauche          |
| 2   | Bâtiments avancés, stratégies intermédiaires          | droite          |
| 3   | Bâtiments prestigieux, guildes, spécialisation finale | gauche          |

## Ressources

- **Matières premières** (cartes marron) : bois, pierre, argile, minerai.
- **Produits manufacturés** (cartes grises) : verre, papyrus, textile.
- Les ressources **ne se consomment pas** : une carte qui produit 1 bois fournit 1 bois **à chaque tour**.
- Une carte peut produire :
  - une ressource simple ;
  - **deux ressources identiques** ;
  - **une ressource au choix** parmi plusieurs.
- Le joueur choisit librement la combinaison de ressources au moment de construire.

## Déroulement d'un âge

1. Chaque joueur reçoit une main de **7 cartes** de l'âge en cours.
2. À chaque tour, tous les joueurs choisissent **simultanément une carte** de leur main (voir
   [Temps de tour](#temps-de-tour)), puis la révèlent en même temps et réalisent **une action** :
   - **construire** le bâtiment de la carte en payant son coût ;
   - **construire une étape de merveille** en payant le coût de l'étape ;
   - **défausser** la carte et gagner **3 pièces** de la réserve.
3. Les effets de la carte ou de l'étape de merveille sont appliqués **immédiatement**.
4. Les mains restantes passent au voisin, dans le sens de l'âge (voir tableau ci-dessus).
5. Après **6 tours**, la dernière carte de chaque main est défaussée.
6. L'âge se termine par la **résolution des conflits militaires**.
7. Les cartes construites et les jetons militaires sont conservés pour les âges suivants.

### Temps de tour

- Chaque joueur dispose de **60 secondes** pour choisir sa carte.
- Pendant les **10 dernières secondes**, le tour est signalé comme **bientôt fini**.
- À **60 secondes pile**, le tour est **expiré** : la carte choisie (ou la première de la main) est
  défaussée automatiquement et le joueur gagne 3 pièces.
- Le **serveur** fixe l'heure limite officielle du tour et l'envoie aux joueurs ; chaque client affiche
  son compte à rebours à partir de cette heure limite.
- Un joueur qui laisse expirer son tour sans jouer est signalé **une seule fois** au journal d'audit
  (inactivité).

## Trésor

- Les pièces d'un joueur ne sont **jamais négatives** : un paiement supérieur au trésor est refusé et
  rien n'est débité.
- Un montant crédité ou débité est un **entier strictement positif**.
- **Audit anti-triche** : quand le trésor d'un joueur **franchit** le seuil critique de **30 pièces**
  (passe de moins de 30 à 30 ou plus), un signalement est envoyé **une seule fois** au journal d'audit.
  Rester au-dessus du seuil ne déclenche pas de nouveau signalement ; repasser sous le seuil puis le
  franchir à nouveau en déclenche un. Le signalement ne bloque pas la partie.

## Construire un bâtiment

- Un joueur ne peut pas construire deux fois la même carte.
- Le coût d'une carte est en pièces, en ressources, ou nul.
- Si le joueur produit toutes les ressources nécessaires, il construit sans payer de pièces.
- S'il lui manque des ressources, il peut les **acheter à ses voisins** (voir Commerce).
- Une action qu'on ne peut pas payer est refusée : le joueur doit choisir une autre action.

### Chaînes de construction

- Certaines cartes indiquent une **carte prérequis** (construite à un âge précédent).
- Si le joueur possède déjà cette carte, il construit la nouvelle **gratuitement**, sans payer son coût.

### Commerce

- On n'achète qu'aux **deux voisins directs**, éventuellement aux deux dans le même tour.
- Prix standard : **2 pièces par ressource**. Le voisin touche les pièces et **ne peut pas refuser**.
- On achète au moins **1 ressource** ; si l'acheteur ne peut pas payer, l'achat est refusé et aucun
  trésor ne change.
- Avant d'acheter, le joueur voit un **devis** : le prix et s'il peut le payer. Le devis ne débite rien,
  c'est le serveur qui valide l'achat.
- On ne peut acheter qu'une ressource que le voisin **produit** (cartes marron, grises et merveille).
- Acheter ne prive pas le voisin de sa ressource : elle sert seulement à payer le coût de construction.
- Les ressources d'un voisin ne sont **jamais gratuites**.
- Certaines cartes jaunes réduisent le prix à **1 pièce** pour certaines ressources ou certains voisins.

## Construire sa merveille

- Une merveille comporte **2, 3 ou 4 étapes** selon le plateau.
- Les étapes se construisent **dans l'ordre**. Construire toutes les étapes n'est pas obligatoire.
- Pour construire une étape, le joueur :
  1. choisit une carte de sa main ;
  2. la place **face cachée** sous son plateau : la carte n'a **aucun effet** ;
  3. paie le coût de l'étape indiqué sur le plateau (le commerce est autorisé) ;
  4. applique immédiatement l'effet de l'étape.
- Une étape peut rapporter : des points de victoire, une ressource, des pièces, des boucliers ou un
  effet spécial.

## Types de cartes

| Couleur | Type                   | Effet                                                                  |
| ------- | ---------------------- | ---------------------------------------------------------------------- |
| Marron  | Ressource brute        | Produit bois, pierre, argile ou minerai                                |
| Gris    | Ressource manufacturée | Produit verre, papyrus ou textile                                      |
| Bleu    | Bâtiment civil         | Points de victoire                                                     |
| Jaune   | Bâtiment commercial    | Pièces, commerce réduit, ressources au choix, ou points sous condition |
| Rouge   | Bâtiment militaire     | Boucliers                                                              |
| Vert    | Bâtiment scientifique  | Symbole : tablette, roue dentée ou compas                              |
| Violet  | Guilde (âge 3)         | Points selon les cartes du joueur, de ses voisins ou de tous           |

## Conflits militaires (fin de chaque âge)

- La puissance militaire d'un joueur = somme des **boucliers** de ses cartes rouges et de sa merveille.
- Chaque joueur se compare **séparément** à chacun de ses deux voisins : il gagne donc 0, 1 ou 2 jetons
  par âge, et peut gagner contre l'un et perdre contre l'autre.

| Résultat | Âge 1 | Âge 2 | Âge 3 |
| -------- | ----- | ----- | ----- |
| Victoire | +1    | +3    | +5    |
| Défaite  | −1    | −1    | −1    |
| Égalité  | 0     | 0     | 0     |

## Science

Score = (nb de tablettes)² + (nb de roues)² + (nb de compas)² + **7 par série complète** des 3 symboles.

| Symboles                         | Points             |
| -------------------------------- | ------------------ |
| 2 tablettes                      | 4                  |
| 3 roues                          | 9                  |
| 1 tablette + 1 roue + 1 compas   | 1 + 1 + 1 + 7 = 10 |
| 3 tablettes + 2 roues + 1 compas | 9 + 4 + 1 + 7 = 21 |

## Score final (fin de l'âge 3)

| Catégorie | Calcul                                           |
| --------- | ------------------------------------------------ |
| Militaire | somme des jetons de conflit                      |
| Trésor    | 1 point par tranche complète de 3 pièces         |
| Merveille | points des étapes construites                    |
| Civil     | points des cartes bleues                         |
| Commerce  | points des cartes jaunes qui en rapportent       |
| Science   | voir section Science                             |
| Guildes   | points selon les conditions des cartes violettes |

Le joueur au plus haut total gagne. En cas d'égalité, celui qui a le plus de pièces l'emporte ; si
l'égalité persiste, les joueurs concernés partagent la victoire.

## Version contre IA

Version jouable : le joueur affronte 2 IA. Les règles ci-dessus s'appliquent ; le catalogue, les
plateaux merveille et les chaînes sont des créations du jeu (pas la transcription d'un jeu existant).

- **Mise en place** : 3 pièces et un plateau merveille par joueur : le joueur choisit le sien, les IA
  reçoivent les autres au hasard (`wonders.ts`). Le
  plateau produit une ressource dès le départ et a 3 étapes à bâtir dans l'ordre.
- **Catalogue** (`cards.ts`) : 7 cartes par âge, chacune en un exemplaire par joueur. Chaque joueur
  reçoit 7 cartes tirées au hasard dans le paquet de l'âge.
- **Trois actions** par tour, avec la carte choisie :
  - **construire le bâtiment** en payant son coût (pièces, ressources produites, commerce), ou
    gratuitement par **chaîne** si le bâtiment indiqué est déjà construit ;
  - **bâtir l'étape suivante de sa merveille** en payant le coût de l'étape : la carte est posée face
    cachée, ni construite ni défaussée, et l'effet de l'étape s'applique (points, boucliers ou pièces) ;
  - **défausser** la carte pour 3 pièces ; elle va sur la pile de défausse, qui reçoit aussi la dernière
    carte de chaque main en fin d'âge.
- **Commerce automatique** : une ressource manquante est achetée d'abord au voisin de gauche, puis à
  celui de droite, à 2 pièces l'unité, dans la limite de ce qu'ils produisent (plateau compris). Les
  pièces reçues pendant le tour ne servent pas à payer : tout est calculé sur l'état de début de tour.
- **Guildes** (violettes, âge III) : 1 point par carte des couleurs indiquées chez les deux voisins.
- **Score** : militaire, trésor, merveille, bâtiments civils, science et guildes. À égalité, le plus de
  pièces gagne ; sinon la victoire est partagée.
- **IA** (`ai.ts`) : elle construit le bâtiment payable le plus intéressant (points, boucliers, science,
  guildes d'abord) ; sinon elle bâtit une étape de sa merveille avec la carte la moins intéressante ;
  sinon elle la défausse.
- **Pas encore dans le catalogue** : productions « au choix », réductions commerciales et cartes jaunes
  qui rapportent des points. Les règles les permettent, aucune carte ne les utilise pour l'instant.

| Âge | Cartes (chaîne : ⛓ bâtiment requis)                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I   | Chantier, Cavité, Filon, Verrerie (ressources), Bains, Palissade, Atelier                                                                                      |
| II  | Scierie, Carrière (ressources ×2), Taverne, Aqueduc ⛓ Bains, Écuries ⛓ Palissade, Bibliothèque, Dispensaire                                                    |
| III | Panthéon ⛓ Aqueduc, Arsenal ⛓ Écuries, Université ⛓ Bibliothèque, Observatoire ⛓ Atelier, Académie ⛓ Dispensaire, Guilde des bâtisseurs, Guilde des magistrats |

| Merveille         | Produit | Étape 1         | Étape 2                  | Étape 3                   |
| ----------------- | ------- | --------------- | ------------------------ | ------------------------- |
| Temple d’Ysar     | minerai | minerai → 3 pts | bois ×2 → 2 boucliers    | pierre ×2, verre → 7 pts  |
| Phare de Sélène   | verre   | bois → 3 pts    | pierre ×2 → +6 pièces    | minerai ×2, verre → 7 pts |
| Jardins de Mirah  | bois    | bois → 3 pts    | minerai ×2 → 2 boucliers | pierre ×3 → 7 pts         |
| Citadelle d’Orkan | pierre  | pierre → 3 pts  | verre, bois → +6 pièces  | bois ×2, minerai → 7 pts  |

## Hors périmètre (première version)

Effets de carte permettant de rejouer une carte ou une action supplémentaire.

## Points à préciser

- Catalogue complet des cartes par âge (nom, coût, effet, chaînage) et cartes retirées selon le
  nombre de joueurs.
- Liste des plateaux de merveille : ressource de départ, coût et effet de chaque étape.

## Critères d'acceptation

- [x] Une partie complète (3 âges) se joue de bout en bout contre 2 IA.
- [ ] Une partie complète se joue entre 3 à 7 joueurs connectés.
- [x] Seuls les coups payables sont proposés ; une action impossible est refusée.
- [x] Le commerce avec les voisins et les chaînes de construction sont appliqués.
- [x] Les conflits militaires sont résolus à la fin de chaque âge.
- [x] Le score final détaillé par catégorie s'affiche en fin de partie et est envoyé à `ctx.submitScore`.
- [ ] Une partie en cours est sauvegardée et peut être reprise.
- [ ] Chaque règle ci-dessus est couverte par un test unitaire.

## Avancement

Cocher une ligne quand la règle est implémentée **et** testée.

Répartition : le **back** fait autorité sur la partie (trésor, commerce, temps de tour officiel) ; le
**front** prévisualise et affiche (devis d'achat, compte à rebours) sans jamais modifier l'état de la partie.

### Mise en place

- [x] 3 à 7 joueurs, 3 pièces chacun au départ (`setup.ts`)
- [x] Voisins de gauche et de droite, assis en cercle (`setup.ts`)
- [x] Tirage des plateaux de merveille et ressource de départ (`wonders.ts`, `game.ts`)
- [x] Paquets des trois âges, mélangés et distribués (`game.ts`, catalogue réduit `cards.ts`)

### Tour de jeu

- [x] Temps de tour officiel et heure limite, sur une horloge injectée (back `TurnTimer.java`)
- [x] Compte à rebours affiché à partir de l'heure limite (front `turnCountdown.ts`)
- [x] Signalement d'inactivité, une seule fois, à l'expiration du tour (front `turnCountdown.ts`)
- [ ] Défausse automatique à l'expiration du tour
- [x] Choix simultané des cartes et passage des mains selon l'âge (`game.ts`)
- [x] Défausser une carte pour 3 pièces (`game.ts`)
- [x] Fin d'âge après 6 tours, dernière carte défaussée (`game.ts`)

### Économie

- [x] Trésor : crédit, débit, transfert, jamais négatif (back `Treasury.java`)
- [x] Audit anti-triche au franchissement du seuil critique de 30 pièces (back `Treasury.java`)
- [x] Achat de ressources à un voisin au prix standard de 2 pièces (back `Trade.java`)
- [x] Devis d'achat : prix et achat possible ou non, sans débit (front `tradeQuote.ts`)
- [x] Achat des ressources manquantes aux voisins qui les produisent, pendant une construction (front `game.ts`)
- [ ] Prix réduit à 1 pièce (cartes jaunes)

### Construction

- [x] Payer le coût d'une carte : pièces, ressources produites et commerce (`game.ts`)
- [x] Refuser une carte déjà construite, impayable ou absente de la main (`game.ts`)
- [x] Chaînes de construction gratuites (`game.ts`)
- [x] Étapes de merveille dans l'ordre, carte posée face cachée sans effet (`game.ts`)
- [x] Guildes : points selon les cartes des voisins (`score.ts`)

### Fin d'âge et score

- [x] Conflits militaires (`game.ts`)
- [x] Score de science (back `ScienceScore.java`, front `score.ts`)
- [x] Score final par catégorie et départage par les pièces (`score.ts`)
- [x] Envoi du score en fin de partie (`ctx.submitScore`)

### Plateforme

- [x] Déclaration du jeu (`index.ts`, `registry.ts`) et migration du catalogue
- [x] Premier écran : table de jeu (joueur connecté + places libres, voisins) et classement (`SdvCivilisationGame.tsx`)
- [x] Places libres complétées par des IA en attendant le multijoueur (`bots.ts`)
- [x] Décisions des IA : construire la meilleure carte payable, sinon défausser (`ai.ts`)
- [ ] Salle d'attente et parties en ligne entre joueurs
- [ ] Sauvegarde et reprise de partie
- [x] Interface jouable : main face visible, construire ou défausser, dernier tour, fin de partie (`SdvCivilisationGame.tsx`)
- [x] Repères visuels : à qui de jouer, cartes constructibles / achat aux voisins / impossibles, cartes jouées posées sur la table (animées), pile de défausse, journal du dernier tour et des conflits
- [x] Règles du jeu à l'écran et plein écran (`RulesDialog.tsx`)
- [x] Plateau de merveille à l'écran : avancement sur chaque siège, détail dans la barre latérale (`WonderPanel.tsx`)
- [x] Choix de la merveille avant la partie ; les IA reçoivent les autres plateaux (`WonderPicker.tsx`)
- [x] Interface d'après la maquette : voisins à gauche et à droite (production achetable en pointillés, bâtiments,
      duel en cours), centre de la table (paquets, défausse, cartes du tour face cachée), cité du joueur (merveille,
      production, trésor, duels par voisin, science, bâtiments par couleur), main, trois actions et journal
- [x] Icônes vectorielles du jeu, expliquées dans les règles (`GameIcon.tsx`)

### Architecture testable

La logique du jeu ne dépend que d'interfaces pures, sans I/O. Les deux côtés ont les mêmes quatre
contrats, chacun utilisé pour son propre rôle, avec ses implémentations de production et ses doublures.

#### Back (JUnit 5) : arbitre de la partie

Package `fr.tikigaming.games.sdv_civilisation` ; doublures dans le même package, sous `src/test/java`.

| Contrat             | Utilisé par                              | Production                                 | Doublure de test                             |
| ------------------- | ---------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| `CurrencyConverter` | `Trade` (prix de l'achat)                | `StandardTrade` (2 pièces)                 | Stub `FixedRateConverter` (taux figé)        |
| `TreasuryRegistry`  | `Treasury` (pièces des joueurs)          | à venir (persistance de la partie)         | Fake `InMemoryTreasuryRegistry` (en mémoire) |
| `AuditNotifier`     | `Treasury` (seuil critique de 30 pièces) | `LogAuditNotifier` (SLF4J)                 | Mock Mockito (`verify(audit, times(1))`)     |
| `Clock`             | `TurnTimer` (heure limite officielle)    | `SystemClock` (`System.currentTimeMillis`) | Fake `FakeClock` (avancée à la main)         |

#### Front (Vitest) : affichage

Contrats dans `ports.ts`, production dans `adapters.ts`, tests et doublures dans `test/` (`test/fakes.ts`).

| Contrat             | Utilisé par                               | Production                   | Doublure de test                         |
| ------------------- | ----------------------------------------- | ---------------------------- | ---------------------------------------- |
| `CurrencyConverter` | `quotePurchase` (prix du devis)           | `standardTrade` (2 pièces)   | Stub `fixedRate` (taux figé)             |
| `TreasuryRegistry`  | `quotePurchase` (pièces de l'acheteur)    | `playersTreasury` (`Player`) | Fake `FakeTreasuryRegistry` (en mémoire) |
| `AuditNotifier`     | `createCountdown` (inactivité)            | `loggerAudit` (Pino)         | Mock `vi.fn()` (appel vérifié)           |
| `Clock`             | `createCountdown` (temps restant affiché) | `systemClock` (`Date.now()`) | Fake `FakeClock` (avancée à la main)     |

## Tests

| Côté  | Emplacement                                                           | Lancer                        |
| ----- | --------------------------------------------------------------------- | ----------------------------- |
| Front | `frontend/src/games/sdv-civilisation/test/*.test.ts(x)` (Vitest)      | `npm test` dans `frontend/`   |
| BDD   | `frontend/src/games/sdv-civilisation/test/partie.feature` (Gherkin)   | `npm test` dans `frontend/`   |
| Back  | `backend/src/test/java/fr/tikigaming/games/sdv_civilisation/` (JUnit) | `mvn -f backend/pom.xml test` |

Les règles de la partie sont décrites en Gherkin dans `partie.feature` (Soit / Quand / Alors), à partir
d'un atelier « 3 amigos » résumé en tête du fichier. Les étapes (`partie.steps.test.ts`) appellent le
moteur de partie, jamais l'écran. Doublures utilisées : stubs (`identityShuffler`, `fixedRate`), fakes
(`FakeScores`, registre et horloge en mémoire) et mocks (`vi.fn` / `vi.spyOn` sur le convertisseur,
`submitScore` et `onReplay`).
