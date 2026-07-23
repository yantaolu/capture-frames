import { describe, expect, it } from 'vitest'
import { TargetSelector } from '../../src/content/video/target-selector'
import type { VideoCandidate } from '../../src/content/video/video-candidate'

function candidate(
  overrides: Partial<VideoCandidate> & Pick<VideoCandidate, 'id'>,
): VideoCandidate {
  return {
    element: {} as HTMLVideoElement,
    sourceKey: overrides.id,
    visibleArea: 100,
    isVisible: true,
    isPlaying: false,
    lastPlayedAt: 0,
    ...overrides,
  }
}

describe('TargetSelector', () => {
  it('prefers a playing candidate', () => {
    const selector = new TargetSelector()
    const result = selector.resolve([
      candidate({ id: 'large', visibleArea: 10_000 }),
      candidate({ id: 'playing', isPlaying: true, visibleArea: 500 }),
    ])
    expect(result?.id).toBe('playing')
  })

  it('uses visible area when playback state is equal', () => {
    const selector = new TargetSelector()
    expect(
      selector.resolve([
        candidate({ id: 'small', visibleArea: 500 }),
        candidate({ id: 'large', visibleArea: 10_000 }),
      ])?.id,
    ).toBe('large')
  })

  it('preserves an explicit selection while it exists', () => {
    const selector = new TargetSelector()
    selector.select('small')
    expect(
      selector.resolve([
        candidate({ id: 'small', visibleArea: 500 }),
        candidate({ id: 'playing', isPlaying: true }),
      ])?.id,
    ).toBe('small')
  })
})
