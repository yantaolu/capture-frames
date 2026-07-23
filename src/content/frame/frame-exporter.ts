import { FrameError } from '../../shared/errors'
import type { MessageResponse } from '../../shared/messages'
import type { Settings } from '../../shared/settings'
import { makeFrameFileName } from './timestamp'
import { getVideoViewportRect } from '../video/video-candidate'

export interface ExportResult {
  mode: 'native' | 'visible-capture'
  width: number
  height: number
  fileName: string
}

export class FrameExporter {
  private readonly downloadUrls = new Map<string, number>()
  private disposed = false

  dispose(): void {
    this.disposed = true
    for (const [url, timer] of this.downloadUrls) {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
    }
    this.downloadUrls.clear()
  }

  async exportNative(
    video: HTMLVideoElement,
    mediaTime: number,
    settings: Settings,
  ): Promise<ExportResult> {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
      throw new FrameError('VIDEO_NOT_READY', '视频帧尚未准备完成')
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new FrameError('EXPORT_FAILED', '无法创建图片画布')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    let blob: Blob
    try {
      blob = await this.toBlob(canvas)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'SecurityError') {
        throw new FrameError('CANVAS_TAINTED', '该视频禁止读取原始像素', { cause: error })
      }
      throw error
    }

    const fileName = makeFrameFileName(mediaTime, settings.includePageTitle)
    this.download(blob, fileName)
    return { mode: 'native', width: canvas.width, height: canvas.height, fileName }
  }

  async exportVisibleCapture(
    video: HTMLVideoElement,
    mediaTime: number,
    settings: Settings,
    setUiHidden: (hidden: boolean) => void,
  ): Promise<ExportResult> {
    setUiHidden(true)
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const response = (await chrome.runtime.sendMessage({
        type: 'capture-frames:capture-visible-tab',
      })) as MessageResponse
      if (!response.ok || !response.dataUrl) {
        throw new FrameError('CAPTURE_FAILED', response.error ?? '标签页截图失败')
      }

      const image = await this.loadImage(response.dataUrl)
      const rect = getVideoViewportRect(video)
      const scaleX = image.naturalWidth / document.documentElement.clientWidth
      const scaleY = image.naturalHeight / document.documentElement.clientHeight
      const sourceX = Math.max(0, rect.left * scaleX)
      const sourceY = Math.max(0, rect.top * scaleY)
      const sourceWidth = Math.min(rect.width * scaleX, image.naturalWidth - sourceX)
      const sourceHeight = Math.min(rect.height * scaleY, image.naturalHeight - sourceY)
      if (sourceWidth <= 0 || sourceHeight <= 0) {
        throw new FrameError('CAPTURE_FAILED', '目标视频不在当前可见区域内')
      }

      const canvas = document.createElement('canvas')
      canvas.width = Math.round(sourceWidth)
      canvas.height = Math.round(sourceHeight)
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) throw new FrameError('CAPTURE_FAILED', '无法创建截图画布')
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      )

      const blob = await this.toBlob(canvas)
      const fileName = makeFrameFileName(mediaTime, settings.includePageTitle)
      this.download(blob, fileName)
      return { mode: 'visible-capture', width: canvas.width, height: canvas.height, fileName }
    } finally {
      setUiHidden(false)
    }
  }

  private toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new FrameError('EXPORT_FAILED', 'PNG 编码失败'))
        }, 'image/png')
      } catch (error) {
        reject(error)
      }
    })
  }

  private loadImage(source: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new FrameError('CAPTURE_FAILED', '无法读取标签页截图'))
      image.src = source
    })
  }

  private download(blob: Blob, fileName: string): void {
    if (this.disposed) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.hidden = true
    document.documentElement.append(anchor)
    anchor.click()
    anchor.remove()
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url)
      this.downloadUrls.delete(url)
    }, 1_000)
    this.downloadUrls.set(url, timer)
  }
}
