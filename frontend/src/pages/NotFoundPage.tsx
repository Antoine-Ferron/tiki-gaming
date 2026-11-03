import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="card">
      <h1>Page introuvable</h1>
      <p>
        <Link to="/">Retour à l'accueil</Link>
      </p>
    </div>
  )
}
