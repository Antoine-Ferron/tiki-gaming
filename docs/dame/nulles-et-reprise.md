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

## Sauvegarde et reprise

Le nouveau port `GameSaveRepository` écrit une rencontre et son instantané dans une seule transaction PostgreSQL. La table privée `dame_game_saves` conserve le plateau, les compteurs, la version et l'empreinte du secret de reprise. La fonction `dame_save_game` verrouille la sauvegarde et compare la version précédente. Une écriture concurrente perdante reçoit un conflit ; la fermeture d'une rencontre et la sauvegarde de son plateau final sont atomiques.

Le serveur génère 256 bits aléatoires au démarrage d'une partie. Le cookie `DAME-RESUME` est `HttpOnly`, `SameSite=Strict`, limité au chemin de l'API Dames, `Secure` sous HTTPS et conservé 30 jours par le navigateur. Le secret ne figure ni dans la réponse JSON ni dans la base, qui ne contient que SHA-256. Le localStorage ne contient que l'UUID. Aucun compte, code à saisir ni changement du SDK commun n'est ajouté.

Après une fermeture du navigateur ou un redémarrage Java, le cookie permet de relire la sauvegarde. Les commandes restent protégées par CSRF. Une panne avant écriture conserve l'état précédent ; après une réponse perdue, l'interface demande une relecture au lieu de renvoyer automatiquement le coup. La base fait autorité, même si la session Java possède une ancienne vue.

La migration `20261106141000_dame_game_saves.sql` active RLS et refuse la lecture et l'écriture aux rôles `anon` et `authenticated`. Le rôle serveur lit la table et appelle la fonction atomique ; il ne peut pas modifier directement les sauvegardes. Les migrations doivent être appliquées avant de déployer ce code. Le retour à l'ancienne application ne sait pas reprendre ces plateaux : sauvegarder la base avant toute intervention de déploiement.

Le script `demo-backend.sh` garde volontairement une base jetable : l'arrêter détruit les données. La reprise après redémarrage Java suppose une base conservée, comme dans les tests d'intégration et un déploiement normal. Les parties antérieures à cette migration ne disposent pas de plateau récupérable. Effacer les données du navigateur fait perdre le droit de reprise ; changer d'appareil et purger les anciennes rencontres restent hors périmètre.

## Traçabilité

- RED répétition : `180561cd`, deux échecs métier observés avant implémentation.
- GREEN nulles : `959d2ee7`, 417 tests Dames au premier passage, puis ajout du test API de nulle ; 57 intégrations et 19 tests frontend passés.
- RED reprise : `394d556e`, deux échecs observés (absence de secret et absence d'écriture du coup ordinaire).

Les commandes ciblées `test` et `failsafe:verify` contrôlent les Dames. Un `mvn verify` lancé avec seulement trois classes de tests échouait légitimement aux seuils de couverture des classes partagées non exécutées ; ces seuils n'ont pas été modifiés. La vérification complète est lancée avec toutes les suites unitaires.

- GREEN reprise : `378b7ea0`. Vérification backend complète : **7 082 tests Surefire** et **73 intégrations Dames**, aucun échec ni test ignoré ; seuils JaCoCo et formatage respectés. Parmi les 7 082 tests, **447 concernent les Dames** à cette référence.
- Frontend : **2 422 tests**, couverture **93,50 % des lignes / 87,73 % des branches**, formatage, lint et build passés. Les **18 E2E Dames** passent sur Chromium, Firefox et WebKit ; Firefox a nécessité un profil macOS temporaire, sans modification des scénarios.
- `DameServerRestartIT` arrête un vrai serveur Spring et en démarre un nouveau sur la même base. Il vérifie le plateau identique via HTTP avec le seul cookie de reprise, puis le refus sans ce cookie.
- [Reprise navigateur réelle](preuves/2026-11-06-extensions/reprise-navigateur.json) : fermeture de Chromium, nouveau contexte sans JSESSIONID, plateau/version retrouvés et aucune création automatique. [Capture observée](preuves/2026-11-06-extensions/reprise-navigateur.png).

Les contrôles sont locaux ; aucune nouvelle CI de PR ni validation humaine n'est revendiquée. Le détail vérifiable figure dans les [preuves des extensions](preuves/2026-11-06-extensions/README.md).
