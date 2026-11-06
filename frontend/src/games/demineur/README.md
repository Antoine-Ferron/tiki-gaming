# Démineur — déroulé

> **Auteur** : Jacky-Lp ([jacky.le-pre@orange.fr](mailto:jacky.le-pre@orange.fr)) — feature développée
> et testée en nom propre, assignée sur l'issue #15.

Ce document retrace la démarche de test suivie pour implémenter le Démineur ([issue #15](https://github.com/EAnathos/tiki-gaming/issues/15)),
dans le cadre du module Tests & Qualité Logicielle. Les règles du jeu sont dans [REGLES.md](REGLES.md).

## 1. TDD sur le cœur du jeu

[logic.ts](logic.ts) est développé en TDD (cycle rouge-vert-refactor), guidé par [REGLES.md](REGLES.md) :
chaque règle y est d'abord couverte par un test dans [logic.test.ts](logic.test.ts) avant d'être codée.

Le module est **pur** : pas d'I/O, pas d'accès direct à `Math.random()`. L'aléatoire est injecté via un
port `Rng` (`{ next(): number }`), avec une implémentation réelle par défaut et un **Stub** à séquence
fixe dans les tests (ex. `{ next: () => 0 }` pour placer une mine à une position connue). Ce choix évite
les tests flaky tout en gardant la production déterministe par construction — un test dédié rejoue 100
fois avec le vrai `Math.random()` pour vérifier que les invariants tiennent quel que soit le tirage.

## 2. BDD — le langage métier

Les règles de révélation/cascade/drapeaux sont aussi spécifiées en Gherkin : [demineur.feature](demineur.feature)

- [demineur.steps.test.ts](demineur.steps.test.ts), et le calcul du score via un `Scenario Outline` :
  [score.feature](score.feature) + [score.steps.test.ts](score.steps.test.ts). Les scénarios décrivent le
  comportement du domaine (ex. _"je révèle la case (2,2) → les cases sans mine sont révélées"_), jamais
  l'UI — sinon les tests casseraient à chaque changement visuel.

## 3. Tests d'intégration réels (Testcontainers)

Les contraintes qui vivent en base (pas dans le code applicatif) sont vérifiées contre un vrai
PostgreSQL, lancé par Testcontainers — zéro mock SQL, zéro H2. Pour Démineur : les bornes de
`max_score` (9899 accepté, 9900 accepté/max, 9901 rejeté), dans
[`frontend/tests/integration/scores.test.ts`](../../../tests/integration/scores.test.ts).

## 4. Qualimétrie statique (SonarQube)

Analyse locale (Docker, instance jetable) via [`quality/sonar-demineur.sh`](../../../../quality/sonar-demineur.sh),
scopée au dossier du jeu. Quality Gate passé : 0 bug, 0 vulnérabilité, 0 code smell, couverture 92.6%.
Un hotspot sécurité a été signalé sur `Math.random()` (usage sensible détecté automatiquement) — marqué
**Accept** après revue manuelle, car il sert au placement des mines, pas à un secret.

## 5. Mutation testing (Stryker) + fuzzing (fast-check)

La couverture de lignes ne dit pas si les tests _vérifient vraiment_ le comportement. Le mutation
testing introduit des bugs volontaires (mutants) dans `logic.ts` et vérifie que la suite les détecte.
Score obtenu : **100%** (108 tués, 13 timeout), largement au-dessus du seuil de 75% exigé. Trois
mutants équivalents sont explicitement exclus (`// Stryker disable next-line`, avec justification en
commentaire) car ils ne changent aucun comportement observable. Un mutant non-équivalent avait d'abord
survécu sur `calculateScore` (`mineCount * 100` → `mineCount / 100`, non détecté par les scénarios BDD
existants) : les propriétés `fast-check` ne vérifient que la monotonie du score, pas sa valeur exacte,
donc une mutation qui change l'échelle sans changer le sens de variation leur échappe. Ajout d'un test
unitaire à valeur exacte (`calculateScore(10, 10)` doit valoir `990`) pour le tuer.

En complément, [logic.fuzz.test.ts](logic.fuzz.test.ts) ajoute 8 propriétés `fast-check` (property-based
testing) : au lieu d'exemples fixes, elles vérifient des invariants sur des milliers de grilles générées
aléatoirement (ex. `revealCell` ne plante jamais, `toggleFlag` est sa propre inverse, `calculateScore`
n'est jamais négatif).

## 6. Composant interactif (React Testing Library)

[DemineurGame.tsx](DemineurGame.tsx) assemble la logique pure et l'affiche : clic gauche pour révéler,
clic droit pour un drapeau, soumission du score à la fin d'une victoire, classement, parcours invité.
Testé en isolation avec [DemineurGame.test.tsx](DemineurGame.test.tsx) : une **Fake** (`FakeScores`, un
stockage de scores en mémoire) remplace la vraie persistance, sans réseau ni base de données.

## 7. End-to-end (Playwright)

[`frontend/e2e/demineur.spec.ts`](../../../e2e/demineur.spec.ts) rejoue le parcours dans un vrai navigateur :
accès depuis le catalogue, changement de difficulté, révélation, drapeaux, défaite. Pour forcer une mine
précise sans pouvoir injecter le port `Rng` par-dessus un vrai navigateur, un PRNG seedé (mulberry32)
remplace `Math.random` côté navigateur (`page.addInitScript`) et est rejoué à l'identique côté Node pour
connaître à l'avance la grille réelle.

## 8. DAST (OWASP ZAP)

En plus de l'analyse statique (SonarQube), un scan dynamique (DAST) vérifie l'application une fois
servie — en conditions proches de la prod (`vite build` + `vite preview`, pas le serveur de dev : ce
dernier bloque exprès les hôtes inconnus, ce qui fausserait le scan). Résultat :
[`quality/reports/zap-report-demineur.html`](../../../../quality/reports/zap-report-demineur.html) —
**0 FAIL, 3 WARN mineurs** (en-têtes `Cross-Origin-Embedder-Policy` absents, cache sur quelques assets),
65 règles passées.

## Bilan

| Niveau                                   | Résultat                                |
| ---------------------------------------- | --------------------------------------- |
| Tests unitaires + BDD (`logic.ts`)       | 52 tests                                |
| Mutation score (`logic.ts`)              | 100%                                    |
| Tests d'intégration (bornes `max_score`) | 3 tests, PostgreSQL réel                |
| Tests composant (`DemineurGame.tsx`)     | React Testing Library, Fake             |
| Tests E2E (`demineur.spec.ts`)           | 5 tests, Chromium                       |
| SonarQube                                | Quality Gate passé, 0 bug/vulnérabilité |
| DAST (ZAP)                               | 0 FAIL, 3 WARN mineurs                  |

Voir aussi le [cahier de recette](../../../../quality/cahier-de-recette-demineur.md) pour la validation
fonctionnelle manuelle (UAT).
