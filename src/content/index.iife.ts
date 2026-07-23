import { CaptureFramesApp } from './bootstrap'

declare global {
  interface Window {
    __captureFramesApp?: CaptureFramesApp
    __captureFramesAppPromise?: Promise<CaptureFramesApp>
  }
}

if (window.top === window) {
  if (window.__captureFramesApp?.isActive()) {
    window.__captureFramesApp.focus()
  } else {
    if (window.__captureFramesApp && !window.__captureFramesApp.isActive()) {
      window.__captureFramesApp = undefined
      window.__captureFramesAppPromise = undefined
    }
    if (!window.__captureFramesAppPromise) {
      const creation = CaptureFramesApp.create()
      window.__captureFramesAppPromise = creation
      void creation
        .then((app) => {
          window.__captureFramesApp = app
        })
        .catch((error: unknown) => {
          if (window.__captureFramesAppPromise === creation) {
            window.__captureFramesAppPromise = undefined
          }
          console.error('[capture-frames] 初始化失败', error)
        })
    }
  }
}
