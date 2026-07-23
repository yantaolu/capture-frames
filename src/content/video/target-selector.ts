import type { VideoCandidate } from './video-candidate'

export class TargetSelector {
  private selectedId: string | null = null

  select(id: string): void {
    this.selectedId = id
  }

  resolve(candidates: VideoCandidate[]): VideoCandidate | null {
    const selected = candidates.find((candidate) => candidate.id === this.selectedId)
    if (selected) return selected

    const ranked = [...candidates].sort((a, b) => {
      if (a.isPlaying !== b.isPlaying) return Number(b.isPlaying) - Number(a.isPlaying)
      if (a.lastPlayedAt !== b.lastPlayedAt) return b.lastPlayedAt - a.lastPlayedAt
      if (a.isVisible !== b.isVisible) return Number(b.isVisible) - Number(a.isVisible)
      return b.visibleArea - a.visibleArea
    })

    this.selectedId = ranked[0]?.id ?? null
    return ranked[0] ?? null
  }

  getSelectedId(): string | null {
    return this.selectedId
  }
}
