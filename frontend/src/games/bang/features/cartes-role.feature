# language: fr
Fonctionnalité: Cartes Rôle
  Pour savoir ce que je dois faire pendant la partie
  En tant que joueur
  Je veux que chaque carte Rôle affiche son nom et son objectif, et ne révèle rien face cachée

  Plan du scénario: Une carte Rôle visible affiche son nom et son objectif
    Quand la carte "<role>" est révélée
    Alors elle affiche le nom "<nom>"
    Et son objectif contient "<extrait>"

    Exemples:
      | role     | nom         | extrait                           |
      | sheriff  | Shérif      | éliminer tous les hors-la-loi     |
      | deputy   | Adjoint     | protègent le Shérif               |
      | outlaw   | Hors-la-loi | tuer le Shérif                    |
      | renegade | Renégat     | dernier personnage en jeu         |

  Scénario: Face cachée, les quatre cartes Rôle ont le même dos et ne révèlent rien
    Quand les quatre cartes Rôle sont face cachée
    Alors elles montrent toutes le même dos
    Et aucune n'affiche de nom ni d'objectif
