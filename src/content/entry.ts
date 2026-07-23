import { CaptureFramesApp, type ActivationMode } from './bootstrap'

declare global {
  interface Window {
    __captureFramesApp?: CaptureFramesApp
    __captureFramesAppPromise?: Promise<CaptureFramesApp>
  }
}

export function activateCaptureFrames(mode: ActivationMode): void {
  if (window.top !== window) return

  if (window.__captureFramesApp?.isActive()) {
    if (mode === 'manual') window.__captureFramesApp.focus()
    return
  }

  if (window.__captureFramesApp && !window.__captureFramesApp.isActive()) {
    window.__captureFramesApp = undefined
    window.__captureFramesAppPromise = undefined
  }

  if (window.__captureFramesAppPromise) {
    if (mode === 'manual') {
      void window.__captureFramesAppPromise.then((app) => app.focus())
    }
    return
  }

  const creation = CaptureFramesApp.create(mode)
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
