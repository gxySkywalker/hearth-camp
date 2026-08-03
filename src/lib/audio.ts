// ── Volume constants ──────────────────────────────────────────
export const BGM_DEFAULT_VOLUME = 0.2
export const UI_SELECT_VOLUME = 0.25
export const UI_MAIL_OPEN_VOLUME = 0.3

type LoopSound = 'hearth' | 'footstepWood' | 'footstepRug'

const LOOP_SOUNDS: Record<LoopSound, { src: string; volume: number }> = {
  hearth: { src: '/audio/fire.wav', volume: 0.12 },
  footstepWood: { src: '/audio/footstep-wood.wav', volume: 0.11 },
  footstepRug: { src: '/audio/footstep-rug.wav', volume: 0.09 },
}

const ONE_SHOT_SOUNDS = {
  reward: { src: '/audio/reward.wav', volume: 0.34 },
  levelUp: { src: '/audio/level-up.wav', volume: 0.38 },
} as const

export type BgmTrack = 'cottage' | 'expedition'
export type BgmSources = Record<BgmTrack, string | null>

class BgmManager {
  private current: HTMLAudioElement | null = null
  private currentSrc = ''
  private baseVolume = BGM_DEFAULT_VOLUME
  private lastVolume = BGM_DEFAULT_VOLUME  // 静音前的音量，用于恢复
  private sources: BgmSources = { cottage: null, expedition: null }
  private requestedTrack: BgmTrack | null = null

  /** 从内置音乐或本地 BGM 包更新两个固定场景的音乐来源。 */
  setSources(sources: BgmSources) {
    this.sources = sources
    if (this.requestedTrack) this.play(this.requestedTrack)
  }

  /** 切换背景音乐（自动循环）；没有可用音乐时保持安静。 */
  play(track: BgmTrack, volume = this.baseVolume) {
    this.requestedTrack = track
    const src = this.sources[track]
    if (!src) {
      this.stopCurrent()
      return
    }
    if (this.currentSrc === src && this.current && !this.current.paused) return
    this.stopCurrent()
    const audio = new Audio(src)
    audio.loop = true
    audio.volume = volume
    audio.play().catch(() => {})
    this.current = audio
    this.currentSrc = src
  }

  /** 停止当前 BGM */
  stop() {
    this.requestedTrack = null
    this.stopCurrent()
  }

  /**
   * Chromium may reject the automatic first play until the traveller has
   * clicked or pressed a key once. Retry the requested track from that gesture
   * instead of leaving a paused audio element behind for the whole session.
   */
  resumeAfterUserGesture() {
    if (this.requestedTrack) this.play(this.requestedTrack)
  }

  private stopCurrent() {
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

class WorldSoundManager {
  private loops: Partial<Record<LoopSound, HTMLAudioElement>> = {}
  private hearthCurrent: HTMLAudioElement | null = null
  private hearthNext: HTMLAudioElement | null = null
  private hearthFadeStartedAt: number | null = null
  private hearthAnimationFrame: number | null = null
  private hearthRequested = false

  setLoop(sound: LoopSound, active: boolean) {
    if (sound === 'hearth') {
      this.setHearthLoop(active)
      return
    }
    const current = this.loops[sound]
    if (!active) {
      if (current) {
        current.pause()
        current.currentTime = 0
        delete this.loops[sound]
      }
      return
    }
    if (current && !current.paused) return
    if (current) {
      void current.play().catch(() => {})
      return
    }
    try {
      const definition = LOOP_SOUNDS[sound]
      const audio = new Audio(definition.src)
      audio.loop = true
      audio.volume = definition.volume
      audio.preload = 'auto'
      this.loops[sound] = audio
      void audio.play().catch(() => {})
    } catch { /* sound remains optional when browser audio is unavailable */ }
  }

  /**
   * `HTMLAudioElement.loop` hard-cuts a WAV at its file boundary. The hearth
   * instead overlaps two copies for a short fade, so its fire stays a single
   * continuous bed of sound rather than a clearly repeating sample.
   */
  private setHearthLoop(active: boolean) {
    this.hearthRequested = active
    if (!active) {
      if (this.hearthAnimationFrame !== null) cancelAnimationFrame(this.hearthAnimationFrame)
      this.hearthAnimationFrame = null
      this.hearthFadeStartedAt = null
      ;[this.hearthCurrent, this.hearthNext].forEach((audio) => {
        if (!audio) return
        audio.pause()
        audio.currentTime = 0
      })
      this.hearthCurrent = null
      this.hearthNext = null
      return
    }
    if (this.hearthCurrent && !this.hearthCurrent.paused) return
    const definition = LOOP_SOUNDS.hearth
    const create = () => {
      const audio = new Audio(definition.src)
      audio.loop = false
      audio.playbackRate = .6
      audio.volume = definition.volume
      audio.preload = 'auto'
      // Metadata can briefly be unavailable on a cold load. This fallback
      // keeps the hearth alive; normal playback uses the crossfade below.
      audio.addEventListener('ended', () => {
        if (this.hearthCurrent === audio && !this.hearthNext) {
          audio.currentTime = 0
          void audio.play().catch(() => {})
        }
      })
      return audio
    }
    this.hearthCurrent = create()
    void this.hearthCurrent.play().catch(() => {})
    const crossfadeSeconds = .55
    const tick = () => {
      const current = this.hearthCurrent
      if (!current) return
      const duration = current.duration
      if (Number.isFinite(duration) && duration > crossfadeSeconds + .1) {
        // `currentTime` advances in media seconds, while the fade runs in
        // real time. Account for the reduced playback rate so the first
        // sound remains alive until the crossfade has completed.
        const fadeMediaSeconds = crossfadeSeconds * current.playbackRate
        if (!this.hearthNext && current.currentTime >= duration - fadeMediaSeconds) {
          const next = create()
          next.volume = 0
          this.hearthNext = next
          this.hearthFadeStartedAt = performance.now()
          void next.play().catch(() => {})
        }
        if (this.hearthNext && this.hearthFadeStartedAt !== null) {
          const progress = Math.min(1, (performance.now() - this.hearthFadeStartedAt) / (crossfadeSeconds * 1000))
          current.volume = definition.volume * (1 - progress)
          this.hearthNext.volume = definition.volume * progress
          if (progress >= 1) {
            current.pause()
            current.currentTime = 0
            this.hearthCurrent = this.hearthNext
            this.hearthNext = null
            this.hearthFadeStartedAt = null
          }
        }
      }
      this.hearthAnimationFrame = requestAnimationFrame(tick)
    }
    this.hearthAnimationFrame = requestAnimationFrame(tick)
  }

  stopAll() {
    ;(Object.keys(LOOP_SOUNDS) as LoopSound[]).forEach((sound) => this.setLoop(sound, false))
  }

  /** Retry a loop that Chromium rejected before the first user interaction. */
  resumeAfterUserGesture() {
    if (!this.hearthRequested || !this.hearthCurrent || !this.hearthCurrent.paused) return
    void this.hearthCurrent.play().catch(() => {})
  }

  playOnce(sound: keyof typeof ONE_SHOT_SOUNDS) {
    try {
      const definition = ONE_SHOT_SOUNDS[sound]
      const audio = new Audio(definition.src)
      audio.volume = definition.volume
      audio.preload = 'auto'
      void audio.play().catch(() => {})
    } catch { /* one-shot feedback is non-blocking */ }
  }
}

export const worldSound = new WorldSoundManager()

export function setHearthFireSound(active: boolean) {
  worldSound.setLoop('hearth', active)
}

export function resumeWorldSoundsAfterUserGesture() {
  worldSound.resumeAfterUserGesture()
}

export function setCottageFootsteps(surface: 'wood' | 'rug' | null) {
  worldSound.setLoop('footstepWood', surface === 'wood')
  worldSound.setLoop('footstepRug', surface === 'rug')
}

export function playRewardSound() { worldSound.playOnce('reward') }
export function playLevelUpSound() { worldSound.playOnce('levelUp') }

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
