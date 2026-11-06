# Campagne Dames du 6 novembre 2026

**Six parcours vérifiés par l'agent Codex avec Playwright.**
Statut des contrôles : **6 PASSED_AGENT, 0 échec observé**.
Il s'agit d'une exécution automatisée ponctuelle des parcours de recette,
avec inspection de captures par l'agent, et non d'une validation UAT signée
par un joueur ou d'une campagne CI supplémentaire.

## Version et environnement

- Commit du dépôt : `ea9cf0c71439213a697dc7d1fdf6f6607598de93`.
- Base de code : `659d4fb937c3004f94e37265064b1b1a0caa952b` ;
  les trois commits suivants sont documentaires.
- [CI réussie de cette base](https://github.com/EAnathos/tiki-gaming/actions/runs/42203726651),
  statut vérifié le 6 novembre 2026.
- Date d'exécution : **6 novembre 2026, de 13:33:01 à 13:33:20 CET**
  (Europe/Warsaw ; les JSON conservent leurs instants UTC).
- Navigateur : **Chromium 156.0.8078.4**, headless, locale française.
- Bureau : 1280 × 900 ; mobile simulé : 360 × 900, sans appareil tactile réel.
- Backend recompilé et démarré avec `DAME_DEMO_PORT=8086 ./tools/dame/demo-backend.sh`.
- Vite dédié sur 5176, avec le proxy de développement dirigé vers 8086 via
  une configuration temporaire, sans modification du fichier partagé.
- Vrais services jetables : `supabase/postgres:17.11.0.018` et
  `postgrest/postgrest:v16.5`, migrations exécutées par la fixture de démo.
- Les services préexistants sur 8080/5173 ont été laissés en place.
  Seule la campagne sur l'instance dédiée est retenue dans ces preuves.

## Méthode

Les créations, déplacements, rafles et revanches passent par l'interface.
Les réponses API sont observées, jamais remplacées. Pour préparer la fin de
partie, l'agent choisit parmi les coups légaux retournés par le serveur et
clique sur chaque case du parcours. Il ne fournit ni plateau ni gagnant au
serveur et ne modifie pas les données en SQL.

Les tentatives non jouables utilisent un clic de pointeur sur une case
réellement visible ; les actions clavier utilisent Tab, les flèches et Entrée.
La coupure réseau utilise le mode hors ligne du contexte Chromium, avant
l'envoi du coup. Chaque fiche indépendante utilise une session neuve ;
les fiches 03 et 04 partagent la même partie afin de conserver une séquence
complète depuis le placement initial.

Les assertions portent sur les réponses réellement reçues, les libellés et
états visibles, les requêtes émises et les pièces présentes. La vérification
SQL finale est une lecture seule des deux UUID créés pour la partie complète
et sa revanche. Les JSON ne contiennent ni cookie, ni jeton, ni en-tête
d'authentification ; les noms sont des données de démonstration.

## Résultats constatés

| Fiche | Observation                                                                                                                                                                                                                                                                                                       | Preuves                                                                                                                                             |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01    | Vide et 51 lettres refusés sans POST ; « A » après normalisation et 50 lettres acceptés, 20 pions par camp, aucun gagnant.                                                                                                                                                                                        | [Observations](observations.json), [erreur du formulaire](01-nom-invalide.png)                                                                      |
| 02    | B4 → A5, passage aux noirs ; clic sur D4 sans effet ; rechargement sur le même UUID/version 1 par GET sans recréation.                                                                                                                                                                                            | [Observations](observations.json), [état repris](02-reprise.png)                                                                                    |
| 03    | À la version 7, I9 → J8 ne produit aucun POST : une prise est obligatoire. La rafle J6 → H4 → F6 → D4 retire trois blancs après son dernier segment, avec un seul POST et un changement de tour. À la version 8, la prise C3 → E5 d'une pièce n'est pas jouable alors qu'une prise de deux pièces est disponible. | [Partie complète](partie-complete.json), [prévisualisation](03-rafle-intermediaire.png), [prise minoritaire non proposée](03-prise-minoritaire.png) |
| 04    | Victoire des noirs après 94 coups : huit pièces noires, aucune blanche. Aucun nouveau coup après victoire. Revanche avec nouvel UUID, 40 pions, blancs au trait. Lecture SQL : ancienne rencontre BLACK_WON, nouvelle IN_PROGRESS.                                                                                | [Victoire](04-victoire.png), [revanche](04-revanche.png), [SQL](verification-sql.json)                                                              |
| 05    | Hors ligne, message « Le serveur est injoignable. » et plateau bloqué. Après reconnexion, GET de relecture : version 0 et position initiale. Aucun POST automatique ; le coup explicite suivant passe à la version 1.                                                                                             | [Observations](observations.json), [erreur réseau](05-hors-ligne.png)                                                                               |
| 06    | Formulaire et coup réalisés au clavier, une seule case dans l'ordre de tabulation, focus avec contour orange de 2 px. Largeur document = largeur fenêtre = 360 px.                                                                                                                                                | [Observations](observations.json), [focus mobile](06-focus-mobile.png)                                                                              |

Le détail des **94 coups légaux** est disponible dans
[parcours-legaux.md](parcours-legaux.md). Les snapshots et requêtes utiles sont
dans [partie-complete.json](partie-complete.json) ; ils permettent notamment
de replacer les captures observées dans le déroulement réel.

## Portée et limites

- Ces résultats remplissent la colonne « résultat obtenu » en identifiant
  explicitement l'agent comme exécutant. Ils ne constituent pas un quitus humain.
- Le mobile est une largeur simulée ; ni écran tactile physique ni lecteur
  d'écran n'ont été utilisés. Le confort de jeu reste à apprécier par une personne.
- Les captures montrent le rendu observé ; elles ne prouvent pas à elles seules
  la base ou les appels réseau, d'où les observations et la lecture SQL séparées.
- Le scénario hors ligne concerne navigateur → application. Aucune panne réelle
  de PostgREST n'est injectée dans cette campagne.
- La campagne ne couvre ni les règles de nulle ni une reprise durable du plateau.
- Les scripts de pilotage ponctuels sont restés hors du dépôt. La séquence des
  coups, les étapes du [cahier](../../recette.md), les versions et les observations
  sont conservées pour reproduction ; aucun nouveau runner CI n'est annoncé.

Les captures et résultats sont des pièces de recette. Aucun support de
soutenance n'est inclus dans ce dossier.
