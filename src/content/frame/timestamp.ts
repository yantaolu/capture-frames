export function formatClock(value: number): string {
  const safeValue = Number.isFinite(value) && value >= 0 ? value : 0
  const totalSeconds = Math.floor(safeValue)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

export function formatTimestamp(value: number): string {
  const safeValue = Number.isFinite(value) && value >= 0 ? value : 0
  const totalMilliseconds = Math.round(safeValue * 1000)
  const milliseconds = totalMilliseconds % 1000
  const totalSeconds = Math.floor(totalMilliseconds / 1000)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)
  return `${String(hours).padStart(2, '0')}-${String(minutes).padStart(2, '0')}-${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

export function sanitizeFilePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 80)
}

export function makeFrameFileName(mediaTime: number, includePageTitle: boolean): string {
  const prefix = includePageTitle ? sanitizeFilePart(document.title) : ''
  const base = `frame_${formatTimestamp(mediaTime)}.png`
  return prefix ? `${prefix}_${base}` : base
}
