# Dames — preuves de qualité et reproduction

Ce bilan distingue les résultats rejoués le **6 novembre 2026**, les mesures
historiques des lots livrés et les contrôles collectifs de plateforme.
Les fichiers de production et de tests n'ont pas été modifiés pour ce bilan.

## Mesures locales du 6 novembre 2026

Base de code : [`659d4fb937c3004f94e37265064b1b1a0caa952b`](https://github.com/EAnathos/tiki-gaming/commit/659d4fb937c3004f94e37265064b1b1a0caa952b).
Les changements ultérieurs de cette branche sont documentaires.

| Preuve | Sélection                                  | Résultat                                 | Durée de commande observée     |
| ------ | ------------------------------------------ | ---------------------------------------- | ------------------------------ |
| B06    | Tous les `*Test` backend Dames, hors `*IT` | **394 cas, 0 échec, 0 erreur, 0 ignoré** | 20,975 s, compilation comprise |
| F06    | `frontend/src/games/dame`                  | **18 tests, 2 fichiers, tous réussis**   | 2,87 s                         |

Les 394 cas se répartissent en : moteur **224**, rencontres **60**, adaptateur
HTTP **29**, orchestration/API HTTP **63**, Pact fournisseur **6**, Gherkin
**12**. Ce total mélange plusieurs niveaux ; il ne désigne pas 394 tests
unitaires purs. Le fournisseur Pact démarre Spring sur un vrai port, avec un
dépôt fake. Les tests HTTP MockMvc utilisent la chaîne Spring/CSRF.

Les durées sont celles de ce poste et de cette exécution ; elles ne sont
ni des SLO de l'application, ni un engagement de moins de 5 ms par test.
Les tests Mockito peuvent notamment inclure un coût d'initialisation.

Commandes exécutées :

```bash
# Depuis la racine : Java 21 et Maven
mvn -B -ntp -f backend/pom.xml \
  '-Dtest=fr/tikigaming/games/dame/**/*Test' test

# Depuis frontend/
./node_modules/.bin/vitest run src/games/dame --maxWorkers=1
```

Sorties de synthèse observées :

```text
Tests run: 394, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS

Test Files  2 passed (2)
Tests       18 passed (18)
```

Les rapports Surefire sont générés dans `backend/target/surefire-reports/`
et le rapport BDD dans `backend/target/cucumber/`. Ils ne sont pas versionnés.
Cette exécution ciblée ne remplace pas `mvn verify` et la couverture frontend
collective ; elle ne revendique pas une nouvelle mesure JaCoCo ou PIT.

## Preuves CI de la livraison complète

Référence : [PR #116](https://github.com/EAnathos/tiki-gaming/pull/116),
tête `f65034f09d4da9ac00cf36b30b6f0290f1f3ef7e`,
[run CI 42041047050](https://github.com/EAnathos/tiki-gaming/actions/runs/42041047050)
du **5 novembre 2026**, vérifié le 6 novembre.

Les **15 jobs** de cette exécution sont réussis, dont backend, frontend,
Testcontainers, les trois navigateurs, PIT, Stryker, k6, ZAP, SonarQube et
le verdict. Les jobs collectifs ne constituent pas tous une mesure dédiée à Dames.

| Contrôle Dames                   | Résultat du lot livré                             | Preuve                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intégration PostgreSQL/PostgREST | **56 cas** : 52 dépôt/SQL et 4 API                | [Job intégration](https://github.com/EAnathos/tiki-gaming/actions/runs/42041047050/job/127293243147), [rapport Failsafe](https://github.com/EAnathos/tiki-gaming/actions/runs/42041047050/artifacts/13423475018), [périmètre](persistance.md)                                            |
| BDD                              | **12 exemples exécutables**                       | [Rapport Cucumber](https://github.com/EAnathos/tiki-gaming/actions/runs/42041047050/artifacts/13421811224), [description](bdd.md)                                                                                                                                                        |
| Pact                             | **6 interactions** Dames consommateur/fournisseur | [Contrat versionné](../../frontend/pacts/tiki-dame-frontend-tiki-dame-backend.json), [description](interface-e2e.md)                                                                                                                                                                     |
| Playwright et axe                | **6 scénarios × 3 navigateurs = 18 exécutions**   | [Chromium](https://github.com/EAnathos/tiki-gaming/actions/runs/42041047050/job/127294298193), [Firefox](https://github.com/EAnathos/tiki-gaming/actions/runs/42041047050/job/127294298239), [WebKit](https://github.com/EAnathos/tiki-gaming/actions/runs/42041047050/job/127294298140) |

Les 56 IT et les 18 exécutions navigateur sont des résultats du lot documenté,
pas une campagne locale rejouée le 6 novembre pour cette documentation.
La démo avec vraie chaîne navigateur/API/base a été vérifiée séparément ;
voir [son compte rendu](interface-e2e.md).

Les artefacts GitHub ont une durée de rétention. Ceux d'intégration, BDD et
mutation cités ici étaient disponibles lors de la vérification, avec une
expiration annoncée au 3 février 2027. Les liens de jobs, sources et commandes
permettent de retrouver le périmètre même après expiration des téléchargements.
Ne pas présenter ce run historique comme le statut permanent du dernier `dev`.

## Couverture et mutation : mesures historiques par lot

Ces résultats ont été mesurés pendant les développements des 4 et 5 novembre
et consignés dans les documents liés. Ils ne proviennent pas tous d'une même
exécution ni du commit de base du présent bilan.

| Périmètre Dames | Lignes JaCoCo | Branches JaCoCo | Mutants tués / total |   Score PIT | Source détaillée                                           |
| --------------- | ------------: | --------------: | -------------------: | ----------: | ---------------------------------------------------------- |
| Moteur          |       187/187 |         128/128 |              149/156 | **95,51 %** | [Architecture](architecture.md), [survivants](mutation.md) |
| Rencontres      |         44/44 |           21/21 |                22/22 |   **100 %** | [Rencontres](rencontres.md)                                |
| Persistance     |         70/70 |           18/18 |                27/28 | **96,43 %** | [Persistance](persistance.md)                              |
| API             |       137/141 |           35/36 |                59/65 | **90,77 %** | [API](api.md)                                              |

La couverture décrit le code exécuté ; PIT vérifie si les assertions détectent
des modifications du code Java. PIT ne valide pas les contraintes SQL.
Le seuil de mutation collectif reste à 75 %, sans exclusion ajoutée pour
masquer les survivants Dames.

Exemple de renforcement : le test
`anUnfinishedResultIsRejectedEvenWhenTheEndDateIsMissing` dans
[MatchTest](../../backend/src/test/java/fr/tikigaming/games/dame/matches/MatchTest.java)
détecte la suppression du refus de clôturer avec `IN_PROGRESS` lorsque la
date est absente. L'ancienne assertion seule était protégée par une autre
validation et ne tuait pas ce mutant.

Les sept survivants du moteur restent [analysés](mutation.md), dont une
limite du contrat de message d'erreur. Les six résultats non tués de l'API
incluent **quatre survivants et deux non couverts**, pas six équivalences
prouvées. Le [rapport PIT collectif de la CI](https://github.com/EAnathos/tiki-gaming/actions/runs/42041047050/artifacts/13424450084)
constitue une autre exécution ; son score global ne remplace pas ces mesures
par package. Stryker est configuré pour d'autres périmètres frontend :
aucun score Stryker propre à Dames n'est annoncé.

## Reproduire les autres niveaux

Depuis la racine, avec Docker démarré pour les IT :

```bash
# Vrais services et migrations : tous les IT Dames
mvn -B -ntp -f backend/pom.xml -Pintegration \
  '-Dit.test=fr/tikigaming/games/dame/**/*IT' \
  test-compile failsafe:integration-test failsafe:verify

# Scénarios métier seuls, sans Docker
mvn -B -ntp -f backend/pom.xml -Dtest=DameBddTest test

# PIT ciblé sur les rencontres, mêmes mutateurs et seuil que le profil
mvn -B -ntp -f backend/pom.xml -Pmutation \
  test-compile org.pitest:pitest-maven:mutationCoverage \
  '-DtargetClasses=fr.tikigaming.games.dame.matches.*' \
  '-DtargetTests=fr.tikigaming.games.dame.matches.*Test'

# Depuis frontend/ : contrat consommateur Dames
./node_modules/.bin/vitest run --config vitest.contract.config.ts \
  tests/contract/dame.pact.test.ts

# Depuis frontend/ : parcours Dames sur les trois navigateurs déjà installés
./node_modules/.bin/playwright test e2e/dame.spec.ts --workers=1
```

Pour le moteur, remplacer les deux cibles PIT par
`fr.tikigaming.games.dame.*` et `fr.tikigaming.games.dame.*Test` ; attention,
ces jokers peuvent englober les sous-packages. Extraire alors les comptes
du package souhaité depuis `mutations.xml`, sans attribuer le total au moteur.
Pour l'API ou la persistance, cibler respectivement `dame.api.*` ou
`dame.persistence.*` et leurs classes de tests.

Rapports : Failsafe sous `backend/target/failsafe-reports/`, PIT sous
`backend/target/pit-reports/`. Un `clean` les supprime.
Pour relancer les contrôles collectifs, suivre [CONTRIBUTING](../../CONTRIBUTING.md).
Le contournement local documenté pour le profil Firefox sur ce Mac est décrit
dans [interface-e2e.md](interface-e2e.md) ; il ne modifie pas les assertions CI.

## Sécurité, accessibilité et limites des preuves

| Sujet                       | Preuve disponible                                                | Limite                                                                                              |
| --------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Session propriétaire / BOLA | Tests HTTP et IT refusant une session étrangère                  | L'UUID n'est pas une autorisation ; pas de promesse multi-nœuds                                     |
| CSRF et validation          | Tests avec filtre Spring réel ; JSON mal typés ou forgés refusés | L'interface n'est pas la barrière de sécurité                                                       |
| Table privée                | Rôles SQL réels, RLS, contraintes et concurrence dans les IT     | Un fake ne valide pas ces mécanismes                                                                |
| Accessibilité               | Parcours clavier et axe sur formulaire/damier à 360 px           | Pas de certification WCAG exhaustive ni de campagne lecteur d'écran revendiquée                     |
| SonarQube / ZAP             | Jobs collectifs réussis sur le run cité                          | Aucun chiffre Sonar par fichier ni audit DAST exhaustif des routes Dames déduit du seul voyant vert |
| k6 / résilience             | Jobs collectifs ; stubs de panne et réponse perdue Dames         | Pas de P95 Dames mesuré, ni de coupure réelle Toxiproxy Dames dans ce lot                           |

## Lien avec les enseignements et prochaines preuves

| Enseignement                                    | Réalisation ou document Dames                                | État                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| J1 : TDD, frontières, architecture et doublures | Moteur, rencontres, journal RED/GREEN et tests déterministes | Livré                                                                                       |
| J2 : BDD, vraie persistance, analyse statique   | Cucumber sur domaine, Testcontainers, contrôles collectifs   | Livré, limites des métriques précisées ci-dessus                                            |
| J3 : E2E, RTM et UAT                            | Playwright, [matrice](rtm-matrix.md), [recette](recette.md)  | Automatisation livrée ; six parcours vérifiés par l’agent, validation humaine non prononcée |
| J4 : k6, pannes réseau, exploitation            | Scripts de démo et tests de panne simulée                    | Campagne k6 et Toxiproxy Dames à prévoir séparément                                         |
| J4 : sécurité et accessibilité                  | Session/CSRF, RLS et axe                                     | Preuves ciblées ; audit complet et procédure de production non revendiqués                  |
| J5 : traçabilité individuelle                   | [PR et commits du bilan](README.md)                          | Contributions distinguées de la plateforme et des corrections du reviewer                   |

Les nouveaux documents rendent les preuves consultables ; ils n'ajoutent pas
de fonctionnalités et ne simulent pas un atelier métier passé. La campagne
de recette par l’agent ci-dessous ne remplace pas une acceptation humaine. La stabilisation des règles de nulle reste
hors de cette livraison documentaire.

## Campagne navigateur réelle du 6 novembre 2026

Après le bilan initial, l’agent a exécuté les six fiches de recette sur une
instance dédiée recompilée depuis `ea9cf0c7`, avec Chromium 156 et les vrais
services PostgreSQL/PostgREST. Aucun plateau injecté et aucune réponse API simulée.
Les six parcours ont passé les contrôles ; la partie complète a nécessité
94 coups légaux et la lecture SQL confirme la victoire noire puis la revanche.

Les [preuves datées](preuves/2026-11-06/README.md) comprennent captures,
requêtes expurgées, séquence de coups et résultats SQL. Cette campagne ponctuelle
complète les E2E CI à API simulée ; elle ne transforme pas la suite CI en E2E réel
ni ne constitue une signature UAT humaine. Le [cahier](recette.md) identifie
l’agent comme exécutant et conserve les réserves.
