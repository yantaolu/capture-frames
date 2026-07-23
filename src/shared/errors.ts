export type FrameErrorCode =
  | 'NO_VIDEO'
  | 'VIDEO_NOT_READY'
  | 'VIDEO_NOT_SEEKABLE'
  | 'FRAME_TIMEOUT'
  | 'CANVAS_TAINTED'
  | 'EXPORT_FAILED'
  | 'CAPTURE_FAILED'
  | 'FRAME_REMOVED'

export class FrameError extends Error {
  constructor(
    readonly code: FrameErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'FrameError'
  }
}
