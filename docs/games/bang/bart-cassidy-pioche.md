# BANG! — Bonus de pioche de Bart Cassidy (#52 / #59)

## Préparation et périmètre

La #59 n'est pas encore intégrée dans `game/bang/implementation` (`94d09ff`).
Le correctif poursuit donc `game/bang/59-synchronisation-tirs`, depuis `20f89a4`.
Le dernier `origin/dev`, `350911e`, a été intégré sans conflit dans `75a9939` ;
les contributions Échecs et les dépendances de test apportées par `dev` sont conservées.

Le contrat `BangCharacter.cardsDrawnOnLifeLost(int lifeLost)` de Colleen est inchangé.
Le raccordement doit dépendre des PV réellement perdus et de la survie du personnage.
La [FAQ BANG!](https://rules.dized.com/game/HmdokPTaSHSr-oYVNdO_ZA/OtF1hoFlTLeqEwY0OfyUGg/new-does-bart-cassidy-or-el-gringo-draw-a-card-when-he-loses-his-last-life-point-so-if-its-a-beer-they-can-save-themselves)
précise qu'un Bart éliminé ne pioche pas. Le sauvetage par une Bière reste hors périmètre.

Le recyclage de la défausse était absent du moteur. Les
[règles françaises, p. 3](https://www.dvgiochi.com/giochi/bang/download/Bang_rules_FRA.pdf)
prévoient de mélanger la défausse lorsque la pioche est vide. Ce point de périmètre a été
présenté avant toute implémentation de remplacement. L'utilisateur a ensuite explicitement
inclus un mécanisme commun au bonus et à la pioche de tour, y compris une pioche de deux
cartes à cheval sur l'ancienne pioche et la défausse mélangée. Un total inférieur à deux
cartes continue de faire refuser la pioche de tour sans mutation.

## Comportements livrés

- `ShotRules.respond` calcule les PV réellement perdus et appelle le contrat du personnage
  seulement si la cible reste vivante. Bart reçoit une carte existante par PV perdu ;
  une esquive, une absence de perte de PV, un autre personnage ou des dégâts mortels
  ne provoquent aucune pioche bonus. La carte n'est jamais ajoutée à la défausse par le bonus.
- `CardDraw` prend d'abord les cartes restantes dans leur ordre. S'il lui manque une carte,
  il mélange une copie de la défausse, la transfère dans la pioche, vide la défausse puis poursuit.
  Le mélange est contrôlable dans les tests ; la production utilise `Collections.shuffle`.
  Aucune carte ni aucun identifiant n'est créé, et l'état d'entrée demeure inchangé.
- La pioche normale de deux cartes et le bonus utilisent le même mécanisme. Une pioche
  de tour avec moins de deux cartes au total dans les deux piles est refusée avant tout
  mélange ou transfert. Avec une carte dans chaque pile, les deux sont reçues.
- Un tir légal a déjà déposé sa carte dans la défausse avant la réponse. Même si les deux
  piles étaient vides avant le tir, Bart peut donc subir les dégâts et recevoir cette carte
  grâce au recyclage : aucun refus ne le rend invulnérable à cause d'une pioche vide.
- Dégâts, bonus, piles et résolution sont appliqués sous le verrou existant. Les doublons
  et anciennes réponses ne rejouent ni dégâts ni bonus ; une seule réponse concurrente gagne.
  Le siège actif, la phase, le compteur de tirs et la pioche normale de Bart sont préservés.
- La nouvelle session de Bart retrouve sa carte dans sa main privée. Les autres comptes
  voient ses PV et son nombre de cartes, sans recevoir l'identifiant ou le type de sa carte.

Le bonus ne nécessite aucune nouvelle route ni aucun nouveau champ JSON. Les réponses HTTP,
l'authentification, le CSRF et les règles d'expiration de la #59 sont conservés ; une réponse
acceptée renouvelle l'activité une seule fois, et un refus ou une lecture ne la renouvelle pas.

Les cartes Bière, les autres effets de cartes, la victoire, l'interface de plateau et la survie
au redémarrage restent hors périmètre. Le cas de la pioche vide est traité par le recyclage,
sans règle de remplacement supplémentaire ni historique de commandes.

## Preuves TDD outside-in

La distribution est un double contrôlable, mais les cartes, états, contrôleur, sécurité,
service de table et règles de tir sont réels dans le test HTTP.

| Comportement | Résultat observé avant toute modification du moteur |
| --- | --- |
| Tir sur Bart, acceptation, vue privée avec une pioche connue | Rouge HTTP : Bart est bien à 3 PV, mais `$.hand[1].id` est absent au lieu de contenir la première carte de la pioche. |
| Perte non mortelle de 1 PV, depuis 4 ou 2 PV | Deux rouges métier : la carte attendue manque dans la main ; les dégâts sont déjà corrects. |
| Aucun PV perdu ou dernier PV perdu | Déjà vert : aucune carte prélevée, santé maintenue à zéro si éliminé. |
| Autres personnages et esquive de Bart | Déjà vert : aucun bonus. |

Sur les huit cas domaine ciblés, **deux échouent pour le bonus absent et six passent**.
Ces six comportements déjà corrects ne donnent pas lieu à un rouge artificiel.

Une seconde exécution ciblée confirme **huit tests verts**, sans échec ni test ignoré :
six cas domaine et les deux parcours HTTP esquive/dernier PV.
Ce contrôle précède la modification du code BANG! de production.

Après l'accord sur le recyclage, le premier raccordement de `cardsDrawnOnLifeLost`
fait passer **125 tests ciblés** au vert. Les PV réellement perdus et la survie déterminent
le bonus ; le transfert de carte est confié à `CardDraw`, sans règle spéciale de Bart
dans le service ou le contrôleur. Le cas de la pioche vide est le palier TDD suivant.

Le recyclage est ensuite piloté par un rouge HTTP (`204` attendu, `409` reçu pour Bart
avec une pioche vide), puis deux rouges domaine : refus de piocher depuis la défausse
et de franchir la limite entre les deux piles. Un double de mélange inverse la liste
pour vérifier l'ordre exact des cartes reçues et restantes ; les listes d'entrée restent intactes.
Après ajout du recyclage dans `CardDraw`, **132 tests ciblés passent**. Le scénario où seule
la carte du BANG! est disponible confirme les dégâts et le bonus, sans création de carte.

Le raccordement de la pioche de tour est conduit par deux rouges HTTP (`204` attendu,
`409` reçu avec zéro ou une carte en pioche et une défausse suffisante). Le service utilise
ensuite la même instance de `CardDraw` pour ses deux usages. **152 tests ciblés passent**,
dont les trois cas de total insuffisant `(0,0)`, `(0,1)` et `(1,0)`, sans prélèvement partiel.

Les garanties complémentaires passent sans nouvelle modification du moteur : **163 tests ciblés**,
dont les réponses concurrentes accepter/accepter et accepter/esquiver, avec ou sans recyclage,
les identifiants anciens de Willy, les doublons après résolution, les nouvelles sessions et les
quatre vues privées. Chaque variante vérifie la partition des cartes entre mains et piles.
Le bonus ne consomme pas la pioche normale de Bart et ne réinitialise pas le compteur de tirs.
Un parcours avec le vrai catalogue et la vraie distribution conserve exactement les 37 cartes.
Ces comportements déjà assurés par le verrou et le tir identifié ne donnent pas lieu à un rouge artificiel.

Swagger donne ensuite un rouge de documentation : le contrat attend le bonus conditionné
à la survie, mais la description l'annonce encore absent. Après mise à jour de Swagger et des
documents BANG!, **356 tests ciblés BANG!/Swagger passent**, sans échec ni test ignoré.

## Vérification finale

Le 4 novembre 2026, depuis `backend/`, avec Java 25.0.3 et la cible de compilation Java 21 du dépôt :

| Contrôle | Résultat |
| --- | --- |
| `mvn -B -ntp '-Dtest=fr.tikigaming.games.bang.**,OpenApiDocsTest' test` | **356 réussis**, zéro échec, erreur ou test ignoré. |
| `mvn spotless:apply` | Succès. |
| `mvn clean verify` | **6 565 cas : 6 564 réussis, zéro échec/erreur, un ignoré**. |
| Pact fournisseur, inclus dans `verify` | **6 interactions réussies**, aucune ignorée. |
| Chaos Toxiproxy/Docker, inclus dans `verify` | **4 tests réussis**, aucun ignoré lors de la vérification finale. |
| Checkstyle, Spotless et JaCoCo | Succès sans baisse des seuils ; **99,03 % des lignes** et **94,80 % des branches** couvertes globalement. |
| `mvn -B -ntp -Pmutation test-compile org.pitest:pitest-maven:mutationCoverage` | Succès : **243/250 mutants tués (97 %)**, aucun sans couverture. |

Le seul cas ignoré est le scénario BDD Échecs « Une pièce clouée devant son roi ne peut pas
quitter la ligne », explicitement marqué `@en-cours` et exclu dans le `dev` intégré.
Il n'est pas modifié par ce correctif. Les quatre cas Docker avaient été ignorés lors d'une
première exécution sans moteur disponible ; après redémarrage de Docker, toute la vérification
a été relancée et ces quatre tests ont été exécutés avec succès.

Pitest conserve les cibles existantes (authentification, dames et résilience), qui n'incluent
pas BANG!. Les tests frontend, E2E navigateur, k6/ZAP, CodeQL/Sonar, les jobs GitHub et le
build de l'image de production ne sont pas exécutés pour cette livraison locale.
Les tests HTTP ci-dessus ne sont pas présentés comme des E2E navigateur.

La dernière récupération des références confirme `origin/dev` à `350911e` et la branche
commune à `94d09ff`. Les deux commandes demandées réussissent :

```text
git merge-base --is-ancestor origin/dev HEAD
git merge-base --is-ancestor origin/game/bang/implementation HEAD
```

`BangCharacter` et `ShotOutcome` sont inchangés. Les fichiers Échecs, leurs scénarios BDD
et les dépendances apportées par `dev` sont identiques à cette référence distante.
Aucun push, aucune intégration vers la branche commune et aucune fermeture d'issue ne sont effectués.

## Commits locaux

| Commit | Étape |
| --- | --- |
| `75a9939` | Dernier `dev` intégré sur la branche de la #59. |
| `15b524c` | Bonus non mortel de Bart, contrats et premier vert HTTP/moteur. |
| `009b604` | Recyclage, mélange contrôlé et pioche à cheval sur les deux piles. |
| `dd9bc8d` | Raccordement commun à la pioche de début de tour, refus atomiques. |
| `d50e7c9` | Doublons, réponses anciennes/concurrentes, vues privées et jeu physique. |
| `9a817e1` | Swagger et documentation du pouvoir et du recyclage. |

Le commit documentaire final ajoute ce bilan de validation, sans nouveau changement du moteur.
