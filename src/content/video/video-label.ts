import type { VideoCandidate } from './video-candidate'
import { formatClock } from '../frame/timestamp'

export function makeVideoLabel(candidate: VideoCandidate, index: number): string {
  const video = candidate.element
  const state = candidate.isPlaying ? '播放中' : '已暂停'
  const dimensions = video.videoWidth > 0 ? `${video.videoWidth}×${video.videoHeight}` : '载入中'
  return `视频 ${index + 1} · ${state} · ${dimensions} · ${formatClock(video.currentTime)}`
}
