import { describe, expect, it } from 'vitest'
import { getVideoSourceKey } from '../../src/content/video/video-candidate'

function makeVideo(srcObject: object | null): HTMLVideoElement {
  return {
    currentSrc: '',
    src: '',
    srcObject,
    querySelectorAll: () => [],
  } as unknown as HTMLVideoElement
}

describe('getVideoSourceKey', () => {
  it('deduplicates elements backed by the same source object only', () => {
    const sharedSource = {}
    const firstKey = getVideoSourceKey(makeVideo(sharedSource))

    expect(getVideoSourceKey(makeVideo(sharedSource))).toBe(firstKey)
    expect(getVideoSourceKey(makeVideo({}))).not.toBe(firstKey)
  })
})
