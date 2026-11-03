/**
 * Keyboard + mouse state, polled by systems (no React).
 * Mouse deltas accumulate between frames and are consumed with consumeMouse().
 */
class Input {
  private keys = new Set<string>()
  /** Appuis vus par l'interface (lus à chaque frame rendue). */
  private pressed = new Set<string>()
  /** Appuis vus par la simulation : gardés jusqu'au prochain pas, même si une frame n'en exécute aucun. */
  private tickPressed = new Set<string>()
  private mouseDX = 0
  private mouseDY = 0
  private wheel = 0
  /** Physical key code → layout label (e.g. KeyW → "Z" on AZERTY). */
  private labels = new Map<string, string>()
  buttons = 0
  pointerLocked = false
  /** Request pointer lock on click (enabled once the third-person camera exists). */
  lockOnClick = false
  private attached = false

  attach(element: HTMLElement): () => void {
    if (this.attached) return () => {}
    this.attached = true

    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.keys.has(e.code)) {
        this.pressed.add(e.code)
        this.tickPressed.add(e.code)
      }
      this.keys.add(e.code)
    }
    const onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code)
    const onMouseMove = (e: MouseEvent) => {
      if (!this.pointerLocked) return
      this.mouseDX += e.movementX
      this.mouseDY += e.movementY
    }
    const onMouseDown = (e: MouseEvent) => {
      this.buttons = e.buttons
      if (this.lockOnClick && !this.pointerLocked) element.requestPointerLock?.()
    }
    const onMouseUp = (e: MouseEvent) => (this.buttons = e.buttons)
    const onWheel = (e: WheelEvent) => {
      if (this.pointerLocked) this.wheel += Math.sign(e.deltaY)
    }
    const onContext = (e: Event) => e.preventDefault()
    const onKeyGuard = (e: KeyboardEvent) => {
      // Keep Tab / Space / F-keys from moving focus or scrolling while playing.
      if (this.pointerLocked && ['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault()
    }
    const onLockChange = () => (this.pointerLocked = document.pointerLockElement === element)
    const onBlur = () => {
      this.keys.clear()
      this.buttons = 0
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    element.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    document.addEventListener('pointerlockchange', onLockChange)
    window.addEventListener('blur', onBlur)
    window.addEventListener('wheel', onWheel, { passive: true })
    element.addEventListener('contextmenu', onContext)
    window.addEventListener('keydown', onKeyGuard)
    const kb = (navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard
    kb?.getLayoutMap()
      .then((map) => map.forEach((label, code) => this.labels.set(code, label.toUpperCase())))
      .catch(() => {})

    return () => {
      window.removeEventListener('wheel', onWheel)
      element.removeEventListener('contextmenu', onContext)
      window.removeEventListener('keydown', onKeyGuard)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      element.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('pointerlockchange', onLockChange)
      window.removeEventListener('blur', onBlur)
      this.attached = false
    }
  }

  isDown(code: string): boolean {
    return this.keys.has(code)
  }

  /** Simulation : vrai au premier pas qui suit l'appui. Appeler endTick() après chaque pas. */
  wasPressed(code: string): boolean {
    return this.tickPressed.has(code)
  }

  /** Interface : vrai à la frame qui suit l'appui. Appeler endFrame() après chaque frame rendue. */
  wasPressedThisFrame(code: string): boolean {
    return this.pressed.has(code)
  }

  consumeWheel(): number {
    const w = this.wheel
    this.wheel = 0
    return w
  }

  /** Human label of a physical key for the current keyboard layout. */
  label(code: string): string {
    const l = this.labels.get(code)
    if (l) return l
    if (code.startsWith('Key')) return code.slice(3)
    if (code.startsWith('Digit')) return code.slice(5)
    return { Space: 'Espace', ShiftLeft: 'Maj', ControlLeft: 'Ctrl', Tab: 'Tab', Escape: 'Échap' }[code] ?? code
  }

  axis(neg: string, pos: string): number {
    return (this.isDown(pos) ? 1 : 0) - (this.isDown(neg) ? 1 : 0)
  }

  consumeMouse(): { dx: number; dy: number } {
    const d = { dx: this.mouseDX, dy: this.mouseDY }
    this.mouseDX = this.mouseDY = 0
    return d
  }

  endFrame(): void {
    this.pressed.clear()
  }

  endTick(): void {
    this.tickPressed.clear()
  }
}

export const input = new Input()
