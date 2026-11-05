# language: fr
Fonctionnalité: Score de la partie (R8)
  Pour me comparer aux autres joueurs
  En tant que joueur
  Je veux que mon score compte tout l'argent gagné, sans être diminué par mes dépenses

  Scénario: Les gains font monter le score, les dépenses ne le font pas baisser
    Soit une nouvelle partie
    Quand il réussit la mission "special"
    Et il achète l'arme "shotgun"
    Et il meurt
    Alors son solde est de 2070 $
    Et son score est de 3000 $

  Scénario: Les missions s'additionnent dans le score
    Soit une nouvelle partie
    Quand il réussit la mission "express"
    Et il réussit la mission "chase"
    Et il réussit la mission "express"
    Alors son score est de 2300 $
