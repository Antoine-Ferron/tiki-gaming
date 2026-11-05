# language: fr
# Écrit AVANT le service (double boucle BDD → TDD) : rouge tant que EchecsService n'existait pas, marqué @en-cours
# pendant la boucle interne TDD, puis tag retiré une fois le service prêt (voir docs/etapes/22).
@echecs @jouer
Fonctionnalité: Jouer un coup
  En tant que joueur d'échecs
  Je veux jouer un coup et obtenir la position qui en résulte
  Afin de mener une partie qui respecte les règles

  Scénario: Ouverture 1.e4 : le pion avance de deux cases et c'est aux Noirs de jouer
    Étant donné la position de départ
    Quand je joue de "e2" vers "e4"
    Alors la position est "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"

  Scénario: Une courte partie : 1.e4 e5 2.Cf3
    Étant donné la position de départ
    Quand je joue de "e2" vers "e4"
    Et je joue de "e7" vers "e5"
    Et je joue de "g1" vers "f3"
    Alors la position est "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2"

  Scénario: Un coup interdit est refusé et la position ne change pas
    Étant donné la position de départ
    Quand je joue de "e2" vers "e5"
    Alors le coup est refusé
    Et la position est "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

  Scénario: Les Noirs ne peuvent pas jouer en premier
    Étant donné la position de départ
    Quand je joue de "e7" vers "e5"
    Alors le coup est refusé

  Scénario: Le mat du lion : la partie se termine par un échec et mat
    Étant donné la position de départ
    Quand je joue de "f2" vers "f3"
    Et je joue de "e7" vers "e5"
    Et je joue de "g2" vers "g4"
    Et je joue de "d8" vers "h4"
    Alors la partie est terminée par "CHECKMATE"

  Scénario: Le petit roque déplace le roi et la tour
    Étant donné une partie arrivée à la position "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1"
    Quand je joue de "e1" vers "g1"
    Alors la position est "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R4RK1 b kq - 1 1"
