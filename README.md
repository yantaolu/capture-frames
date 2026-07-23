# 逐帧截图

一个使用 TypeScript、Vite、CRXJS 和 Chrome Manifest V3 构建的本地视频逐帧控制扩展。

## 功能

- 自动识别页面中的 HTML5 视频，并优先选择正在播放或可见面积最大的视频。
- 后退一帧、自动逐帧播放/停止、前进一帧；自动播放通过串行 seek 推进，底层视频保持暂停。
- 多视频下拉切换及三次红色呼吸边框定位。
- 以视频原始解码尺寸导出无损 PNG。
- Canvas 跨域受限时，可降级为当前标签页可见区域截图。
- Shadow DOM 悬浮控制条，支持拖动、全屏和位置记忆。
- 自动检测帧间隔，也可手动设置 FPS。

## 开发

```bash
pnpm install
pnpm dev
```

在 Chrome 打开 `chrome://extensions`，启用开发者模式，加载开发产物。生产构建：

```bash
pnpm build
```

然后加载 `dist/` 目录。

## 使用

1. 打开包含 HTML5 视频的网页。
2. 点击 Chrome 工具栏中的“逐帧截图”扩展图标。
3. 使用右上角控制条或快捷键操作。

| 操作              | Windows / Linux | macOS       |
| ----------------- | --------------- | ----------- |
| 后退一帧          | `Ctrl+Shift+,`  | `⌘+Shift+,` |
| 自动逐帧播放/停止 | `Ctrl+Shift+P`  | `⌘+Shift+P` |
| 前进一帧          | `Ctrl+Shift+.`  | `⌘+Shift+.` |
| 导出当前帧        | `Ctrl+Shift+E`  | `⌘+Shift+E` |

快捷键可在 `chrome://extensions/shortcuts` 修改。

## 技术限制

- 浏览器没有稳定的标准“上一帧/下一帧”命令。扩展通过呈现帧的 `mediaTime` 和精确 seek 实现近似逐帧；可变帧率、直播和部分流媒体可能无法做到绝对帧精度。
- 跨域视频缺少 CORS 授权时，浏览器禁止 Canvas 读取原始像素。此时只能导出屏幕中可见的视频区域。
- DRM 视频通常不能导出原始帧。
- Canvas 可能对 HDR 视频进行色调映射，导出的 PNG 不保留原始 HDR 元数据。
- 支持主文档和同源 iframe 中的视频；跨域 iframe 受浏览器隔离限制，当前无法统一读取内部视频元素。

## 调试

开发模式会在页面开发者工具的 Console 中输出以 `[capture-frames]` 开头的结构化日志；生产构建默认关闭高频调试日志，只保留错误信息。调试时可按该前缀过滤，重点查看：

- `command.received`：按钮或快捷键是否送达、当前目标视频状态。
- `step.plan`：当前时间、估算帧间隔和目标时间。
- `seek.start` / `seek.seeking` / `seek.seeked`：定位事件是否完整触发。
- `step.complete`：实际落点是否与目标时间一致。
- `seek.timeout` / `auto.error`：失败时的视频 readyState、seekable 和 currentTime。

## 隐私

视频、帧图片、页面标题和网址均不会上传。扩展只在用户点击图标或使用快捷键后对当前标签页临时启用。
