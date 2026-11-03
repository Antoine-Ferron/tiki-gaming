/* v8 ignore file -- rendu visuel (WebGL, shaders, géométries, canvas) : vérifié à l'écran, sans règle de jeu. Voir docs/games/mini-gta/regles.md § 6. */
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

/** Bloom (lights, explosions), ACES tone mapping, vignette; MSAA via the composer. */
export function PostFX() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.8} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.3} darkness={0.55} />
    </EffectComposer>
  )
}
