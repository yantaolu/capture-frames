export interface RecommendedSite {
  label: string
  pattern: string
}

export const RECOMMENDED_SITES: RecommendedSite[] = [
  { label: '爱奇艺', pattern: 'https://www.iqiyi.com/*' },
  { label: '优酷', pattern: 'https://v.youku.com/*' },
  { label: '腾讯视频', pattern: 'https://v.qq.com/*' },
  { label: '哔哩哔哩', pattern: 'https://www.bilibili.com/*' },
  { label: '哔哩哔哩直播', pattern: 'https://live.bilibili.com/*' },
]

export function makeSitePattern(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('请输入网站地址')

  let url: URL
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    throw new Error('网站地址格式不正确')
  }

  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error('仅支持 HTTP 或 HTTPS 网站')
  }

  return `${url.protocol}//${url.hostname}/*`
}

export function siteNameFromPattern(pattern: string): string {
  return pattern.replace(/^https?:\/\//, '').replace(/\/\*$/, '')
}
