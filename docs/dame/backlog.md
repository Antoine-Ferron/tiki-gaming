# Backlog TDD proposé — issue #18

Ces US sont des sous-tâches documentaires : aucune issue GitHub créée. Les règles ci-dessous constituent la spécification proposée à confirmer pour les détails internationaux. Coordonnées et orientation sont des conventions internes proposées.

Les étapes RED / GREEN seront consignées au fil de la réalisation de chaque US. Ce backlog décrit le périmètre prévu ; il ne vaut pas validation des US.

## Definition of Done commune

Pour chaque US : critères et cas limites couverts par des tests JUnit 5 déterministes ; RED constaté pour la bonne raison ; implémentation minimale GREEN ; refactoring avec tests verts ; invariants vérifiés ; aucune dépendance technique dans le domaine ; documentation mise à jour ; revue requise selon CONTRIBUTING. Aucun commit ou push automatique. Les évolutions React/API restent conditionnées aux décisions plateforme.

## US-01 — Initialisation du damier

- **User Story** : en tant que joueur, je veux disposer d’un plateau de dames internationales.
- **Description** : Introduire Board et Position, sans pions.
- **Règles métier** : 10 × 10 cases ; 50 cases jouables. Convention proposée : lignes/colonnes 0 à 9 ; jouable si (ligne + colonne) % 2 == 1.
- **Critères d’acceptation** : Un plateau neuf expose 100 positions, dont 50 jouables, toutes vides.
- **Scénarios de tests prévus** : Compter les cases ; vérifier les quatre coins et les deux parités ; accès à une case vide.
- **Cas limites** : Coordonnées -1, 0, 9 et 10 sur chaque axe ; coordonnées identiques.
- **Invariants** : Dimensions stables ; aucune occupation initiale ; lecture sans mutation.
- **Dépendances** : Aucune.
- **Definition of Done** : DoD commune, avec validation des critères, scénarios et invariants de cette US.

## US-02 — Placement initial des pions

- **User Story** : en tant que joueur, je veux commencer avec vingt pions de chaque camp.
- **Description** : Introduire Piece et Player puis la disposition initiale.
- **Règles métier** : Noirs sur les cases jouables des lignes 0–3, blancs sur 6–9 ; lignes 4–5 vides ; tous sont des pions.
- **Critères d’acceptation** : 40 pièces réparties 20/20 ; aucune sur une case claire.
- **Scénarios de tests prévus** : Compter par camp et ligne ; vérifier le centre libre et la nature des pièces.
- **Cas limites** : Première et dernière cases jouables ; deux initialisations indépendantes.
- **Invariants** : Une pièce au plus par case ; camps distincts ; pas de dame initiale.
- **Dépendances** : US-01.
- **Definition of Done** : DoD commune, avec validation des critères, scénarios et invariants de cette US.

## US-03 — Gestion des tours

- **User Story** : en tant que joueur, je veux jouer alternativement avec mon adversaire.
- **Description** : Introduire Game et l’identité du camp courant.
- **Règles métier** : Les blancs commencent ; un coup complet accepté change le camp une fois ; refus sans changement.
- **Critères d’acceptation** : État initial blanc ; transitions blanc → noir → blanc ; refus du mauvais camp.
- **Scénarios de tests prévus** : Vérifier le premier joueur ; deux coups acceptés ; tentative hors tour.
- **Cas limites** : Coup refusé ; futur enchaînement de captures sans passage de tour intermédiaire.
- **Invariants** : Un seul camp actif ; compte SDK indépendant du camp.
- **Dépendances** : US-02 ; transitions complètes vérifiables avec US-04.
- **Definition of Done** : DoD commune, avec validation des critères, scénarios et invariants de cette US.

## US-04 — Déplacements simples

- **User Story** : en tant que joueur, je veux avancer un pion sur une diagonale libre.
- **Description** : Introduire Move et la validation des déplacements sans capture.
- **Règles métier** : Pion : une case diagonale vers l’avant ; blancs vers lignes décroissantes, noirs croissantes ; destination libre.
- **Critères d’acceptation** : Chaque diagonale avant disponible est acceptée ; origine libérée et destination occupée.
- **Scénarios de tests prévus** : Deux directions par camp ; état avant/après ; alternance après succès.
- **Cas limites** : Pion au bord ; destination au dernier rang (promotion traitée en US-09).
- **Invariants** : Nombre de pièces conservé ; un seul déplacement atomique.
- **Dépendances** : US-01, US-02, US-03.
- **Definition of Done** : DoD commune, avec validation des critères, scénarios et invariants de cette US.

## US-05 — Déplacements invalides

- **User Story** : en tant que joueur, je veux voir un coup illégal refusé sans altérer la partie.
- **Description** : Couvrir la validation des commandes et des positions.
- **Règles métier** : Refuser origine vide, pièce adverse, arrivée occupée/claire/hors plateau, déplacement nul, orthogonal ou arrière sans capture.
- **Critères d’acceptation** : Chaque refus laisse plateau et tour identiques et fournit une erreur métier déterministe.
- **Scénarios de tests prévus** : Un scénario par classe invalide ; comparer l’état complet avant/après.
- **Cas limites** : -1/10 sur chaque axe ; saut trop long ; origine égale à destination.
- **Invariants** : Aucune mutation partielle en cas de refus.
- **Dépendances** : US-04.
- **Definition of Done** : DoD commune, avec validation des critères, scénarios et invariants de cette US.

## US-06 — Capture simple

- **User Story** : en tant que joueur, je veux prendre un pion adverse en le franchissant.
- **Description** : Ajouter une capture de pion isolée.
- **Règles métier** : Saut diagonal par-dessus une pièce adverse adjacente vers une case libre ; capture avant et arrière ; aucune prise de sa propre pièce.
- **Critères d’acceptation** : Un adversaire retiré après coup complet ; pièce déplacée ; tour terminé si aucune suite.
- **Scénarios de tests prévus** : Quatre directions ; allié au milieu ; arrivée occupée ; absence de pièce à sauter.
- **Cas limites** : Capture proche du bord ; destination hors plateau ; dernière pièce adverse.
- **Invariants** : Décompte adverse diminué de un ; camp capturant conservé.
- **Dépendances** : US-05.
- **Definition of Done** : DoD commune, avec validation des critères, scénarios et invariants de cette US.

## US-07 — Capture obligatoire

- **User Story** : en tant que joueur, je veux respecter la priorité des prises.
- **Description** : Calculer les captures de tout le camp avant les déplacements ordinaires.
- **Règles métier** : Toute capture disponible interdit les déplacements simples, même avec une autre pièce.
- **Critères d’acceptation** : Un déplacement simple est refusé dès qu’une autre pièce peut prendre.
- **Scénarios de tests prévus** : Capture par la pièce sélectionnée ; par une autre pièce ; aucune capture disponible.
- **Cas limites** : Seule prise en arrière ; pièce bloquée ailleurs sur le plateau.
- **Invariants** : La priorité est globale au camp ; refus atomique.
- **Dépendances** : US-06.
- **Definition of Done** : DoD commune, avec validation des critères, scénarios et invariants de cette US.

## US-08 — Captures multiples et prise majoritaire

- **User Story** : en tant que joueur, je veux effectuer une rafle prenant le maximum de pièces.
- **Description** : Représenter un parcours complet et comparer toutes les rafles légales du camp.
- **Règles métier** : Continuer avec la même pièce ; nombre maximal de pièces obligatoire ; à égalité choix libre sans priorité à une dame. Pièces prises retirées à la fin ; pas de seconde capture de la même pièce.
- **Critères d’acceptation** : Refus d’un parcours incomplet ou minoritaire ; acceptation de chaque parcours maximal à égalité.
- **Scénarios de tests prévus** : Rafles de 2 et 3 ; maxima sur des pièces différentes ; branches de même longueur ; double prise interdite.
- **Cas limites** : Retour sur une case vide déjà traversée ; pièce déjà capturée qui bloque ; échec tardif du parcours.
- **Invariants** : Tour changé une seule fois ; retrait final atomique ; aucune pièce capturée deux fois.
- **Dépendances** : US-07.
- **Definition of Done** : DoD commune, avec validation des critères, scénarios et invariants de cette US.

## US-09 — Promotion en dame

- **User Story** : en tant que joueur, je veux transformer mon pion atteignant la dernière rangée.
- **Description** : Ajouter la promotion à la fin du coup complet.
- **Règles métier** : Blanc promu sur ligne 0, noir sur ligne 9 ; pendant une rafle le pion reste pion ; traverser la rangée puis finir ailleurs ne promeut pas.
- **Critères d’acceptation** : Promotion après arrivée finale sur la rangée ; aucune promotion anticipée.
- **Scénarios de tests prévus** : Arrivée simple ; arrivée après capture ; passage sur rangée puis sortie pendant une rafle.
- **Cas limites** : Pion déjà sur rangée dans une position de test ; dame déjà promue.
- **Invariants** : Camp et nombre de pièces conservés ; promotion une fois par pièce.
- **Dépendances** : US-08.
- **Definition of Done** : DoD commune, avec validation des critères, scénarios et invariants de cette US.

## US-10 — Déplacements et captures des dames

- **User Story** : en tant que joueur, je veux déplacer une dame à distance sur les diagonales.
- **Description** : Ajouter les dames volantes et les intégrer au calcul majoritaire.
- **Règles métier** : Déplacement diagonal avant/arrière de distance libre sans obstacle ; capture d’un adversaire avec arrivée sur une case libre au-delà ; pas de franchissement d’allié ni de deux pièces dans un seul saut.
- **Critères d’acceptation** : Toutes les arrivées libres admissibles sont proposées, avec priorité des rafles maximales.
- **Scénarios de tests prévus** : Plusieurs distances ; quatre directions ; obstacles ; plusieurs arrivées après une prise ; rafle mixte pions/dames.
- **Cas limites** : Bord du plateau ; adversaire sans case libre derrière ; pièces déjà prises bloquantes.
- **Invariants** : Règles de priorité et retrait final identiques aux pions.
- **Dépendances** : US-08, US-09.
- **Definition of Done** : DoD commune, avec validation des critères, scénarios et invariants de cette US.

## US-11 — Fin de partie et victoire

- **User Story** : en tant que joueur, je veux connaître le résultat quand un camp ne peut plus jouer.
- **Description** : Introduire GameStatus et vérifier le camp devant jouer après un coup complet.
- **Règles métier** : Victoire si adversaire sans pièce ou sans coup légal ; aucun coup accepté après terminaison. Nulles internationales : périmètre et compteurs à confirmer séparément.
- **Critères d’acceptation** : Vainqueur correct sur élimination ou blocage ; état terminal stable ; pas de victoire au milieu d’une rafle.
- **Scénarios de tests prévus** : Dernière capture ; adversaire bloqué avec pièces ; une seule action légale restante ; commande après victoire.
- **Cas limites** : Dames mobiles à distance ; capture seule possible ; situations de nulle à spécifier avant clôture.
- **Invariants** : Un seul vainqueur ; contrôle après tour complet ; pas de fausse victoire.
- **Dépendances** : US-10 ; décision explicite sur les nulles.
- **Definition of Done** : DoD commune, avec validation des critères, scénarios et invariants de cette US.

## US-12 — Réinitialisation

- **User Story** : en tant que joueur, je veux recommencer une nouvelle partie.
- **Description** : Reconstruire un état initial indépendant après une partie commencée ou terminée.
- **Règles métier** : Damier initial, 20 pions par camp, blancs au trait, statut en cours ; historique et séquence de capture effacés.
- **Critères d’acceptation** : État identique à une nouvelle partie ; absence de partage mutable avec l’ancienne.
- **Scénarios de tests prévus** : Réinitialiser après déplacement, rafle, promotion et victoire ; recommencer deux fois.
- **Cas limites** : Réinitialisation depuis état initial ; future sauvegarde incompatible ; ancienne référence conservée.
- **Invariants** : Aucun reliquat de l’ancienne partie ; pas de suppression de données SDK implicite.
- **Dépendances** : US-02 à US-11.
- **Definition of Done** : DoD commune, avec validation des critères, scénarios et invariants de cette US.
