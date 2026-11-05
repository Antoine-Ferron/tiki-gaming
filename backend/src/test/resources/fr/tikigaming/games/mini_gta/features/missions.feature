# language: fr
Fonctionnalité: Récompenses des missions (R3)
  Pour être payé de mon travail sans pouvoir tricher
  En tant que joueur
  Je veux que chaque mission réussie me paie sa récompense, une seule fois

  Contexte:
    Soit une nouvelle partie

  Plan du scénario: Chaque mission paie sa récompense
    Quand il réussit la mission "<mission>"
    Alors la mission lui rapporte <récompense> $
    Et son solde est de <solde> $
    Et la mission "<mission>" est terminée

    Exemples:
      | mission | récompense | solde |
      | express | 800        | 1300  |
      | chase   | 1500       | 2000  |
      | port    | 2500       | 3000  |
      | special | 3000       | 3500  |

  Scénario: Une mission déjà terminée ne paie plus rien
    Étant donné qu'il a réussi la mission "express"
    Quand il réussit la mission "express"
    Alors la mission ne lui rapporte rien
    Et son solde est de 1300 $

  Scénario: Une mission inconnue est refusée
    Quand il réussit la mission "braquage"
    Alors la demande est refusée avec le code 404
