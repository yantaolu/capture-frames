export interface VideoCandidate {
  id: string
  element: HTMLVideoElement
  sourceKey: string
  visibleArea: number
  isVisible: boolean
  isPlaying: boolean
  lastPlayedAt: number
}

export interface VideoOption {
  id: string
  label: string
}

const sourceObjectIds = new WeakMap<object, number>()
let sourceObjectSequence = 0

export function getVideoSourceKey(video: HTMLVideoElement): string {
  if (video.currentSrc) return video.currentSrc
  if (video.src) return video.src
  const sources = Array.from(video.querySelectorAll('source'))
    .map((source) => source.src)
    .filter(Boolean)
  if (sources.length > 0) return sources.join('|')
  if (video.srcObject) {
    let id = sourceObjectIds.get(video.srcObject)
    if (id === undefined) {
      id = ++sourceObjectSequence
      sourceObjectIds.set(video.srcObject, id)
    }
    return `src-object:${id}`
  }
  return 'unknown-source'
}

export function getVisibleVideoArea(video: HTMLVideoElement): number {
  const rect = getVideoViewportRect(video)
  const width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0))
  const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0))
  return width * height
}

export function isVideoVisible(video: HTMLVideoElement): boolean {
  const style = video.ownerDocument.defaultView?.getComputedStyle(video)
  if (!style) return false
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false
  }
  const rect = getVideoViewportRect(video)
  return rect.width >= 80 && rect.height >= 45 && getVisibleVideoArea(video) > 0
}

export function getVideoViewportRect(video: HTMLVideoElement): DOMRect {
  const ownRect = video.getBoundingClientRect()
  let left = ownRect.left
  let top = ownRect.top
  let width = ownRect.width
  let height = ownRect.height
  let currentWindow = video.ownerDocument.defaultView

  try {
    while (currentWindow && currentWindow !== window.top) {
      const frame = currentWindow.frameElement
      if (!frame) break
      const frameRect = frame.getBoundingClientRect()
      const scaleX = frame.clientWidth > 0 ? frameRect.width / frame.clientWidth : 1
      const scaleY = frame.clientHeight > 0 ? frameRect.height / frame.clientHeight : 1
      left = frameRect.left + left * scaleX
      top = frameRect.top + top * scaleY
      width *= scaleX
      height *= scaleY
      currentWindow = frame.ownerDocument.defaultView
    }
  } catch {
    // Cross-origin frame boundaries are intentionally not traversed.
  }

  return new DOMRect(left, top, width, height)
}

export function isVideoPlaying(video: HTMLVideoElement): boolean {
  return !video.paused && !video.ended && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
}
