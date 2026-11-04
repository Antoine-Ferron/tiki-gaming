# Exemples métier en Gherkin — issue #18

## Statut

Première proposition à relire ensemble, avant le raccordement API/interface.
Les fichiers `.feature` décrivent les comportements attendus ; leurs étapes ne
sont **pas encore reliées à un runner Java**. Ils ne constituent donc pas une
nouvelle suite verte et n'augmentent pas le nombre de tests automatisés.

Les règles décrites possèdent déjà des tests JUnit. Les prochains bindings devront
appeler le vrai moteur et `MatchService`, avec un fake de `MatchRepository`, une
horloge et des identifiants fixes. Aucun navigateur ni base réelle n'est nécessaire
pour ces scénarios métier. Les tests Testcontainers restent la preuve séparée du
fonctionnement du stockage réel.

## Scénarios proposés

| Fichier | Exemples métier | Comportements Java déjà testés |
|---|---|---|
| [rencontres.feature](../../backend/src/test/resources/features/dame/rencontres.feature) | Création avec deux noms, limites 0/1/50/51, victoires des deux camps, résultat prématuré et remplacement interdit | `MatchTest`, `MatchServiceTest`, `MatchServiceDoublesTest` |
| [prises-et-victoire.feature](../../backend/src/test/resources/features/dame/prises-et-victoire.feature) | Capture obligatoire, maximum de captures et dernière pièce adverse | `MandatoryCaptureTest`, `MultipleCaptureTest`, `GameEndTest` |

Soit **8 scénarios déclarés**, dont 2 plans de scénario, pour **12 cas** après
développement des exemples. Les noms composés de lettres A rendent les frontières
de longueur explicites sans ambiguïté sur les caractères Unicode.

Le « joueur au trait » est celui qui doit jouer. Un « résultat refusé » signifie
que l'état et le gagnant de la rencontre sont conservés ; une panne quelconque
ne devra pas suffire à faire passer cette assertion. Le gagnant provient du moteur.

## Relecture et prochaine étape

Le cours J2 matin présente le BDD comme une discussion métier/dev/QA guidée par des
exemples. Ces textes reprennent notre périmètre convenu ; leur ajout seul ne prouve
pas qu'un atelier avec l'équipe a eu lieu. À relire notamment : la limite de 50
caractères et l'impossibilité de corriger un résultat déjà enregistré.

Après cette relecture, relier les étapes au domaine Java et publier leur rapport
d'exécution en CI. Le runner Gherkin existant côté frontend sert ici uniquement à
vérifier la lecture des fichiers français ; le moteur Dames ne sera pas réécrit
en TypeScript pour ces tests.
