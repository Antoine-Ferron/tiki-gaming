# SDV Civilisation — spécification des règles

Jeu de civilisation à cartes en **trois âges**. Chaque joueur développe sa civilisation : il construit
des bâtiments, produit des ressources, progresse en science, arme son armée et érige une merveille.
Le joueur qui termine avec le plus de **points de victoire** gagne.

Seules les règles listées ici sont implémentées (et testées) : tout le reste est hors périmètre.

## Format

| Élément      | Valeur                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| Catégorie    | `multi` (3 joueurs et +)                                                   |
| Mode         | `multiplayer` : compte requis, les joueurs s'affrontent en ligne           |
| Joueurs      | 3 à 7 joueurs connectés, assis en cercle ; places libres prises par des IA |
| Durée        | 3 âges de 6 tours                                                          |
| Score envoyé | total de points de victoire de chaque joueur (`ctx.submitScore`)           |
| Sauvegarde   | état complet de la partie en cours (`ctx.save`), reprise au chargement     |

## Mise en place

1. Il faut entre **3 et 7 joueurs**.
2. Chaque joueur commence avec **1 pièce** et aucune carte construite.
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

## Hors périmètre (première version)

Effets de carte permettant de rejouer une carte ou une action supplémentaire.

## Points à préciser

- Catalogue complet des cartes par âge (nom, coût, effet, chaînage) et cartes retirées selon le
  nombre de joueurs.
- Liste des plateaux de merveille : ressource de départ, coût et effet de chaque étape.

## Critères d'acceptation

- [ ] Une partie complète (3 âges) se joue de bout en bout entre 3 à 7 joueurs connectés.
- [ ] Seuls les coups payables sont proposés ; une action impossible est refusée.
- [ ] Le commerce avec les voisins et les chaînes de construction sont appliqués.
- [ ] Les conflits militaires sont résolus à la fin de chaque âge.
- [ ] Le score final détaillé par catégorie s'affiche en fin de partie et est envoyé à `ctx.submitScore`.
- [ ] Une partie en cours est sauvegardée et peut être reprise.
- [ ] Le jeu demande d'être connecté (mode `multiplayer`).
- [ ] Chaque règle ci-dessus est couverte par un test unitaire.

## Avancement

Cocher une ligne quand la règle est implémentée **et** testée.

Répartition : le **back** fait autorité sur la partie (trésor, commerce, temps de tour officiel) ; le
**front** prévisualise et affiche (devis d'achat, compte à rebours) sans jamais modifier l'état de la partie.

### Mise en place

- [x] 3 à 7 joueurs, 1 pièce chacun au départ (`setup.ts`)
- [x] Voisins de gauche et de droite, assis en cercle (`setup.ts`)
- [ ] Tirage des plateaux de merveille et ressource de départ
- [ ] Paquets des trois âges selon le nombre de joueurs

### Tour de jeu

- [x] Temps de tour officiel et heure limite, sur une horloge injectée (back `TurnTimer.java`)
- [x] Compte à rebours affiché à partir de l'heure limite (front `turnCountdown.ts`)
- [x] Signalement d'inactivité, une seule fois, à l'expiration du tour (front `turnCountdown.ts`)
- [ ] Défausse automatique à l'expiration du tour
- [ ] Choix simultané des cartes et passage des mains selon l'âge
- [ ] Défausser une carte pour 3 pièces
- [ ] Fin d'âge après 6 tours

### Économie

- [x] Trésor : crédit, débit, transfert, jamais négatif (back `Treasury.java`)
- [x] Audit anti-triche au franchissement du seuil critique de 30 pièces (back `Treasury.java`)
- [x] Achat de ressources à un voisin au prix standard de 2 pièces (back `Trade.java`)
- [x] Devis d'achat : prix et achat possible ou non, sans débit (front `tradeQuote.ts`)
- [ ] Vérifier que le vendeur est un voisin et produit la ressource
- [ ] Prix réduit à 1 pièce (cartes jaunes)

### Construction

- [ ] Payer le coût d'une carte (ressources produites + commerce)
- [ ] Refuser une carte déjà construite
- [ ] Chaînes de construction gratuites
- [ ] Étapes de merveille dans l'ordre

### Fin d'âge et score

- [ ] Conflits militaires
- [x] Score de science (back : `ScienceScore.java`)
- [ ] Score final par catégorie et départage
- [ ] Envoi du score (`ctx.submitScore`)

### Plateforme

- [x] Déclaration du jeu (`index.ts`, `registry.ts`) et migration du catalogue
- [x] Premier écran : table de jeu (joueur connecté + places libres, voisins) et classement (`SdvCivilisationGame.tsx`)
- [x] Places libres complétées par des IA en attendant le multijoueur (`bots.ts`)
- [ ] Décisions des IA (choisir et jouer une carte)
- [ ] Salle d'attente et parties en ligne entre joueurs
- [ ] Sauvegarde et reprise de partie
- [ ] Interface de jeu complète (main, plateau, merveille)

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
| Front | `frontend/src/games/sdv-civilisation/test/*.test.ts` (Vitest)         | `npm test` dans `frontend/`   |
| Back  | `backend/src/test/java/fr/tikigaming/games/sdv_civilisation/` (JUnit) | `mvn -f backend/pom.xml test` |
