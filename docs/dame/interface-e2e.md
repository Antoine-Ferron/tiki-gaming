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

## Interface GREEN

Les mêmes **18 cas passent**. Le damier reprend la présentation préparée sur
`game/dame/implementation`, adaptée à l'API à session : aucune route ne reçoit
de plateau, de propriétaire ou de résultat choisi par le client.

- Noms de 1 à 50 caractères après nettoyage, validation Zod et messages liés aux champs.
- Sélection d'un parcours parmi les coups du serveur ; une rafle complète produit un seul POST.
- Pas de mise à jour optimiste du résultat. Après une erreur de coup, le plateau
  reste visible mais bloqué jusqu'à une relecture GET explicite, sans répétition du POST.
- Un UUID est conservé dans l'onglet. Si la session ne le possède plus, le serveur
  renvoie 404 et le formulaire revient ; aucune nouvelle rencontre n'est créée automatiquement.
- Flèches, Home/End, Entrée et Espace ; une seule case dans l'ordre de tabulation.
  Les dames portent la lettre D et les coups proposés ont des libellés accessibles.

Validation : **1 324 tests frontend verts**, formatage, lint et build réussis.
Couverture globale : **93,76 % des lignes**, **87,41 % des branches** ; seuils
conservés. Les **62 tests PostgreSQL collectifs** passent avec la nouvelle
migration de catalogue, sans modification de leur code.
