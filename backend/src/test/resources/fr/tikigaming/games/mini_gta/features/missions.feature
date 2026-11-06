# language: fr
Fonctionnalité: Récompenses des missions (R3)
  En tant que joueur
  Je veux que chaque mission réussie me paie sa récompense, une seule fois
  Afin d'être payé de mon travail sans pouvoir tricher

  Contexte:
    Étant donné une nouvelle partie

  Plan du scénario: Chaque mission paie sa récompense
    Quand il réussit la mission "<mission>"
    Alors la mission lui rapporte <récompense> $
    Et son solde est de <solde> $
    Et la mission "<mission>" est terminée

    Exemples:
      | mission           | récompense | solde |
      | Colis express     | 800        | 1300  |
      | La fuite          | 1500       | 2000  |
      | Contrat au port   | 2500       | 3000  |
      | Commande spéciale | 3000       | 3500  |

  Scénario: Une mission déjà terminée ne paie plus rien
    Étant donné qu'il a réussi la mission "Colis express"
    Quand il réussit la mission "Colis express"
    Alors la mission ne lui rapporte rien
    Et son solde est de 1300 $

  Scénario: Une mission qui n'existe pas n'est jamais payée
    Quand il réussit la mission "Braquage de banque"
    Alors la mission est introuvable
    Et son solde est de 500 $
