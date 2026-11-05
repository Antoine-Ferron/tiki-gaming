# Rush Hour : contrat d'API avec Pact

> **Statut : fait.** Ce document garde la trace du contrat Pact ajouté entre le jeu (front) et l'endpoint de vérification des parties (backend) : pourquoi, comment, et la preuve qu'il protège quelque chose (cours J3_AM, tests de contrat).
> Suite de #102 (PR #114) · Branche : `game/rush-hour/tests-qualite-soutenance`

---

## 1. Le problème

À la fin d'un niveau, le jeu envoie la liste des coups à `POST /api/games/rush-hour/levels/{level}/results`. Le serveur les rejoue et renvoie le score qu'il a calculé lui-même (anti-triche, règle S6). Deux équipes, ou deux moments du projet, peuvent faire évoluer chaque côté. **Si le backend renomme un champ de la réponse, les tests du backend passent et ceux du front aussi**, puisque le front teste avec un Stub. Le jeu, lui, casse en production.

Un test E2E complet le verrait, mais il est lent et fragile. Le cours propose une solution intermédiaire : le **contrat piloté par le consommateur** (Pact).

## 2. Le principe

1. **Le consommateur (front) écrit ce qu'il attend** : la requête qu'il envoie vraiment, et la réponse **minimale** dont il a besoin. Le test tourne contre un faux backend fourni par Pact, et produit un fichier de contrat JSON (`frontend/pacts/tiki-frontend-tiki-backend.json`).
2. **Le fournisseur (backend) rejoue ce contrat** contre l'application Spring complète, avec sécurité, CSRF, validation et sérialisation (`PactProviderTest`). Si sa réponse ne correspond plus, le test échoue.

Les **matchers** (`integer(1000)`, `like('…')`) fixent la **forme** et non la valeur exacte : le backend reste libre de son calcul, mais pas du nom ni du type des champs.

La plateforme avait déjà ce dispositif pour la session, la suppression de compte et l'envoi des scores. Rush Hour n'y figurait pas.

## 3. Ce qui a été ajouté

Deux interactions dans `frontend/tests/contract/backend.pact.test.ts`. Elles sont jouées avec le **vrai adaptateur du jeu** (`serverVerifier`), pas un appel HTTP écrit à la main : le contrat décrit donc ce que le jeu envoie réellement.

| Interaction | Requête | Réponse attendue |
|---|---|---|
| Partie gagnée du niveau 1 | la solution en 3 coups (A+3, H-1, X+3), 0 indice | `200` : `{ score, moves, optimal }`, trois entiers |
| Partie truquée | un seul coup impossible (X+3, bloqué par le camion A) | `422` : `{ error }`, le message affiché au joueur |

Côté backend, **rien n'est simulé** pour ces deux interactions : l'endpoint n'a besoin d'aucun service externe. Le contrat est donc vérifié avec le **vrai calcul** du serveur. L'état « visiteur » de la plateforme suffit, puisque la vérification d'une partie ne demande pas de compte.

## 4. Pact ou contrat partagé : deux contrats différents

Rush Hour avait déjà un « contrat » : `shared/games/rush-hour/contrat.json`. Les deux ne vérifient pas la même chose.

| | Contrat partagé (`contrat.json`) | Contrat Pact |
|---|---|---|
| Ce qu'il protège | **Les règles** : mêmes niveaux, mêmes parties rejouées, même barème des deux côtés | **L'API** : même URL, même corps de requête, mêmes noms et types de champs, mêmes statuts HTTP |
| Il échoue si… | le front et le serveur ne calculent plus pareil | le serveur ne répond plus dans la forme attendue par le jeu |
| Qui l'écrit | les deux côtés lisent le même fichier | le consommateur (front) écrit, le fournisseur (backend) rejoue |

Les deux se complètent : on peut avoir les mêmes règles avec une API cassée, ou une API parfaite qui calcule faux.

## 5. Preuve qu'il protège quelque chose

On renomme le champ `optimal` en `minimum` dans la réponse du backend (`LevelResult`), puis on relance la vérification fournisseur :

```
has a matching body (FAILED)
  body: $ Actual map is missing the following keys: optimal
```

Le backend compile, ses propres tests passent, mais **le contrat le bloque** avant que le jeu ne casse. Le code a ensuite été restauré.

## 6. Résultats

| | Avant | Après |
|---|---|---|
| Interactions Pact de Rush Hour | 0 | **2** (nominal + erreur) |
| Interactions Pact du projet | 6 | **8** |
| Vérification fournisseur | — | **verte**, avec le vrai calcul du serveur |
| RTM | — | TC-API-04 et TC-API-05 rattachés à REQ-API-01 (92 cas, traçabilité complète) |

En CI, le job *Frontend* vérifie que le contrat régénéré est bien celui commité, et le job *Backend* le rejoue (`PactProviderTest`). Une rupture d'API, d'un côté ou de l'autre, bloque donc la PR.
