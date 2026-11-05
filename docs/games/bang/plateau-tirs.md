# BANG! — Plateau et actions de tir (#60)

Base vérifiée après `git fetch origin --prune` le 5 novembre 2026 : branche commune
locale et distante à `22a11fc`, `origin/dev` à `ece3ce7`, déjà ancêtre de la base.
La branche `game/bang/60-plateau-tirs` part de cette branche commune ;
`git merge --no-edit origin/dev` répond « Already up to date ».

## Critères couverts

- Les quatre tapis de Colleen sont conservés : personnages, PV actuels/maximaux,
  nombres de cartes, rôles privé/public/cachés, arme et cartes posées. Le scénario
  Gherkin existant vérifie la Planque uniquement sur le tapis de la place 3.
- `OnlineTable` transmet désormais le tir, l'esquive et l'acceptation à `GameScreen`
  puis `BangBoard`. Les trois appels passent par `apiPost`, avec le cookie CSRF du dépôt.
- `pendingShot` vient du serveur : le tireur attend, seule la cible répond, avec
  l'identifiant capturé dans la vue affichée. Les actions de tour attendent la résolution.
- Après chaque action, même refusée, la vue serveur est relue. Les dégâts et le
  bonus de Bart ne sont pas calculés par le client. Un verrou empêche les envois
  simultanés de l'écran ; le serveur reste responsable des conflits et doublons.
- Calamity Janet peut sélectionner Raté ! pour tirer et BANG ! pour esquiver,
  selon le contrat de substitution des personnages. Le serveur valide les règles.
- Les lectures retardées ne remplacent plus une vue plus récente.
- Le mode local recycle la défausse dès l'épuisement de la pioche, y compris
  entre les deux cartes. Le onzième tour conserve les 37 cartes une seule fois.

## Journal rouge / vert

| Comportement observable | Rouge réellement exécuté | Commit vert |
| --- | --- | --- |
| Choisir BANG ! et viser depuis `OnlineTable` | Le POST `/shots/BANG-1/targets/2` manque ; seuls création et état sont appelés. L'écran affiche encore « Le tir n'est pas encore disponible ». | `c144a7d` |
| Attendre le tir serveur | Message « choisis un BANG ! » reçu au lieu de l'attente ; les actions restent proposées. | `a7443d5` |
| Esquiver depuis sa main | Bouton « Esquiver avec Raté ! » absent. | `7b6c351` |
| Accepter et recevoir le résultat de Bart | Bouton « Accepter le tir » absent. | `7cbb972` |
| Double clic pendant une requête | Deux POST d'acceptation au lieu d'un. | `486d01c` |
| Substitutions de Calamity Janet | Raté ! pour tirer et BANG ! pour esquiver ne sont pas proposés comme boutons. | `a333fb8` |
| Pioche du onzième tour local | « La pioche ne contient pas assez de cartes » avec 1 carte en pioche et 20 en défausse. | `6724147` |
| Lecture périodique retardée | Un ancien `pendingShot` réapparaît après sa résolution. | `e9cd11c` |

Compléments déjà verts, sans rouge artificiel : spectateurs sans action de réponse,
409 périmé sans renvoi automatique, prochain identifiant utilisé au clic suivant,
recyclage avec 0/1/2 cartes, refus atomique si moins de deux cartes au total.
Commit `121e1b9`. La refactorisation typée du double de mélange est `fad4559`.

## Commandes et limites des preuves

Depuis `frontend/` :

```powershell
npm test -- src/games/bang/OnlineTable.test.tsx
npm test -- src/games/bang/features/partie-locale.steps.test.ts
npm test -- src/games/bang/local.test.ts
npm run format -- --log-level warn
npm test -- src/games/bang
npm run typecheck
npm run test:contract
```

176 tests BANG! réussis sur la branche #60 finale ; types et linter vérifiés. Les tests de l'écran
remplacent uniquement `fetch` et traversent les vrais composants, `api.ts` et
`apiPost`. Les Gherkin de Colleen sont rejoués, avec un scénario local ajouté.
Ils ne constituent pas une démo sur serveur réel.

Les trois nouvelles interactions Pact sont générées dans le contrat versionné.
Le fournisseur les rejoue avec Spring/HTTP/CSRF réels et un double à la frontière
`PrivateTableService`, sans remplacer les vérifications du moteur réel.

Depuis `backend/` :

```powershell
mvn -B -ntp spotless:apply '-Dtest=PactProviderTest' test
```

9 interactions Pact réussies, aucune ignorée. L'échec initial de Pact dans le bac
à sable était une interdiction de joindre ses serveurs locaux, pas un rouge métier ;
la commande a réussi avec l'accès local autorisé. La vérification des types a
aussi détecté un double générique mal typé, corrigé dans `fad4559`.

La validation globale et la démo réelle à quatre sont consignées dans le bilan #61.
Cette branche n'est ni poussée ni fusionnée vers une branche commune ; l'issue reste ouverte.

## Relecture finale : connexion lente

Un dernier test à horloge contrôlée a montré qu'une lecture de plus de deux secondes
était ignorée dès que la suivante démarrait, même sans réponse plus récente reçue.
Rouge : le message de tir en attente restait affiché après réception de sa résolution.
Le client compare désormais les lectures à la dernière réponse **appliquée** : une
lecture lente peut actualiser le plateau, et une réponse ancienne ne peut toujours
pas remplacer une réponse plus récente déjà affichée. Les deux tests sont verts.
Le correctif est également reporté sur la branche #61 (`976955a`) ; ce report
n'intègre ni ne modifie la branche commune.
