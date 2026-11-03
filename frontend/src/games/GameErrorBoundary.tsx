import { Component, Fragment, type ReactNode } from 'react'
import { logger } from '@/lib/logger'
import { isChunkLoadError } from './errors'

type Props = { gameSlug: string; children: ReactNode }
type State = { error: Error | null; attempt: number }

/**
 * Isole chaque jeu : une exception dans son rendu n'emporte pas le reste du lobby.
 * « Relancer le jeu » remonte le composant (nouvel état) ; si c'est son code qui n'a pas pu être
 * téléchargé, seul un rechargement de la page aide.
 */
export class GameErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error) {
    logger.error({ err: error, gameSlug: this.props.gameSlug }, 'Le jeu a planté')
  }

  private retry = () => this.setState(({ attempt }) => ({ error: null, attempt: attempt + 1 }))

  render() {
    const { error, attempt } = this.state
    if (!error) return <Fragment key={attempt}>{this.props.children}</Fragment>

    const chunk = isChunkLoadError(error)
    return (
      <div className="card game-crash" role="alert">
        <h2>{chunk ? 'Le jeu n’a pas pu être chargé' : 'Le jeu a rencontré un problème'}</h2>
        <p className="muted">
          {chunk
            ? 'Vérifie ta connexion, puis recharge la page.'
            : 'Le reste du site fonctionne toujours. Tu peux relancer le jeu ou revenir aux autres jeux.'}
        </p>
        {chunk ? (
          <button onClick={() => window.location.reload()}>Recharger la page</button>
        ) : (
          <button onClick={this.retry}>Relancer le jeu</button>
        )}
      </div>
    )
  }
}
