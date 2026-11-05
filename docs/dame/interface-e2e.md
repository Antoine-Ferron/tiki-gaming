# Interface et parcours navigateur — issue #18

L'interface a été préparée sur `game/dame/interface-e2e`, après les cinq commits
de `game/dame/api`. Ces dix commits sont maintenant regroupés avec la
persistance dans **la PR #116**, sur `game/dame/rencontres`, afin de relire et
valider un parcours complet dans une seule PR. Le dernier `dev` est repris et
les commits intermédiaires conservent leur auteur.

## Contrat et RED

L'interface demande deux noms avant le démarrage. Elle lit les coups légaux et
le résultat calculés par Java, puis envoie seulement la version et le parcours.
Un rechargement conserve uniquement l'UUID dans `sessionStorage`, jamais le
plateau ni un gagnant. Le backend vérifie toujours la session propriétaire.

Avant implémentation, `npx vitest run src/games/dame` constate **18 cas RED** :
8 vérifient le transport HTTP et les erreurs, 10 les comportements visibles.
Les adaptateurs HTTP et le composant sont encore des squelettes compilables.
Les réponses réduites des tests ne prétendent pas calculer les règles du moteur.

Les ajouts partagés annoncés sont l'inscription au registre et la migration
du catalogue. Les clients et configurations communs sont réutilisés sans
modification. Les tests de contrat Dames restent dans leurs propres fichiers.

## Interface GREEN

Les mêmes **18 cas passent**. Le damier reprend la présentation préparée sur
`game/dame/implementation`, adaptée à l'API à session : aucune route ne reçoit
de plateau, de propriétaire ou de résultat choisi par le client.

- Noms de 1 à 50 caractères après nettoyage, validation Zod et messages liés aux champs.
- Sélection d'un parcours parmi les coups du serveur ; une rafle complète produit un seul POST.
- Pas de mise à jour optimiste du résultat. Après une erreur de coup, le plateau
  reste visible mais bloqué jusqu'à une relecture GET explicite, sans répétition du POST.
- Un UUID est conservé dans l'onglet. Si la session ne le possède plus, le serveur
  renvoie 404 et le formulaire revient ; aucune nouvelle rencontre n'est créée automatiquement.
- Flèches, Home/End, Entrée et Espace ; une seule case dans l'ordre de tabulation.
  Les dames portent la lettre D et les coups proposés ont des libellés accessibles.

Validation : **1 324 tests frontend verts**, formatage, lint et build réussis.
Couverture globale : **93,76 % des lignes**, **87,41 % des branches** ; seuils
conservés. Les **62 tests PostgreSQL collectifs** passent avec la nouvelle
migration de catalogue, sans modification de leur code.

## Contrat Pact

Le nouveau contrat `frontend/pacts/tiki-dame-frontend-tiki-dame-backend.json`
est généré par `tests/contract/dame.pact.test.ts`, avec le vrai client HTTP du
front. Ses six interactions couvrent création, relecture, coup valide, coup
interdit (400), rencontre absente de la session (404) et version périmée (409).

`DamePactProviderTest` les rejoue sur Spring démarré avec un vrai port HTTP,
ses vrais cookies et son vrai filtre CSRF. Seul le dépôt est un fake. L'état
Pact crée les rencontres par HTTP et fournit l'UUID à un générateur de chemin :
aucun UUID de production n'est fixé et aucun plateau n'est injecté par une route.

Les **15 interactions consommateur** et les **15 vérifications fournisseur**
passent : 6 Dames et 9 collectives. Ni le contrat collectif ni son test
fournisseur ne sont modifiés. Les configurations et la CI existantes découvrent
les nouveaux fichiers.

```bash
cd frontend
npm run test:contract
cd ../backend
mvn -Dtest=DamePactProviderTest,PactProviderTest test
```

## Parcours navigateur

`frontend/e2e/dame.spec.ts` s'exécute dans la configuration collective, sans
changement de fixture partagée ni de workflow. Les six scénarios passent sous
Chromium, Firefox et WebKit : **18 exécutions Dames vertes**.

| Besoin | Preuve dans `dame.spec.ts` |
|---|---|
| Lobby → noms → partie → rechargement | `lobby, noms, coup au clavier puis reprise sans nouvelle création` |
| Saisies absentes ou trop longues, aucun POST | `les noms invalides sont expliqués sans création` |
| Réponse réseau perdue, état relu sans répéter le coup | `une réponse perdue se récupère par GET sans rejouer le coup` |
| Rafle complète, résultat serveur et revanche | `une rafle complète mène au résultat du serveur puis au formulaire de revanche` |
| Session expirée, retour au formulaire | `une session expirée revient au formulaire sans création automatique` |
| Formulaire et damier à 360 px, audit axe | `formulaire et damier accessibles sur mobile, sans débordement horizontal` |

La suite navigateur collective complète passe : **72/72 exécutions**. Les
sélecteurs utilisent rôles et noms accessibles ; aucun délai arbitraire ni
injection de plateau dans le vrai backend. Axe ne trouve aucune violation
sérieuse ou critique WCAG 2.1 A/AA sur le formulaire et le damier. Une capture
mobile est produite dans `frontend/test-results/` et a été relue visuellement.

Conformément à `CONTRIBUTING`, ces parcours utilisent un vrai navigateur mais
des réponses HTTP scriptées. Ils prouvent l'intégration de l'interface ; Pact
et les 56 IT backend complètent la preuve côté serveur et base réelle.
Les cas de règles de jeu restent dans les tests Java et Gherkin.

```bash
cd frontend
npx playwright install
npx playwright test e2e/dame.spec.ts
npm run test:e2e
```

Sur ce Mac, Firefox 157 échoue au lancement de son profil standard. Les tests
passent avec un `CFFIXED_USER_HOME` temporaire, nettoyé après exécution ; ni
`HOME` ni la configuration Playwright ne sont modifiés. Ce problème et
l'isolation du répertoire d'application sont décrits dans
[l'issue Playwright #42768](https://github.com/microsoft/playwright/issues/42768).
La CI Linux conserve sa commande habituelle.

Validation backend finale : `mvn -Pintegration verify` passe avec **6 490 cas,
aucun échec ni erreur, un scénario Échecs ignoré préexistant**, puis **56 IT**.

## Voir la vraie interface avec une base jetable

Docker doit être démarré ; Java 21, Maven et les dépendances frontend du projet
doivent être disponibles. Depuis la racine, dans deux terminaux :

```bash
# Terminal 1 : PostgreSQL/PostgREST jetables et vrai backend sur 8080
./tools/dame/demo-backend.sh
```

```bash
# Terminal 2 : Vite sur 5173, paramètres Supabase de démonstration
./tools/dame/demo-frontend.sh
```

Ouvrir **http://localhost:5173/games/dame**, saisir les noms et jouer.
Ce mode est prévu pour une partie locale en invité. La commande backend
réutilise les conteneurs des IT, applique toutes les migrations sur leur base
vide et branche le vrai dépôt PostgREST. Les paramètres Supabase/OAuth de
démonstration sont prioritaires, sans modification de `.env` ou des fichiers
communs. La migration distante reste à appliquer par l'équipe plateforme.

`Ctrl+C` dans chaque terminal arrête la démo. L'arrêt du backend ferme ses
conteneurs et détruit les données jetables ; une session d'une démo précédente
peut demander de commencer une nouvelle rencontre. Le plateau n'est pas une
sauvegarde durable et disparaît avec le backend.

Vérification effectuée avec un vrai Chromium et **aucune interception réseau** :
création HTTP 201, noms nettoyés, 20 pions par camp, coup B4→A5 et rechargement
sur la même rencontre. Une lecture SQL directe du conteneur confirme les deux
noms, une seule ligne `IN_PROGRESS` et l'absence de résultat prématuré.
Les services ont ensuite été arrêtés et les conteneurs supprimés. Ce contrôle
de démo complète les tests automatisés ; il ne remplace pas la suite CI.

## Regroupement dans la PR #116

La branche est remise à jour sur `dev` (`0eedc6e`) avant d'y reporter les dix
commits API/interface/E2E. Les 25 commits de développement sont conservés avec
leurs auteurs et leurs étapes RED/GREEN. Le code et les tests Dames sont
identiques à ceux des branches préparées ; les conflits portent sur le registre,
le total Swagger et l'assemblage CI.

Bang est conservé au catalogue. Swagger vérifie les 43 chemins de `dev` et les
3 chemins Dames, soit 46. La CI reprend le cache Node et l'étape SDV de `dev` ;
le nouvel appel Failsafe cible `fr/tikigaming/games/dame/**/*IT`, pour ne pas
rejouer les IT SDV déjà lancés par leur propre étape.

Premières validations sur cette base : **6 870 cas backend sans échec/erreur**
(un scénario Échecs ignoré préexistant), **59 IT réels** dont 56 Dames et 3 SDV,
**22 contrats Pact**, **69 tests PostgreSQL collectifs**, formatage/lint/build
réussis. Les **19 migrations** ont des versions uniques et la RTM collective
est valide (32 exigences, 124 cas tracés).

Le premier lancement frontend parallèle a rencontré des dépassements de délai
sous charge et a été interrompu. La suite de couverture est relancée avec
`npm run test:coverage -- --maxWorkers=1`, en conservant délais, assertions et
seuils de couverture. Résultat : **1 555 tests verts**, **93,79 % des lignes** et
**87,67 % des branches**. La commande CI filtrée exécute également **56 IT
Dames verts**, sans sélectionner SDV.

Le lancement navigateur collectif sur cette base termine les **44 parcours
Chromium sans échec**. Sous la charge locale, des audits Firefox dépassent le
délai global de 30 secondes ; cette exécution est interrompue et les parcours
sont repris isolément avant publication, avec les mêmes assertions et délais.

La mise à jour distante suivante (`4d3b811`, Morpion et accessibilité/E2E SDV)
est ensuite intégrée sans conflit. Les fichiers métier et les tests Dames
restent identiques. Validation des changements entrants et de la compatibilité :
**89 tests backend ciblés**, **47 tests frontend ciblés**, formatage/lint/build
verts, puis **33 parcours Dames/SDV verts** sur les trois navigateurs avec un
seul worker. Les 18 exécutions Dames sont toutes incluses dans ce dernier lot.
Les cinq audits Firefox collectifs précédemment en dépassement passent aussi
lors de leur relance isolée : **5/5 en 11,1 secondes**, sans changement des
assertions, des délais ou des configurations partagées.
