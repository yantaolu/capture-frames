import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../shared/settings'

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element: ${id}`)
  return element as T
}

const fpsMode = byId<HTMLSelectElement>('fps-mode')
const manualFps = byId<HTMLInputElement>('manual-fps')
const includeTitle = byId<HTMLInputElement>('include-title')
const autoScroll = byId<HTMLInputElement>('auto-scroll')
const showToasts = byId<HTMLInputElement>('show-toasts')
const rememberPosition = byId<HTMLInputElement>('remember-position')
const autoFallback = byId<HTMLInputElement>('auto-fallback')
const status = byId<HTMLSpanElement>('status')

function render(settings: Settings): void {
  fpsMode.value = settings.fpsMode
  manualFps.value = String(settings.manualFps)
  manualFps.disabled = settings.fpsMode === 'auto'
  includeTitle.checked = settings.includePageTitle
  autoScroll.checked = settings.autoScrollToVideo
  showToasts.checked = settings.showToasts
  rememberPosition.checked = settings.rememberToolbarPosition
  autoFallback.checked = settings.autoVisibleCaptureFallback
}

function read(): Settings {
  return {
    fpsMode: fpsMode.value === 'manual' ? 'manual' : 'auto',
    manualFps: Math.min(240, Math.max(1, Number(manualFps.value) || 30)),
    includePageTitle: includeTitle.checked,
    autoScrollToVideo: autoScroll.checked,
    showToasts: showToasts.checked,
    rememberToolbarPosition: rememberPosition.checked,
    autoVisibleCaptureFallback: autoFallback.checked,
    toolbarPosition: null,
  }
}

fpsMode.addEventListener('change', () => {
  manualFps.disabled = fpsMode.value === 'auto'
})

byId<HTMLButtonElement>('save').addEventListener('click', async () => {
  const previous = await loadSettings()
  await saveSettings({ ...read(), toolbarPosition: previous.toolbarPosition })
  status.textContent = '设置已保存'
  setTimeout(() => (status.textContent = ''), 2_000)
})

byId<HTMLButtonElement>('reset').addEventListener('click', async () => {
  await saveSettings(DEFAULT_SETTINGS)
  render(DEFAULT_SETTINGS)
  status.textContent = '已恢复默认设置'
})

void loadSettings().then(render)
