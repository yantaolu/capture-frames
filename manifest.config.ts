import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: '逐帧截图',
  short_name: '逐帧截图',
  description: '控制网页视频逐帧前进或后退，并以原始解码尺寸导出当前帧。',
  version: pkg.version,
  minimum_chrome_version: '116',
  permissions: ['activeTab', 'scripting', 'storage'],
  optional_host_permissions: ['https://*/*', 'http://*/*'],
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_title: '启用逐帧截图',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
  options_page: 'src/options/index.html',
  commands: {
    'previous-frame': {
      suggested_key: {
        default: 'Ctrl+Shift+Comma',
        mac: 'Command+Shift+Comma',
      },
      description: '后退一帧',
    },
    'toggle-playback': {
      suggested_key: {
        default: 'Ctrl+Shift+P',
        mac: 'Command+Shift+P',
      },
      description: '开始或停止自动逐帧播放',
    },
    'next-frame': {
      suggested_key: {
        default: 'Ctrl+Shift+Period',
        mac: 'Command+Shift+Period',
      },
      description: '前进一帧',
    },
    'export-frame': {
      suggested_key: {
        default: 'Ctrl+Shift+E',
        mac: 'Command+Shift+E',
      },
      description: '导出当前帧',
    },
  },
})
