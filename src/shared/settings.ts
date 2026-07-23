export interface Settings {
  fpsMode: 'auto' | 'manual'
  manualFps: number
  includePageTitle: boolean
  autoScrollToVideo: boolean
  showToasts: boolean
  rememberToolbarPosition: boolean
  autoVisibleCaptureFallback: boolean
  autoEnableSites: string[]
  toolbarPosition: { x: number; y: number } | null
}

export const DEFAULT_SETTINGS: Settings = {
  fpsMode: 'auto',
  manualFps: 30,
  includePageTitle: false,
  autoScrollToVideo: false,
  showToasts: true,
  rememberToolbarPosition: true,
  autoVisibleCaptureFallback: false,
  autoEnableSites: [],
  toolbarPosition: null,
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get('settings')
  return { ...DEFAULT_SETTINGS, ...(stored.settings as Partial<Settings> | undefined) }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings })
}
