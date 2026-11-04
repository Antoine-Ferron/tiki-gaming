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

## Procès-verbal de recette

| Rubrique | Contenu |
|----------|---------|
| Version recettée | (commit ou tag) |
| Période | du … au … |
| Fiches exécutées | … / 6 |
| Anomalies ouvertes | S0 : … · S1 : … · S2 : … · S3 : … |
| Décision | ☐ Acceptée · ☐ Acceptée avec réserves (lister) · ☐ Refusée |
| Recetteur | nom, date, signature |
| Responsable produit | nom, date, signature |
