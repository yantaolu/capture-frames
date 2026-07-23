import contentScript from '../content/index.iife.ts?script'
import autoContentScript from '../content/auto.iife.ts?script'
import type { CommandName } from '../shared/constants'
import type { ExtensionMessage, MessageResponse } from '../shared/messages'
import { loadSettings } from '../shared/settings'

const AUTO_CONTENT_SCRIPT_ID = 'capture-frames-auto-sites'
let syncQueue: Promise<void> = Promise.resolve()

async function syncAutoContentScript(): Promise<void> {
  const registered = await chrome.scripting.getRegisteredContentScripts({
    ids: [AUTO_CONTENT_SCRIPT_ID],
  })
  const { autoEnableSites } = await loadSettings()
  const uniqueSites = [...new Set(autoEnableSites)]
  const permissionChecks = await Promise.all(
    uniqueSites.map((pattern) => chrome.permissions.contains({ origins: [pattern] })),
  )
  const permittedSites = uniqueSites.filter((_pattern, index) => permissionChecks[index])
  if (permittedSites.length === 0) {
    if (registered.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: [AUTO_CONTENT_SCRIPT_ID] })
    }
    return
  }

  const script = {
    id: AUTO_CONTENT_SCRIPT_ID,
    js: [autoContentScript],
    matches: permittedSites,
    persistAcrossSessions: true,
    runAt: 'document_idle' as const,
  }
  if (registered.length > 0) await chrome.scripting.updateContentScripts([script])
  else await chrome.scripting.registerContentScripts([script])
}

function enqueueAutoSiteSync(): Promise<void> {
  const next = syncQueue.catch(() => undefined).then(syncAutoContentScript)
  syncQueue = next
  return next
}

void enqueueAutoSiteSync().catch((error: unknown) => {
  console.warn('[capture-frames] 自动启用网站同步失败', error)
})

chrome.permissions.onRemoved.addListener(() => {
  void enqueueAutoSiteSync().catch((error: unknown) => {
    console.warn('[capture-frames] 网站权限撤销同步失败', error)
  })
})

async function inject(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [contentScript],
  })
}

async function waitUntilReady(tabId: number): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = (await chrome.tabs.sendMessage(tabId, {
        type: 'capture-frames:ping',
      } satisfies ExtensionMessage)) as MessageResponse | undefined
      if (response?.ok) return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw lastError instanceof Error ? lastError : new Error('逐帧控制初始化超时')
}

async function sendCommand(tabId: number, command: CommandName): Promise<void> {
  await inject(tabId)
  await waitUntilReady(tabId)
  await chrome.tabs.sendMessage(tabId, {
    type: 'capture-frames:command',
    command,
  } satisfies ExtensionMessage)
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) return
  try {
    await inject(tab.id)
  } catch (error) {
    console.warn('[capture-frames] 当前页面无法启用扩展', error)
  }
})

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (tab?.id === undefined) return
  try {
    await sendCommand(tab.id, command as CommandName)
  } catch (error) {
    console.warn('[capture-frames] 快捷键执行失败', error)
  }
})

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse: (response: MessageResponse) => void) => {
    if (message.type === 'capture-frames:sync-auto-sites') {
      void enqueueAutoSiteSync()
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) =>
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        )
      return true
    }

    if (message.type !== 'capture-frames:capture-visible-tab') return false

    const capture =
      sender.tab?.windowId === undefined
        ? chrome.tabs.captureVisibleTab({ format: 'png' })
        : chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' })
    capture
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      )

    return true
  },
)
