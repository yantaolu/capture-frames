import { describe, expect, it } from 'vitest'
import { FrameSampler } from '../../src/content/frame/frame-sampler'

describe('FrameSampler', () => {
  it('estimates a median frame duration from presented media times', () => {
    let callback: VideoFrameRequestCallback | undefined
    const video = {
      currentTime: 0,
      requestVideoFrameCallback(next: VideoFrameRequestCallback) {
        callback = next
        return 1
      },
      cancelVideoFrameCallback() {},
    } as unknown as HTMLVideoElement

    const sampler = new FrameSampler()
    sampler.bind(video)
    for (const [index, mediaTime] of [0, 1 / 24, 2 / 24, 3 / 24].entries()) {
      callback?.(performance.now(), {
        mediaTime,
        presentedFrames: index + 1,
        width: 1920,
        height: 1080,
        presentationTime: 0,
        expectedDisplayTime: 0,
        processingDuration: 0,
      })
    }

    expect(sampler.getEstimatedFrameDuration()).toBeCloseTo(1 / 24, 5)
    expect(sampler.getPreviousMediaTime(3 / 24)).toBeCloseTo(2 / 24, 5)
    expect(sampler.getPreviousMediaTime(10, 0.1)).toBeNull()
  })

  it('falls back to a manually configured frame rate', () => {
    const sampler = new FrameSampler()
    expect(sampler.getEstimatedFrameDuration(60)).toBeCloseTo(1 / 60, 6)
  })
})
