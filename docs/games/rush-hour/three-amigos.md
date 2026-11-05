# Rush Hour — compte rendu des Three Amigos

Séances de cadrage tenues **avant** d'écrire les scénarios Gherkin (atelier BDD, module J2_AM). Chaque séance
réunit trois regards sur une règle du jeu :

| Rôle        | Apporte                                                       |
| ----------- | ------------------------------------------------------------- |
| Métier      | la règle et sa valeur pour le joueur (le « pourquoi »)        |
| Développeur | la faisabilité et les contraintes techniques (le « comment ») |
| Testeur     | les cas limites et les « et si… ? »                           |

Les décisions prises ici sont la source des scénarios de `frontend/src/games/rush-hour/features/` : si une
décision change, le scénario correspondant change dans la même PR.

## Séance 1 — Fin de niveau et déblocage des niveaux (issue #81)

**Statut :** ⚠️ **séance pas encore tenue, reportée.** Les scénarios de l'issue #81 reposent pour l'instant
sur les propositions ci-dessous, décidées par le développeur seul. C'est une limite connue : le cours la
décrit comme l'anti-pattern « BDD sans le métier ». La séance reste à faire ; ses décisions pourront
modifier les scénarios.

**Date :** _à compléter lors de la séance_
**Participants :** _métier à compléter_ · Tanguy (développeur) · _testeur à compléter_

| Question                                                        | Proposition                                                                      | Décision    | Scénario qui la vérifie                                                          |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| Un score **égal** au record est-il un nouveau record ?          | Non : seul un score strictement meilleur remplace le record                      | _à valider_ | tests unitaires `progress.test.ts` et `completeLevel.test.ts`                    |
| L'envoi au classement est **refusé** : que devient le record ?  | Il n'est pas gardé ; rejouer le niveau renvoie le score                          | _à valider_ | `fin-de-niveau.feature` — « Un record refusé par le classement n'est pas gardé » |
| **Coupure réseau** pendant l'envoi ?                            | Le record est gardé, le score part à la partie suivante (géré par la plateforme) | _à valider_ | test unitaire `completeLevel.test.ts`                                            |
| Un **invité** a-t-il un record ?                                | Oui, sur son appareil, mais il n'apparaît pas au classement                      | _à valider_ | test unitaire `completeLevel.test.ts`                                            |
| **Barème** du score d'un niveau                                 | 1000 − 50 par coup en trop − 200 par indice, entre 0 et 1000                     | _à valider_ | `fin-de-niveau.feature` — plan du scénario                                       |
| Moins de coups que le **minimum** ?                             | Impossible sans triche : la partie est refusée                                   | _à valider_ | `fin-de-niveau.feature` — exemple « 9 coups »                                    |
| Le niveau suivant s'ouvre-t-il avec **0 point** ?               | Oui : terminer suffit, le score n'importe pas                                    | _à valider_ | `deblocage-des-niveaux.feature`                                                  |
| Le niveau 3 est-il ouvert si **seul le niveau 1** est terminé ? | Non : il faut terminer le niveau 2                                               | _à valider_ | `deblocage-des-niveaux.feature`                                                  |

### Cas limites relevés par le testeur

_À compléter pendant la séance : tout cas oublié ci-dessus devient un nouvel exemple ou un nouveau scénario._

### Suites

_À compléter : décisions qui modifient `regles.md` ou un scénario existant._
