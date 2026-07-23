import { APP_ROOT_ID, type CommandName } from '../shared/constants'
import { FrameError } from '../shared/errors'
import { debugLog, describeVideo, errorLog } from '../shared/logger'
import { isCommandMessage } from '../shared/messages'
import { loadSettings, saveSettings, type Settings } from '../shared/settings'
import { FrameController } from './frame/frame-controller'
import { FrameExporter } from './frame/frame-exporter'
import { formatClock } from './frame/timestamp'
import { HighlightOverlay } from './ui/highlight-overlay'
import { Toolbar } from './ui/toolbar'
import { TargetSelector } from './video/target-selector'
import type { VideoCandidate } from './video/video-candidate'
import { VideoRegistry } from './video/video-registry'

export type ActivationMode = 'manual' | 'auto'

export class CaptureFramesApp {
  private readonly registry = new VideoRegistry()
  private readonly selector = new TargetSelector()
  private readonly highlight = new HighlightOverlay()
  private readonly exporter = new FrameExporter()
  private readonly controller: FrameController
  private readonly toolbar: Toolbar
  private candidates: VideoCandidate[] = []
  private target: VideoCandidate | null = null
  private settings: Settings
  private targetCleanup: (() => void) | null = null
  private unsubscribeRegistry: (() => void) | null = null
  private active = false
  private waitingForAutoVideo: boolean

  private constructor(settings: Settings, mode: ActivationMode) {
    this.settings = settings
    this.waitingForAutoVideo = mode === 'auto'
    this.controller = new FrameController(() => this.settings)
    this.toolbar = new Toolbar(
      {
        onSelect: (id) => this.selectTarget(id),
        onPrevious: () => void this.execute('previous-frame'),
        onToggle: () => void this.execute('toggle-playback'),
        onNext: () => void this.execute('next-frame'),
        onExport: () => void this.execute('export-frame'),
        onPositionChange: (position) => void this.persistPosition(position),
      },
      settings,
    )
    this.toolbar.root.id = APP_ROOT_ID
  }

  static async create(mode: ActivationMode = 'manual'): Promise<CaptureFramesApp> {
    const app = new CaptureFramesApp(await loadSettings(), mode)
    app.start()
    return app
  }

  focus(): void {
    this.waitingForAutoVideo = false
    this.toolbar.setHidden(false)
    this.toolbar.showToast(this.target ? '逐帧控制已启用' : '当前页面未发现可操作的视频')
  }

  isActive(): boolean {
    return this.active
  }

  async execute(command: CommandName): Promise<void> {
    if (!this.active || this.isEditingText()) return
    debugLog('command.received', {
      command,
      targetId: this.target?.id ?? null,
      video: this.target ? describeVideo(this.target.element) : null,
    })
    try {
      if (!this.target) throw new FrameError('NO_VIDEO', '当前页面未发现可操作的视频')
      switch (command) {
        case 'previous-frame':
          this.controller.stopAutoPlayback()
          await this.controller.enqueueStep(-1)
          this.toastFrame('已后退一帧')
          break
        case 'toggle-playback':
          this.controller.toggleAutoPlayback()
          this.toast(this.controller.isAutoPlaying() ? '开始自动逐帧播放' : '已停止自动逐帧播放')
          break
        case 'next-frame':
          this.controller.stopAutoPlayback()
          await this.controller.enqueueStep(1)
          this.toastFrame('已前进一帧')
          break
        case 'export-frame':
          this.controller.stopAutoPlayback()
          await this.exportFrame()
          break
      }
    } catch (error) {
      this.handleError(error)
    } finally {
      if (this.active) this.refreshToolbar()
    }
  }

  destroy(): void {
    if (!this.active) return
    this.active = false
    this.unsubscribeRegistry?.()
    this.unsubscribeRegistry = null
    this.registry.stop()
    this.targetCleanup?.()
    this.targetCleanup = null
    this.candidates = []
    this.target = null
    this.controller.dispose()
    this.exporter.dispose()
    this.highlight.hide()
    this.toolbar.destroy()
    chrome.runtime.onMessage.removeListener(this.onMessage)
    document.removeEventListener('fullscreenchange', this.onFullscreenChange)
    removeEventListener('pagehide', this.onPageHide)
    if (window.__captureFramesApp === this) {
      window.__captureFramesApp = undefined
      window.__captureFramesAppPromise = undefined
    }
  }

  private start(): void {
    this.active = true
    this.toolbar.mount()
    if (this.waitingForAutoVideo) this.toolbar.setHidden(true)
    this.controller.setStateListener((state) =>
      this.toolbar.setBusy(
        state !== 'idle' && state !== 'error' && !this.controller.isAutoPlaying(),
      ),
    )
    this.controller.setAutoPlaybackListener(() => this.refreshToolbar())
    this.controller.setAutoPlaybackErrorListener((error) => this.handleError(error))
    this.unsubscribeRegistry = this.registry.subscribe((candidates) =>
      this.onCandidates(candidates),
    )
    this.registry.start()
    chrome.runtime.onMessage.addListener(this.onMessage)
    document.addEventListener('fullscreenchange', this.onFullscreenChange)
    addEventListener('pagehide', this.onPageHide)
    if (!this.waitingForAutoVideo) this.focus()
  }

  private readonly onMessage = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: { ok: boolean }) => void,
  ): boolean => {
    if (typeof message === 'object' && message !== null && 'type' in message) {
      if ((message as { type?: unknown }).type === 'capture-frames:ping') {
        sendResponse({ ok: true })
        return false
      }
    }
    if (isCommandMessage(message)) void this.execute(message.command)
    return false
  }

  private readonly onFullscreenChange = (): void => {
    this.toolbar.remountForFullscreen(document.fullscreenElement)
  }

  private readonly onPageHide = (event: PageTransitionEvent): void => {
    if (event.persisted) this.controller.stopAutoPlayback()
    else this.destroy()
  }

  private onCandidates(candidates: VideoCandidate[]): void {
    this.candidates = candidates
    const target = this.selector.resolve(candidates)
    if (target?.element !== this.target?.element) this.bindTarget(target)
    else this.target = target
    if (this.waitingForAutoVideo && candidates.length > 0) {
      this.waitingForAutoVideo = false
      this.toolbar.setHidden(false)
    }
    this.refreshToolbar()
  }

  private selectTarget(id: string): void {
    this.selector.select(id)
    const target = this.selector.resolve(this.candidates)
    this.bindTarget(target)
    if (!target) return
    if (this.settings.autoScrollToVideo) {
      target.element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }
    this.highlight.show(target.element)
    this.refreshToolbar()
  }

  private bindTarget(target: VideoCandidate | null): void {
    this.targetCleanup?.()
    this.targetCleanup = null
    this.target = target
    this.controller.bind(target?.element ?? null)
    debugLog('target.bind', {
      targetId: target?.id ?? null,
      sourceKey: target?.sourceKey ?? null,
      video: target ? describeVideo(target.element) : null,
    })
    if (!target) return

    const refresh = (): void => this.refreshToolbar()
    target.element.addEventListener('play', refresh)
    target.element.addEventListener('pause', refresh)
    target.element.addEventListener('ended', refresh)
    this.targetCleanup = () => {
      target.element.removeEventListener('play', refresh)
      target.element.removeEventListener('pause', refresh)
      target.element.removeEventListener('ended', refresh)
    }
  }

  private refreshToolbar(): void {
    if (!this.active) return
    this.toolbar.updateCandidates(this.candidates, this.selector.getSelectedId())
    this.toolbar.setPlaying(this.controller.isAutoPlaying())
  }

  private async exportFrame(): Promise<void> {
    const video = this.target?.element
    if (!video) throw new FrameError('NO_VIDEO', '当前页面未发现可操作的视频')
    await this.controller.runExport(async (activeVideo) => {
      const mediaTime = activeVideo.currentTime
      try {
        const result = await this.exporter.exportNative(activeVideo, mediaTime, this.settings)
        this.toast(`已导出 ${result.width}×${result.height} PNG`)
      } catch (error) {
        if (!(error instanceof FrameError) || error.code !== 'CANVAS_TAINTED') throw error
        const useFallback =
          this.settings.autoVisibleCaptureFallback ||
          window.confirm(
            '该视频禁止读取原始像素。是否改为截取当前屏幕中可见的视频区域？\n\n截图可能包含字幕、水印或播放器控件，分辨率也可能低于视频原始分辨率。',
          )
        if (!useFallback) throw error
        const result = await this.exporter.exportVisibleCapture(
          activeVideo,
          mediaTime,
          this.settings,
          (hidden) => {
            this.toolbar.setHidden(hidden)
            this.highlight.setHidden(hidden)
          },
        )
        this.toast(`已导出可见画面 ${result.width}×${result.height}`)
      }
    })
  }

  private toastFrame(prefix: string): void {
    const time = this.controller.getVideo()?.currentTime ?? this.controller.sampler.getMediaTime()
    this.toast(
      `${prefix} · ${formatClock(time)}.${String(Math.round((time % 1) * 1000)).padStart(3, '0')}`,
    )
  }

  private toast(message: string): void {
    if (this.active && this.settings.showToasts) this.toolbar.showToast(message)
  }

  private handleError(error: unknown): void {
    if (!this.active) return
    errorLog('command.error', error, {
      targetId: this.target?.id ?? null,
      video: this.target ? describeVideo(this.target.element) : null,
    })
    if (error instanceof FrameError) this.toast(error.message)
    else if (error instanceof DOMException && error.name === 'NotAllowedError') {
      this.toast('浏览器阻止了自动播放，请先点击视频')
    } else {
      console.error('[capture-frames]', error)
      this.toast('操作失败，请稍后重试')
    }
  }

  private isEditingText(): boolean {
    let active: Element | null = document.activeElement
    while (active?.tagName === 'IFRAME') {
      try {
        active = (active as HTMLIFrameElement).contentDocument?.activeElement ?? active
      } catch {
        break
      }
    }
    return (
      active?.matches(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
      ) ?? false
    )
  }

  private async persistPosition(position: { x: number; y: number }): Promise<void> {
    if (!this.settings.rememberToolbarPosition) return
    this.settings = { ...this.settings, toolbarPosition: position }
    await saveSettings(this.settings)
  }
}
