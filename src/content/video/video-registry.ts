import { MIN_VIDEO_HEIGHT, MIN_VIDEO_WIDTH } from '../../shared/constants'
import {
  getVideoSourceKey,
  getVisibleVideoArea,
  isVideoPlaying,
  isVideoVisible,
  getVideoViewportRect,
  type VideoCandidate,
} from './video-candidate'

type RegistryListener = (candidates: VideoCandidate[]) => void

export class VideoRegistry {
  private readonly ids = new WeakMap<HTMLVideoElement, string>()
  private readonly lastPlayedAt = new WeakMap<HTMLVideoElement, number>()
  private readonly eventCleanups = new Map<HTMLVideoElement, () => void>()
  private readonly listeners = new Set<RegistryListener>()
  private readonly observers = new Map<Document, MutationObserver>()
  private sequence = 0
  private candidates: VideoCandidate[] = []
  private refreshFrame: number | null = null
  private mutationTimer: number | null = null
  private running = false

  start(): void {
    if (this.running) return
    this.running = true
    this.scan()
    addEventListener('resize', this.scheduleRefresh, { passive: true })
    addEventListener('scroll', this.scheduleRefresh, { passive: true, capture: true })
    addEventListener('load', this.scheduleMutationScan, true)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.refreshFrame !== null) cancelAnimationFrame(this.refreshFrame)
    if (this.mutationTimer !== null) clearTimeout(this.mutationTimer)
    this.refreshFrame = null
    this.mutationTimer = null
    for (const observer of this.observers.values()) observer.disconnect()
    this.observers.clear()
    removeEventListener('resize', this.scheduleRefresh)
    removeEventListener('scroll', this.scheduleRefresh, true)
    removeEventListener('load', this.scheduleMutationScan, true)
    for (const cleanup of this.eventCleanups.values()) cleanup()
    this.eventCleanups.clear()
    this.candidates = []
    this.listeners.clear()
  }

  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener)
    listener(this.candidates)
    return () => this.listeners.delete(listener)
  }

  getCandidates(): VideoCandidate[] {
    return this.candidates
  }

  getById(id: string): VideoCandidate | undefined {
    return this.candidates.find((candidate) => candidate.id === id)
  }

  private readonly scheduleRefresh = (): void => {
    if (!this.running || this.refreshFrame !== null) return
    this.refreshFrame = requestAnimationFrame(() => {
      this.refreshFrame = null
      if (this.running) this.refreshCandidates(Array.from(this.eventCleanups.keys()))
    })
  }

  private readonly scheduleMutationScan = (): void => {
    if (!this.running || this.mutationTimer !== null) return
    this.mutationTimer = window.setTimeout(() => {
      this.mutationTimer = null
      if (this.running) this.scan()
    }, 100)
  }

  private scan(): void {
    if (!this.running) return
    const documents = this.collectDocuments(document)
    this.syncObservers(documents)
    const elements = documents.flatMap((currentDocument) =>
      Array.from(currentDocument.querySelectorAll('video')),
    )
    const elementSet = new Set(elements)

    for (const [video, cleanup] of this.eventCleanups) {
      if (!elementSet.has(video) || !video.isConnected) {
        cleanup()
        this.eventCleanups.delete(video)
      }
    }

    for (const video of elements) this.bindVideo(video)

    this.refreshCandidates(elements)
  }

  private refreshCandidates(elements: HTMLVideoElement[]): void {
    if (!this.running) return
    const candidates = elements
      .filter((video) => video.isConnected)
      .filter((video) => {
        const rect = getVideoViewportRect(video)
        return rect.width >= MIN_VIDEO_WIDTH && rect.height >= MIN_VIDEO_HEIGHT
      })
      .map((element) => {
        const id = this.getId(element)
        const sourceKey = getVideoSourceKey(element)
        return {
          id,
          element,
          sourceKey: sourceKey === 'unknown-source' ? `${sourceKey}:${id}` : sourceKey,
          visibleArea: getVisibleVideoArea(element),
          isVisible: isVideoVisible(element),
          isPlaying: isVideoPlaying(element),
          lastPlayedAt: this.lastPlayedAt.get(element) ?? 0,
        }
      })

    const bySource = new Map<string, VideoCandidate>()
    for (const candidate of candidates) {
      const current = bySource.get(candidate.sourceKey)
      if (!current || this.compareCandidates(candidate, current) < 0) {
        bySource.set(candidate.sourceKey, candidate)
      }
    }
    this.candidates = Array.from(bySource.values())

    for (const listener of this.listeners) listener(this.candidates)
  }

  private compareCandidates(left: VideoCandidate, right: VideoCandidate): number {
    if (left.isPlaying !== right.isPlaying) return Number(right.isPlaying) - Number(left.isPlaying)
    if (left.isVisible !== right.isVisible) return Number(right.isVisible) - Number(left.isVisible)
    if (left.lastPlayedAt !== right.lastPlayedAt) return right.lastPlayedAt - left.lastPlayedAt
    return right.visibleArea - left.visibleArea
  }

  private collectDocuments(root: Document): Document[] {
    const documents = [root]
    for (const iframe of root.querySelectorAll('iframe')) {
      try {
        if (iframe.contentDocument?.documentElement) {
          documents.push(...this.collectDocuments(iframe.contentDocument))
        }
      } catch {
        // Access to cross-origin iframe documents is blocked by the browser.
      }
    }
    return documents
  }

  private syncObservers(documents: Document[]): void {
    const activeDocuments = new Set(documents)
    for (const [currentDocument, observer] of this.observers) {
      if (!activeDocuments.has(currentDocument)) {
        observer.disconnect()
        this.observers.delete(currentDocument)
      }
    }
    for (const currentDocument of documents) {
      if (this.observers.has(currentDocument) || !currentDocument.documentElement) continue
      const observer = new MutationObserver(this.scheduleMutationScan)
      observer.observe(currentDocument.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src'],
      })
      this.observers.set(currentDocument, observer)
    }
  }

  private getId(video: HTMLVideoElement): string {
    let id = this.ids.get(video)
    if (!id) {
      id = `video-${++this.sequence}`
      this.ids.set(video, id)
    }
    return id
  }

  private bindVideo(video: HTMLVideoElement): void {
    if (this.eventCleanups.has(video)) return

    const onPlay = (): void => {
      this.lastPlayedAt.set(video, Date.now())
      this.scheduleRefresh()
    }
    const onChange = (): void => this.scheduleRefresh()
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onChange)
    video.addEventListener('loadedmetadata', onChange)
    video.addEventListener('durationchange', onChange)
    video.addEventListener('emptied', onChange)

    this.eventCleanups.set(video, () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onChange)
      video.removeEventListener('loadedmetadata', onChange)
      video.removeEventListener('durationchange', onChange)
      video.removeEventListener('emptied', onChange)
    })
  }
}
