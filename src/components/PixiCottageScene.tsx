import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import 'pixi.js/unsafe-eval'
import type { Application, Graphics, Sprite, Texture } from 'pixi.js'
import type { Companion } from '../types'
import { canHandle, setInputContext } from '../lib/inputContext'
import { playUISound, setCottageFootsteps } from '../lib/audio'
import { getCottageLightPeriod, type CottageLightPeriod } from '../lib/cottage-lighting'
import roomDayBackdrop from '../../assets/art/environments/cottage/cottage_room_day_512_v1.png'
import roomNightBackdrop from '../../assets/art/environments/cottage/cottage_room_night_512_v1.png'
import hearthFireAtlas from '../../assets/art/environments/cottage/cottage_hearth_fire_4frames_v1.png'
import hearthTravelerNativeWalkAtlas from '../../assets/art/characters/player/player_adventurer_hearth_native_walk_32x48_v2.png'
import blueTravelerNativeWalkAtlas from '../../assets/art/characters/player/player_adventurer_blue_native_walk_32x48_v2.png'
import ochreTravelerNativeWalkAtlas from '../../assets/art/characters/player/player_adventurer_ochre_native_walk_32x48_v2.png'
import silverTravelerNativeWalkAtlas from '../../assets/art/characters/player/player_adventurer_silver_native_walk_32x48_v1.png'
import hearthHoundWalkAtlas from '../../assets/art/characters/companions/hearth_hound_walk_48_v1.png'
import hearthHoundManeWalkAtlas from '../../assets/art/characters/companions/hearth_hound_stage-1_walk_48_v1.png'
import hearthHoundEmberTailWalkAtlas from '../../assets/art/characters/companions/hearth_hound_ember_tail_walk_48_v1.png'
import hearthHoundPineShadowWalkAtlas from '../../assets/art/characters/companions/hearth_hound_pine_shadow_walk_48_v1.png'
import hearthHoundMoonPawWalkAtlas from '../../assets/art/characters/companions/hearth_hound_moon_paw_walk_48_v1.png'
import mossFoxWalkAtlas from '../../assets/art/characters/companions/moss_fox_stage-0_walk_48_v1.png'
import mossFoxGrownWalkAtlas from '../../assets/art/characters/companions/moss_fox_stage-1_walk_48_v1.png'
import mossFoxForestCrownWalkAtlas from '../../assets/art/characters/companions/moss_fox_forest_crown_walk_48_v1.png'
import glimmerCatWalkAtlas from '../../assets/art/characters/companions/glimmer_cat_stage-0_walk_48_v1.png'
import glimmerCatGrownWalkAtlas from '../../assets/art/characters/companions/glimmer_cat_stage-1_walk_48_v1.png'
import glimmerCatNightGlassWalkAtlas from '../../assets/art/characters/companions/glimmer_cat_night_glass_walk_48_v1.png'
import riverOtterWalkAtlas from '../../assets/art/characters/companions/river_otter_stage-0_walk_48_v1.png'
import riverOtterGrownWalkAtlas from '../../assets/art/characters/companions/river_otter_stage-1_walk_48_v1.png'
import riverOtterBayCurrentWalkAtlas from '../../assets/art/characters/companions/river_otter_bay_current_walk_48_v1.png'
import ironBadgerWalkAtlas from '../../assets/art/characters/companions/iron_badger_stage-0_walk_48_v1.png'
import ironBadgerGrownWalkAtlas from '../../assets/art/characters/companions/iron_badger_stage-1_walk_48_v1.png'
import ironBadgerArmorKingWalkAtlas from '../../assets/art/characters/companions/iron_badger_armor_king_walk_48_v1.png'
import moonOwlWalkAtlas from '../../assets/art/characters/companions/moon_owl_stage-0_walk_48_v1.png'
import moonOwlGrownWalkAtlas from '../../assets/art/characters/companions/moon_owl_stage-1_walk_48_v1.png'
import moonOwlFinalWalkAtlas from '../../assets/art/characters/companions/moon_owl_dusk_owl_walk_48_v1.png'
import cloudRabbitWalkAtlas from '../../assets/art/characters/companions/cloud_rabbit_stage-0_walk_48_v1.png'
import cloudRabbitGrownWalkAtlas from '../../assets/art/characters/companions/cloud_rabbit_stage-1_walk_48_v1.png'
import cloudRabbitFinalWalkAtlas from '../../assets/art/characters/companions/cloud_rabbit_wind_tuft_rabbit_walk_48_v1.png'
import emberDrakeWalkAtlas from '../../assets/art/characters/companions/ember_drake_stage-0_walk_48_v2.png'
import emberDrakeGrownWalkAtlas from '../../assets/art/characters/companions/ember_drake_stage-1_walk_48_v2.png'
import emberDrakeFinalWalkAtlas from '../../assets/art/characters/companions/ember_drake_ember_drake_walk_48_v2.png'
import honeyBearWalkAtlas from '../../assets/art/characters/companions/valley_honey_bear_stage-0_walk_48_v1.png'
import honeyBearGrownWalkAtlas from '../../assets/art/characters/companions/valley_honey_bear_stage-1_walk_48_v1.png'
import honeyBearFinalWalkAtlas from '../../assets/art/characters/companions/valley_honey_bear_rock_honey_guardian_walk_48_v1.png'
import cloudfieldSheepWalkAtlas from '../../assets/art/characters/companions/cloudfield_sheep_stage-0_walk_48_v1.png'
import cloudfieldSheepGrownWalkAtlas from '../../assets/art/characters/companions/cloudfield_sheep_stage-1_walk_48_v1.png'
import cloudfieldSheepFinalWalkAtlas from '../../assets/art/characters/companions/cloudfield_sheep_morning_breeze_walk_48_v1.png'
import {
  COTTAGE_PLAYER_HEIGHT,
  COTTAGE_PLAYER_WIDTH,
  COTTAGE_COMPANION_POSITION,
  getCottageResidentPosition,
  resolveCottageWanderMove,
  findOpenCottageCompanionPosition,
  areCottageCompanionsCrowded,
  advanceCottageCompanion,
  areCottageEntitiesCrowded,
  findCottageCompanionYieldPosition,
  getCottageMoveDirection,
  getRememberedCottageCompanionPosition,
  getRememberedCottagePlayerPosition,
  COTTAGE_SCENE_HEIGHT,
  COTTAGE_SCENE_WIDTH,
  getCottageInteraction,
  getCottageFloorSoundSurface,
  isNearCottageCompanion,
  rememberCottagePlayerPosition,
  rememberCottageCompanionPosition,
  resolveCottageMove,
  type CottageInteractionAction,
  type CottageCompanionMode,
  type CottageDirection,
  type CottagePosition,
} from '../lib/cottage-scene'
import '../pixi-cottage-scene.css'
import '../cottage-scene.css'

const COMPANION_RUNTIME_FRAME_SIZE = 48
const PRODUCTION_COMPANION_SPECIES = new Set(['hearth_hound', 'moss_fox', 'glimmer_cat', 'river_otter', 'iron_badger', 'moon_owl', 'cloud_rabbit', 'ember_drake', 'valley_honey_bear', 'cloudfield_sheep'])

function atlasForCompanion(companion: Companion | null) {
  if (!companion) return hearthHoundWalkAtlas
  const stage = Number(companion.stage || 0)
  if (companion.species_id === 'hearth_hound') {
    if (stage >= 2) return ({ ember_tail: hearthHoundEmberTailWalkAtlas, pine_shadow: hearthHoundPineShadowWalkAtlas, moon_paw: hearthHoundMoonPawWalkAtlas }[companion.evolution_path] || hearthHoundManeWalkAtlas)
    return stage >= 1 ? hearthHoundManeWalkAtlas : hearthHoundWalkAtlas
  }
  if (companion.species_id === 'moss_fox') return stage >= 2 && companion.evolution_path === 'forest_crown' ? mossFoxForestCrownWalkAtlas : stage >= 1 ? mossFoxGrownWalkAtlas : mossFoxWalkAtlas
  if (companion.species_id === 'glimmer_cat') return stage >= 2 && companion.evolution_path === 'night_glass' ? glimmerCatNightGlassWalkAtlas : stage >= 1 ? glimmerCatGrownWalkAtlas : glimmerCatWalkAtlas
  if (companion.species_id === 'river_otter') return stage >= 2 && companion.evolution_path === 'bay_current' ? riverOtterBayCurrentWalkAtlas : stage >= 1 ? riverOtterGrownWalkAtlas : riverOtterWalkAtlas
  if (companion.species_id === 'iron_badger') return stage >= 2 && companion.evolution_path === 'armor_king' ? ironBadgerArmorKingWalkAtlas : stage >= 1 ? ironBadgerGrownWalkAtlas : ironBadgerWalkAtlas
  if (companion.species_id === 'moon_owl') return stage >= 2 && companion.evolution_path === 'dusk_owl' ? moonOwlFinalWalkAtlas : stage >= 1 ? moonOwlGrownWalkAtlas : moonOwlWalkAtlas
  if (companion.species_id === 'cloud_rabbit') return stage >= 2 && companion.evolution_path === 'wind_tuft_rabbit' ? cloudRabbitFinalWalkAtlas : stage >= 1 ? cloudRabbitGrownWalkAtlas : cloudRabbitWalkAtlas
  if (companion.species_id === 'ember_drake') return stage >= 2 && companion.evolution_path === 'ember_drake' ? emberDrakeFinalWalkAtlas : stage >= 1 ? emberDrakeGrownWalkAtlas : emberDrakeWalkAtlas
  if (companion.species_id === 'valley_honey_bear') return stage >= 2 && companion.evolution_path === 'rock_honey_guardian' ? honeyBearFinalWalkAtlas : stage >= 1 ? honeyBearGrownWalkAtlas : honeyBearWalkAtlas
  if (companion.species_id === 'cloudfield_sheep') return stage >= 2 && companion.evolution_path === 'morning_breeze' ? cloudfieldSheepFinalWalkAtlas : stage >= 1 ? cloudfieldSheepGrownWalkAtlas : cloudfieldSheepWalkAtlas
  return hearthHoundWalkAtlas
}

function companionVisual(companion: Companion | null) {
  const stage = Number(companion?.stage || 0)
  const production = PRODUCTION_COMPANION_SPECIES.has(companion?.species_id || '')
  const size = production && stage >= 2 ? 56 : production && stage >= 1 ? 48 : 40
  const hover = companion?.species_id === 'ember_drake' && stage >= 1 ? stage >= 2 ? 6 : 4 : 0
  return { size, hover, production }
}

/**
 * The cottage background is intentionally a single approved illustration.
 * Rather than generate a visually mismatched foreground PNG, these narrow
 * crops redraw the front lips of key furniture above actors. Their z-index is
 * based on the same ground Y as the player, so an actor in front remains in
 * front while an actor behind is naturally occluded.
 */
const FOREGROUND_OCCLUSION_SLICES = [
  { x: 207, y: 101, width: 70, height: 13, name: '日志桌前沿' },
  { x: 319, y: 98, width: 116, height: 14, name: '制图桌前沿' },
  { x: 423, y: 114, width: 76, height: 16, name: '宝箱前沿' },
  { x: 444, y: 226, width: 68, height: 25, name: '床脚前沿' },
  { x: 223, y: 263, width: 66, height: 17, name: '门槛前沿' },
] as const

export function PixiCottageScene({
  playerName,
  playerAvatar = 'traveler_clothes',
  companion = null,
  companions = [],
  immersive = false,
  onAction,
  onCompanionInteract,
  companionMode = 'follow',
  residentModes = {},
  pausedCompanionId = null,
  hearthLit = false,
  hearthAvailable = false,
  onInitError,
}: {
  playerName: string
  playerAvatar?: string
  companion?: Companion | null
  companions?: Companion[]
  immersive?: boolean
  onAction?: (action: CottageInteractionAction) => void
  onCompanionInteract?: (companion: Companion) => void
  companionMode?: CottageCompanionMode
  residentModes?: Record<string, CottageCompanionMode>
  pausedCompanionId?: string | null
  hearthLit?: boolean
  hearthAvailable?: boolean
  onInitError?: () => void
}) {
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const backdropRef = useRef<Sprite | null>(null)
  const backdropTexturesRef = useRef<Partial<Record<CottageLightPeriod, Texture>>>({})
  const foregroundOcclusionRef = useRef<Sprite[]>([])
  const foregroundOcclusionTexturesRef = useRef<Partial<Record<CottageLightPeriod, Texture[]>>>({})
  const hearthFireRef = useRef<Sprite | null>(null)
  // The persisted hearth state can resolve while Pixi is still loading its
  // textures. Keep the newest value available to the async scene initializer.
  const hearthLitRef = useRef(hearthLit)
  hearthLitRef.current = hearthLit
  const playerSpriteRef = useRef<Sprite | null>(null)
  const companionSpriteRef = useRef<Sprite | Graphics | null>(null)
  const houndSpriteRef = useRef<Sprite | null>(null)
  const residentSpriteRefs = useRef<Sprite[]>([])
  const residentSpriteByIdRef = useRef<Record<string, Sprite>>({})
  const residentFramesRef = useRef<Record<string, Record<CottageDirection, Texture[]>>>({})
  const residentPositionsRef = useRef<Record<string, CottagePosition>>({})
  const residentWanderRef = useRef<Record<string, { direction?: CottageDirection; stepsRemaining: number; pauseUntil: number; frame: number; waitingForPlayer: boolean }>>({})
  const activeWanderRef = useRef<{ direction?: CottageDirection; stepsRemaining: number; pauseUntil: number; waitingForPlayer: boolean }>({ stepsRemaining: 0, pauseUntil: 0, waitingForPlayer: false })
  const activeCompanionIdRef = useRef<string | null>(companion?.id || null)
  const residentPositionOverridesRef = useRef<Record<string, CottagePosition>>({})
  const playerFramesRef = useRef<Record<CottageDirection, Texture[]> | null>(null)
  const companionFramesRef = useRef<Record<CottageDirection, Texture[]> | null>(null)
  const [position, setPosition] = useState<CottagePosition>(() => getRememberedCottagePlayerPosition())
  const [companionPosition, setCompanionPosition] = useState<CottagePosition>(() => getRememberedCottageCompanionPosition())
  const [companionDirection, setCompanionDirection] = useState<CottageDirection>('south')
  const [companionWalkFrame, setCompanionWalkFrame] = useState(0)
  const [direction, setDirection] = useState<CottageDirection>('south')
  const [walkFrame, setWalkFrame] = useState(0)
  const [pressedMoveKey, setPressedMoveKey] = useState<string | null>(null)
  const [lightPeriod, setLightPeriod] = useState<CottageLightPeriod>(() => getCottageLightPeriod())
  const lightPeriodRef = useRef<CottageLightPeriod>(lightPeriod)
  const [timeNotice, setTimeNotice] = useState<string | null>(null)
  const timeNoticeTimerRef = useRef<number | null>(null)
  const companionPushRef = useRef<{ direction: CottageDirection; since: number } | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [message, setMessage] = useState('使用方向键或 WASD 移动；靠近物件后按 E、空格或回车。')
  const companionPositionRef = useRef(companionPosition)
  const playerPositionRef = useRef(position)
  companionPositionRef.current = companionPosition
  playerPositionRef.current = position
  const residentCompanions = companions.filter((item) => !item.is_ill && item.id !== companion?.id)
  const companionsSignature = companions.map((item) => `${item.id}:${item.is_ill}:${item.stage}:${item.evolution_path}`).join('|')
  const residentPositionFor = (item: Companion) => residentPositionsRef.current[item.id]
    || residentPositionOverridesRef.current[item.id] || getCottageResidentPosition(item.species_id)

  useEffect(() => {
    let disposed = false
    let initialized = false
    let app: Application | null = null

    const start = async () => {
      try {
        // Dynamic import isolates renderer capability failures in Electron.
        // The caller can then safely render the pre-existing DOM cottage fallback.
        const { Application, Graphics, Rectangle, Sprite, Texture } = await import('pixi.js')
        app = new Application()
        await app.init({
          width: COTTAGE_SCENE_WIDTH,
          height: COTTAGE_SCENE_HEIGHT,
          antialias: false,
          autoDensity: false,
          backgroundAlpha: 0,
          resolution: 1,
          preference: 'webgl',
        })
        initialized = true
        if (disposed || !canvasHostRef.current) {
          app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false })
          return
        }

        app.stage.sortableChildren = true
        appRef.current = app
        app.canvas.classList.add('pixi-cottage-canvas')
        canvasHostRef.current.appendChild(app.canvas)

        const loadTexture = async (url: string) => {
          const image = new Image()
          image.src = url
          await image.decode()
          const texture = Texture.from(image)
          // Canvas defaults to linear filtering. That softens an atlas as soon
          // as a companion is shown larger than one native pixel per texel.
          // Keep every game sprite on nearest-neighbour sampling instead.
          texture.source.style.scaleMode = 'nearest'
          return texture
        }
        const usesProductionAtlas = !companion || PRODUCTION_COMPANION_SPECIES.has(companion.species_id)
        const selectedPlayerAtlas = {
          traveler_clothes: hearthTravelerNativeWalkAtlas,
          traveler_blue: blueTravelerNativeWalkAtlas,
          // The golden-ear traveller now uses the transparent native-pixel
          // 4×4 source. Every direction keeps the same 32×48 footprint and
          // baseline as the original furnace traveller.
          traveler_ochre: ochreTravelerNativeWalkAtlas,
          traveler_silver: silverTravelerNativeWalkAtlas,
        }[playerAvatar] || hearthTravelerNativeWalkAtlas
        const [dayBackdropTexture, nightBackdropTexture, playerAtlas, houndAtlas, fireAtlas] = await Promise.all([
          loadTexture(roomDayBackdrop),
          loadTexture(roomNightBackdrop),
          loadTexture(selectedPlayerAtlas),
          loadTexture(atlasForCompanion(companion)),
          loadTexture(hearthFireAtlas),
        ])
        const residentTextures = await Promise.all(residentCompanions.map(async (resident) => ({
          resident,
          texture: await loadTexture(atlasForCompanion(resident)),
        })))
        if (disposed) return

        const backdropTextures: Record<CottageLightPeriod, Texture> = {
          day: dayBackdropTexture,
          night: nightBackdropTexture,
        }
        backdropTexturesRef.current = backdropTextures
        const backdrop = new Sprite(backdropTextures[lightPeriodRef.current])
        backdrop.width = COTTAGE_SCENE_WIDTH
        backdrop.height = COTTAGE_SCENE_HEIGHT
        backdrop.zIndex = 1
        backdropRef.current = backdrop

        // The generated source had a baked checkerboard rather than alpha.
        // The runtime atlas is a reviewed, transparent, four-cell derivative:
        // 48px cells, a shared baseline, and a deliberately small hearth fit.
        const fireFrames = Array.from({ length: 4 }, (_, frame) => new Texture({
          source: fireAtlas.source,
          frame: new Rectangle(frame * 48, 0, 48, 48),
        }))
        const hearthFire = new Sprite(fireFrames[0])
        // Keep the flame inside the dark throat of the stone hearth rather
        // than letting its base cover the front course of stones.
        hearthFire.width = 40
        hearthFire.height = 40
        hearthFire.position.set(79, 53)
        hearthFire.zIndex = 2
        hearthFire.visible = hearthLitRef.current
        hearthFireRef.current = hearthFire
        let activeFireFrame = 0
        app.ticker.add(() => {
          const nextFrame = Math.floor(performance.now() / 170) % fireFrames.length
          if (nextFrame === activeFireFrame) return
          activeFireFrame = nextFrame
          hearthFire.texture = fireFrames[nextFrame]
        })

        const foregroundTextures: Record<CottageLightPeriod, Texture[]> = {
          day: FOREGROUND_OCCLUSION_SLICES.map((slice) => new Texture({
            source: dayBackdropTexture.source,
            frame: new Rectangle(slice.x, slice.y, slice.width, slice.height),
          })),
          night: FOREGROUND_OCCLUSION_SLICES.map((slice) => new Texture({
            source: nightBackdropTexture.source,
            frame: new Rectangle(slice.x, slice.y, slice.width, slice.height),
          })),
        }
        foregroundOcclusionTexturesRef.current = foregroundTextures
        const foregroundOcclusion = FOREGROUND_OCCLUSION_SLICES.map((slice, index) => {
          const foreground = new Sprite(foregroundTextures[lightPeriodRef.current][index])
          foreground.position.set(slice.x, slice.y)
          foreground.zIndex = 200 + slice.y + slice.height
          foreground.label = slice.name
          return foreground
        })
        foregroundOcclusionRef.current = foregroundOcclusion

        const rowByDirection: Record<CottageDirection, number> = { south: 0, north: 1, west: 2, east: 3 }
        const playerFrames = Object.fromEntries(Object.entries(rowByDirection).map(([facing, row]) => [
          facing,
          Array.from({ length: 4 }, (_, frame) => new Texture({ source: playerAtlas.source, frame: new Rectangle(frame * 32, row * 48, 32, 48) })),
        ])) as Record<CottageDirection, Texture[]>
        playerFramesRef.current = playerFrames
        const player = new Sprite(playerFrames.south[0])
        player.width = COTTAGE_PLAYER_WIDTH
        player.height = COTTAGE_PLAYER_HEIGHT
        player.zIndex = 200
        playerSpriteRef.current = player

        let sceneCompanion: Sprite | Graphics
        if (usesProductionAtlas) {
          const rowByDirection: Record<CottageDirection, number> = { south: 0, north: 1, west: 2, east: 3 }
          const houndFrames = Object.fromEntries(Object.entries(rowByDirection).map(([facing, row]) => [
            facing,
            Array.from({ length: 4 }, (_, frame) => new Texture({
              source: houndAtlas.source,
              frame: new Rectangle(frame * COMPANION_RUNTIME_FRAME_SIZE, row * COMPANION_RUNTIME_FRAME_SIZE, COMPANION_RUNTIME_FRAME_SIZE, COMPANION_RUNTIME_FRAME_SIZE),
            })),
          ])) as Record<CottageDirection, Texture[]>
          companionFramesRef.current = houndFrames
          sceneCompanion = new Sprite(houndFrames.south[0])
          houndSpriteRef.current = sceneCompanion
        } else {
          const palette = companion.species.palette === 'ember' ? 0xa84c32 : companion.species.palette === 'moon' ? 0xaaa6a0 : 0x7d8150
          sceneCompanion = new Graphics().roundRect(5, 7, 22, 20, 3).fill({ color: palette }).rect(8, 4, 16, 5).fill({ color: palette })
        }
        const { size: companionSize, hover: companionHover } = companionVisual(companion)
        const occupiedAtEntry: CottagePosition[] = []
        const safeCompanionPosition = findOpenCottageCompanionPosition(companionPosition, position, occupiedAtEntry)
        occupiedAtEntry.push(safeCompanionPosition)
        companionPositionRef.current = safeCompanionPosition
        rememberCottageCompanionPosition(safeCompanionPosition)
        setCompanionPosition(safeCompanionPosition)
        sceneCompanion.width = companionSize
        sceneCompanion.height = companionSize
        sceneCompanion.position.set(safeCompanionPosition.x + (32 - companionSize) / 2, safeCompanionPosition.y + 32 - companionSize - companionHover)
        sceneCompanion.zIndex = 200 + safeCompanionPosition.y + 32
        companionSpriteRef.current = sceneCompanion

        const residentSprites = residentTextures.map(({ resident, texture }) => {
          const place = findOpenCottageCompanionPosition(residentPositionFor(resident), position, occupiedAtEntry)
          occupiedAtEntry.push(place)
          residentPositionsRef.current[resident.id] = { ...place }
          const { size, hover } = companionVisual(resident)
          const frames = Object.fromEntries(Object.entries({ south: 0, north: 1, west: 2, east: 3 } as Record<CottageDirection, number>).map(([facing, row]) => [
            facing, Array.from({ length: 4 }, (_, frame) => new Texture({ source: texture.source, frame: new Rectangle(frame * COMPANION_RUNTIME_FRAME_SIZE, row * COMPANION_RUNTIME_FRAME_SIZE, COMPANION_RUNTIME_FRAME_SIZE, COMPANION_RUNTIME_FRAME_SIZE) })),
          ])) as Record<CottageDirection, Texture[]>
          residentFramesRef.current[resident.id] = frames
          const sprite = new Sprite(frames.south[0])
          sprite.width = size
          sprite.height = size
          sprite.position.set(place.x + (32 - size) / 2, place.y + 32 - size - hover)
          sprite.zIndex = 200 + place.y + 32
          sprite.label = `小屋里的${resident.nickname}`
          return sprite
        })
        residentSpriteRefs.current = residentSprites
        residentSpriteByIdRef.current = Object.fromEntries(residentTextures.map(({ resident }, index) => [resident.id, residentSprites[index]]))

        app.stage.addChild(backdrop, hearthFire, ...residentSprites, sceneCompanion, player, ...foregroundOcclusion)
        player.position.set(position.x, position.y)
        player.zIndex = 200 + position.y + COTTAGE_PLAYER_HEIGHT
        app.render()
      } catch (error) {
        if (!disposed) {
          const detail = error instanceof Error ? error.message : String(error)
          console.error('[PixiCottageScene] initialization failed', error)
          setInitError(detail)
          onInitError?.()
        }
      }
    }

    void start()
    return () => {
      disposed = true
      playerSpriteRef.current = null
      appRef.current = null
      backdropRef.current = null
      backdropTexturesRef.current = {}
      foregroundOcclusionRef.current = []
      foregroundOcclusionTexturesRef.current = {}
      hearthFireRef.current = null
      playerFramesRef.current = null
      companionSpriteRef.current = null
      houndSpriteRef.current = null
      residentSpriteRefs.current = []
      residentSpriteByIdRef.current = {}
      residentFramesRef.current = {}
      residentPositionsRef.current = {}
      residentWanderRef.current = {}
      companionFramesRef.current = null
      // React development mode intentionally mounts, cleans up, then mounts
      // effects again. Pixi v8 must not be destroyed before async init finishes.
      if (initialized && app) {
        app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false })
      }
    }
    }, [playerAvatar, onInitError])

  // Choosing another travelling companion must not tear down the whole Pixi
  // room. Swap only companion sprites in place, so the fire, room, player
  // position and keyboard focus remain uninterrupted.
  useEffect(() => {
    const app = appRef.current
    if (!app || !companionSpriteRef.current) return
    let cancelled = false
    const syncCompanions = async () => {
      const { Rectangle, Sprite, Texture } = await import('pixi.js')
      const loadTexture = async (url: string) => {
        const image = new Image()
        image.src = url
        await image.decode()
        const texture = Texture.from(image)
        texture.source.style.scaleMode = 'nearest'
        return texture
      }
      const [activeTexture, ...residentTextures] = await Promise.all([
        loadTexture(atlasForCompanion(companion)),
        ...residentCompanions.map((resident) => loadTexture(atlasForCompanion(resident))),
      ])
      if (cancelled || app !== appRef.current) return
      const formerActiveId = activeCompanionIdRef.current
      if (formerActiveId && formerActiveId !== companion?.id) {
        // A handoff happens exactly where the previous follower stopped. It
        // becomes still; the newly chosen friend starts moving from its own
        // resting place on the next input tick.
        residentPositionOverridesRef.current[formerActiveId] = { ...companionPosition }
      }
      // A newly chosen room follower starts at the exact spot where they were
      // standing as a resident. Never reuse the old follower's coordinate:
      // that was the source of the visible "jump" across the room.
      const occupiedAtEntry: CottagePosition[] = []
      const newFollowerPosition = findOpenCottageCompanionPosition(companion ? residentPositionFor(companion) : companionPosition, position, occupiedAtEntry)
      occupiedAtEntry.push(newFollowerPosition)
      if (companion?.id) delete residentPositionOverridesRef.current[companion.id]
      activeCompanionIdRef.current = companion?.id || null
      const oldSprites = [companionSpriteRef.current, ...residentSpriteRefs.current].filter(Boolean) as Sprite[]
      oldSprites.forEach((sprite) => { app.stage.removeChild(sprite); sprite.destroy() })
      const activeFrames = Object.fromEntries(Object.entries({ south: 0, north: 1, west: 2, east: 3 } as Record<CottageDirection, number>).map(([facing, row]) => [
        facing,
        Array.from({ length: 4 }, (_, frame) => new Texture({ source: activeTexture.source, frame: new Rectangle(frame * COMPANION_RUNTIME_FRAME_SIZE, row * COMPANION_RUNTIME_FRAME_SIZE, COMPANION_RUNTIME_FRAME_SIZE, COMPANION_RUNTIME_FRAME_SIZE) })),
      ])) as Record<CottageDirection, Texture[]>
      companionFramesRef.current = activeFrames
      const { size: activeSize, hover: activeHover } = companionVisual(companion)
      const activeSprite = new Sprite(activeFrames[companionDirection][companionWalkFrame])
      activeSprite.width = activeSize
      activeSprite.height = activeSize
      activeSprite.position.set(newFollowerPosition.x + (32 - activeSize) / 2, newFollowerPosition.y + 32 - activeSize - activeHover)
      activeSprite.zIndex = 200 + newFollowerPosition.y + 32
      companionSpriteRef.current = activeSprite
      houndSpriteRef.current = activeSprite
      const residents = residentCompanions.map((resident, index) => {
        const place = findOpenCottageCompanionPosition(residentPositionFor(resident), position, occupiedAtEntry)
        occupiedAtEntry.push(place)
        residentPositionsRef.current[resident.id] = { ...place }
        const { size, hover } = companionVisual(resident)
        const texture = residentTextures[index]
        const frames = Object.fromEntries(Object.entries({ south: 0, north: 1, west: 2, east: 3 } as Record<CottageDirection, number>).map(([facing, row]) => [
          facing, Array.from({ length: 4 }, (_, frame) => new Texture({ source: texture.source, frame: new Rectangle(frame * COMPANION_RUNTIME_FRAME_SIZE, row * COMPANION_RUNTIME_FRAME_SIZE, COMPANION_RUNTIME_FRAME_SIZE, COMPANION_RUNTIME_FRAME_SIZE) })),
        ])) as Record<CottageDirection, Texture[]>
        residentFramesRef.current[resident.id] = frames
        const sprite = new Sprite(frames.south[0])
        sprite.width = size
        sprite.height = size
        sprite.position.set(place.x + (32 - size) / 2, place.y + 32 - size - hover)
        sprite.zIndex = 200 + place.y + 32
        return sprite
      })
      residentSpriteRefs.current = residents
      residentSpriteByIdRef.current = Object.fromEntries(residentCompanions.map((resident, index) => [resident.id, residents[index]]))
      app.stage.addChild(...residents, activeSprite)
      rememberCottageCompanionPosition(newFollowerPosition)
      setCompanionPosition(newFollowerPosition)
      setCompanionDirection('south')
      setCompanionWalkFrame(0)
      app.render()
    }
    void syncCompanions()
    return () => { cancelled = true }
  }, [companion?.id, companion?.species_id, companion?.stage, companion?.evolution_path, companionsSignature])

  // Swap only the ground illustration and its paired foreground cutouts. The
  // world entities retain their current Pixi instances and coordinates, so
  // the day/night transition never teleports the player or their companion.
  useEffect(() => {
    const backdropTexture = backdropTexturesRef.current[lightPeriod]
    const foregroundTextures = foregroundOcclusionTexturesRef.current[lightPeriod]
    if (!backdropTexture || !foregroundTextures) return
    if (backdropRef.current) backdropRef.current.texture = backdropTexture
    foregroundOcclusionRef.current.forEach((foreground, index) => {
      foreground.texture = foregroundTextures[index]
    })
    if (hearthFireRef.current) hearthFireRef.current.visible = hearthLit
    appRef.current?.render()
  }, [lightPeriod, hearthLit])

  useEffect(() => {
    let boundaryTimer: number | null = null
    const clearNoticeTimer = () => {
      if (timeNoticeTimerRef.current !== null) window.clearTimeout(timeNoticeTimerRef.current)
      timeNoticeTimerRef.current = null
    }
    const showNightNotice = () => {
      clearNoticeTimer()
      setTimeNotice('夜晚到了')
      timeNoticeTimerRef.current = window.setTimeout(() => setTimeNotice(null), 2600)
    }
    const synchronize = (announce = false) => {
      const nextPeriod = getCottageLightPeriod()
      if (nextPeriod === lightPeriodRef.current) return
      lightPeriodRef.current = nextPeriod
      setLightPeriod(nextPeriod)
      if (announce && nextPeriod === 'night') showNightNotice()
    }
    const scheduleBoundary = () => {
      const now = new Date()
      const next = new Date(now)
      if (now.getHours() < 6) next.setHours(6, 0, 0, 0)
      else if (now.getHours() < 18) next.setHours(18, 0, 0, 0)
      else { next.setDate(next.getDate() + 1); next.setHours(6, 0, 0, 0) }
      boundaryTimer = window.setTimeout(() => {
        synchronize(true)
        scheduleBoundary()
      }, Math.max(100, next.getTime() - Date.now() + 50))
    }
    synchronize(false)
    scheduleBoundary()
    return () => {
      if (boundaryTimer !== null) window.clearTimeout(boundaryTimer)
      clearNoticeTimer()
    }
  }, [])

  useEffect(() => {
    const player = playerSpriteRef.current
    const sceneCompanion = companionSpriteRef.current
    if (!player || !sceneCompanion) return
    player.position.set(position.x, position.y)
    player.zIndex = 200 + position.y + COTTAGE_PLAYER_HEIGHT
    if (playerFramesRef.current) player.texture = playerFramesRef.current[direction][walkFrame]
    const { size: companionSize, hover: companionHover } = companionVisual(companion)
    sceneCompanion.position.set(companionPosition.x + (32 - companionSize) / 2, companionPosition.y + 32 - companionSize - companionHover)
    sceneCompanion.zIndex = 200 + companionPosition.y + 32
    if (houndSpriteRef.current && companionFramesRef.current) {
      houndSpriteRef.current.texture = companionFramesRef.current[companionDirection][companionWalkFrame]
    }
    appRef.current?.render()
  }, [companion?.species_id, companion?.stage, companionDirection, companionPosition, companionWalkFrame, direction, position, walkFrame])

  // A deliberately small NPC state machine. A companion chooses one cardinal
  // direction, actually walks a short run, then pauses. It never swaps pose
  // without moving, so the room reads like a calm Stardew-style interior.
  useEffect(() => {
    const companionsCrowded = areCottageCompanionsCrowded
    const playerCollides = (candidate: CottagePosition) => areCottageEntitiesCrowded(playerPositionRef.current, candidate)
    const facePlayer = (candidate: CottagePosition, fallback: CottageDirection) => getCottageMoveDirection(candidate, {
      x: playerPositionRef.current.x + COTTAGE_PLAYER_WIDTH / 2 - 16,
      y: playerPositionRef.current.y + COTTAGE_PLAYER_HEIGHT - 3 - 29,
    }, fallback)
    const isOpen = (candidate: CottagePosition, selfId?: string) => {
      if (companion && companion.id !== selfId && companionsCrowded(candidate, companionPositionRef.current)) return false
      return !residentCompanions.some((resident) => resident.id !== selfId && companionsCrowded(candidate, residentPositionFor(resident)))
    }
    const directions: CottageDirection[] = ['north', 'south', 'west', 'east']
    const shuffle = () => [...directions].sort(() => Math.random() - .5)
    const chooseDirection = (from: CottagePosition, selfId: string) => shuffle().find((direction) => {
      const next = resolveCottageWanderMove(from, direction)
      return (next.x !== from.x || next.y !== from.y) && isOpen(next, selfId)
    })
    const pauseFor = (state: { direction?: CottageDirection; stepsRemaining: number; pauseUntil: number }, now: number, duration = 550) => {
      state.direction = undefined
      state.stepsRemaining = 0
      state.pauseUntil = now + duration + Math.floor(Math.random() * 550)
    }
    // Keep the expedition companion's wait state isolated. Returning from this
    // helper must never abort the room ticker: other friends keep wandering
    // when one of them is politely waiting for the traveller to step aside.
    const advanceActiveWander = (now: number) => {
      if (!companion || companion.id === pausedCompanionId || companionMode !== 'wander' || !companionSpriteRef.current) return
      const state = activeWanderRef.current
      const current = companionPositionRef.current
      if (state.waitingForPlayer) {
        const nextInSameDirection = state.direction ? resolveCottageWanderMove(current, state.direction) : current
        if (state.direction && playerCollides(nextInSameDirection)) return
        state.waitingForPlayer = false
      }
      if (now < state.pauseUntil) return
      if (!state.direction || state.stepsRemaining <= 0) {
        state.direction = chooseDirection(current, companion.id)
        state.stepsRemaining = state.direction ? 8 + Math.floor(Math.random() * 13) : 0
        if (!state.direction) pauseFor(state, now, 900)
        return
      }
      const next = resolveCottageWanderMove(current, state.direction)
      if (playerCollides(next)) {
        state.waitingForPlayer = true
        setCompanionDirection(facePlayer(current, companionDirection))
        setCompanionWalkFrame(0)
        return
      }
      if ((next.x === current.x && next.y === current.y) || !isOpen(next, companion.id)) {
        pauseFor(state, now)
        setCompanionWalkFrame(0)
        return
      }
      setCompanionDirection(state.direction)
      setCompanionWalkFrame((frame) => (frame + 1) % 4)
      rememberCottageCompanionPosition(next)
      setCompanionPosition(next)
      state.stepsRemaining -= 1
      if (state.stepsRemaining <= 0) setCompanionWalkFrame(0)
    }
    const timer = window.setInterval(() => {
      if (!appRef.current) return
      const now = Date.now()
      advanceActiveWander(now)
      residentCompanions.forEach((resident) => {
        if ((residentModes[resident.id] || 'wander') !== 'wander') return
        if (resident.id === pausedCompanionId) return
        const sprite = residentSpriteByIdRef.current[resident.id]
        if (!sprite) return
        const current = residentPositionFor(resident)
        const state = residentWanderRef.current[resident.id] || { stepsRemaining: 0, pauseUntil: 0, frame: 0, waitingForPlayer: false }
        residentWanderRef.current[resident.id] = state
        if (state.waitingForPlayer) {
          const nextInSameDirection = state.direction ? resolveCottageWanderMove(current, state.direction) : current
          if (state.direction && playerCollides(nextInSameDirection)) return
          state.waitingForPlayer = false
        }
        if (now < state.pauseUntil) return
        if (!state.direction || state.stepsRemaining <= 0) {
          state.direction = chooseDirection(current, resident.id)
          state.stepsRemaining = state.direction ? 8 + Math.floor(Math.random() * 13) : 0
          if (!state.direction) pauseFor(state, now, 900)
          return
        }
        const next = resolveCottageWanderMove(current, state.direction)
        if (playerCollides(next)) {
          state.waitingForPlayer = true
          state.direction = facePlayer(current, state.direction)
          state.frame = 0
          const frames = residentFramesRef.current[resident.id]
          if (frames) sprite.texture = frames[state.direction][0]
          return
        }
        if (next.x === current.x && next.y === current.y || !isOpen(next, resident.id)) {
          const stoppedDirection = state.direction || 'south'
          pauseFor(state, now)
          state.frame = 0
          const frames = residentFramesRef.current[resident.id]
          if (frames) sprite.texture = frames[stoppedDirection][0]
          return
        }
        residentPositionsRef.current[resident.id] = next
        state.direction = getCottageMoveDirection(current, next, state.direction)
        state.frame = (state.frame + 1) % 4
        const frames = residentFramesRef.current[resident.id]
        if (frames) sprite.texture = frames[state.direction][state.frame]
        const { size, hover } = companionVisual(resident)
        sprite.position.set(next.x + (32 - size) / 2, next.y + 32 - size - hover)
        sprite.zIndex = 200 + next.y + 32
        state.stepsRemaining -= 1
        if (state.stepsRemaining <= 0) {
          state.frame = 0
          if (frames) sprite.texture = frames[state.direction][0]
        }
      })
      appRef.current?.render()
    }, 220)
    return () => window.clearInterval(timer)
  }, [companion, companionMode, companionsSignature, residentModes, pausedCompanionId])

  useEffect(() => { setInputContext('world'); sceneRef.current?.focus() }, [])

  const nearbyResident = residentCompanions.find((item) => isNearCottageCompanion(position, residentPositionFor(item))) || null
  const talkToCompanion = (target: Companion | null) => {
    if (!target) return
    playUISound('select')
    setMessage(`${target.nickname || '伙伴'}抬头回应了你。`)
    onCompanionInteract?.(target)
  }

  const applyMove = (key: string) => {
    // A free/stationary expedition companion is a normal room resident. Only
    // a genuinely following companion participates in the player-following
    // solver; otherwise player input must never rewrite its animation state.
    const followingPosition = companionMode === 'follow' ? companionPosition : { x: -999, y: -999 }
    let result = resolveCottageMove(position, key, followingPosition)
    if (!result) {
      setCottageFootsteps(null)
      return false
    }
    // Every companion in the room is a physical presence. Free-moving friends
    // stop when the traveller reaches them and continue only after the path
    // clears; they must not become ghosts just because they are wandering.
    const initialMove = result
    if (!('blockedBy' in initialMove)) {
      const roomResidents = [
        ...(companion && companionMode !== 'follow' ? [companion] : []),
        ...residentCompanions,
      ]
      const blockingResident = roomResidents.find((resident) => areCottageEntitiesCrowded(initialMove.position, resident.id === companion?.id ? companionPosition : residentPositionFor(resident)))
      if (blockingResident) {
        setCottageFootsteps(null)
        setMessage(`${blockingResident.nickname || '伙伴'}在这里。靠近些，按 E 和它说说话。`)
        return true
      }
    }
    let activeCompanionPosition = companionPosition
    if ('blockedBy' in result && result.blockedBy === 'companion' && companionMode === 'follow') {
      const now = Date.now()
      if (!companionPushRef.current || companionPushRef.current.direction !== result.direction) {
        companionPushRef.current = { direction: result.direction, since: now }
        setCottageFootsteps(null)
        setMessage('伙伴挡住了路。继续朝这里走一会儿，它会让开。')
        return true
      }
      if (now - companionPushRef.current.since < 2000) {
        setCottageFootsteps(null)
        setMessage('伙伴正在找能让开的地方…')
        return true
      }
      const yieldPosition = findCottageCompanionYieldPosition(companionPosition, result.direction)
      if (yieldPosition) {
        rememberCottageCompanionPosition(yieldPosition)
        setCompanionPosition(yieldPosition)
        activeCompanionPosition = yieldPosition
        result = resolveCottageMove(position, key, yieldPosition)
      }
    }
    if (!result) return false
    if ('blockedBy' in result && result.blockedBy === 'companion') {
      setCottageFootsteps(null)
      setMessage('这里有点挤，伙伴没有能让开的地方。')
      return true
    }
    companionPushRef.current = null
    const moved = result.position.x !== position.x || result.position.y !== position.y
    if (!moved) {
      setCottageFootsteps(null)
      setMessage(result.message)
      return true
    }
    setCottageFootsteps(getCottageFloorSoundSurface(result.position))
    setDirection(result.direction)
    rememberCottagePlayerPosition(result.position)
    setPosition(result.position)
    if (companionMode === 'follow') {
      const nextCompanionPosition = advanceCottageCompanion(activeCompanionPosition, result.position, result.direction, companionMode)
      rememberCottageCompanionPosition(nextCompanionPosition)
      setCompanionPosition(nextCompanionPosition)
      const nextCompanionDirection = getCottageMoveDirection(activeCompanionPosition, nextCompanionPosition, companionDirection)
      if (nextCompanionPosition.x !== activeCompanionPosition.x || nextCompanionPosition.y !== activeCompanionPosition.y) {
        setCompanionDirection(nextCompanionDirection)
        setCompanionWalkFrame((frame) => (frame + 1) % 4)
      } else setCompanionWalkFrame(0)
    }
    setWalkFrame((frame) => (frame + 1) % 4)
    const nearbyInteraction = getCottageInteraction(result.position)
    const availableInteraction = nearbyInteraction?.action === 'hearth' && !hearthAvailable ? null : nearbyInteraction
    setMessage(availableInteraction
        ? `按 E、空格或回车：${availableInteraction.label}`
        : result.message)
    return true
  }

  useEffect(() => {
    if (!pressedMoveKey) return
    const timer = window.setInterval(() => { applyMove(pressedMoveKey) }, 85)
    return () => window.clearInterval(timer)
  }, [position, pressedMoveKey])

  useEffect(() => {
    if (companionMode === 'stay') {
      setCompanionDirection('south')
      setCompanionWalkFrame(0)
    }
  }, [companionMode])

  useEffect(() => () => setCottageFootsteps(null), [])

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canHandle('world')) return
    if (['e', 'enter', ' '].includes(event.key.toLowerCase())) {
      event.preventDefault()
      const nearby = getCottageInteraction(position)
      const interaction = nearby?.action === 'hearth' && !hearthAvailable ? null : nearby
      if (interaction && onAction) {
        playUISound('select')
        setMessage(interaction.label)
        onAction(interaction.action)
      } else if (isNearCottageCompanion(position, companionPosition)) {
        talkToCompanion(companion)
      } else if (nearbyResident) {
        talkToCompanion(nearbyResident)
      } else setMessage('这里没有需要操作的东西。再靠近一些看看。')
      return
    }

    const key = event.key.toLowerCase()
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) return
    event.preventDefault()
    if (!pressedMoveKey) applyMove(key)
    setPressedMoveKey(key)
  }

  const stopMove = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key.toLowerCase() === pressedMoveKey) {
      companionPushRef.current = null
      setPressedMoveKey(null)
      setCottageFootsteps(null)
    }
  }

  const nearby = getCottageInteraction(position)
  const nearbyInteraction = nearby?.action === 'hearth' && !hearthAvailable ? null : nearby
  const interactionPrompt = nearbyInteraction
      ? { label: nearbyInteraction.label, position: nearbyInteraction.prompt }
      : isNearCottageCompanion(position, companionPosition)
        ? { label: `与${companion?.nickname || '伙伴'}交谈`, position: { x: companionPosition.x + 16, y: companionPosition.y - 3 } }
        : nearbyResident
          ? { label: `与${nearbyResident.nickname || '伙伴'}交谈`, position: { x: residentPositionFor(nearbyResident).x + 16, y: residentPositionFor(nearbyResident).y - 3 } }
      : null
  const promptStyle: CSSProperties | undefined = interactionPrompt ? {
    left: `${interactionPrompt.position.x / COTTAGE_SCENE_WIDTH * 100}%`,
    top: `${interactionPrompt.position.y / COTTAGE_SCENE_HEIGHT * 100}%`,
  } : undefined

  return <div className={`cottage-scene-shell ${immersive ? 'is-immersive' : ''} pixi-cottage-scene-shell`}>
    <div
      ref={sceneRef}
      className={`cottage-scene pixi-cottage-scene facing-${direction}`}
      tabIndex={0}
      role='application'
      aria-label='可行走的炉火小屋。使用方向键或 WASD 移动，按 E、空格或回车交互。'
      onKeyDown={move}
      onKeyUp={stopMove}
      onBlur={() => { setPressedMoveKey(null); setCottageFootsteps(null) }}
      onPointerDown={() => { setInputContext('world'); sceneRef.current?.focus() }}
    >
      <div className='pixi-cottage-canvas-host' ref={canvasHostRef} aria-hidden='true' />
      {initError && <div className='pixi-cottage-error' role='alert'>
        Pixi 小屋资源未能加载：{initError}
      </div>}
      {timeNotice && <div className='cottage-time-notice' role='status' aria-live='polite'>{timeNotice}</div>}
      {interactionPrompt && <div className='cottage-interaction-prompt' style={promptStyle} aria-hidden='true'>
        <kbd>E</kbd><span>{interactionPrompt.label}</span>
      </div>}
    </div>
    <div className='cottage-scene-status' aria-live='polite'><span />{message}</div>
  </div>
}
