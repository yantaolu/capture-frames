import type { Settings } from '../../shared/settings'
import type { VideoCandidate } from '../video/video-candidate'
import { makeVideoLabel } from '../video/video-label'
import { ICONS } from './icons'
import styles from './toolbar.css?inline'

export interface ToolbarActions {
  onSelect: (id: string) => void
  onPrevious: () => void
  onToggle: () => void
  onNext: () => void
  onExport: () => void
  onPositionChange: (position: { x: number; y: number }) => void
}

export class Toolbar {
  readonly root: HTMLDivElement
  private readonly shadow: ShadowRoot
  private readonly shell: HTMLDivElement
  private readonly select: HTMLSelectElement
  private readonly toastElement: HTMLDivElement
  private readonly playButton: HTMLButtonElement
  private readonly actionButtons: HTMLButtonElement[]
  private readonly busyButtons: HTMLButtonElement[]
  private toastTimer: number | null = null
  private candidateSignature = ''
  private playingState: boolean | null = null
  private busy = false
  private enabled: boolean | null = null
  private customPosition = false
  private positionFrame: number | null = null

  constructor(
    private readonly actions: ToolbarActions,
    settings: Settings,
  ) {
    this.root = document.createElement('div')
    this.shadow = this.root.attachShadow({ mode: 'closed' })
    const style = document.createElement('style')
    style.textContent = styles
    this.shadow.append(style)

    this.shell = document.createElement('div')
    this.shell.className = 'cf-shell'
    this.shell.setAttribute('role', 'toolbar')
    this.shell.setAttribute('aria-label', '视频逐帧控制')

    this.select = document.createElement('select')
    this.select.className = 'cf-select'
    this.select.setAttribute('aria-label', '选择视频')
    this.select.addEventListener('change', () => this.actions.onSelect(this.select.value))
    this.shell.append(this.select)

    const previous = this.makeButton('后退一帧', ICONS.previous, this.actions.onPrevious)
    this.playButton = this.makeButton('开始自动逐帧播放', ICONS.play, this.actions.onToggle)
    const next = this.makeButton('前进一帧', ICONS.next, this.actions.onNext)
    const exportButton = this.makeButton('导出当前帧', ICONS.export, this.actions.onExport)
    this.actionButtons = [previous, this.playButton, next, exportButton]
    this.busyButtons = [previous, next, exportButton]
    for (const button of this.actionButtons) this.shell.append(button)

    this.toastElement = document.createElement('div')
    this.toastElement.className = 'cf-toast'
    this.toastElement.setAttribute('role', 'status')
    this.shadow.append(this.shell, this.toastElement)
    this.installDrag(this.shell)

    if (settings.rememberToolbarPosition && settings.toolbarPosition) {
      this.customPosition = true
      this.setPosition(settings.toolbarPosition)
    }
  }

  mount(parent: Element = document.documentElement): void {
    parent.append(this.root)
    addEventListener('resize', this.schedulePositionClamp, { passive: true })
    this.schedulePositionClamp()
  }

  destroy(): void {
    if (this.toastTimer !== null) clearTimeout(this.toastTimer)
    if (this.positionFrame !== null) cancelAnimationFrame(this.positionFrame)
    removeEventListener('resize', this.schedulePositionClamp)
    this.root.remove()
  }

  updateCandidates(candidates: VideoCandidate[], selectedId: string | null): void {
    const signature = candidates
      .map(
        (candidate) =>
          `${candidate.id}:${candidate.isPlaying}:${candidate.element.videoWidth}x${candidate.element.videoHeight}`,
      )
      .join('|')
    if (signature !== this.candidateSignature) {
      this.candidateSignature = signature
      this.select.replaceChildren()
      candidates.forEach((candidate, index) => {
        const option = document.createElement('option')
        option.value = candidate.id
        option.textContent = makeVideoLabel(candidate, index)
        this.select.append(option)
      })
    }
    this.select.value = selectedId ?? this.select.value
    this.select.hidden = candidates.length <= 1
    this.setEnabled(candidates.length > 0)
  }

  setPlaying(playing: boolean): void {
    if (playing === this.playingState) return
    this.playingState = playing
    this.playButton.innerHTML = playing ? ICONS.pause : ICONS.play
    this.playButton.title = playing ? '停止自动逐帧播放' : '开始自动逐帧播放'
    this.playButton.setAttribute('aria-label', this.playButton.title)
  }

  setBusy(busy: boolean): void {
    if (busy === this.busy) return
    this.busy = busy
    this.applyDisabledState()
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return
    this.enabled = enabled
    this.applyDisabledState()
  }

  setHidden(hidden: boolean): void {
    this.shell.dataset.hidden = String(hidden)
  }

  showToast(message: string, duration = 2_400): void {
    this.toastElement.textContent = message
    this.toastElement.dataset.visible = 'true'
    if (this.toastTimer !== null) clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => {
      this.toastElement.dataset.visible = 'false'
    }, duration)
  }

  remountForFullscreen(element: Element | null): void {
    ;(element ?? document.documentElement).append(this.root)
    this.schedulePositionClamp()
  }

  private makeButton(label: string, icon: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cf-button cf-action'
    button.title = label
    button.setAttribute('aria-label', label)
    button.innerHTML = icon
    button.addEventListener('click', action)
    return button
  }

  private applyDisabledState(): void {
    this.playButton.disabled = !this.enabled
    for (const button of this.busyButtons) button.disabled = !this.enabled || this.busy
    this.select.disabled = !this.enabled || this.busy
  }

  private setPosition(position: { x: number; y: number }): void {
    this.shell.style.left = `${position.x}px`
    this.shell.style.top = `${position.y}px`
    this.shell.style.right = 'auto'
  }

  private readonly schedulePositionClamp = (): void => {
    if (!this.customPosition || this.positionFrame !== null) return
    this.positionFrame = requestAnimationFrame(() => {
      this.positionFrame = null
      if (!this.root.isConnected) return
      const rect = this.shell.getBoundingClientRect()
      const x = Math.max(8, Math.min(rect.left, Math.max(8, innerWidth - rect.width - 8)))
      const y = Math.max(8, Math.min(rect.top, Math.max(8, innerHeight - rect.height - 8)))
      this.setPosition({ x, y })
    })
  }

  private installDrag(handle: HTMLElement): void {
    let pointerId: number | null = null
    let offsetX = 0
    let offsetY = 0

    handle.addEventListener('pointerdown', (event) => {
      if ((event.target as Element | null)?.closest('button, select, option, input, a')) return
      pointerId = event.pointerId
      this.customPosition = true
      const rect = this.shell.getBoundingClientRect()
      offsetX = event.clientX - rect.left
      offsetY = event.clientY - rect.top
      handle.setPointerCapture(event.pointerId)
      event.preventDefault()
    })

    handle.addEventListener('pointermove', (event) => {
      if (pointerId !== event.pointerId) return
      const rect = this.shell.getBoundingClientRect()
      const x = Math.max(
        8,
        Math.min(event.clientX - offsetX, Math.max(8, innerWidth - rect.width - 8)),
      )
      const y = Math.max(
        8,
        Math.min(event.clientY - offsetY, Math.max(8, innerHeight - rect.height - 8)),
      )
      this.setPosition({ x, y })
    })

    const finish = (event: PointerEvent): void => {
      if (pointerId !== event.pointerId) return
      pointerId = null
      const rect = this.shell.getBoundingClientRect()
      this.actions.onPositionChange({ x: rect.left, y: rect.top })
    }
    handle.addEventListener('pointerup', finish)
    handle.addEventListener('pointercancel', finish)
  }
}
