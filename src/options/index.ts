import { makeSitePattern, RECOMMENDED_SITES, siteNameFromPattern } from '../shared/auto-sites'
import type { MessageResponse } from '../shared/messages'
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
const recommendedButton = byId<HTMLButtonElement>('enable-recommended')
const siteAddress = byId<HTMLInputElement>('site-address')
const siteList = byId<HTMLUListElement>('site-list')
const status = byId<HTMLSpanElement>('status')
let autoEnableSites: string[] = []

function render(settings: Settings): void {
  fpsMode.value = settings.fpsMode
  manualFps.value = String(settings.manualFps)
  manualFps.disabled = settings.fpsMode === 'auto'
  includeTitle.checked = settings.includePageTitle
  autoScroll.checked = settings.autoScrollToVideo
  showToasts.checked = settings.showToasts
  rememberPosition.checked = settings.rememberToolbarPosition
  autoFallback.checked = settings.autoVisibleCaptureFallback
  autoEnableSites = [...settings.autoEnableSites]
  renderSites()
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
    autoEnableSites: [...autoEnableSites],
    toolbarPosition: null,
  }
}

function showStatus(message: string): void {
  status.textContent = message
  setTimeout(() => {
    if (status.textContent === message) status.textContent = ''
  }, 2_400)
}

function renderSites(): void {
  siteList.replaceChildren()
  for (const pattern of autoEnableSites) {
    const item = document.createElement('li')
    const name = document.createElement('code')
    const recommended = RECOMMENDED_SITES.find((site) => site.pattern === pattern)
    name.textContent = recommended
      ? `${recommended.label} · ${siteNameFromPattern(pattern)}`
      : siteNameFromPattern(pattern)

    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'secondary'
    remove.textContent = '移除'
    remove.addEventListener('click', () => void removeSite(pattern))
    item.append(name, remove)
    siteList.append(item)
  }

  const allRecommendedEnabled = RECOMMENDED_SITES.every((site) =>
    autoEnableSites.includes(site.pattern),
  )
  recommendedButton.disabled = allRecommendedEnabled
  recommendedButton.textContent = allRecommendedEnabled ? '推荐网站已启用' : '启用推荐视频网站'
}

async function syncAutoSites(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    type: 'capture-frames:sync-auto-sites',
  })) as MessageResponse
  if (!response.ok) throw new Error(response.error ?? '自动启用配置同步失败')
}

async function persistAutoSites(nextSites: string[]): Promise<void> {
  const settings = await loadSettings()
  autoEnableSites = [...new Set(nextSites)]
  await saveSettings({ ...settings, autoEnableSites })
  await syncAutoSites()
  renderSites()
}

async function removeSite(pattern: string): Promise<void> {
  try {
    await chrome.permissions.remove({ origins: [pattern] })
    await persistAutoSites(autoEnableSites.filter((site) => site !== pattern))
    showStatus('网站已移除，刷新已打开的网站后完全关闭')
  } catch (error) {
    await initialize().catch(() => undefined)
    showStatus(error instanceof Error ? error.message : '移除网站失败')
  }
}

fpsMode.addEventListener('change', () => {
  manualFps.disabled = fpsMode.value === 'auto'
})

byId<HTMLButtonElement>('save').addEventListener('click', async () => {
  try {
    const previous = await loadSettings()
    await saveSettings({ ...read(), toolbarPosition: previous.toolbarPosition })
    await syncAutoSites()
    showStatus('设置已保存')
  } catch (error) {
    showStatus(error instanceof Error ? error.message : '保存设置失败')
  }
})

byId<HTMLButtonElement>('reset').addEventListener('click', async () => {
  try {
    const previousSites = [...autoEnableSites]
    if (previousSites.length > 0) await chrome.permissions.remove({ origins: previousSites })
    await saveSettings(DEFAULT_SETTINGS)
    await syncAutoSites()
    render(DEFAULT_SETTINGS)
    showStatus('已恢复默认设置，刷新已打开的网站后生效')
  } catch (error) {
    await initialize().catch(() => undefined)
    showStatus(error instanceof Error ? error.message : '恢复默认设置失败')
  }
})

recommendedButton.addEventListener('click', async () => {
  const patterns = RECOMMENDED_SITES.map((site) => site.pattern)
  const missingPatterns = patterns.filter((pattern) => !autoEnableSites.includes(pattern))
  try {
    const granted = await chrome.permissions.request({ origins: missingPatterns })
    if (!granted) {
      showStatus('未获得网站访问权限')
      return
    }
    await persistAutoSites([...autoEnableSites, ...patterns])
    showStatus('推荐视频网站已启用，刷新已打开的网站后生效')
  } catch (error) {
    await chrome.permissions.remove({ origins: missingPatterns }).catch(() => undefined)
    await initialize().catch(() => undefined)
    showStatus(error instanceof Error ? error.message : '启用推荐网站失败')
  }
})

byId<HTMLButtonElement>('add-site').addEventListener('click', async () => {
  let pattern = ''
  try {
    pattern = makeSitePattern(siteAddress.value)
    if (autoEnableSites.includes(pattern)) {
      showStatus('该网站已经启用')
      return
    }
    const granted = await chrome.permissions.request({ origins: [pattern] })
    if (!granted) {
      showStatus('未获得网站访问权限')
      return
    }
    await persistAutoSites([...autoEnableSites, pattern])
    siteAddress.value = ''
    showStatus('网站已添加，刷新目标网站后生效')
  } catch (error) {
    if (pattern) {
      await chrome.permissions.remove({ origins: [pattern] }).catch(() => undefined)
    }
    await initialize().catch(() => undefined)
    showStatus(error instanceof Error ? error.message : '添加网站失败')
  }
})

async function initialize(): Promise<void> {
  const settings = await loadSettings()
  const permittedSites: string[] = []
  for (const pattern of settings.autoEnableSites) {
    if (await chrome.permissions.contains({ origins: [pattern] })) permittedSites.push(pattern)
  }
  if (permittedSites.length !== settings.autoEnableSites.length) {
    settings.autoEnableSites = permittedSites
    await saveSettings(settings)
    await syncAutoSites()
  }
  render(settings)
}

void initialize().catch((error: unknown) => {
  showStatus(error instanceof Error ? error.message : '设置加载失败')
})
