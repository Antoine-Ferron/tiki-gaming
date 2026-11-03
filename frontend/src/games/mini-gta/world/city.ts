import type { District, RoadKind } from './constants'
import { Terrain } from './terrain'
import { RoadGraph, type RoadEdge, type RoadNetwork, type RoadNode } from './roads'

export interface Rect {
  x0: number
  x1: number
  z0: number
  z1: number
}

export interface Block extends Rect {
  id: number
  district: District
  park: boolean
  /** Grid indices, -1 for outer strips. */
  gi: number
  gj: number
}

/** Facade styles understood by the facade shader. */
export const enum FacadeStyle {
  GlassTower = 0,
  Office = 1,
  Brick = 2,
  House = 3,
  Warehouse = 4,
  Shop = 5,
}

export type SpecialKind = 'safehouse' | 'gunshop' | 'warehouse' | 'hospital' | 'police'

export interface Building {
  id: number
  /** Center and half extents (local, before rotation). */
  x: number
  z: number
  hw: number
  hd: number
  y0: number
  h: number
  rot: number
  style: FacadeStyle
  color: [number, number, number]
  roof: 'flat' | 'gable'
  /** Optional upper tier (setback tower). */
  tier?: { hw: number; hd: number; h: number }
  special?: SpecialKind
  /**
   * Bâtiment où l'on peut entrer : porte côté 0=-z, 1=+x, 2=+z, 3=-x. Sans `floorHeight`, tout le bâtiment est
   * creux (bâtiments spéciaux) ; avec, seul le rez-de-chaussée l'est et les étages restent pleins.
   */
  hollow?: { doorSide: number; floorHeight?: number }
  /** Lot the building stands on (city buildings only). */
  lot?: Rect
  chunk: number
}

export type PropKind = 'lamp' | 'tree' | 'hydrant' | 'bin' | 'bench' | 'trafficLight' | 'palm'

export interface Prop {
  id: number
  kind: PropKind
  x: number
  y: number
  z: number
  rot: number
  scale: number
  chunk: number
  destroyed: boolean
  /** For traffic lights: the node and the approaching edge. */
  node?: number
  edge?: number
}

export interface Container {
  x: number
  y: number
  z: number
  rot: number
  color: [number, number, number]
  chunk: number
}

export interface ParkingSpot {
  x: number
  z: number
  y: number
  heading: number
}

export interface SidewalkNode {
  id: number
  x: number
  z: number
  y: number
  links: number[]
}

export type RampKind = 'dirt' | 'concrete' | 'planks'

/** Tremplin : coin qui monte de 0 à `height` sur `length`, dans la direction du cap `rot`. */
export interface Ramp {
  x: number
  /** Hauteur du sol sous le tremplin. */
  y: number
  z: number
  rot: number
  length: number
  width: number
  height: number
  kind: RampKind
  chunk: number
}

export interface Location {
  x: number
  y: number
  z: number
  heading?: number
}

export interface CityData {
  seed: number
  terrain: Terrain
  roads: RoadNetwork
  blocks: Block[]
  buildings: Building[]
  props: Prop[]
  containers: Container[]
  cranes: Location[]
  parking: ParkingSpot[]
  sidewalk: SidewalkNode[]
  ramps: Ramp[]
  locations: {
    spawn: Location
    safehouseDoor: Location
    safehouseInside: Location
    garage: Location
    gunshopDoor: Location
    gunshopCounter: Location
    warehouseDoor: Location
    warehouseInside: Location
    hospital: Location
    policeStation: Location
    planeSpawn: Location
    heliSpawn: Location
    missionGivers: Location[]
    missionPoints: Location[]
  }
}

/**
 * Reconstruit la ville envoyée par le backend Java (`GET /api/world`). La génération elle-même
 * est faite côté serveur : le client ne garde que les structures d'exécution (graphe routier,
 * grille de hauteurs) et les données de rendu.
 */
export function cityFromDto(dto: unknown): CityData {
  const d = dto as Omit<CityData, 'terrain' | 'roads'> & {
    terrain: { n: number; heights: string }
    roads: Omit<RoadNetwork, 'graph'> & { nodes: RoadNode[]; edges: (Omit<RoadEdge, 'kind'> & { kind: RoadKind })[] }
  }
  const { nodes, edges, ...network } = d.roads
  return {
    ...d,
    // Champ ajouté après coup : un monde plus ancien n'a pas de tremplins.
    ramps: d.ramps ?? [],
    terrain: new Terrain(decodeFloat32(d.terrain.heights), d.terrain.n),
    roads: { ...network, graph: RoadGraph.from(nodes, edges) },
  }
}

/** Base64 d'un tableau Float32 petit-boutiste. */
export function decodeFloat32(base64: string): Float32Array {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const view = new DataView(bytes.buffer)
  const out = new Float32Array(bytes.length / 4)
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true)
  return out
}
