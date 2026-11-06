# Persistance des rencontres — issue #18

> **Document historique des étapes de développement.** Les mesures et les
> mentions « à réaliser » ci-dessous se rapportent à leurs lots respectifs.
> Pour le périmètre livré et les limites actuelles, voir le [bilan Dames](README.md).

## Décisions

- Réutiliser le trajet du projet : Java → PostgREST → PostgreSQL Supabase.
- Les deux noms sont ceux des participants locaux, pas des comptes. La table
  `dame_matches` est privée : aucune lecture/écriture `anon` ou `authenticated`.
  Seul le backend utilise `service_role`. Avant d'exposer l'API, chaque UUID devra
  être associé à la session HTTP propriétaire et au jeu détenu par le serveur.
- Création en cours uniquement. Identifiant, noms et début deviennent immuables.
  Clôture vers une victoire uniquement ; aucune réouverture ou deuxième clôture.
- Une clôture utilise un PATCH conditionné par `status=IN_PROGRESS`. Deux clients
  concurrents ne peuvent pas écraser leurs résultats : un seul modifie une ligne.
  Les contraintes et le trigger protègent également une écriture SQL directe.
- PostgreSQL conserve les dates à la microseconde. L'adaptateur tronque les
  nanosecondes avant l'écriture ; les tests comparent les instants, pas leur fuseau.
- Les erreurs du stockage ne sont pas présentées comme des succès. Aucun détail
  Supabase, nom ou secret n'est renvoyé au joueur.

## Tests prévus

1. Testcontainers démarre une base Supabase PostgreSQL 17.11 et PostgREST 16.5,
   images déjà utilisées par `quality/docker-compose.yml`.
2. Toutes les migrations SQL du dépôt sont exécutées sur la base vide, dans
   l'ordre ; les tests n'utilisent ni H2 ni une base partagée.
3. Les tests Java passent par le véritable adaptateur HTTP, puis contrôlent les
   lignes SQL : création, relecture, absence, victoires, clôture inconnue/double,
   concurrence et précision des dates.
4. Les tests SQL vérifient noms invalides et limites, statuts/dates incohérents,
   immutabilité et droits des rôles réels. Un rollback isole les tests SQL ; les
   tests HTTP nettoient uniquement la table du conteneur éphémère.
5. Des tests unitaires HTTP sans réseau couvrent les pannes et réponses invalides.

`mvn -f backend/pom.xml verify` garde la suite rapide sans Docker.
`mvn -f backend/pom.xml -Pintegration verify` ajoute les `*IT` via Failsafe et
échoue si Docker manque. Les `*IT` sont obligatoires au palier intégration de la CI.

## Traçabilité

La branche est resynchronisée avec `dev` à `3af6766`, sans modifier les autres
jeux. Les quatre commits unitaires sont conservés dans leur ordre après rebase :
`d609bdf`, `6cc4202`, `a9cd566`, `88cdec0`.

Sous-étapes avec commits distincts : préparation du schéma et de l'outillage,
tests RED, contraintes SQL, adaptateur GREEN, puis branchement CI et preuves.
La migration initiale était volontairement incomplète pendant RED ; elle a été
complétée au GREEN SQL. Aucune migration déjà fusionnée n'est modifiée.

Deux dépendances de test sont ajoutées à Maven : Testcontainers (conteneurs réels)
et le pilote PostgreSQL (migrations et assertions SQL), versions gérées par le BOM
Spring Boot. Failsafe est également géré par ce BOM. Rien n'est ajouté au runtime
de production. Docker Desktop a été démarré localement pour cette étape.

Références techniques : [réseau Testcontainers](https://java.testcontainers.org/features/networking/),
[attente de disponibilité](https://java.testcontainers.org/features/startup_and_waits/),
[tables et filtres PostgREST](https://docs.postgrest.org/en/stable/references/api/tables_views.html).

## RED observé

- Préparation `1dd018b` : compilation et vérification des 16 noms/versions de
  migration réussies, avant les tests.
- Tests du contrat HTTP : **25 cas, 25 échecs attendus, 0 erreur, 0 ignoré**.
- Intégration réelle : **52 cas, 33 échecs attendus, 0 erreur, 0 ignoré**.
  Les conteneurs démarrent, les 16 migrations sont appliquées et les contrôles
  d'accès déjà préparés passent. L'adaptateur est encore un squelette et les
  contraintes métier ne sont pas encore implémentées.
- Les rôles réservés de Supabase sont initialisés par le script de qualité
  monté dans le conteneur, en `supabase_admin`, comme dans Docker Compose. Une
  première tentative via JDBC en `postgres` avait été refusée ; elle ne compte
  pas comme RED métier et a été corrigée avant le décompte ci-dessus.

Le RED s'exécute avec `mvn ... -Dtest=SupabaseMatchRepositoryTest test`, puis
`mvn ... -Pintegration -Dit.test=SupabaseMatchRepositoryIT
failsafe:integration-test failsafe:verify` après `test-compile`.

## Contraintes SQL

Après implémentation de la migration, la même suite compte **44 réussites et
8 échecs attendus sur 52, sans erreur ni test ignoré**. Les 43 cas SQL passent,
ainsi que la lecture d'un identifiant absent. Les huit scénarios qui nécessitent
l'adaptateur HTTP attendent encore son implémentation. Les noms suivent les mêmes
limites UTF-16 et espaces Unicode que le domaine Java ; la base refuse les dates
incohérentes, les insertions déjà terminées, les réécritures et les accès navigateur.

## Adaptateur GREEN

Sans modifier les assertions du RED, l'adaptateur réalise les créations, lectures
et clôtures conditionnelles via PostgREST. Il traduit les refus et pannes du
fournisseur, vérifie la forme des réponses et n'utilise pas d'upsert susceptible
de réécrire une rencontre terminée.

`mvn -B -ntp -f backend/pom.xml -Pintegration clean verify` réussit :
**1 081 tests backend et 52 tests d'intégration**, zéro échec, erreur ou ignoré.
La course réelle de deux requêtes de clôture n'en accepte qu'une. Checkstyle,
Spotless et les seuils JaCoCo passent. Persistance : **70/70 lignes et 17/18
branches couvertes** ; moteur et rencontres restent à 100 % lignes/branches.

La suite PostgreSQL collective `CI=true npm run test:integration` passe également :
**57 cas dans 4 fichiers**, avec la nouvelle migration, aucun test ignoré.

## Renforcement par mutation

Le premier PIT passe le seuil mais révèle deux réponses incohérentes insuffisamment
couvertes : plusieurs lignes pourtant valides pour un seul UUID, et une clôture
renvoyant l'UUID d'une autre rencontre. Deux tests dédiés les refusent désormais.
Deux entrées de corps uniquement composé d'espaces complètent aussi les cas
invalides. Aucun code de production ni paramètre PIT n'est changé.

Après renforcement : **29 tests HTTP**, **1 085 tests backend et 52 tests
d'intégration réussis**, zéro erreur ou ignoré. La persistance couvre désormais
**70/70 lignes et 18/18 branches**.

PIT mesure **27/28 mutants tués (96,43 %) sur la persistance**, **22/22 sur les
rencontres**, et **262/270 (97,04 %) sur le profil collectif**. Aucun timeout,
mutant non couvert ou erreur. Les sept survivants historiques du moteur restent
analysés dans [mutation.md](mutation.md).

Le seul survivant de la persistance supprime le précontrôle `body.isBlank()` dans
`rows`. Le parseur refuse ensuite ces corps comme JSON sans tableau et le service
renvoie toujours `MatchStorageException` : même contrat observable. Les tests
ne figent pas le détail interne de la cause pour tuer cette redondance. Aucune
exclusion ne masque le mutant. PIT mesure le code Java, pas les contraintes SQL.

## CI et reproduction locale

Le check existant `Backend (format + lint + tests)` conserve son nom et exécute
la commande collective `mvn -B verify` au palier 1, y compris le BDD. Le palier 2
`Integration (Testcontainers)` exécute ensuite les tests collectifs de base puis
`mvn -B -Pintegration test-compile failsafe:integration-test failsafe:verify` depuis
`backend/`. Les changements backend, migrations et script d'initialisation
déclenchent ce palier. Les rapports Failsafe sont publiés en artefact ; aucun test
Docker ni seuil n'est désactivé. Les règles d'arrêt au premier échec de dev restent
inchangées. La syntaxe YAML et le branchement du profil sont contrôlés localement.
La CI GitHub n'a pas été exécutée sur ces commits locaux : aucun push ni PR.

Depuis la racine, Docker Desktop démarré :

```bash
# Toute la validation backend, y compris les vrais conteneurs
mvn -B -ntp -f backend/pom.xml -Pintegration clean verify

# Les tests unitaires du contrat HTTP, sans Docker
mvn -B -ntp -f backend/pom.xml -Dtest=SupabaseMatchRepositoryTest test

# Mutation Java, sans Docker
mvn -B -ntp -f backend/pom.xml -Pmutation test-compile org.pitest:pitest-maven:mutationCoverage

# Compatibilité de toutes les migrations et politiques collectives
cd frontend
CI=true npm run test:integration
```

Les conteneurs utilisent des ports aléatoires et sont arrêtés à la fin. Aucun
fichier `.env` ni base partagée n'est utilisé par ces tests. Rapports locaux :
`backend/target/failsafe-reports`, `backend/target/site/jacoco/index.html`,
`backend/target/pit-reports/index.html` (non versionnés).

## API, interface et parcours regroupés

La persistance est reliée à l'[API à session](api.md), au formulaire des deux
noms et au damier React. Le serveur valide les coups et enregistre le résultat
issu du moteur. Les [tests de contrat, E2E et commandes de démo](interface-e2e.md)
complètent les IT réels. Ces étapes sont désormais regroupées dans la même
PR #116, en conservant les commits intermédiaires, pour une seule revue.

## Validation avant publication — 5 novembre 2026

Les 14 commits du lot sont rebasés sur `dev` à `ece3ce7`, en préservant les auteurs
et le cycle RED/GREEN. Les dépendances Cucumber 8.0.4 sont maintenant fournies par
dev et ne sont pas dupliquées. Pact, chaos, cibles PIT collectives et paliers CI
sont conservés ; les vrais tests Dames s'exécutent au palier 2 intégration.

Vérifications locales sur cette base :

- Backend complet : **6 358 cas**, 0 échec/erreur, 1 scénario Échecs `@en-cours`
  ignoré par le filtre collectif préexistant. Les **12 cas BDD Dames** s'exécutent.
- Failsafe : **52 tests Dames réussis**, aucun ignoré, sur les vrais conteneurs.
- Frontend collectif : format, lint, typage, couverture (**1 304 cas**), contrat
  Pact (**6 cas**) et build réussis. Aucun code frontend propre au lot modifié.
- Base collective : **61 cas** réussis ; **17 migrations** aux versions uniques.
- RTM collective : contrôle réussi, 24 exigences et 85 cas tracés.
- JaCoCo Dames : moteur, rencontres et persistance à **100 % lignes/branches**.
- PIT : rencontres **22/22**, persistance **27/28** tués ; profil collectif
  **441/453 détectés (97,35 %)**, dont **439 tués et 2 timeouts collectifs**.
  Les 12 survivants globaux comprennent les 8 Dames déjà documentés.

Les résultats GitHub de la PR restent distincts de ces mesures locales
historiques, antérieures au regroupement de l'API et de l'interface dans #116.
Les validations du parcours complet sont dans [interface-e2e.md](interface-e2e.md).
L'issue #18 reste ouverte ; les règles de nulle restent hors de ce lot.
