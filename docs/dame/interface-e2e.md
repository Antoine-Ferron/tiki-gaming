# Interface et parcours navigateur — issue #18

La branche `game/dame/interface-e2e` reprend les cinq commits validés de
`game/dame/api`. La PR de persistance #116 reste indépendante.

## Contrat et RED

L'interface demande deux noms avant le démarrage. Elle lit les coups légaux et
le résultat calculés par Java, puis envoie seulement la version et le parcours.
Un rechargement conserve uniquement l'UUID dans `sessionStorage`, jamais le
plateau ni un gagnant. Le backend vérifie toujours la session propriétaire.

Avant implémentation, `npx vitest run src/games/dame` constate **18 cas RED** :
8 vérifient le transport HTTP et les erreurs, 10 les comportements visibles.
Les adaptateurs HTTP et le composant sont encore des squelettes compilables.
Les réponses réduites des tests ne prétendent pas calculer les règles du moteur.

Les ajouts partagés annoncés sont l'inscription au registre et la migration
du catalogue. Les clients et configurations communs sont réutilisés sans
modification. Les tests de contrat Dames restent dans leurs propres fichiers.
