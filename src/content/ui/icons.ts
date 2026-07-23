const svg = (path: string): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`

export const ICONS = {
  previous: svg(
    '<path d="M6.5 5.5v13"/><path d="m17.5 6-8 6 8 6z" fill="currentColor" stroke="none"/>',
  ),
  play: svg('<path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none"/>'),
  pause: svg('<path d="M7 5.5h3.5v13H7zM13.5 5.5H17v13h-3.5z" fill="currentColor" stroke="none"/>'),
  next: svg(
    '<path d="M17.5 5.5v13"/><path d="m6.5 6 8 6-8 6z" fill="currentColor" stroke="none"/>',
  ),
  export: svg(
    '<path d="M12 3.5v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M5 14.5v5h14v-5"/>',
  ),
} as const
