const PREFIX = '[capture-frames]'
const DEBUG_ENABLED = import.meta.env.DEV

export function debugLog(event: string, details: Record<string, unknown> = {}): void {
  if (!DEBUG_ENABLED) return
  console.debug(`${PREFIX} ${event}`, {
    at: new Date().toISOString(),
    ...details,
  })
}

export function errorLog(
  event: string,
  error: unknown,
  details: Record<string, unknown> = {},
): void {
  console.error(`${PREFIX} ${event}`, {
    at: new Date().toISOString(),
    ...details,
    error,
  })
}

export function describeVideo(video: HTMLVideoElement): Record<string, unknown> {
  return {
    currentTime: video.currentTime,
    duration: video.duration,
    paused: video.paused,
    ended: video.ended,
    seeking: video.seeking,
    readyState: video.readyState,
    networkState: video.networkState,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    seekable: Array.from({ length: video.seekable.length }, (_, index) => [
      video.seekable.start(index),
      video.seekable.end(index),
    ]),
  }
}
