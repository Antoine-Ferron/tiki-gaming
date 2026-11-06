# Dames — cahier de recette manuelle

**Statut au 6 novembre 2026 : campagne préparée, non exécutée.**

Ce document décrit la validation du parcours par un joueur. Les tests
automatisés de la [matrice RTM](rtm-matrix.md) apportent une vérification
technique distincte. La présentation orale et les démos antérieures ne
valent pas exécution ni signature de ces fiches.

## Préparer une campagne

- Identifier le commit, l'environnement, le navigateur et la personne qui teste.
- Vérifier les résultats CI de cette version et les migrations attendues.
- Démarrer les services selon le [README](README.md), avec des noms fictifs.
- Pour la démo locale, noter « environnement local, base jetable » ; cela ne
  constitue pas une recette sur un environnement de production.
- Utiliser une nouvelle rencontre pour chaque fiche qui le demande.
- Conserver une capture ou une trace pertinente sans cookie, jeton ni secret.

Après exécution, renseigner résultat obtenu, date, initiales, preuve et statut.
Utiliser PASSED si les attentes sont vérifiées, FAILED si elles ne le sont
pas, BLOCKED si un obstacle empêche le test ; dans ces deux derniers cas,
lier une anomalie conformément à [CONTRIBUTING](../../CONTRIBUTING.md).
Une attente non observée ne peut pas recevoir PASSED.

## UAT-DAME-01 — Noms et limites du formulaire

| Rubrique                                | Contenu                                                                                                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exigences                               | REQ-DAME-09, 10                                                                                                                                                                                |
| Profil / préconditions                  | Deux participants locaux, formulaire d'une nouvelle rencontre                                                                                                                                  |
| Données                                 | Noir : `Amadou` ; blanc : vide, puis 51 lettres A, puis `A` ; nouvelle rencontre avec 50 lettres A                                                                                             |
| Étapes                                  | 1. Soumettre vide. 2. Essayer 51 lettres A pour le blanc. 3. Remplacer par `A` et démarrer. 4. Demander une nouvelle partie et recommencer avec 50 lettres A.                                  |
| Attendu                                 | Vide et 51 lettres refusés avec erreurs lisibles, sans démarrage. Le nom A normalisé et celui de 50 lettres sont acceptés ; le plateau commence avec 20 pions de chaque camp et aucun gagnant. |
| Résultat obtenu / preuve                | À renseigner                                                                                                                                                                                   |
| Date / testeur / commit / environnement | À renseigner                                                                                                                                                                                   |
| Statut / anomalie                       | À EXÉCUTER / —                                                                                                                                                                                 |

Les lettres A rendent les limites non ambiguës. Le contrat technique porte
sur des unités UTF-16 ; cette fiche ne prétend pas couvrir tous les caractères Unicode.

## UAT-DAME-02 — Coup, alternance et rechargement

| Rubrique                                | Contenu                                                                                                                                                                                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exigences                               | REQ-DAME-01, 02, 16                                                                                                                                                                                                                                                                |
| Profil / préconditions                  | Nouvelle rencontre Cherif / Amadou, même onglet et session active                                                                                                                                                                                                                  |
| Données                                 | Premier coup blanc B4 → A5                                                                                                                                                                                                                                                         |
| Étapes                                  | 1. Jouer B4 → A5. 2. Observer le camp annoncé et les pièces. 3. Tenter de sélectionner un pion blanc au tour noir. 4. Recharger la page.                                                                                                                                           |
| Attendu                                 | Le pion blanc arrive en A5, B4 est libre et le tour passe aux noirs. Aucun second coup blanc ne peut être joué. Après rechargement, noms, position et tour restent identiques. Dans le réseau du navigateur, la reprise fait un GET de la rencontre sans nouveau POST de création. |
| Résultat obtenu / preuve                | À renseigner                                                                                                                                                                                                                                                                       |
| Date / testeur / commit / environnement | À renseigner                                                                                                                                                                                                                                                                       |
| Statut / anomalie                       | À EXÉCUTER / —                                                                                                                                                                                                                                                                     |

## UAT-DAME-03 — Prise obligatoire et rafle

| Rubrique                                | Contenu                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exigences                               | REQ-DAME-03, 04                                                                                                                                                                                                                                                                                                                |
| Profil / préconditions                  | Partie réelle amenée par des coups légaux à une capture, puis à une rafle ; consigner les coups de préparation                                                                                                                                                                                                                 |
| Données                                 | Coordonnées du plateau et parcours choisis à relever avant chaque essai                                                                                                                                                                                                                                                        |
| Étapes                                  | 1. Quand une prise est disponible, tenter un déplacement simple avec une autre pièce. 2. Sélectionner une rafle proposée. 3. Observer le plateau à une arrivée intermédiaire. 4. Terminer le parcours. Si une prise minoritaire existe sur la position, tenter de la sélectionner.                                             |
| Attendu                                 | Les déplacements simples et les prises minoritaires ne sont pas proposés comme coups jouables. L'arrivée intermédiaire ne déclenche pas de POST de coup ; les victimes restent visibles pendant la prévisualisation. Le parcours complet déclenche un seul POST ; les victimes sont alors retirées et le tour change une fois. |
| Résultat obtenu / preuve                | À renseigner, avec les coups de préparation                                                                                                                                                                                                                                                                                    |
| Date / testeur / commit / environnement | À renseigner                                                                                                                                                                                                                                                                                                                   |
| Statut / anomalie                       | À EXÉCUTER / —                                                                                                                                                                                                                                                                                                                 |

Cette fiche nécessite une préparation plus longue. Ne pas injecter un plateau
par une route ou en base : le produit ne propose pas cette fonctionnalité.
Si la position de test n'a pas été obtenue, ne pas déclarer le cas validé.

## UAT-DAME-04 — Victoire et revanche

| Rubrique                                | Contenu                                                                                                                                                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exigences                               | REQ-DAME-07, 08, 11                                                                                                                                                                                 |
| Profil / préconditions                  | Partie réelle menée jusqu'à la dernière capture ou au blocage adverse ; noter le camp attendu                                                                                                       |
| Données                                 | Deux noms fictifs et parcours légal consigné                                                                                                                                                        |
| Étapes                                  | 1. Jouer le coup gagnant. 2. Lire le résultat et essayer de jouer encore. 3. Demander une revanche et saisir les noms. 4. Démarrer la nouvelle rencontre.                                           |
| Attendu                                 | Le résultat annonce le camp attendu et aucun coup supplémentaire n'est accepté. La revanche passe par le formulaire ; la nouvelle rencontre possède un autre UUID, 40 pions et les blancs au trait. |
| Résultat obtenu / preuve                | À renseigner, avec capture du résultat et UUID des deux rencontres                                                                                                                                  |
| Date / testeur / commit / environnement | À renseigner                                                                                                                                                                                        |
| Statut / anomalie                       | À EXÉCUTER / —                                                                                                                                                                                      |

L'affichage ne prouve pas à lui seul la persistance SQL ni le refus d'une
seconde clôture concurrente. Ces garanties sont vérifiées par les IT liés à
REQ-DAME-11 ; ne pas les déduire uniquement d'une capture du navigateur.

## UAT-DAME-05 — Coupure réseau et relecture

| Rubrique                                | Contenu                                                                                                                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exigences                               | REQ-DAME-15, 16                                                                                                                                                                                                                                                                            |
| Profil / préconditions                  | Partie initiale dans le navigateur, panneau réseau ouvert                                                                                                                                                                                                                                  |
| Données                                 | B4 → A5 ; mode hors ligne des outils de développement                                                                                                                                                                                                                                      |
| Étapes                                  | 1. Couper le réseau avant de soumettre le coup. 2. Essayer B4 → A5. 3. Observer le message et le plateau. 4. Rétablir le réseau. 5. Cliquer « Actualiser la partie ».                                                                                                                      |
| Attendu                                 | Une erreur est affichée ; le plateau précédent reste visible et bloqué jusqu'à la relecture. L'actualisation envoie un GET, sans répéter automatiquement le POST. Avec cette coupure avant envoi, le serveur conserve la position initiale ; le joueur peut ensuite rejouer explicitement. |
| Résultat obtenu / preuve                | À renseigner, avec trace réseau expurgée                                                                                                                                                                                                                                                   |
| Date / testeur / commit / environnement | À renseigner                                                                                                                                                                                                                                                                               |
| Statut / anomalie                       | À EXÉCUTER / —                                                                                                                                                                                                                                                                             |

Ce scénario n'est pas une panne de PostgreSQL et ne simule pas une réponse
perdue après écriture. Les stubs et tests dédiés couvrent ces autres situations ;
une injection réseau réelle côté PostgREST reste un travail distinct.

## UAT-DAME-06 — Clavier et petite largeur

| Rubrique                                | Contenu                                                                                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exigence                                | REQ-DAME-17                                                                                                                                                                                                                                            |
| Profil / préconditions                  | Formulaire puis damier, navigateur à 360 px de largeur                                                                                                                                                                                                 |
| Données                                 | Cherif / Amadou, partie initiale                                                                                                                                                                                                                       |
| Étapes                                  | 1. Parcourir et remplir le formulaire au clavier. 2. Démarrer sans souris. 3. Atteindre le damier par Tab. 4. Naviguer avec les flèches et sélectionner un coup avec Entrée ou Espace. 5. Vérifier le focus, les messages et le défilement horizontal. |
| Attendu                                 | Champs et actions utilisables au clavier, focus visible, déplacement entre cases possible. Le damier utilise une seule entrée dans l'ordre de tabulation. Formulaire et plateau restent lisibles sans débordement horizontal de la page.               |
| Résultat obtenu / preuve                | À renseigner                                                                                                                                                                                                                                           |
| Date / testeur / commit / environnement | À renseigner                                                                                                                                                                                                                                           |
| Statut / anomalie                       | À EXÉCUTER / —                                                                                                                                                                                                                                         |

L'audit axe et ce contrôle manuel sont complémentaires. Ils ne constituent pas
une certification exhaustive WCAG ; un parcours avec lecteur d'écran reste
une vérification supplémentaire possible.

## Bilan de campagne

| Champ                             | Valeur                       |
| --------------------------------- | ---------------------------- |
| Version / environnement / date    | À renseigner                 |
| Personne ayant exécuté la recette | À renseigner                 |
| Fiches exécutées                  | 0/6                          |
| PASSED / FAILED / BLOCKED         | 0 / 0 / 0                    |
| Fiches à exécuter                 | 6                            |
| Anomalies et réserves             | À renseigner après exécution |
| Décision et validation humaine    | Non prononcées               |

Pour une décision d'acceptation, exécuter toutes les fiches, qualifier les
écarts et re-tester les corrections. L'acceptation et les réserves appartiennent
à la personne ou à l'équipe qui réalise la recette, pas à la génération de ce document.
