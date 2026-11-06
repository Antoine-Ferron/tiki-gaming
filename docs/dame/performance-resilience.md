# Performance et résilience des Dames

Ces contrôles ciblent uniquement les Dames. Ils complètent les mesures collectives, sans modifier la CI ni ses seuils.

## Charge k6

Dans un terminal, démarrer une démo **éphémère**, puis lancer k6 dans un autre :

```sh
DAME_DEMO_PORT=8086 ./tools/dame/demo-backend.sh
docker run --rm --add-host host.docker.internal:host-gateway \
  -v "$PWD/quality/k6:/scripts:ro" \
  -e BACKEND_URL=http://host.docker.internal:8086 -e PROFILE=smoke \
  grafana/k6:2.3.0 run /scripts/dame.js
```

`PROFILE=load` utilise 10 utilisateurs virtuels pendant une minute ; `DURATION=30s` permet de changer la durée. `smoke` utilise un utilisateur pendant dix secondes. Chaque parcours initialise CSRF et les cookies, crée une rencontre, la relit, joue un coup légal puis vérifie la version conservée. Les URL sont regroupées par opération pour éviter une métrique par UUID.

Critères locaux : P95 inférieur à 300 ms pour chacune des opérations création/lecture/coup, moins de 1 % d'erreurs HTTP et 100 % des vérifications fonctionnelles. Ce sont des objectifs de test, pas un SLA de production. Les rencontres créées restent dans la base éphémère jusqu'à l'arrêt de la démo ; ne pas lancer ce script sur la production.

## Pannes réseau réelles

```sh
mvn -B -ntp -f backend/pom.xml -Pintegration \
  -Dit.test=DameStorageChaosIT test-compile failsafe:integration-test failsafe:verify
```

`DameStorageChaosIT` place Toxiproxy entre le client Java et le vrai PostgREST, relié au vrai PostgreSQL migré. Docker est requis : ces tests échouent s'il n'est pas disponible.

- Coupure avant l'écriture : erreur de stockage, résultat inchangé, écriture possible après rétablissement.
- Lecture ralentie : délai client de 400 ms face à trois secondes de latence injectée ; récupération après retrait de la panne.
- Réponse d'écriture perdue : l'écriture peut avoir abouti. Une relecture confirme le résultat, et une seconde clôture reste refusée.

Exécution locale du 6 novembre 2026 : **3 tests passés**, sans tests ignorés, en 10,80 s pour la classe. Le délai réduit appartient au test ; il ne change pas les délais réseau de la plateforme. Aucun circuit breaker propre aux Dames n'est revendiqué.

## Mesures de la version avec sauvegarde durable

Campagne locale du 6 novembre 2026 sur `3656fb2f` (backend de `378b7ea0`), après arrêt des tests lourds : Java 21, k6 2.3.0 dans Docker, PostgreSQL et PostgREST réels de la démo sur le port 8086. Le profil court a servi d'échauffement ; ces chiffres ne sont pas des mesures de production.

| Profil            | Parcours | Requêtes | Erreurs HTTP | P95 création | P95 lecture | P95 coup |
| ----------------- | -------: | -------: | -----------: | -----------: | ----------: | -------: |
| Smoke, 1 VU, 10 s |       18 |       90 |          0 % |     37,70 ms |    32,41 ms | 22,41 ms |
| Load, 10 VU, 60 s |    1 070 |    5 350 |          0 % |     36,00 ms |    18,99 ms | 37,43 ms |

Toutes les vérifications fonctionnelles et tous les seuils passent. Les rapports [smoke](preuves/2026-11-06-extensions/k6-smoke.json) et [load](preuves/2026-11-06-extensions/k6-load.json) conservent les mesures exportées par k6.

La suite de panne a été étendue à **4 tests passés** pour contrôler aussi le nouveau stockage atomique : coupure avant sauvegarde, puis réponse perdue après sauvegarde, relecture de la version et refus du doublon. Elle fait partie des **73 intégrations Dames passées** dans la vérification complète. Le parcours de charge ne remplace pas ces scénarios d'erreur : il ne soumet que des coups légaux.
