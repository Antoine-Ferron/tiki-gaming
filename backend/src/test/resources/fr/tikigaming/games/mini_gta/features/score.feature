# language: fr
Fonctionnalité: Score de la partie (R8)
  En tant que joueur
  Je veux que mon score compte tout l'argent gagné, sans être diminué par mes dépenses
  Afin de me comparer aux autres joueurs

  Contexte:
    Étant donné une nouvelle partie

  Scénario: Les dépenses ne font pas baisser le score
    Étant donné qu'il a réussi la mission "Commande spéciale"
    Et qu'il a acheté l'arme "fusil à pompe"
    Quand il meurt
    Alors son solde est de 2070 $
    Et son score est de 3000 $

  Scénario: Une mission rejouée ne compte qu'une fois dans le score
    Étant donné qu'il a réussi les missions "Colis express" et "La fuite"
    Quand il réussit la mission "Colis express"
    Alors son score est de 2300 $
