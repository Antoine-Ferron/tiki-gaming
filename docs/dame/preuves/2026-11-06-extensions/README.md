# Preuves des extensions Dames — 6 novembre 2026

Résultats **locaux**, sur `game/dame/diallo-mamadou-cherif-bilan-qualite`, sans nouvelle PR ni nouvelle validation humaine. Le backend fonctionnel est celui de `378b7ea0`, le texte d'aide du frontend de `3656fb2f`, et le renforcement des tests de mutation de `4cc52b5a`. Les migrations ne touchent que les tables et fonctions Dames ; aucun workflow ni seuil partagé n'est modifié.

## Vérifications exécutées

- [verification.json](verification.json) : `mvn verify` complet, **7 082 tests Surefire**, dont **447 Dames**, et **73 intégrations Dames** ; zéro échec, erreur ou test ignoré, seuils JaCoCo respectés. Après cette exécution, neuf cas ont été ajoutés dans `DrawStateTest` : les **32 tests de nulle** ont été rejoués et passent. La suite Dames contient alors **456 cas**, sans prétendre qu'une seconde exécution globale de tous les jeux a été faite après cet ajout de tests.
- Frontend : **2 422 tests passés**, dont **19 Dames** ; couverture **93,50 % des lignes et 87,73 % des branches**. Formatage, lint et build passent. Le lint signale un avertissement préexistant dans les Échecs. Les 19 tests Dames ont été rejoués après la correction du texte d'aide.
- E2E avec API simulée selon CONTRIBUTING : **6 Chromium + 6 WebKit + 6 Firefox**. L'échec initial de lancement de Firefox sur macOS a été résolu par `CFFIXED_USER_HOME` pointant vers un répertoire temporaire ; aucune assertion n'a été supprimée.
- Les **73 IT réels** comprennent 53 tests de métadonnées, 10 du stockage atomique, 4 de panne Toxiproxy, 5 HTTP/CSRF/stockage et 1 redémarrage de serveur. `DameServerRestartIT` démarre deux véritables serveurs Spring successifs sur la même base et vérifie la reprise avec le seul cookie privé.

## Mutations du cœur

[mutation.json](mutation.json) : **214 mutants tués sur 222, soit 96,40 %**, aucun mutant sans couverture ni timeout. Périmètre exact : `Game`, `GameRules`, `DrawState`, avec les mutateurs `STRONGER` et le seuil inchangé de 75 %. Ce chiffre ne représente pas tout le backend ni l'adaptateur SQL.

| Classe    | Tués | Total |   Score |
| --------- | ---: | ----: | ------: |
| Game      |   13 |    13 |   100 % |
| GameRules |  113 |   118 | 95,76 % |
| DrawState |   88 |    91 | 96,70 % |

Le [premier passage](mutation-avant-renforcement.json) comptait 197 mutants tués et un timeout, soit 198 détectés sur 222. L'analyse a conduit à tester la distinction couleur/dame/case occupée, le nettoyage des répétitions après déplacement de pion, l'absence de délai spécial contre un pion seul et les historiques corrompus.

Les huit survivants restent visibles : cinq dans les règles préexistantes, analysés dans le [bilan historique](../../mutation.md) ; deux sur la borne de 51 positions dans l'historique, qui constituent une limite de tests connue ; un sur le décrément d'un compteur déjà nul, situation empêchée par l'arrêt du jeu. Aucune exclusion n'est ajoutée.

```sh
mvn -B -ntp -f backend/pom.xml -Pmutation \
  '-DtargetClasses=fr.tikigaming.games.dame.Game,fr.tikigaming.games.dame.GameRules,fr.tikigaming.games.dame.DrawState' \
  '-DtargetTests=fr.tikigaming.games.dame.*Test' -Dthreads=2 \
  -DreportsDirectory=target/pit-reports-dame-extensions \
  test-compile org.pitest:pitest-maven:mutationCoverage
```

## Charge et reprise navigateur

[k6-smoke.json](k6-smoke.json) et [k6-load.json](k6-load.json) : tous les seuils passent. À **10 VU pendant une minute**, 1 070 parcours et 5 350 requêtes terminent sans erreur ; P95 **36,00 ms création / 18,99 ms lecture / 37,43 ms coup**. Les tests de mutation étaient arrêtés pendant cette mesure. Le détail de l'environnement et les commandes sont dans [performance et résilience](../../performance-resilience.md).

[reprise-navigateur.json](reprise-navigateur.json) et [capture](reprise-navigateur.png) : Chromium 156, vrai backend et vrai PostgreSQL. Après un coup, fermeture du contexte navigateur et réouverture avec localStorage et cookie de reprise, sans JSESSIONID : même plateau, version 1 et aucune nouvelle création. Aucun mock API ni plateau injecté dans ce parcours. Le statut `PASSED_AGENT` constate une exécution par l'agent, sans signer une UAT à la place d'un humain.

Les traces exportées ne contiennent ni cookie, ni clé serveur, ni jeton de reprise. Les instances temporaires de validation sont arrêtées après la campagne ; les serveurs déjà ouverts par l'utilisateur sont conservés. La démo habituelle reste jetable : arrêter son script détruit sa base, contrairement au redémarrage Java seul testé ici.
