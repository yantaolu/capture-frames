import { getVideoViewportRect } from '../video/video-candidate'

export class HighlightOverlay {
  private overlay: HTMLDivElement | null = null
  private video: HTMLVideoElement | null = null
  private animation: Animation | null = null
  private readonly reposition = (): void => this.updatePosition()

  show(video: HTMLVideoElement): void {
    this.hide()
    this.video = video
    const overlay = document.createElement('div')
    Object.assign(overlay.style, {
      position: 'fixed',
      zIndex: '2147483645',
      pointerEvents: 'none',
      boxSizing: 'border-box',
      border: '4px solid #ff2b2b',
      borderRadius: '5px',
      boxShadow: '0 0 0 2px rgba(255,255,255,.7), 0 0 22px rgba(255,30,30,.95)',
    })
    document.documentElement.append(overlay)
    this.overlay = overlay
    this.updatePosition()
    addEventListener('scroll', this.reposition, true)
    addEventListener('resize', this.reposition)
    this.animation = overlay.animate(
      [
        { opacity: 0.25, transform: 'scale(1)' },
        { opacity: 1, transform: 'scale(1.008)' },
        { opacity: 0.25, transform: 'scale(1)' },
      ],
      { duration: 700, iterations: 3, easing: 'ease-in-out' },
    )
    this.animation.finished.then(() => this.hide()).catch(() => undefined)
  }

  hide(): void {
    this.animation?.cancel()
    this.animation = null
    this.overlay?.remove()
    this.overlay = null
    this.video = null
    removeEventListener('scroll', this.reposition, true)
    removeEventListener('resize', this.reposition)
  }

  setHidden(hidden: boolean): void {
    if (this.overlay) this.overlay.hidden = hidden
  }

  private updatePosition(): void {
    if (!this.overlay || !this.video) return
    const rect = getVideoViewportRect(this.video)
    Object.assign(this.overlay.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    })
  }
}
