# API des rencontres — issue #18

> **Document historique des étapes de développement.** Les mesures et les
> mentions « à réaliser » ci-dessous se rapportent à leurs lots respectifs.
> Pour le périmètre livré et les limites actuelles, voir le [bilan Dames](README.md).

## Périmètre et branche

L'API a été préparée sur `game/dame/api`, puis l'interface et les E2E sur
`game/dame/interface-e2e`. À la demande de l'utilisateur, leurs dix commits
sont désormais regroupés avec la persistance dans **la même PR #116**, sur
`game/dame/rencontres`, remise à jour sur `dev` (`4d3b811`). Les étapes
RED/GREEN et les auteurs sont conservés. Voir
[l'interface, les parcours et la démo locale](interface-e2e.md).

## Contrat HTTP

| Méthode | Route | Corps / réponse |
|---|---|---|
| POST | `/api/games/dame/matches` | `whiteName`, `blackName` → 201, état initial et Location |
| GET | `/api/games/dame/matches/{id}` | 200, état serveur de la rencontre de cette session |
| POST | `/api/games/dame/matches/{id}/moves` | `version`, `from: {row,column}`, `landings: [...]` → 200, nouvel état |

L'état renvoie l'UUID, les noms, une version (0 à la création), le plateau 10×10,
le camp au trait, le statut, les coups légaux, le gagnant et les dates. Le client
n'envoie jamais un plateau, un gagnant ou l'identifiant d'un propriétaire.

Les deux noms sont des noms d'affichage : aucun compte n'est requis pour cette
partie locale. Les POST héritent du CSRF de la plateforme ; le navigateur récupère
son jeton via le GET `/api/auth/session` déjà existant. Une autre session obtient
404, avant tout accès au dépôt, même si elle connaît l'UUID. Les JSON mal typés,
champs inconnus, coordonnées hors 0–9 et parcours de plus de 20 arrivées sont refusés.

## Cohérence et erreurs

- Une partie courante par session. Une nouvelle création remplace cette partie,
  sans effacer son ancienne rencontre en base ; une partie abandonnée reste en cours.
- La session conserve seulement un texte JSON produit côté serveur, sérialisable
  avec la session, jamais l'objet `Game` mutable ni un état fourni par le client.
- Les commandes de la même session sont sérialisées et exigent la version lue :
  une version périmée, une partie terminée ou une seconde commande concurrente
  reçoit 409. Un coup interdit reçoit 400 et ne modifie rien.
- Le coup est appliqué sur une copie. À la victoire, l'enregistrement précède le
  commit de session ; une panne du stockage renvoie 502 et conserve l'état initial.
- Si l'écriture a réussi mais sa réponse a été perdue, le même coup peut confirmer
  le résultat déjà enregistré avant de mettre à jour la session, sans seconde clôture.
- Pas de reprise après expiration de session ni de distribution multi-nœuds promise :
  le plateau n'est pas stocké en base. Les règles de nulle restent hors périmètre.

## Isolation et traçabilité

Sources et tests dans les packages Dames. Pas de nouvelle dépendance, migration,
modification du SDK, de Jackson global, de SecurityConfig ou de la CI. La seule
adaptation mécanique partagée de l'API est le test Swagger : le dernier `dev`
expose 43 routes ; les trois chemins Dames portent ce total à 46 et ajoutent le tag `dame`.
Cette exception est annoncée avant modification et sera signalée à la plateforme.

Sous-étapes avec commits distincts : contrats compilables, tests RED, logique
GREEN avec les tests Spring/CSRF, puis intégration réelle et validations. Les commandes métier sont encore
squelettiques dans le premier commit ; aucune fonctionnalité terminée n'y est revendiquée.

## RED observé

Après le commit des contrats, la suite dédiée exécute **58 cas** :
25 d'orchestration sans Spring et 33 HTTP avec la vraie chaîne Spring/CSRF.
Résultat : **48 échecs d'assertion attendus, 0 erreur, 0 ignoré** ; les dix cas
déjà verts sont les validations de création et la documentation des routes.
La commande est `mvn -f backend/pom.xml
-Dtest=DameApplicationServiceTest,DameApiHttpTest test`.

Les tests couvrent la propriété de la session avant accès au dépôt, l'état
sérialisable, la concurrence de deux onglets, les versions périmées, les deux
gagnants, les pannes avant écriture et les réponses perdues après écriture.
Les positions de fin de partie sont uniquement des fixtures de test ; aucune
route d'injection de plateau n'est créée.

## GREEN

Les mêmes **58 cas passent** sans changement de leurs assertions : création et
lecture privées à la session, vrais coups du moteur, contrôle de version, un seul
coup appliqué entre deux onglets, deux gagnants et reprise après panne.
L'état serveur est un texte JSON ; le résultat est enregistré avant la session.

Le seul test partagé adapté est `OpenApiDocsTest` : total initial de chemins 35 → 38,
actualisé à 43 → 46 lors du regroupement sur le dernier `dev`, et
ajout du tag `dame` à la liste admise. Les assertions des autres jeux restent
inchangées. Le test Swagger propre à Dames vérifie ses trois résumés et ses erreurs.

## Intégration API et persistance réelle

`DameApiPersistenceIT` réutilise les conteneurs éphémères Dames et toutes les
migrations du dépôt. Ses quatre tests appellent les routes avec MockMvc et la
vraie chaîne Spring/CSRF, le cas d'usage et l'adaptateur PostgREST réel :

- création des noms, victoire calculée par le moteur et résultat vérifié en SQL ;
  un nouveau coup après la victoire reçoit 409 et conserve le résultat ;
- coup interdit refusé, coup valide accepté, puis version périmée refusée ;
  la rencontre en base reste en cours et conserve ses métadonnées ;
- nom vide ou CSRF absent : aucun enregistrement et aucun plateau en session ;
- accès d'une autre session : lecture et coup reçoivent 404, sans modification
  de la rencontre réelle.

La fixture de fin de partie est injectée uniquement dans la session du test.
Ces tests utilisent la couche HTTP simulée de Spring : ce ne sont pas des E2E
navigateur. Aucune doublure de dépôt ni base H2 n'est utilisée.

Commande : `mvn -f backend/pom.xml -Pintegration -Dit.test=DameApiPersistenceIT
test-compile failsafe:integration-test failsafe:verify`.
Le profil et la CI existants découvrent automatiquement ce nouveau fichier `*IT`.
Résultat ciblé observé : **4 tests verts, aucun échec, erreur ou ignoré**.

## Renforcement après mutation

Le premier passage PIT ciblé sur tout le package API détecte **55/65 mutants
(84,62 %)**. Cinq cas unitaires supplémentaires vérifient ensuite les sessions
absentes ou non textuelles, les versions négatives, les statuts incohérents,
les cases dupliquées et une rencontre supprimée avant le coup gagnant.
La session et le dépôt ne sont pas modifiés après ces refus.

Les **63 cas API** passent : 30 tests d'orchestration sans Spring et 33 tests
HTTP avec le vrai filtre CSRF. Les doublures restent au niveau du port
`MatchRepository` : fake en mémoire avec pannes contrôlées pour les unitaires
et les tests HTTP ; adaptateur réel pour les quatre IT.

Commande de mutation, depuis `backend/` :

```bash
mvn -B -ntp -Pmutation test-compile org.pitest:pitest-maven:mutationCoverage \
  '-DtargetClasses=fr.tikigaming.games.dame.api.*' \
  '-DtargetTests=fr.tikigaming.games.dame.api.*Test' -Dthreads=2
```

Le ciblage concerne l'API ajoutée dans cette branche. Le profil, ses mutateurs
`STRONGER` et son seuil de 75 % restent inchangés. Le rapport HTML est
`backend/target/pit-reports/index.html` ; le détail vérifiable des mutants est
`backend/target/pit-reports/mutations.xml`.

Après renforcement : **59/65 mutants tués (90,77 %)**, aucun timeout.
Les quatre mutants portant sur la session absente, la version négative, le
statut incohérent et la case dupliquée sont désormais tués.

Les six mutants restants sont conservés dans le score, sans exclusion :

| Emplacement | Résultat | Analyse |
|---|---|---|
| `DameApplicationService.metadata` | survivant | La branche `finishedAt` non nul est inaccessible pour une commande sur une partie en cours ; une partie terminée est refusée avant cet appel. |
| `DameGameView.of` | survivant | Pour un état terminal issu du moteur, le camp au trait n'a déjà aucun coup légal ; retirer le choix explicite de liste vide donne la même réponse. |
| `DameRequests.unexpectedField` | survivant | Remplacer l'exception par `null` produit une exception lors du `throw` ; le JSON reste refusé avec 400, comme vérifié par les tests HTTP. |
| `DameJsonTypes`, deux retours | non couverts | Ces retours suivent le rejet Jackson d'un type inattendu. Les tests vérifient les erreurs HTTP ; les instructions de retour ne sont pas atteintes. |
| `DameApiConfiguration.dameApplicationService` | survivant | Point restant à renforcer dans la sélection PIT : le mutant n'est pas neutralisé, même si les suites Spring et les IT valident le démarrage et l'usage du bean réel. |

## Validation complète du backend

`mvn -B -ntp -Pintegration verify` : **6 479 cas**, aucun échec ou erreur,
un scénario Échecs ignoré préexistant ; puis **56 IT verts** (52 de persistance,
4 d'API). Spotless, Checkstyle et les seuils JaCoCo passent.
Après les cinq nouveaux cas, la suite API ciblée passe à **63 cas verts**.
Le rapport JaCoCo actualisé mesure **137/141 lignes (97,16 %)** et **35/36
branches (97,22 %)** sur le package API. Il ne s'agit pas d'une couverture
globale du projet ni d'un résultat E2E navigateur.
