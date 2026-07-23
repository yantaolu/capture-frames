import { DEFAULT_FPS, FRAME_SAMPLE_LIMIT } from '../../shared/constants'

export interface FrameSnapshot {
  mediaTime: number
  presentedFrames: number
  width: number
  height: number
}

export class FrameSampler {
  private video: HTMLVideoElement | null = null
  private callbackId: number | null = null
  private mediaTimes: number[] = []
  private lastSnapshot: FrameSnapshot | null = null
  private listener: ((snapshot: FrameSnapshot) => void) | null = null

  bind(video: HTMLVideoElement | null): void {
    this.unbind()
    this.video = video
    this.mediaTimes = []
    this.lastSnapshot = null
    if (video) this.schedule()
  }

  unbind(): void {
    if (this.video && this.callbackId !== null) {
      this.video.cancelVideoFrameCallback(this.callbackId)
    }
    this.callbackId = null
    this.video = null
  }

  setListener(listener: ((snapshot: FrameSnapshot) => void) | null): void {
    this.listener = listener
  }

  getLastSnapshot(): FrameSnapshot | null {
    return this.lastSnapshot
  }

  getMediaTime(): number {
    return this.lastSnapshot?.mediaTime ?? this.video?.currentTime ?? 0
  }

  getPreviousMediaTime(before: number, maximumGap = Number.POSITIVE_INFINITY): number | null {
    for (let index = this.mediaTimes.length - 1; index >= 0; index -= 1) {
      const value = this.mediaTimes[index]
      if (value !== undefined && value < before - 0.0005) {
        return before - value <= maximumGap ? value : null
      }
    }
    return null
  }

  getEstimatedFrameDuration(manualFps?: number): number {
    const deltas: number[] = []
    for (let index = 1; index < this.mediaTimes.length; index += 1) {
      const previous = this.mediaTimes[index - 1]
      const current = this.mediaTimes[index]
      if (previous === undefined || current === undefined) continue
      const delta = current - previous
      if (delta > 0.001 && delta < 0.25) deltas.push(delta)
    }

    if (deltas.length > 0) {
      deltas.sort((a, b) => a - b)
      return deltas[Math.floor(deltas.length / 2)] ?? 1 / DEFAULT_FPS
    }

    const fps = manualFps && manualFps > 0 ? manualFps : DEFAULT_FPS
    return 1 / fps
  }

  private schedule(): void {
    if (!this.video) return
    this.callbackId = this.video.requestVideoFrameCallback((_now, metadata) => {
      const snapshot: FrameSnapshot = {
        mediaTime: metadata.mediaTime,
        presentedFrames: metadata.presentedFrames,
        width: metadata.width,
        height: metadata.height,
      }
      const lastTime = this.mediaTimes.at(-1)
      if (lastTime === undefined || Math.abs(lastTime - snapshot.mediaTime) > 0.0001) {
        this.mediaTimes.push(snapshot.mediaTime)
        if (this.mediaTimes.length > FRAME_SAMPLE_LIMIT) this.mediaTimes.shift()
      }
      this.lastSnapshot = snapshot
      this.listener?.(snapshot)
      this.schedule()
    })
  }
}
