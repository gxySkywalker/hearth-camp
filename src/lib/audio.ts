// ── Volume constants ──────────────────────────────────────────
export const BGM_DEFAULT_VOLUME = 0.2
export const UI_SELECT_VOLUME = 0.25
export const UI_MAIL_OPEN_VOLUME = 0.3

class BgmManager {
  private current: HTMLAudioElement | null = null
  private currentSrc = ''
  private baseVolume = BGM_DEFAULT_VOLUME
  private lastVolume = BGM_DEFAULT_VOLUME  // 静音前的音量，用于恢复

  /** 切换背景音乐（自动循环），相同曲目不重复加载 */
  play(src: string, volume = this.baseVolume) {
    if (this.currentSrc === src && this.current && !this.current.paused) return
    this.stop()
    const audio = new Audio(src)
    audio.loop = true
    audio.volume = volume
    audio.play().catch(() => {})
    this.current = audio
    this.currentSrc = src
  }

  /** 停止当前 BGM */
  stop() {
    if (this.current) {
      this.current.pause()
      this.current.currentTime = 0
      this.current = null
      this.currentSrc = ''
    }
  }

  /** 设置音量（0-1）。如果非零则同时记住为恢复音量 */
  volume(value: number) {
    const v = Math.max(0, Math.min(1, value))
    if (v > 0) this.lastVolume = v
    this.baseVolume = v
    if (this.current) this.current.volume = v
  }

  /** 获取当前基础音量 */
  getVolume() { return this.baseVolume }
  /** 获取静音前的音量，用于恢复 */
  getLastVolume() { return this.lastVolume }
}

export const bgm = new BgmManager()

// ── UI Sound Effects ──────────────────────────────────────────

const UI_SOUNDS: Record<string, { src: string; volume: number }> = {
  select: { src: 'audio/ui_select.wav', volume: UI_SELECT_VOLUME },
  mail_open: { src: 'audio/mail_open.wav', volume: UI_MAIL_OPEN_VOLUME },
}

let lastSelectPlayedAt = 0

/**
 * Play a one-shot UI sound effect.
 * Fail-silent: missing files and autoplay blocks are caught.
 * Only 'select' and 'mail_open' are currently supported.
 */
export function playUISound(type: string): void {
  const def = UI_SOUNDS[type]
  if (!def) return
  // Global delegation and a few existing feature-specific handlers can observe
  // the same interaction. Keep a single tactile click without muting rapid,
  // intentional separate selections.
  const now = performance.now()
  if (type === 'select' && now - lastSelectPlayedAt < 45) return
  if (type === 'select') lastSelectPlayedAt = now
  try {
    const audio = new Audio(def.src)
    audio.volume = def.volume
    audio.play().catch(() => {})
  } catch { /* audio unavailable — no-op */ }
}
