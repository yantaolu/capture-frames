import { describe, expect, it } from 'vitest'
import { makeSitePattern, siteNameFromPattern } from '../../src/shared/auto-sites'

describe('auto site patterns', () => {
  it('normalizes a hostname to an HTTPS match pattern', () => {
    expect(makeSitePattern('www.example.com/video/1')).toBe('https://www.example.com/*')
  })

  it('preserves an explicit HTTP scheme', () => {
    expect(makeSitePattern('http://example.com/watch')).toBe('http://example.com/*')
  })

  it('rejects unsupported protocols', () => {
    expect(() => makeSitePattern('file:///tmp/video.mp4')).toThrow('仅支持 HTTP 或 HTTPS 网站')
  })

  it('formats a match pattern for display', () => {
    expect(siteNameFromPattern('https://*.example.com/*')).toBe('*.example.com')
  })
})
