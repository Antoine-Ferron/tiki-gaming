import {
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  type WebGLProgramParametersWithUniforms,
} from 'three'

/** Uniforms shared by every procedural material (updated by day/night and weather systems). */
export const sharedUniforms = {
  uTime: { value: 0 },
  /** 0 = day, 1 = full night. */
  uNight: { value: 0 },
  /** 0 = dry, 1 = soaked. */
  uWet: { value: 0 },
}

const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
`

interface Patch {
  key: string
  vertexHeader?: string
  vertexMain?: string
  fragmentHeader?: string
  /** After diffuseColor is computed (vertex colors applied). */
  color?: string
  roughness?: string
  metalness?: string
  normal?: string
  emissive?: string
}

/** Inject GLSL into a MeshStandardMaterial without forking the whole shader. */
function patch<T extends MeshStandardMaterial>(material: T, p: Patch): T {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, sharedUniforms)
    const header = `uniform float uTime;\nuniform float uNight;\nuniform float uWet;\n${NOISE_GLSL}\n`
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${header}\nvarying vec3 vWorldPos;\n${p.vertexHeader ?? ''}`)
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          vWorldPos = (modelMatrix * wp).xyz;
        }
        ${p.vertexMain ?? ''}`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${header}\nvarying vec3 vWorldPos;\n${p.fragmentHeader ?? ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${p.color ?? ''}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${p.roughness ?? ''}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${p.metalness ?? ''}`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>\n${p.normal ?? ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${p.emissive ?? ''}`)
  }
  material.customProgramCacheKey = () => p.key
  return material
}

function std(params: MeshStandardMaterialParameters) {
  return new MeshStandardMaterial(params)
}

/**
 * Building facades. Attributes:
 *  - aUvM (vec2): facade coordinates in meters (u along the wall, v up)
 *  - aInfo (vec2): x = style, y = per-building seed. Styles:
 *    0..5 walls with windows (FacadeStyle), -1 flat roof, -2 plain trim (cornice, plinth, parapet),
 *    -3 tiled roof (u along ridge, v along slope), -4 awning fabric, -5 door, -6 metal railing.
 * Windows use interior mapping: a fake room is ray-traced behind each pane.
 */
export const facadeMaterial = patch(std({ vertexColors: true, roughness: 0.85, metalness: 0 }), {
  key: 'facade',
  vertexHeader:
    'attribute vec2 aUvM;\nattribute vec2 aInfo;\nvarying vec2 vUvM;\nvarying vec2 vInfo;\nvarying vec3 vWN;',
  vertexMain: 'vUvM = aUvM; vInfo = aInfo; vWN = normalize(mat3(modelMatrix) * objectNormal);',
  fragmentHeader: /* glsl */ `
    varying vec2 vUvM; varying vec2 vInfo; varying vec3 vWN;
    vec3 gEmit; vec3 gNrm; float gRough; float gMetal;
    void tangentFrame(out vec3 T, out vec3 B) {
      vec3 q0 = dFdx(vWorldPos); vec3 q1 = dFdy(vWorldPos);
      vec2 st0 = dFdx(vUvM); vec2 st1 = dFdy(vUvM);
      vec3 N = normalize(vWN);
      vec3 q1perp = cross(q1, N); vec3 q0perp = cross(N, q0);
      T = q1perp * st0.x + q0perp * st1.x;
      B = q1perp * st0.y + q0perp * st1.y;
      float det = max(dot(T, T), dot(B, B));
      float sc = det == 0.0 ? 0.0 : inversesqrt(det);
      T *= sc; B *= sc;
    }
    // Ray-traced fake room behind a window. f = position in the room cell (0..1), returns color.
    vec3 roomInterior(vec2 f, vec2 id, float seed, vec2 cell, float office, vec3 T, vec3 B, out float lit) {
      vec3 V = normalize(vWorldPos - cameraPosition);
      vec3 N = normalize(vWN);
      float depth = mix(1.0, 1.5, office);
      vec3 d = vec3(dot(V, T) / cell.x, dot(V, B) / cell.y, max(1e-3, dot(V, -N)) / (cell.x * depth));
      d.x = abs(d.x) < 1e-4 ? 1e-4 : d.x;
      d.y = abs(d.y) < 1e-4 ? 1e-4 : d.y;
      vec3 o = vec3(f, 0.0);
      vec3 tp = (step(vec3(0.0), d) - o) / d;
      float t = min(min(tp.x, tp.y), tp.z);
      vec3 h = o + d * t;
      float r = hash12(id + seed * 17.3);
      float r2 = hash12(id * 1.7 + seed * 5.1);
      vec3 wall = office > 0.5 ? vec3(0.8, 0.8, 0.78) : mix(vec3(0.85, 0.78, 0.66), vec3(0.6, 0.68, 0.74), r2);
      vec3 floorC = office > 0.5 ? vec3(0.3, 0.31, 0.34) : mix(vec3(0.4, 0.26, 0.15), vec3(0.58, 0.45, 0.32), r);
      vec3 col;
      if (t == tp.z) {
        col = wall * 0.85;
        if (h.y < 0.36 && abs(h.x - 0.5) < 0.22 + 0.15 * r) col = office > 0.5 ? vec3(0.14, 0.14, 0.16) : mix(vec3(0.32, 0.16, 0.1), vec3(0.18, 0.24, 0.34), r2);
        if (office < 0.5 && h.y > 0.5 && h.y < 0.78 && abs(h.x - (0.25 + 0.5 * r)) < 0.09) col = mix(vec3(0.7, 0.55, 0.3), vec3(0.3, 0.45, 0.6), r2);
        if (office > 0.5 && h.y < 0.3 && fract(h.x * 3.0) < 0.12) col = vec3(0.1);
      } else if (t == tp.x) {
        col = wall * 0.68;
        if (h.y < 0.4 && h.z > 0.3 && h.z < 0.8 && r > 0.5) col = vec3(0.35, 0.25, 0.18);
      } else if (d.y < 0.0) {
        col = floorC;
        if (office < 0.5) col *= 0.85 + 0.15 * step(0.5, fract(h.x * 6.0 + step(0.5, fract(h.z * 3.0)) * 0.5));
      } else {
        col = vec3(0.82);
        if (office > 0.5 && fract(h.x * 2.0 + 0.25) < 0.5 && fract(h.z * 2.5) < 0.35) col = vec3(3.0, 2.9, 2.7);
      }
      col *= 0.5 + 0.5 * (1.0 - h.z * 0.75);
      lit = step(office > 0.5 ? 0.3 : 0.55, hash12(id * 1.3 + seed * 13.1));
      return col;
    }`,
  color: /* glsl */ `
    float style = vInfo.x;
    float seed = vInfo.y;
    vec3 base = diffuseColor.rgb;
    vec3 col = base;
    gEmit = vec3(0.0); gNrm = vec3(0.0); gRough = 0.85; gMetal = 0.0;
    vec3 T = vec3(1.0, 0.0, 0.0); vec3 B = vec3(0.0, 1.0, 0.0);
    float day = 1.0 - uNight;
    if (style > -0.5) {
      tangentFrame(T, B);
      vec2 uv = vUvM;
      vec2 cell = vec2(3.0, 3.5); float mx = 0.5; float myb = 0.9; float myt = 0.45; float fw = 0.07;
      vec3 frameC = vec3(0.12); float sillH = 0.0; float office = 0.0; float shopGround = 0.0;
      if (style < 0.5) { cell = vec2(1.5, 3.6); office = 1.0; }
      else if (style < 1.5) { cell = vec2(3.0, 3.6); mx = 0.45; myb = 0.85; myt = 0.45; frameC = vec3(0.1); office = 1.0; shopGround = 1.0; }
      else if (style < 2.5) { cell = vec2(2.6, 3.1); mx = 0.72; myb = 0.85; myt = 0.42; frameC = vec3(0.88, 0.87, 0.84); sillH = 0.09; }
      else if (style < 3.5) { cell = vec2(3.4, 2.8); mx = 0.95; myb = 0.85; myt = 0.5; frameC = vec3(0.95); sillH = 0.07; }
      else if (style < 4.5) { cell = vec2(5.0, 3.0); mx = 0.6; myb = 0.9; myt = 0.9; frameC = vec3(0.3); }
      else { cell = vec2(3.2, 3.5); mx = 0.45; myb = 0.9; myt = 0.45; frameC = vec3(0.18); shopGround = 1.0; }
      vec2 g = uv / cell; vec2 id = floor(g); vec2 lp = (g - id) * cell;
      bool ground = id.y < 0.5;
      vec2 w0 = vec2(mx, myb); vec2 w1 = cell - vec2(mx, myt);
      if (ground && shopGround > 0.5) { w0 = vec2(0.12, 0.35); w1 = vec2(cell.x - 0.12, cell.y - 0.55); }
      float inside = step(w0.x, lp.x) * step(lp.x, w1.x) * step(w0.y, lp.y) * step(lp.y, w1.y);
      vec2 dE = min(lp - w0, w1 - lp);
      float edge = min(dE.x, dE.y);
      float frame = inside * (1.0 - step(fw, edge));
      if (style > 1.5 && style < 3.5) frame = max(frame, inside * (1.0 - step(0.035, abs(lp.x - (w0.x + w1.x) * 0.5))));
      if (style > 1.5 && style < 2.5) frame = max(frame, inside * (1.0 - step(0.03, abs(lp.y - mix(w0.y, w1.y, 0.62)))));
      float sill = sillH > 0.0 ? step(w0.x - 0.08, lp.x) * step(lp.x, w1.x + 0.08) * step(w0.y - sillH, lp.y) * step(lp.y, w0.y) : 0.0;
      if (style > 2.5 && style < 3.5 && id.y > 1.5) { inside = 0.0; frame = 0.0; sill = 0.0; }
      if (style > 3.5 && style < 4.5 && !(id.y > 0.5 && id.y < 1.5)) { inside = 0.0; frame = 0.0; }
      float glass = inside * (1.0 - frame);

      // --- Wall material
      vec3 wallC = base;
      if (style < 0.5) {
        // Curtain wall: mullions and spandrel panels, glass everywhere else.
        float mull = 1.0 - step(0.05, min(lp.x, cell.x - lp.x));
        float tran = 1.0 - step(0.05, min(lp.y, cell.y - lp.y));
        float spandrel = step(lp.y, 0.85);
        glass = (1.0 - max(mull, tran)) * (1.0 - spandrel);
        frame = max(mull, tran);
        frameC = base * 0.9 + 0.1;
        wallC = base * 0.45;
        gMetal = 0.6;
      } else if (style < 1.5) {
        // Precast concrete panels with rain streaks.
        float pl = max(1.0 - step(0.025, abs(fract(uv.x / 1.5) - 0.5) * 1.5 - 0.725), 1.0 - step(0.03, lp.y));
        float streak = vnoise(vec2(uv.x * 3.0, uv.y * 0.15 + seed * 9.0));
        wallC = base * (0.92 + 0.12 * vnoise(uv * 1.5)) * (1.0 - 0.18 * pl) * (0.9 + 0.1 * streak);
      } else if (style < 2.5) {
        // Running-bond brick with mortar joints.
        float row = floor(uv.y / 0.075);
        float bx = fract((uv.x + mod(row, 2.0) * 0.12) / 0.24);
        float by = fract(uv.y / 0.075);
        float mortar = 1.0 - step(0.045, bx) * step(bx, 0.955) * step(0.13, by);
        float bh = hash12(vec2(floor((uv.x + mod(row, 2.0) * 0.12) / 0.24), row) + seed);
        // Fade sub-pixel detail with distance (no moiré).
        float aa = clamp(fwidth(uv.y / 0.075) * 1.6 - 0.3, 0.0, 1.0);
        vec3 brick = base * (0.78 + 0.35 * mix(bh, 0.5, aa));
        wallC = mix(brick, vec3(0.62, 0.6, 0.56), mix(mortar, 0.17, aa));
        gNrm += (B * (by < 0.13 ? 0.35 : 0.0) - T * (bx < 0.045 ? 0.3 : 0.0)) * (1.0 - aa);
        gRough = 0.9;
      } else if (style < 3.5) {
        if (fract(seed * 7.13) > 0.45) {
          // Clapboard siding
          float bd = fract(uv.y / 0.19);
          float aa = clamp(fwidth(uv.y / 0.19) * 1.6 - 0.3, 0.0, 1.0);
          bd = mix(bd, 0.5, aa);
          wallC = base * (0.82 + 0.22 * bd);
          gNrm += B * (bd - 0.5) * 0.7;
          gRough = 0.7;
        } else {
          wallC = base * (0.9 + 0.12 * vnoise(uv * 6.0) + 0.05 * vnoise(uv * 40.0));
        }
      } else if (style < 4.5) {
        // Corrugated metal
        float c = sin(uv.x * 6.2831 / 0.16) * (1.0 - clamp(fwidth(uv.x / 0.16) * 2.0 - 0.3, 0.0, 1.0));
        wallC = base * (0.85 + 0.12 * c) * (0.85 + 0.2 * vnoise(vec2(uv.x * 0.3, uv.y * 2.0)));
        gNrm += T * c * 0.35;
        gMetal = 0.55; gRough = 0.5;
        // Roll-up doors on the ground floor
        float door = (ground && mod(id.x, 3.0) == 1.0) ? step(0.4, lp.x) * step(lp.x, cell.x - 0.4) * step(lp.y, 3.0) : 0.0;
        wallC = mix(wallC, vec3(0.55, 0.56, 0.55) * (0.85 + 0.15 * step(0.5, fract(lp.y / 0.12))), door);
      } else {
        wallC = base * (0.92 + 0.1 * vnoise(uv * 5.0));
      }
      // Ambient occlusion around openings + grime at street level.
      vec2 dOut = max(w0 - lp, lp - w1);
      float near = max(dOut.x, dOut.y);
      float ao = inside > 0.5 ? 1.0 : mix(0.72, 1.0, smoothstep(0.0, 0.18, near));
      if (style < 0.5) ao = 1.0;
      wallC *= ao * (0.78 + 0.22 * smoothstep(0.0, 1.6, uv.y));
      col = mix(wallC, frameC, frame);
      col = mix(col, vec3(0.8, 0.79, 0.76), sill);
      if (sill > 0.5) gNrm += B * 0.5;
      if (frame > 0.5) { gRough = 0.4; gMetal = style < 1.5 ? 0.7 : 0.0; }

      // --- Glass with interior
      if (glass > 0.5) {
        vec2 rcell = style < 0.5 ? vec2(4.5, 3.6) : cell;
        vec2 rid = floor(uv / rcell);
        vec2 rf = fract(uv / rcell);
        float lit;
        vec3 room = roomInterior(rf, rid, seed, rcell, office, T, B, lit);
        float r3 = hash12(rid * 2.3 + seed * 3.7);
        vec2 wf = (lp - w0) / max(w1 - w0, vec2(0.01));
        bool shop = ground && shopGround > 0.5;
        if (!shop && office < 0.5) {
          if (r3 > 0.7 && (wf.x < 0.2 || wf.x > 0.8)) room = mix(vec3(0.75, 0.68, 0.55), vec3(0.45, 0.2, 0.18), hash12(rid + 9.0)) * (0.8 + 0.2 * sin(wf.x * 60.0));
          if (r3 > 0.55 && r3 < 0.7 && wf.y > 0.55) room = vec3(0.82) * (0.75 + 0.25 * step(0.5, fract(wf.y * 14.0)));
        }
        if (office > 0.5 && r3 > 0.75 && wf.y > 0.7) room = vec3(0.7) * (0.8 + 0.2 * step(0.5, fract(wf.y * 20.0)));
        float lightOn = shop ? 1.0 : lit;
        vec3 warm = mix(vec3(1.0, 0.82, 0.6), vec3(0.85, 0.92, 1.0), office);
        gEmit = room * (day * (shop ? 0.6 : 0.3) + uNight * lightOn * 1.5 * warm + uNight * 0.02);
        col = style < 0.5 ? base * 0.12 + 0.01 : vec3(0.025, 0.03, 0.035);
        gRough = 0.04;
        gMetal = style < 0.5 ? 0.35 : 0.1;
      }
      col = mix(col, col * 0.6, uWet * (1.0 - glass) * 0.5);
    } else if (style > -1.5) {
      // Flat roof: gravel, tar seams, stains
      float n = vnoise(vWorldPos.xz * 0.8) * 0.5 + vnoise(vWorldPos.xz * 6.0) * 0.5;
      float seam = 1.0 - step(0.04, abs(fract(vWorldPos.x / 4.0) - 0.5) * 2.0 - 0.92);
      col = base * (0.75 + 0.35 * n) * (1.0 - 0.3 * seam);
      gRough = 0.95;
    } else if (style > -2.5) {
      col = base * (0.92 + 0.12 * vnoise(vWorldPos.xz * 3.0 + vWorldPos.y));
      gRough = 0.8;
    } else if (style > -3.5) {
      // Clay / slate roof tiles
      tangentFrame(T, B);
      float row = floor(vUvM.y / 0.28);
      float tu = fract((vUvM.x + row * 0.14) / 0.3);
      float tv = mix(fract(vUvM.y / 0.28), 0.6, clamp(fwidth(vUvM.y / 0.28) * 1.6 - 0.3, 0.0, 1.0));
      float th = hash12(vec2(floor((vUvM.x + row * 0.14) / 0.3), row) + seed);
      col = base * (0.75 + 0.3 * th) * (0.7 + 0.3 * smoothstep(0.0, 0.9, tv)) * (1.0 - 0.25 * (1.0 - step(0.04, tu)));
      gNrm += B * (tv - 0.5) * 0.8;
      gRough = 0.6 - 0.3 * uWet;
    } else if (style > -4.5) {
      // Awning fabric stripes
      col = mix(base, vec3(0.92), step(0.5, fract(vUvM.x / 0.45)));
      gRough = 0.9;
    } else if (style > -5.5) {
      // Wooden door with panels
      vec2 duv = fract(vec2(vUvM.x / 1.1, vUvM.y / 2.4));
      float panel = step(0.12, duv.x) * step(duv.x, 0.88) * (step(0.1, duv.y) * step(duv.y, 0.45) + step(0.55, duv.y) * step(duv.y, 0.9));
      col = base * (0.8 + 0.25 * vnoise(vec2(vUvM.x * 30.0, vUvM.y * 2.0))) * (1.0 - 0.2 * panel);
      gRough = 0.5;
    } else if (style > -6.5) {
      col = base;
      gMetal = 0.7; gRough = 0.35;
    } else {
      // Sectional garage door
      float rib = fract(vUvM.y / 0.5);
      col = base * (0.85 + 0.15 * smoothstep(0.0, 0.15, rib));
      tangentFrame(T, B);
      gNrm += B * (rib < 0.1 ? 0.5 : 0.0);
      gRough = 0.45;
    }
    diffuseColor.rgb = col;
  `,
  roughness: 'roughnessFactor = gRough * mix(1.0, 0.6, uWet);',
  metalness: 'metalnessFactor = gMetal;',
  normal: 'if (dot(gNrm, gNrm) > 0.0) normal = normalize(normal + (viewMatrix * vec4(gNrm, 0.0)).xyz * 0.6);',
  emissive: 'totalEmissiveRadiance += gEmit;',
})

/**
 * Road surface. Attributes:
 *  - aUvM (vec2): x = across (meters, 0 = centerline), y = along (meters)
 *  - aInfo (vec4): x = lanes per direction (0 = intersection), y = lane width sum, z = crosswalk start, w = crosswalk end
 */
export const roadMaterial = patch(
  std({
    color: new Color(0.11, 0.11, 0.12),
    roughness: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  }),
  {
    key: 'road',
    vertexHeader: 'attribute vec2 aUvM;\nattribute vec4 aInfo;\nvarying vec2 vUvM;\nvarying vec4 vInfo;',
    vertexMain: 'vUvM = aUvM; vInfo = aInfo;',
    fragmentHeader: 'varying vec2 vUvM;\nvarying vec4 vInfo;\nfloat gMark; float gPuddle;',
    color: /* glsl */ `
      float u = vUvM.x; float v = vUvM.y;
      float lanes = vInfo.x; float edgeU = vInfo.y;
      float n = vnoise(vWorldPos.xz * 0.35) * 0.6 + vnoise(vWorldPos.xz * 3.0) * 0.4;
      vec3 col = diffuseColor.rgb * (0.85 + 0.3 * n);
      gMark = 0.0;
      vec3 markCol = vec3(0.85);
      if (lanes > 0.5) {
        float au = abs(u);
        float edge = step(abs(au - edgeU), 0.07);
        float center;
        if (lanes > 1.5) {
          center = step(abs(au - 0.17), 0.065);
          if (center > 0.5) markCol = vec3(0.85, 0.65, 0.1);
          float sep = step(abs(au - edgeU * 0.5), 0.06) * step(fract(v / 9.0), 0.5);
          center = max(center, sep);
        } else {
          center = step(au, 0.07) * step(fract(v / 9.0), 0.55);
        }
        gMark = max(edge, center);
        if (v < vInfo.z || v > vInfo.w) {
          gMark = step(0.5, fract(u / 1.1)) * step(au, edgeU - 0.3);
          markCol = vec3(0.9);
        }
      }
      float wear = 0.75 + 0.25 * vnoise(vWorldPos.xz * 1.7);
      col = mix(col, markCol * wear, gMark);
      gPuddle = uWet * smoothstep(0.55, 0.7, vnoise(vWorldPos.xz * 0.12 + 11.0));
      col *= 1.0 - 0.35 * uWet;
      diffuseColor.rgb = col;
    `,
    roughness:
      'roughnessFactor = mix(roughnessFactor * mix(1.0, 0.45, uWet), 0.04, gPuddle); roughnessFactor = mix(roughnessFactor, 0.6, gMark * (1.0 - uWet));',
    metalness: 'metalnessFactor += gPuddle * 0.25;',
  },
)

/** Sidewalks, slabs, plazas: vertex color + paving tiles on top faces. */
export const pavementMaterial = patch(std({ vertexColors: true, roughness: 0.88 }), {
  key: 'pavement',
  vertexHeader: 'varying float vUp;',
  vertexMain: 'vUp = normal.y;',
  fragmentHeader: 'varying float vUp;',
  color: /* glsl */ `
    if (vUp > 0.5) {
      vec2 t = fract(vWorldPos.xz / 1.5);
      float joint = max(step(t.x, 0.03), step(t.y, 0.03));
      float n = vnoise(vWorldPos.xz * 0.9);
      diffuseColor.rgb *= (0.9 + 0.15 * n) * (1.0 - 0.18 * joint);
    }
    diffuseColor.rgb *= 1.0 - 0.25 * uWet;
  `,
  roughness: 'roughnessFactor *= mix(1.0, 0.5, uWet);',
})

/** Terrain and lawns: vertex color + noise variation. */
export const terrainMaterial = patch(std({ vertexColors: true, roughness: 0.95 }), {
  key: 'terrain',
  color: /* glsl */ `
    float n = vnoise(vWorldPos.xz * 0.08) * 0.5 + vnoise(vWorldPos.xz * 0.7) * 0.3 + vnoise(vWorldPos.xz * 4.0) * 0.2;
    diffuseColor.rgb *= 0.75 + 0.45 * n;
    diffuseColor.rgb *= 1.0 - 0.2 * uWet;
  `,
  roughness: 'roughnessFactor *= mix(1.0, 0.7, uWet);',
})

/** Sea: animated normals, low roughness. */
export const waterMaterial = patch(
  std({ color: new Color(0.02, 0.1, 0.13), roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.92 }),
  {
    key: 'water',
    normal: /* glsl */ `
      {
        vec2 p = vWorldPos.xz;
        float t = uTime;
        float e = 0.6;
        float h0 = vnoise(p * 0.15 + vec2(t * 0.12, t * 0.08)) + 0.5 * vnoise(p * 0.5 - vec2(t * 0.2, 0.0));
        float hx = vnoise((p + vec2(e, 0.0)) * 0.15 + vec2(t * 0.12, t * 0.08)) + 0.5 * vnoise((p + vec2(e, 0.0)) * 0.5 - vec2(t * 0.2, 0.0));
        float hz = vnoise((p + vec2(0.0, e)) * 0.15 + vec2(t * 0.12, t * 0.08)) + 0.5 * vnoise((p + vec2(0.0, e)) * 0.5 - vec2(t * 0.2, 0.0));
        vec3 wn = normalize(vec3(-(hx - h0) * 1.6, 1.0, -(hz - h0) * 1.6));
        normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
      }
    `,
  },
)

/** Generic vertex-colored PBR for procedural props, characters, interiors. */
export const propMaterial = std({ vertexColors: true, roughness: 0.7, metalness: 0.05 })
export const metalPropMaterial = std({ vertexColors: true, roughness: 0.45, metalness: 0.6 })
export const foliageMaterial = patch(std({ vertexColors: true, roughness: 0.9, flatShading: true }), {
  key: 'foliage',
  color: 'diffuseColor.rgb *= 0.85 + 0.3 * vnoise(vWorldPos.xz * 0.05 + vWorldPos.y);',
})
/**
 * Intérieurs : éclairage simple sans lumière dynamique (une par bâtiment serait trop coûteuse) : les surfaces
 * émettent une part de leur couleur, un peu plus la nuit, comme sous des plafonniers allumés.
 */
export const interiorMaterial = patch(std({ vertexColors: true, roughness: 0.85, side: DoubleSide }), {
  key: 'interior',
  emissive: 'totalEmissiveRadiance += diffuseColor.rgb * (0.18 + uNight * 0.25);',
})

/** Emissive lamp heads, brightness driven by uNight. */
export const lampHeadMaterial = patch(
  std({ color: new Color(0.9, 0.9, 0.85), emissive: new Color(1, 0.75, 0.45), roughness: 0.4 }),
  {
    key: 'lampHead',
    emissive: 'totalEmissiveRadiance *= 0.05 + uNight * 6.0;',
  },
)

/** Traffic light lamps: per-instance color, unlit. */
export const signalMaterial = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false })

// --- Vehicles (paint, glass, wheels live in vehicleMaterials.ts) ---------------

/**
 * Vehicle lights. Attribute aLight: 0 = headlight, 1 = taillight, 2 = siren red, 3 = siren blue.
 * Uniforms are per-vehicle (material clone), program is shared.
 */
export function vehicleLightsMaterial() {
  const uniforms = {
    uHead: { value: 0.2 },
    uTail: { value: 0.4 },
    uSiren: { value: 0 },
    uSirenPhase: { value: 0 },
  }
  const m = std({ color: new Color(0.9, 0.9, 0.9), emissive: new Color(1, 1, 1), roughness: 0.2, vertexColors: true })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLight;\nvarying float vLight;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLight = aLight;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vLight;\nuniform float uHead;\nuniform float uTail;\nuniform float uSiren;\nuniform float uSirenPhase;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float k = vLight < 0.5 ? uHead : vLight < 1.5 ? uTail : uSiren * (vLight < 2.5 ? step(0.5, fract(uSirenPhase)) : step(fract(uSirenPhase), 0.5));
        totalEmissiveRadiance = vColor.rgb * k;`,
      )
  }
  m.customProgramCacheKey = () => 'vehicleLights'
  return { material: m, uniforms }
}
