import { GameIcon, type IconKey } from './GameIcon'
import { Modal } from './Modal'

// Légende des icônes affichées sur les cartes, chez les voisins et dans la cité.
const LEGEND: [IconKey[], string][] = [
  [['wood', 'stone', 'clay', 'ore'], 'Ressources naturelles : bois, pierre, argile, minerai'],
  [['glass', 'papyrus', 'textile'], 'Produits manufacturés : verre, papyrus, textile'],
  [['coin'], 'Pièces : ton trésor (1 point par tranche de 3 en fin de partie)'],
  [['laurel'], 'Points de victoire'],
  [['shield'], 'Bouclier : puissance militaire, comparée à chaque voisin en fin d’âge'],
  [['tablet', 'gear', 'compass'], 'Science : tablette, roue, compas'],
  [['chain'], 'Chaîne : la carte est gratuite si tu as déjà le bâtiment indiqué'],
  [['wonder'], 'Merveille : ton plateau et ses étapes'],
  [
    ['mountain', 'factory', 'column', 'shield', 'book', 'scales', 'crown'],
    'Catégorie de carte : ressource, manufacture, civil, militaire, science, commerce, guilde',
  ],
]

/** Règles de la version contre IA, expliquées pas à pas. Se ferme avec le bouton ou la touche Échap. */
export function RulesDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Règles du jeu" onClose={onClose}>
      <h3>Le but</h3>
      <p>
        Tu développes ta cité pendant <strong>3 âges de 6 tours</strong>. À la fin, celui qui a le plus de{' '}
        <strong>points de victoire</strong> gagne. Tu commences avec 3 pièces et un plateau merveille qui produit une
        ressource.
      </p>

      <h3>Les icônes</h3>
      <dl className="sdv-civilisation-legend">
        {LEGEND.map(([icons, meaning]) => (
          <div key={meaning}>
            <dt aria-hidden="true">
              {icons.map((k) => (
                <GameIcon key={k} k={k} size={20} />
              ))}
            </dt>
            <dd>{meaning}</dd>
          </div>
        ))}
      </dl>
      <p>
        Sur une carte : le <strong>bandeau</strong> donne sa catégorie (couleur + symbole), le <strong>centre</strong>{' '}
        son effet (2 bois = produit 2 bois par tour ; 5 + laurier = 5 points), le <strong>bas</strong> son coût. Quand
        tu choisis une carte, le panneau de droite détaille chaque ressource : <strong>verte</strong> si tu la produis,
        <strong> dorée</strong> si un voisin te la vend (2 pièces), <strong>rouge</strong> si elle manque.
      </p>

      <h3>Un tour, en 3 temps</h3>
      <ol>
        <li>
          <strong>Choisis une carte</strong> de ta main. Les IA choisissent en même temps que toi.
        </li>
        <li>
          <strong>Fais une seule action</strong> avec cette carte :
          <ul>
            <li>
              <strong>Construire le bâtiment</strong> : tu paies son coût, la carte rejoint ta cité et son effet
              s’applique.
            </li>
            <li>
              <strong>Bâtir une étape de ta merveille</strong> : tu paies le coût de l’étape (pas celui de la carte) ;
              la carte est posée face cachée et sert seulement de support.
            </li>
            <li>
              <strong>Défausser</strong> : tu gagnes 3 pièces, la carte va sur la défausse.
            </li>
          </ul>
        </li>
        <li>
          <strong>Les mains tournent</strong> : tu passes le reste de ta main à ton voisin (à gauche aux âges I et III,
          à droite à l’âge II). Au 6ᵉ tour, la dernière carte est défaussée.
        </li>
      </ol>

      <h3>Payer un coût</h3>
      <ul>
        <li>
          Tes cartes marron et grises et ton plateau <strong>produisent des ressources à chaque tour</strong> : elles ne
          s’épuisent pas.
        </li>
        <li>
          Il te manque une ressource ? Elle est <strong>achetée 2 pièces</strong> à un voisin qui la produit. Exemple :
          les Bains coûtent 1 pierre ; sans carrière, tu paies 2 pièces au voisin qui en a une.
        </li>
        <li>Tu ne construis jamais deux fois le même bâtiment.</li>
        <li>
          <strong>Chaîne</strong> : certaines cartes sont gratuites si tu as déjà construit le bâtiment indiqué (maillon
          de chaîne). Exemple : avec les Bains, l’Aqueduc ne coûte rien.
        </li>
      </ul>

      <h3>Fin d’âge : les conflits</h3>
      <p>
        Tu compares tes boucliers à ceux de <strong>chacun</strong> de tes deux voisins : plus de boucliers = +1, +3
        puis +5 points selon l’âge ; moins = −1 point ; autant = rien.
      </p>

      <h3>Le score final</h3>
      <ul>
        <li>Conflits gagnés et perdus.</li>
        <li>Trésor : 1 point par tranche de 3 pièces.</li>
        <li>Merveille : les points des étapes bâties.</li>
        <li>Bâtiments bleus : leurs points.</li>
        <li>
          Science : chaque symbole (tablette, roue, compas) compte son nombre au carré, plus 7 points par série des
          trois. Exemple : 2 roues + 1 compas + 1 tablette = 4 + 1 + 1 + 7 = 13.
        </li>
        <li>Guildes : 1 point par carte de la couleur indiquée chez tes voisins.</li>
      </ul>
      <p>À égalité, celui qui a le plus de pièces gagne ; sinon la victoire est partagée.</p>
    </Modal>
  )
}
