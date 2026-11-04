import { RED_CAR, type Vehicle } from '../domain/board'

/** Nom accessible d'un véhicule, lu par les lecteurs d'écran (« Voiture rouge », « Camion C, vertical »). */
export function vehicleLabel(v: Vehicle): string {
  if (v.id === RED_CAR) return 'Voiture rouge'
  const kind = v.length === 3 ? 'Camion' : 'Voiture'
  return `${kind} ${v.id}, ${v.orientation === 'H' ? 'horizontal' : 'vertical'}`
}
