# Nulles automatiques et reprise durable

## Règles de nulle

Référence : [FMJD, annexe 1, article 6](https://www.fmjd.org/docs/Annex_1.pdf), consultée le 6 novembre 2026.

- Troisième occurrence d'une position, avec le même joueur au trait.
- 25 coups par joueur sans déplacement de pion ni prise.
- Finales de trois pièces comprenant une dame contre une dame seule : 16 coups par joueur. Une prise ne remet pas ce délai à zéro.
- Une ou deux pièces comprenant une dame contre une dame seule : cinq coups par joueur.

Les compteurs avancent après chaque coup complet, rafle comprise. Le coup qui crée une finale démarre son compteur ; une victoire au dernier coup autorisé reste prioritaire. L'historique distingue les couleurs et la promotion. Une prise ou un déplacement de pion efface les répétitions devenues impossibles et remet le compteur des 25 coups à zéro.

Une nulle termine la rencontre avec `DRAW`, une date de fin et aucun gagnant. L'interface désactive les coups et propose de rejouer. L'accord mutuel et l'arbitrage humain ne font pas partie de ces règles automatiques.

La migration additive `20261106140000_dame_draws.sql` étend les statuts acceptés sans modifier les migrations fusionnées. Les tests couvrent les frontières, la répétition, les remises à zéro, les finales, le refus de jouer après clôture et le stockage réel d'une nulle.
