import {
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three'

/**
 * Surface kinds baked per vertex (attribute aKind) so a whole vehicle body is one draw call:
 * 0 = car paint (clearcoat + metallic flakes), 1 = plastic trim, 2 = chrome, 3 = rubber, 4 = interior fabric, 5 = brushed metal.
 */
export const enum Surface {
  Paint = 0,
  Trim = 1,
  Chrome = 2,
  Rubber = 3,
  Fabric = 4,
  Metal = 5,
}

/** Dynamic city reflections (cube map), shared by every vehicle material. */
export const vehicleEnv: { texture: Texture | null } = { texture: null }
const materials = new Set<MeshStandardMaterial>()

export function setVehicleEnvMap(tex: Texture) {
  vehicleEnv.texture = tex
  for (const m of materials) {
    m.envMap = tex
    m.needsUpdate = true
  }
}

const HASH = /* glsl */ `
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}`

function surfaceShader(shader: WebGLProgramParametersWithUniforms, physical: boolean) {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\nattribute float aKind;\nvarying float vKind;\nvarying vec3 vObjPos;',
    )
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKind = aKind;\nvObjPos = position;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\nvarying float vKind;\nvarying vec3 vObjPos;\n${HASH}`)
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      if (vKind > 0.5) diffuseColor.rgb = vColor.rgb;`,
    )
    .replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      roughnessFactor = vKind < 0.5 ? roughnessFactor : vKind < 1.5 ? 0.55 : vKind < 2.5 ? 0.05 : vKind < 3.5 ? 0.93 : vKind < 4.5 ? 0.9 : 0.32;`,
    )
    .replace(
      '#include <metalnessmap_fragment>',
      `#include <metalnessmap_fragment>
      metalnessFactor = vKind < 0.5 ? metalnessFactor : vKind < 1.5 ? 0.0 : vKind < 2.5 ? 1.0 : vKind < 4.5 ? 0.0 : 0.9;`,
    )
    .replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      if (vKind < 0.5) {
        // Metallic flakes: tiny randomly oriented facets under the clear coat.
        vec3 f = hash33(floor(vObjPos * 900.0)) - 0.5;
        normal = normalize(normal + f * 0.05);
      } else if (vKind > 2.5 && vKind < 3.5) {
        // Tyre sidewall / tread grain
        vec3 f = hash33(floor(vObjPos * 160.0)) - 0.5;
        normal = normalize(normal + f * 0.08);
      }`,
    )
  if (physical) {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_physical_fragment>',
      `#include <lights_physical_fragment>
      material.clearcoat *= step(vKind, 0.5);`,
    )
  }
}

/** Car paint: clear-coated metallic paint + trims, chrome, rubber, fabric in the same mesh. */
export function paintMaterial(color: Color, metallic = 0.45) {
  const m = new MeshPhysicalMaterial({
    color,
    vertexColors: true,
    metalness: metallic,
    roughness: 0.36,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    envMap: vehicleEnv.texture,
    envMapIntensity: 1.25,
  })
  m.onBeforeCompile = (s) => surfaceShader(s, true)
  m.customProgramCacheKey = () => 'vehiclePaint'
  materials.add(m)
  return m
}

export function disposePaint(m: MeshStandardMaterial) {
  materials.delete(m)
  m.dispose()
}

/** Wheels: rubber + chrome/painted rims via aKind. */
export const wheelMaterial = (() => {
  const m = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    envMap: vehicleEnv.texture,
    envMapIntensity: 1.2,
  })
  m.onBeforeCompile = (s) => surfaceShader(s, false)
  m.customProgramCacheKey = () => 'vehicleWheel'
  materials.add(m)
  return m
})()

/** Tinted, highly reflective glass (slightly see-through so the interior and driver show). */
export const vehicleGlassMaterial = (() => {
  const m = new MeshPhysicalMaterial({
    color: new Color(0.02, 0.025, 0.03),
    metalness: 0.1,
    roughness: 0.02,
    transparent: true,
    opacity: 0.72,
    envMap: vehicleEnv.texture,
    envMapIntensity: 1.1,
    clearcoat: 1,
    clearcoatRoughness: 0,
    depthWrite: false,
  })
  materials.add(m)
  return m
})()

export const burntMaterial = new MeshStandardMaterial({ color: new Color(0.05, 0.045, 0.04), roughness: 0.95 })
