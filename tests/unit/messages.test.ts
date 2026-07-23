import { describe, expect, it } from 'vitest'
import { isCommandMessage } from '../../src/shared/messages'

describe('message validation', () => {
  it('accepts known commands and rejects arbitrary data', () => {
    expect(isCommandMessage({ type: 'capture-frames:command', command: 'next-frame' })).toBe(true)
    expect(isCommandMessage({ type: 'capture-frames:command', command: 'delete-page' })).toBe(false)
    expect(isCommandMessage(null)).toBe(false)
  })
})
