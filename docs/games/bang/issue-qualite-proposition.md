# Proposition de sous-issue de #24 — à valider par Antoine

## BANG! — Tester la reprise réseau et mesurer la solidité des tests du moteur et du plateau

Responsable : Antoine. Périmètre : ses issues #54 à #60 et ses contributions à la démo et aux commandes du joueur de #61. Les contrats de cartes, personnages, rôles et règles de Colleen sont réutilisés sans en modifier le comportement.

## Critères d'acceptation

- [ ] Partir du dernier état de `game/bang/implementation`, intégrer `origin/dev` sur une branche de travail et refaire un fetch avant remise. Vérifier les deux ancêtres distants lorsqu'ils existent ; signaler toute branche supprimée sans recréer ni pousser une branche distante.
- [ ] Utiliser le Toxiproxy Testcontainers déjà disponible côté backend devant un vrai serveur Spring, avec le moteur en mémoire, quatre sessions distinctes et la protection CSRF réelle.
- [ ] Démarrer une partie à quatre ; le Shérif possède sept cartes et cinq PV après sa pioche. Envoyer « Finir le tour », laisser Spring traiter la requête et bloquer seulement le retour au joueur.
- [ ] Depuis une autre connexion, observer `DISCARD` avant de rétablir le réseau. Ordonner les événements par des signaux observables, sans délai arbitraire.
- [ ] Retrouver avec la session initiale le même siège et les sept mêmes cartes ; une répétition de la fin de tour avant défausse renvoie 409 sans mutation de l'état. Après deux défausses, une nouvelle fin de tour passe au siège 2.
- [ ] Fournir une exécution Docker non ignorée et ses rapports.
- [ ] Étendre le profil Maven PIT et Stryker/Vitest en conservant les cibles des autres équipes et le seuil de 75 %. Mesurer BANG! séparément avant et après les nouveaux tests.
- [ ] Cibler en Java `PrivateTableService`, `InitialDeal`, `CardDraw`, `PlayerDistance` et `ShotRules` ; en TypeScript `OnlineTable.tsx` et `local.ts`. Garder Docker et Playwright hors des campagnes de mutation.
- [ ] Associer chaque issue aux comportements et aux tests. Examiner d'abord les fuites de main, tirs hors de portée, clics valides perdus et doubles fins de tour.
- [ ] Pour chaque lacune retenue, ajouter le plus petit test du comportement public et conserver la preuve rouge avec le mutant puis verte sur le code normal. Pour un défaut réel, reproduire le rouge sur le code courant avant le correctif minimal.
- [ ] Rejouer le test Docker, les campagnes ciblées PIT et Stryker, `mvn clean verify` et les neuf parcours `npm run test:e2e:bang` avec Chromium et Spring.
- [ ] Livrer les commandes, le SHA testé, les scores avant/après de chaque outil, les mutants survivants, non couverts et en timeout et les chemins des rapports. Décrire une erreur auparavant invisible si une campagne en révèle une.
- [ ] Faire de petits commits locaux à chaque étape verte significative. Soumettre à Antoine avant tout push ou merge de livraison.

## État de la préparation

Le 5 novembre 2026, aucune sous-issue qualité correspondante ne figure parmi les sous-issues de #24. Ce document est un brouillon local : aucune issue GitHub n'a été créée.

La PR #88 a été fusionnée dans `dev` le 5 novembre et la branche distante `game/bang/implementation` a été supprimée. Le dernier head de la PR, confirmé par GitHub, est `04fc3fa0e1ad729f504f6b797656f576e17cfeab`. Il sert de point de départ à la branche locale `af/bang-tests-reseau-mutation`, qui intègre ensuite `origin/dev`. La référence distante supprimée ne peut pas faire l'objet d'un contrôle d'ascendance ; le SHA de son dernier head peut être vérifié.
