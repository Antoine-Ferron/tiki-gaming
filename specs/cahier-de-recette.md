# Cahier de recette (UAT) du lobby

La **vérification** (« construit-on la solution correctement ? ») est automatisée : tests unitaires, intégration,
contrat, E2E, mutation, tracés dans la [matrice RTM](rtm-matrix.md). La **validation** (« construit-on le bon
produit ? ») se fait ici : un joueur réel déroule les parcours sur l'application déployée, avec des données réalistes,
et signe le procès-verbal.

## Critères d'entrée (gate-in)

La recette ne commence que si :

- [ ] la CI de la version à recetter est **entièrement verte** (job `CI (verdict)`), intégration et E2E compris ;
- [ ] `npm run rtm:check` ne signale aucune rupture de traçabilité ;
- [ ] l'environnement de recette est un miroir de la production (mêmes migrations, même RLS) avec des comptes de test
      dédiés, sans données personnelles réelles (RGPD) ;
- [ ] la liste des changements de la version (PR fusionnées) est jointe.

## Critères de sortie (gate-out)

La version est acceptée si :

- [ ] 100 % des fiches ci-dessous ont été exécutées, avec un statut `PASSED`, `FAILED` ou `BLOCKED` ;
- [ ] aucune anomalie **S0 (bloquante)** ou **S1 (majeure)** n'est ouverte ;
- [ ] chaque `FAILED` est rattaché à une anomalie (tableau des anomalies de la [RTM](rtm-matrix.md#anomalies)) ;
- [ ] le procès-verbal est signé (avec ou sans réserves).

## Fiches de recette

Statut tant que la fiche n'a pas été jouée : `À EXÉCUTER`. Le recetteur remplit « Résultat obtenu », le statut, la
date et ses initiales.

### TC-UAT-01 · Inscription avec Google

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-AUTH-02 |
| Profil | Visiteur, navigateur de bureau puis smartphone |
| Préconditions | Compte Google de test avec email vérifié, jamais utilisé sur Tiki Gaming |
| Jeu de données | Compte Google `recette.tiki.01@…` (fourni par l'équipe) |
| Étapes | 1. Ouvrir `/signup` · 2. Cliquer « S'inscrire avec Google » · 3. Choisir le compte de test et accepter |
| Résultat attendu | Retour sur l'accueil, salué par un pseudo dérivé du nom Google ; « Mon profil » affiche l'email Google |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

### TC-UAT-02 · Inscription par email avec un pseudo refusé puis corrigé

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-AUTH-01 |
| Profil | Visiteur |
| Préconditions | Aucune session ouverte |
| Jeu de données | Pseudo `Zoé la-zoé` puis `zoe_42` ; email de test ; mot de passe de 8 caractères |
| Étapes | 1. Ouvrir `/signup` · 2. Saisir le pseudo `Zoé la-zoé` et valider · 3. Corriger en `zoe_42` et valider |
| Résultat attendu | Étape 2 : message sous le champ citant `é`, `espace` et `-` · Étape 3 : compte créé (ou email de confirmation) |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

### TC-UAT-03 · Partie de Clicker connectée et classement

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-SCORE-01, REQ-SCORE-02, REQ-RANK-01 |
| Profil | Joueur connecté |
| Préconditions | Deux comptes de test, l'un déjà classé avec un score connu |
| Jeu de données | Compte `recette_a` (score 50), compte `recette_b` |
| Étapes | 1. Avec `recette_b`, jouer une partie de Clicker 10s · 2. Atteindre exactement 50 clics si possible · 3. Relire le classement |
| Résultat attendu | Score affiché en fin de partie, ligne de `recette_b` au classement avec son meilleur score ; à 50, rang partagé avec `recette_a` |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

### TC-UAT-04 · Fin de partie pendant une coupure réseau

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-SCORE-03, REQ-ERR-01 |
| Profil | Joueur connecté, smartphone |
| Préconditions | Session ouverte sur `recette_b` |
| Jeu de données | — |
| Étapes | 1. Lancer une partie · 2. Couper le réseau (mode avion) avant la fin · 3. Lire le message · 4. Rétablir le réseau et rejouer une partie |
| Résultat attendu | Étape 3 : « Connexion perdue : ton score est gardé sur cet appareil… » · Étape 4 : les deux scores apparaissent dans le classement |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

### TC-UAT-05 · Suppression du compte (droit à l'effacement)

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-GDPR-01 |
| Profil | Joueur connecté |
| Préconditions | Compte de test jetable avec au moins un score et une sauvegarde |
| Jeu de données | Compte `recette_jetable` |
| Étapes | 1. Ouvrir « Mon profil » · 2. Taper un pseudo erroné dans la confirmation · 3. Taper le bon pseudo et supprimer · 4. Ouvrir le classement du jeu joué · 5. Tenter de se reconnecter |
| Résultat attendu | Étape 2 : bouton inactif · Étape 3 : retour à l'accueil, « Ton compte et toutes tes données ont été supprimés. » · Étape 4 : le pseudo a disparu · Étape 5 : identifiants refusés |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

### TC-UAT-06 · Navigation au clavier et lecteur d'écran

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-A11Y-01 |
| Profil | Visiteur, clavier seul, puis lecteur d'écran (NVDA ou VoiceOver) |
| Préconditions | — |
| Jeu de données | — |
| Étapes | 1. Parcourir l'accueil, les filtres et une carte de jeu au clavier (Tab, Entrée) · 2. Sur `/login`, valider un formulaire vide |
| Résultat attendu | Focus toujours visible, ordre logique ; les erreurs de champ sont annoncées par le lecteur d'écran |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

### TC-UAT-07 · Rush Hour : niveau 1 terminé au minimum de coups, à la souris

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-RH-01, REQ-RH-02, REQ-RH-04, REQ-RH-05 |
| Profil | Joueur connecté, navigateur de bureau, souris |
| Préconditions | Compte de test qui n'a jamais joué à Rush Hour |
| Jeu de données | Compte `recette_b` ; solution du niveau 1 : camion A de 3 cases vers le bas, voiture H d'1 case vers le haut, voiture rouge de 3 cases vers la droite |
| Étapes | 1. Ouvrir Rush Hour · 2. Essayer d'ouvrir le niveau 2 · 3. Ouvrir le niveau 1 · 4. Glisser la voiture rouge vers la droite, au-delà du camion A · 5. Cliquer « Recommencer » · 6. Jouer la solution à la souris · 7. Revenir aux niveaux et relire le classement |
| Résultat attendu | Étape 2 : niveau 2 fermé (cadenas) · Étape 4 : la voiture s'arrête contre le camion, « Coups : 1 (min. 3) » · Étape 6 : « Bravo ! 1000 points en 3 coups », véhicules bloqués · Étape 7 : niveau 2 « à jouer », « Score total : 1000 points », `recette_b` classé à 1000 |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

### TC-UAT-08 · Rush Hour : indice payant et record conservé

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-RH-03, REQ-RH-05, REQ-RH-07 |
| Profil | Joueur connecté |
| Préconditions | TC-UAT-07 exécutée : record de 1000 points au niveau 1 |
| Jeu de données | Compte `recette_b` |
| Étapes | 1. Rejouer le niveau 1 · 2. Cliquer « Indice (−200 points) » · 3. Suivre l'indice puis finir au minimum de coups · 4. Revenir aux niveaux |
| Résultat attendu | Étape 2 : « Indice : Camion A, vertical de 3 cases vers le bas », le camion est mis en avant · Étape 3 : « Bravo ! 800 points en 3 coups » · Étape 4 : le niveau 1 affiche toujours 1000 points, score total inchangé (un record ne baisse jamais) |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

### TC-UAT-09 · Rush Hour : plateau généré en Difficile, hors classement

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-RH-06 |
| Profil | Joueur connecté |
| Préconditions | Score total connu au classement (par exemple 1000 après TC-UAT-07) |
| Jeu de données | Compte `recette_b` |
| Étapes | 1. Dans « Génération », cliquer « Difficile » · 2. Noter le minimum affiché · 3. Résoudre le plateau (les indices sont autorisés) · 4. Cliquer « Nouveau plateau » · 5. Revenir à l'écran de choix et relire le classement |
| Résultat attendu | Étape 1 : un plateau s'affiche en moins de 2 secondes · Étape 2 : minimum d'au moins 17 coups · Étape 4 : un autre plateau Difficile · Étape 5 : « Difficile : 1 plateau réussi », score total et classement inchangés |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

### TC-UAT-10 · Rush Hour : jouer au doigt sur smartphone et au clavier seul

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-RH-08, REQ-A11Y-01 |
| Profil | Invité, smartphone (écran tactile) puis navigateur de bureau au clavier seul |
| Préconditions | — |
| Jeu de données | Niveau 1 |
| Étapes | 1. Sur smartphone, ouvrir le niveau 1 et glisser des véhicules au doigt, d'à peine plus d'une demi-case, dans les deux sens · 2. Sur ordinateur, sans souris : Tab jusqu'à la voiture rouge, flèche haut, puis flèche droite · 3. Finir le niveau au clavier |
| Résultat attendu | Étape 1 : le plateau tient dans l'écran ; le véhicule suit le doigt et se cale sur la case la plus proche, de la même façon vers la gauche que vers la droite · Étape 2 : focus visible ; flèche haut sans effet sur une voiture horizontale, flèche droite la déplace d'une case · Étape 3 : écran de victoire, et le jeu invite l'invité à se connecter pour être classé |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

### TC-UAT-11 · MiniGTA : première partie en invité, mission « Colis express » et armurerie

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-GTA-02, REQ-GTA-03, REQ-GTA-05 |
| Profil | Invité, navigateur de bureau, clavier et souris |
| Préconditions | Aucune sauvegarde MiniGTA dans ce navigateur (`localStorage` vidé) |
| Jeu de données | Nouvelle partie (500 $) |
| Étapes | 1. Ouvrir `/games/mini-gta`, cliquer « Jouer » · 2. Prendre une voiture, réussir « Colis express » (GPS, chrono) · 3. À l'armurerie, acheter un pistolet · 4. Tenter d'acheter le sniper (2 500 $) · 5. Rejouer « Colis express » · 6. Échap → « Quitter » |
| Résultat attendu | Étape 2 : +800 $, solde 1 300 $ · Étape 3 : −300 $, pistolet et munitions dans l'inventaire · Étape 4 : achat refusé, solde inchangé · Étape 5 : aucune récompense · Étape 6 : l'accueil affiche « Continuer », l'argent et « 1 / 4 » missions |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

### TC-UAT-12 · MiniGTA : score au classement et progression retrouvée sur un autre appareil

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-GTA-08 |
| Profil | Joueur connecté, deux navigateurs (ou deux appareils) |
| Préconditions | Compte `recette_c`, aucun score MiniGTA |
| Jeu de données | Compte `recette_c` |
| Étapes | 1. Connecté, réussir une mission puis ramasser des billets · 2. Dépenser à l'armurerie · 3. Quitter et relire le classement · 4. Se connecter avec le même compte sur l'autre navigateur et ouvrir MiniGTA |
| Résultat attendu | Étape 3 : le classement affiche tout l'argent gagné (mission + billets), non diminué par l'achat · Étape 4 : « Continuer » avec le même argent et les mêmes missions |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

### TC-UAT-13 · MiniGTA : poursuite de police, arrestation et caution

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-GTA-06, REQ-GTA-07 |
| Profil | Invité, navigateur de bureau |
| Préconditions | Partie en cours avec plus de 1 500 $ et une arme achetée |
| Jeu de données | Commande de chat `/recherche 2` autorisée pour gagner du temps |
| Étapes | 1. Commettre un crime devant un témoin · 2. Se cacher hors de vue jusqu'à la fin de la recherche · 3. Recommencer, puis se laisser arrêter |
| Résultat attendu | Étape 1 : des étoiles s'affichent · Étape 2 : elles clignotent puis disparaissent · Étape 3 : réapparition au commissariat, caution de 15 % (200 $ minimum) prélevée, plus que les poings dans l'inventaire |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

### TC-UAT-14 · MiniGTA : tremplin et bâtiment ouvert

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-GTA-09, REQ-GTA-10 |
| Profil | Invité, navigateur de bureau |
| Préconditions | Partie en cours |
| Jeu de données | Commandes `/tp port` et `/summon sport` autorisées |
| Étapes | 1. Au port, prendre une sportive et rouler vite sur une rampe de chargement · 2. En ville, entrer à pied dans un immeuble dont la porte est ouverte · 3. Essayer d'y entrer en voiture |
| Résultat attendu | Étape 1 : la voiture décolle et retombe sans traverser le sol · Étape 2 : pièce meublée, plafond au-dessus du joueur · Étape 3 : la porte est trop étroite pour la voiture |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

### TC-UAT-15 · MiniGTA : smartphone et petit écran

| Rubrique | Contenu |
|----------|---------|
| Exigence liée | REQ-GTA-11 |
| Profil | Invité, smartphone (écran tactile) |
| Préconditions | — |
| Jeu de données | — |
| Étapes | 1. Ouvrir `/games/mini-gta` sur le smartphone · 2. Relire le classement |
| Résultat attendu | Étape 1 : « Ce jeu se joue au clavier et à la souris, sur ordinateur. », aucun bouton « Jouer » · Étape 2 : le classement reste lisible |
| Résultat obtenu | |
| Statut | À EXÉCUTER |

## Procès-verbal de recette

| Rubrique | Contenu |
|----------|---------|
| Version recettée | (commit ou tag) |
| Période | du … au … |
| Fiches exécutées | … / 15 |
| Anomalies ouvertes | S0 : … · S1 : … · S2 : … · S3 : … |
| Décision | ☐ Acceptée · ☐ Acceptée avec réserves (lister) · ☐ Refusée |
| Recetteur | nom, date, signature |
| Responsable produit | nom, date, signature |

## Recette simulée BANG! — exécution automatisée locale

Cette section est une **recette simulée**, exécutée par Playwright/Chromium et k6 contre Spring local.
Elle ne remplit pas les signatures du procès-verbal précédent et ne constitue pas une validation humaine.
Les comptes et données sont factices ; le fournisseur d'identité est simulé, les sessions et le CSRF sont réels.
Les nouveaux jobs CI sont préparés mais n'ont pas encore tourné sur GitHub, la branche restant non publiée.

### TC-SIM-BANG-01 · Deux comptes et deux invités à la même table

| Rubrique | Contenu |
| --- | --- |
| Exigence liée | REQ-BANG-01 ; #54, #56, #59, #60, #61 |
| Nature | Recette simulée locale, quatre contextes Chromium isolés |
| Préconditions | Serveur `BangBrowserApplication`, deux connexions par formulaire, deux invités |
| Étapes | Créer une table, rejoindre par code, démarrer, observer les quatre vues privées, jouer et répondre aux tirs, actualiser les invités, terminer le dernier tour |
| Attendu | Quatre sessions distinctes ; mains et rôles cachés non divulgués ; même siège/main/tir après actualisation ; aucune émission de score invité ; passage du siège 4 au siège 1 en DRAW après la réponse au dernier tir |
| Observé | PASSED local : quatre sessions distinctes, JSON privés conformes, sièges/mains/tir retrouvés, aucun POST de score invité, siège 1 en DRAW après le dernier passage de main ; neuf E2E verts ensemble, zéro retry |
| SHA testé | `f54a600becd8eebb29e810c596de452bdaf6c4d4` |
| Trace | `frontend/reports/bang-e2e/results/review.probe-deux-invités--df334-èges-auprès-de-deux-comptes-chromium/trace.zip` |
| Statut | PASSED — recette simulée, aucune signature humaine |

### TC-SIM-BANG-02 · Même tour local et en ligne

| Rubrique | Contenu |
| --- | --- |
| Exigence liée | REQ-BANG-02 ; #55, #57 |
| Nature | Recette simulée ; même parcours dans `local.ts` et les endpoints Spring |
| Étapes | Donne déterministe, piocher, finir le jeu, défausser deux cartes, passer la main |
| Attendu | Siège 1 en DRAW/5 cartes puis PLAY/7, DISCARD/7, DISCARD/6, DISCARD/5 et enfin siège 2 en DRAW ; main du siège 2 inchangée à quatre cartes ; mêmes identifiants/types de cartes entre les moteurs à chaque étape |
| Observé | PASSED : les deux vues correspondent à chacune des six étapes, cartes comprises ; douze observations dans l'attachement JSON `meme-tour-local-en-ligne` du rapport |
| SHA testé | `f54a600becd8eebb29e810c596de452bdaf6c4d4` |
| Trace | `frontend/reports/bang-e2e/results/review.probe-sur-un-écran-le-BANG-atteint-un-voisin-à-portée-chromium/trace.zip` |
| Statut | PASSED — recette simulée |

### TC-SIM-BANG-03 · Charge nominale à dix tables

| Rubrique | Contenu |
| --- | --- |
| Exigence liée | REQ-BANG-03 ; #61 |
| Nature | Charge simulée locale k6, quarante sessions invitées et vrais cookies/CSRF |
| Attendu | Dix tables distinctes démarrées et jouées ; environ 20 lectures/s ; cinq commandes par table et effet vérifié ; P95 < 300 ms, P99 < 500 ms, erreurs < 1 % pour lectures et commandes séparées |
| Observé | 10/10 tables démarrées et jouées ; 600 lectures à 19,72/s, P95 3,11 ms, P99 5,45 ms, erreurs 0 % ; 50 commandes à 1,64/s, P95 3,27 ms, P99 3,43 ms, erreurs 0 % |
| SHA testé | `d788c51` ; le commit suivant modifie uniquement le workflow CI |
| Trace de mesure | `quality/reports/bang/k6-load.json` et `quality/reports/bang/recette-charge/k6-load.log` |
| Statut | PASSED — recette simulée locale, 30 secondes de charge |

La [matrice RTM](rtm-matrix.md) relie ces fiches aux preuves et aux cas de refus. Le
[bilan BANG!](../docs/games/bang/recette-simulee-charge.md) donne les commandes reproductibles,
les limites, les traces rouges/vertes et la distinction entre les résultats locaux et GitHub.
