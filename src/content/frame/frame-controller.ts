import { AUTO_STEP_INTERVAL_MS, SEEK_TIMEOUT_MS } from '../../shared/constants'
import { FrameError } from '../../shared/errors'
import { debugLog, describeVideo, errorLog } from '../../shared/logger'
import type { Settings } from '../../shared/settings'
import { FrameSampler } from './frame-sampler'

export type ControllerState = 'idle' | 'seeking' | 'exporting' | 'error'

export class FrameController {
  readonly sampler = new FrameSampler()
  private video: HTMLVideoElement | null = null
  private queue: Promise<void> = Promise.resolve()
  private state: ControllerState = 'idle'
  private stateListener: ((state: ControllerState) => void) | null = null
  private autoPlaybackListener: ((playing: boolean) => void) | null = null
  private autoPlaybackErrorListener: ((error: unknown) => void) | null = null
  private autoPlaying = false
  private autoGeneration = 0
  private bindingGeneration = 0
  private cancelActiveSeek: (() => void) | null = null

  constructor(private readonly getSettings: () => Settings) {}

  bind(video: HTMLVideoElement | null): void {
    this.stopAutoPlayback()
    this.bindingGeneration += 1
    this.cancelActiveSeek?.()
    this.video = video
    this.sampler.bind(video)
    debugLog('controller.bind', { video: video ? describeVideo(video) : null })
  }

  dispose(): void {
    this.stopAutoPlayback()
    this.bindingGeneration += 1
    this.cancelActiveSeek?.()
    this.sampler.unbind()
    this.video = null
    this.stateListener = null
    this.autoPlaybackListener = null
    this.autoPlaybackErrorListener = null
  }

  setStateListener(listener: ((state: ControllerState) => void) | null): void {
    this.stateListener = listener
  }

  setAutoPlaybackListener(listener: ((playing: boolean) => void) | null): void {
    this.autoPlaybackListener = listener
  }

  setAutoPlaybackErrorListener(listener: ((error: unknown) => void) | null): void {
    this.autoPlaybackErrorListener = listener
  }

  isAutoPlaying(): boolean {
    return this.autoPlaying
  }

  getVideo(): HTMLVideoElement | null {
    return this.video
  }

  toggleAutoPlayback(): void {
    if (this.autoPlaying) {
      this.stopAutoPlayback()
      return
    }
    if (!this.video || !this.video.isConnected) {
      throw new FrameError('NO_VIDEO', '当前页面未发现可操作的视频')
    }
    this.video.pause()
    this.autoPlaying = true
    const generation = ++this.autoGeneration
    this.autoPlaybackListener?.(true)
    debugLog('auto.start', { generation, video: describeVideo(this.video) })
    void this.runAutoPlayback(generation)
  }

  stopAutoPlayback(): void {
    if (!this.autoPlaying) return
    this.autoPlaying = false
    this.autoGeneration += 1
    this.autoPlaybackListener?.(false)
    debugLog('auto.stop', { generation: this.autoGeneration })
  }

  enqueueStep(direction: -1 | 1): Promise<void> {
    return this.enqueue(async (video) => {
      this.setState('seeking')
      video.pause()
      const settings = this.getSettings()
      const manualFps = settings.fpsMode === 'manual' ? settings.manualFps : undefined
      const duration = this.sampler.getEstimatedFrameDuration(manualFps)
      // currentTime is the authoritative seek position. The sampler may stay stale on
      // paused/MSE videos where Chrome does not emit a new video-frame callback.
      const current = video.currentTime
      const previous =
        direction < 0 ? this.sampler.getPreviousMediaTime(current, duration * 1.75) : null
      const desired = previous ?? current + direction * duration
      const target = this.clampToSeekable(video, desired)
      debugLog('step.plan', {
        direction,
        sampledTime: current,
        elementTime: video.currentTime,
        estimatedFrameDuration: duration,
        previousSample: previous,
        desiredTime: desired,
        targetTime: target,
        video: describeVideo(video),
      })
      await this.seek(video, target)
      debugLog('step.complete', {
        direction,
        targetTime: target,
        actualTime: video.currentTime,
        sampledTime: this.sampler.getMediaTime(),
        video: describeVideo(video),
      })
    })
  }

  runExport(operation: (video: HTMLVideoElement) => Promise<void>): Promise<void> {
    return this.enqueue(async (video) => {
      this.setState('exporting')
      await operation(video)
    })
  }

  private enqueue(operation: (video: HTMLVideoElement) => Promise<void>): Promise<void> {
    const generation = this.bindingGeneration
    const next = this.queue
      .catch(() => undefined)
      .then(async () => {
        const video = this.video
        if (!video || !video.isConnected || generation !== this.bindingGeneration) {
          throw new FrameError('NO_VIDEO', '当前页面未发现可操作的视频')
        }
        try {
          await operation(video)
          this.setState('idle')
        } catch (error) {
          this.setState('error')
          throw error
        }
      })
    this.queue = next
    return next
  }

  private async runAutoPlayback(generation: number): Promise<void> {
    try {
      while (this.autoPlaying && generation === this.autoGeneration) {
        const before = this.video?.currentTime ?? this.sampler.getMediaTime()
        const startedAt = performance.now()
        debugLog('auto.tick', { generation, before })
        await this.enqueueStep(1)
        if (!this.autoPlaying || generation !== this.autoGeneration) break
        const after = this.video?.currentTime ?? this.sampler.getMediaTime()
        if (after <= before + 0.0005) break

        const remaining = Math.max(0, AUTO_STEP_INTERVAL_MS - (performance.now() - startedAt))
        debugLog('auto.wait', {
          generation,
          intervalMs: AUTO_STEP_INTERVAL_MS,
          remainingMs: remaining,
        })
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
      }
    } catch (error) {
      errorLog('auto.error', error, { generation })
      if (generation === this.autoGeneration && this.autoPlaying) {
        this.autoPlaybackErrorListener?.(error)
      }
    } finally {
      if (generation === this.autoGeneration) {
        this.autoPlaying = false
        this.autoPlaybackListener?.(false)
      }
    }
  }

  private clampToSeekable(video: HTMLVideoElement, value: number): number {
    if (video.seekable.length === 0 && !Number.isFinite(video.duration)) {
      throw new FrameError('VIDEO_NOT_SEEKABLE', '当前视频不支持逐帧定位')
    }

    let minimum = 0
    let maximum = Number.isFinite(video.duration) ? video.duration : value
    if (video.seekable.length > 0) {
      minimum = video.seekable.start(0)
      maximum = video.seekable.end(video.seekable.length - 1)
    }
    return Math.min(Math.max(value, minimum), Math.max(minimum, maximum - 0.0001))
  }

  private seek(video: HTMLVideoElement, target: number): Promise<void> {
    if (Math.abs(video.currentTime - target) < 0.0001) {
      debugLog('seek.skip-same-time', { target, video: describeVideo(video) })
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      let settled = false
      let timeout = 0
      const cleanup = (): void => {
        clearTimeout(timeout)
        video.removeEventListener('seeking', onSeeking)
        video.removeEventListener('seeked', onSeeked)
        video.removeEventListener('error', onError)
        if (this.cancelActiveSeek === cancel) this.cancelActiveSeek = null
      }
      const fail = (error: FrameError): void => {
        if (settled) return
        settled = true
        cleanup()
        reject(error)
      }
      const cancel = (): void => fail(new FrameError('FRAME_REMOVED', '目标视频已切换'))
      timeout = window.setTimeout(() => {
        errorLog('seek.timeout', new Error('seeked event timeout'), {
          target,
          video: describeVideo(video),
        })
        fail(new FrameError('FRAME_TIMEOUT', '视频定位超时'))
      }, SEEK_TIMEOUT_MS)
      const onSeeking = (): void =>
        debugLog('seek.seeking', { target, video: describeVideo(video) })
      const onSeeked = (): void => {
        if (settled) return
        settled = true
        debugLog('seek.seeked', { target, video: describeVideo(video) })
        cleanup()
        resolve()
      }
      const onError = (): void => {
        errorLog('seek.error', video.error, { target, video: describeVideo(video) })
        fail(new FrameError('VIDEO_NOT_READY', '视频定位失败'))
      }
      video.addEventListener('seeking', onSeeking)
      video.addEventListener('seeked', onSeeked, { once: true })
      video.addEventListener('error', onError, { once: true })
      this.cancelActiveSeek = cancel
      debugLog('seek.start', { target, video: describeVideo(video) })
      video.currentTime = target
    })
  }

  private setState(state: ControllerState): void {
    this.state = state
    this.stateListener?.(state)
  }
}
