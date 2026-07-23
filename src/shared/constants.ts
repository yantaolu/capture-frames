export const APP_ROOT_ID = 'capture-frames-extension-root'
export const DEFAULT_FPS = 30
export const MIN_VIDEO_WIDTH = 80
export const MIN_VIDEO_HEIGHT = 45
export const SEEK_TIMEOUT_MS = 3_000
export const FRAME_TIMEOUT_MS = 2_000
export const FRAME_SAMPLE_LIMIT = 30
export const AUTO_STEP_INTERVAL_MS = 300

export const COMMANDS = ['previous-frame', 'toggle-playback', 'next-frame', 'export-frame'] as const

export type CommandName = (typeof COMMANDS)[number]
