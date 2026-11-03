/* v8 ignore file -- rendu visuel (WebGL, shaders, géométries, canvas) : vérifié à l'écran, sans règle de jeu. Voir docs/games/mini-gta/regles.md § 6. */
import { MeshPhysicalMaterial } from 'three'

/**
 * Character surfaces, one material for the whole body (attribute aMat):
 * 0 skin (fake subsurface scattering), 1 cloth (weave + sheen), 2 leather, 3 hair, 4 eye white, 5 iris.
 */
export const characterMaterial = (() => {
  const m = new MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.6,
    metalness: 0,
    sheen: 0.6,
    sheenRoughness: 0.8,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
  })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aMat;\nvarying float vMat;\nvarying vec3 vRest;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat;\nvRest = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vMat;
        varying vec3 vRest;
        float chash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float cnoise(vec3 x) {
          vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(chash(i), chash(i + vec3(1,0,0)), f.x), mix(chash(i + vec3(0,1,0)), chash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(chash(i + vec3(0,0,1)), chash(i + vec3(1,0,1)), f.x), mix(chash(i + vec3(0,1,1)), chash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (vMat < 0.5) {
          // Skin: pores / blotches
          float n = cnoise(vRest * 90.0) * 0.5 + cnoise(vRest * 25.0) * 0.5;
          diffuseColor.rgb *= 0.93 + 0.1 * n;
        } else if (vMat < 1.5) {
          // Fabric weave
          float wv = sin(vRest.x * 900.0) * sin(vRest.y * 900.0);
          float n = cnoise(vRest * 60.0);
          diffuseColor.rgb *= 0.9 + 0.06 * wv + 0.08 * n;
        } else if (vMat > 2.5 && vMat < 3.5) {
          // Hair strands
          float st = cnoise(vec3(vRest.x * 400.0, vRest.y * 40.0, vRest.z * 400.0));
          diffuseColor.rgb *= 0.75 + 0.45 * st;
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = vMat < 0.5 ? 0.48 : vMat < 1.5 ? 0.88 : vMat < 2.5 ? 0.35 : vMat < 3.5 ? 0.45 : vMat < 4.5 ? 0.12 : 0.05;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        if (vMat > 0.5 && vMat < 1.5) {
          vec3 g = vec3(cnoise(vRest * 300.0), cnoise(vRest * 300.0 + 7.1), cnoise(vRest * 300.0 + 3.7)) - 0.5;
          normal = normalize(normal + g * 0.18);
        } else if (vMat < 0.5) {
          vec3 g = vec3(cnoise(vRest * 220.0), cnoise(vRest * 220.0 + 5.3), cnoise(vRest * 220.0 + 1.9)) - 0.5;
          normal = normalize(normal + g * 0.06);
        }`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
        material.sheenColor *= step(0.5, vMat) * step(vMat, 1.5);
        material.clearcoat *= step(3.5, vMat);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (vMat < 0.5) {
          // Fake subsurface scattering: warm, soft wrap + rim where light bleeds through thin skin.
          float rim = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 2.5);
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.4, 0.3) * (0.015 + 0.09 * rim);
        }`,
      )
  }
  m.customProgramCacheKey = () => 'characterSkinCloth'
  return m
})()
