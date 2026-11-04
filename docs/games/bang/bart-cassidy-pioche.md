# BANG! — Bonus de pioche de Bart Cassidy (#52 / #59)

## Préparation et périmètre

La #59 n'est pas encore intégrée dans `game/bang/implementation` (`94d09ff`).
Le correctif poursuit donc `game/bang/59-synchronisation-tirs`, depuis `20f89a4`.
Le dernier `origin/dev`, `350911e`, a été intégré sans conflit dans `75a9939` ;
les contributions Échecs et les dépendances de test apportées par `dev` sont conservées.

Le contrat `BangCharacter.cardsDrawnOnLifeLost(int lifeLost)` de Colleen est inchangé.
Le raccordement doit dépendre des PV réellement perdus et de la survie du personnage.
La [FAQ BANG!](https://rules.dized.com/game/HmdokPTaSHSr-oYVNdO_ZA/OtF1hoFlTLeqEwY0OfyUGg/new-does-bart-cassidy-or-el-gringo-draw-a-card-when-he-loses-his-last-life-point-so-if-its-a-beer-they-can-save-themselves)
précise qu'un Bart éliminé ne pioche pas. Le sauvetage par une Bière reste hors périmètre.

Le recyclage de la défausse était absent du moteur. Les
[règles françaises, p. 3](https://www.dvgiochi.com/giochi/bang/download/Bang_rules_FRA.pdf)
prévoient de mélanger la défausse lorsque la pioche est vide. Ce point de périmètre a été
présenté avant toute implémentation de remplacement. L'utilisateur a ensuite explicitement
inclus un mécanisme commun au bonus et à la pioche de tour, y compris une pioche de deux
cartes à cheval sur l'ancienne pioche et la défausse mélangée. Un total inférieur à deux
cartes continue de faire refuser la pioche de tour sans mutation.

## Preuves TDD outside-in

La distribution est un double contrôlable, mais les cartes, états, contrôleur, sécurité,
service de table et règles de tir sont réels dans le test HTTP.

| Comportement | Résultat observé avant toute modification du moteur |
| --- | --- |
| Tir sur Bart, acceptation, vue privée avec une pioche connue | Rouge HTTP : Bart est bien à 3 PV, mais `$.hand[1].id` est absent au lieu de contenir la première carte de la pioche. |
| Perte non mortelle de 1 PV, depuis 4 ou 2 PV | Deux rouges métier : la carte attendue manque dans la main ; les dégâts sont déjà corrects. |
| Aucun PV perdu ou dernier PV perdu | Déjà vert : aucune carte prélevée, santé maintenue à zéro si éliminé. |
| Autres personnages et esquive de Bart | Déjà vert : aucun bonus. |

Sur les huit cas domaine ciblés, **deux échouent pour le bonus absent et six passent**.
Ces six comportements déjà corrects ne donnent pas lieu à un rouge artificiel.

Une seconde exécution ciblée confirme **huit tests verts**, sans échec ni test ignoré :
six cas domaine et les deux parcours HTTP esquive/dernier PV.
Ce contrôle précède la modification du code BANG! de production.

Après l'accord sur le recyclage, le premier raccordement de `cardsDrawnOnLifeLost`
fait passer **125 tests ciblés** au vert. Les PV réellement perdus et la survie déterminent
le bonus ; le transfert de carte est confié à `CardDraw`, sans règle spéciale de Bart
dans le service ou le contrôleur. Le cas de la pioche vide est le palier TDD suivant.

Le recyclage est ensuite piloté par un rouge HTTP (`204` attendu, `409` reçu pour Bart
avec une pioche vide), puis deux rouges domaine : refus de piocher depuis la défausse
et de franchir la limite entre les deux piles. Un double de mélange inverse la liste
pour vérifier l'ordre exact des cartes reçues et restantes ; les listes d'entrée restent intactes.
Après ajout du recyclage dans `CardDraw`, **132 tests ciblés passent**. Le scénario où seule
la carte du BANG! est disponible confirme les dégâts et le bonus, sans création de carte.

Le raccordement de la pioche de tour est conduit par deux rouges HTTP (`204` attendu,
`409` reçu avec zéro ou une carte en pioche et une défausse suffisante). Le service utilise
ensuite la même instance de `CardDraw` pour ses deux usages. **152 tests ciblés passent**,
dont les trois cas de total insuffisant `(0,0)`, `(0,1)` et `(1,0)`, sans prélèvement partiel.
