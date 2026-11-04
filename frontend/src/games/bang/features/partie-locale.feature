# language: fr
Fonctionnalité: Partie locale à quatre sans compte
  Pour jouer sans me connecter
  En tant qu'invité
  Je veux une partie à quatre sur le même écran, avec les mêmes règles de tour qu'en ligne

  Plan du scénario: Une partie locale distribue un rôle et un personnage à chacun
    Quand une partie locale est distribuée
    Alors la place <place> a le rôle <role>, le personnage "<personnage>", <pv> PV et <main> cartes en main

    Exemples:
      | place | role     | personnage     | pv | main |
      | 1     | SHERIFF  | Bart Cassidy   | 5  | 5    |
      | 2     | OUTLAW   | Calamity Janet | 4  | 4    |
      | 3     | OUTLAW   | Paul Regret    | 3  | 3    |
      | 4     | RENEGADE | Willy le Kid   | 4  | 4    |

  Scénario: Le Shérif joue en premier, en phase de pioche
    Quand une partie locale est distribuée
    Alors c'est à la place 1 de jouer, en phase DRAW

  Scénario: Le onzième tour recycle la défausse entre les deux cartes
    Étant donné une partie locale ayant terminé dix tours sans mélange
    Et il reste une carte en pioche et vingt en défausse
    Quand le joueur actif pioche au onzième tour
    Alors il reçoit la dernière carte puis la première carte recyclée
    Et les trente-sept cartes sont toutes conservées une seule fois

  Scénario: Piocher donne deux cartes et ouvre la phase de jeu
    Étant donné une partie locale distribuée
    Quand le joueur actif pioche
    Alors il a 7 cartes en main et la phase est PLAY

  Scénario: Finir son tour avec trop de cartes ouvre la défausse
    Étant donné une partie locale distribuée
    Et le joueur actif a pioché
    Quand il finit son tour
    Alors la phase est DISCARD et c'est toujours à la place 1 de jouer

  Scénario: Défausser jusqu'à ses PV puis finir passe la main au joueur suivant
    Étant donné une partie locale distribuée
    Et le joueur actif a pioché puis ouvert la défausse
    Quand il défausse 2 cartes puis finit son tour
    Alors c'est à la place 2 de jouer, en phase DRAW

  Scénario: Finir son tour sans piocher est refusé
    Étant donné une partie locale distribuée
    Quand le joueur actif finit son tour
    Alors le tour est refusé avec "Pioche d'abord tes deux cartes."

  Scénario: Sans compte, la partie démarre tout de suite et je pioche
    Quand j'ouvre le jeu sans être connecté
    Alors le plateau m'indique "À toi de jouer : pioche tes deux cartes."
    Et après avoir pioché, le plateau m'indique de jouer
