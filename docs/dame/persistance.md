# Persistance des rencontres — issue #18

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
échoue si Docker manque. Ce profil sera rendu obligatoire dans le job backend CI.

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
