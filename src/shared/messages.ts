import type { CommandName } from './constants'

export type ExtensionMessage =
  | { type: 'capture-frames:command'; command: CommandName }
  | { type: 'capture-frames:ping' }
  | { type: 'capture-frames:capture-visible-tab' }

export interface MessageResponse {
  ok: boolean
  dataUrl?: string
  error?: string
}

export function isCommandMessage(
  value: unknown,
): value is Extract<ExtensionMessage, { type: 'capture-frames:command' }> {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  return (
    message.type === 'capture-frames:command' &&
    ['previous-frame', 'toggle-playback', 'next-frame', 'export-frame'].includes(
      String(message.command),
    )
  )
}
