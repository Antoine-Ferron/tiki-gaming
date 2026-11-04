/** Le jeu se joue au clavier et à la souris : il faut un pointeur précis et au moins 360px de large. */
export function canPlay(device: { finePointer: boolean; width: number }): boolean {
  return device.finePointer && device.width >= 360
}
