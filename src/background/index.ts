import contentScript from '../content/index.iife.ts?script'
import type { CommandName } from '../shared/constants'
import type { ExtensionMessage, MessageResponse } from '../shared/messages'

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
