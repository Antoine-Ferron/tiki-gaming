# Rush Hour : traçabilité des exigences (RTM) et recette (UAT)

> **Statut : matrice complète ; recette prête, à exécuter.** Ce document garde la trace de l'entrée de Rush Hour dans la matrice de traçabilité et le cahier de recette de la plateforme (cours J3_PM).
> Issue : #102 · Branche : `game/rush-hour/qualite-sonar` · Fichiers : [`specs/rtm-matrix.md`](../../../specs/rtm-matrix.md), [`specs/cahier-de-recette.md`](../../../specs/cahier-de-recette.md)

---

## 1. Le point de départ

Le cahier des charges de Rush Hour ([regles.md](regles.md)) numérote déjà ses exigences (R1–R8, N1–N6, G1–G6, P1–P6, S1–S6, C1–C4), et 308 tests les vérifient. Mais **rien ne reliait les deux** : on ne pouvait pas répondre à « quelle exigence ce test prouve-t-il ? » ni à « quels tests prouvent cette exigence ? ».

La plateforme tient une **matrice de traçabilité** (`specs/rtm-matrix.md`) vérifiée à chaque CI par `npm run rtm:check`, et un **cahier de recette** (`specs/cahier-de-recette.md`). Rush Hour n'apparaissait dans aucun des deux.

## 2. Les deux questions du cours

- **Vérification**, « construit-on la solution correctement ? » : ce sont les tests automatisés. La RTM prouve que chaque exigence est testée.
- **Validation**, « construit-on le bon produit ? » : un vrai joueur déroule des parcours et signe un procès-verbal. C'est la recette (UAT).

## 3. Ce qui a été fait

### Matrice RTM

- **9 exigences Rush Hour** (`REQ-RH-01` à `09`), chacune rattachée à sa source dans le cahier des charges : déplacements (R4, R5), coups (R6), score (§ 7), vérification serveur (S6), progression (N3, N5), génération (G2, G3, S4), indices (P5), contrôles (C1, C2), contrat front/back.
- **31 cas de test**. Chaque exigence a **au moins un cas nominal et un cas d'erreur**, comme l'exige le script. Les preuves pointent vers de vrais tests, à tous les étages de la pyramide : unitaire, composant, BDD, contrat, E2E et accessibilité. Plusieurs viennent des campagnes SonarQube et mutation de cette PR.
- **2 anomalies** au format du cours, `[Module][Action] observé au lieu de attendu`, avec sévérité, priorité et correctif :

| Anomalie | Titre (résumé) | Sévérité | Priorité | Statut | Trouvée par |
|---|---|---|---|---|---|
| BUG-04 | Glissé d'une demi-case ignoré vers la gauche ou le haut | S3 (mineure) | P2 | Closed | le test rouge de `dropDelta` |
| BUG-05 | Nom lu des boutons de niveau sans leur texte visible (WCAG 2.5.3) | S2 (majeure) | P2 | Closed | l'audit axe en E2E |

Les deux suivent le cycle de vie ISTQB jusqu'au bout : trouvée, corrigée, re-testée (le test passe), close avec le commit du correctif.

Le script le confirme :

```
$ npm run rtm:check
24 exigences, 85 cas de test (84 PASSED), 5 anomalies : traçabilité complète.
```

**La traçabilité se lit dans les deux sens.**
- **Aval** (exigence → tests) : aucune règle de Rush Hour n'est orpheline.
- **Amont** (test → exigence) : les tests cités justifient leur existence par un besoin du cahier des charges.

Le script vérifie aussi que **chaque titre de test cité existe vraiment dans son fichier**. Un test renommé ou supprimé casse donc la CI, au lieu de laisser une preuve morte dans la matrice.

**Un piège rencontré.** La première insertion des anomalies a atterri dans le mauvais tableau : la ligne `TC-PERF-02` contient elle aussi `BUG-03`. Le script l'a signalé aussitôt (10 ruptures), ce qui montre l'intérêt d'une matrice vérifiée par un outil.

### Cahier de recette

4 fiches (`TC-UAT-07` à `10`) au format du cours : exigences liées, profil, préconditions, jeu de données, étapes, résultat attendu.

| Fiche | Parcours | Exigences |
|---|---|---|
| TC-UAT-07 | Niveau 1 au minimum de coups à la souris, déblocage du niveau 2, classement | REQ-RH-01, 02, 04, 05 |
| TC-UAT-08 | Indice payant (800 points) et record de 1000 conservé | REQ-RH-03, 05, 07 |
| TC-UAT-09 | Plateau Difficile généré (au moins 17 coups), hors classement | REQ-RH-06 |
| TC-UAT-10 | Jeu au doigt sur smartphone, puis au clavier seul | REQ-RH-08, REQ-A11Y-01 |

Le procès-verbal compte désormais 10 fiches. Elles sont au statut **`À EXÉCUTER`** : une recette se joue par un humain, sur l'application déployée, avec des comptes de test. Ce n'est ni un test automatisé, ni un outil.

## 4. Ce qu'il reste

- **Exécuter les 4 fiches** sur l'application déployée, remplir « Résultat obtenu » et le statut. Une fiche en échec doit pointer vers une nouvelle anomalie dans la RTM.
- **Mettre à jour la matrice à chaque nouvelle règle** : la CI refusera une exigence sans cas nominal et sans cas d'erreur.
