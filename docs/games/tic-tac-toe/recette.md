# Cahier de recette — Tic-Tac-Toe

Les fiches sont à exécuter sur une version dont la CI est verte. Le recetteur
complète le résultat et le statut avant la soutenance.

| Cas                                   | Préconditions              | Étapes                                                         | Résultat attendu                                                     | Statut     |
| ------------------------------------- | -------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- | ---------- |
| UAT-TTT-01 — victoire X               | Page Tic-Tac-Toe ouverte   | Jouer `(1,1)`, `(2,1)`, `(1,2)`, `(2,2)`, `(1,3)`              | `VICTOIRE !`, « Joueur X gagne », score X à 1                        | À EXÉCUTER |
| UAT-TTT-02 — alternance               | Nouvelle partie            | Jouer deux cases libres                                        | La première contient X, la seconde O, le statut indique le tour de X | À EXÉCUTER |
| UAT-TTT-03 — match nul                | Nouvelle partie            | Jouer la séquence de grille pleine sans alignement             | « Match nul ! », aucune case supplémentaire n'est jouable            | À EXÉCUTER |
| UAT-TTT-04 — replay                   | Partie gagnée              | Cliquer « Rejouer »                                            | Grille vide, tour de X, score précédent conservé                     | À EXÉCUTER |
| UAT-TTT-05 — clavier et accessibilité | Page ouverte, clavier seul | Parcourir les cases avec Tab puis activer une case avec Entrée | Focus visible, coup joué, annonce accessible du statut               | À EXÉCUTER |
