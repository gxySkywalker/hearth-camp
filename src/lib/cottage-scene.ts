export const COTTAGE_SCENE_WIDTH = 512
export const COTTAGE_SCENE_HEIGHT = 288
export const COTTAGE_PLAYER_WIDTH = 48
export const COTTAGE_PLAYER_HEIGHT = 72
export const COTTAGE_COMPANION_POSITION: CottagePosition = { x: 306, y: 164 }
export const COTTAGE_PLAYER_START_POSITION: CottagePosition = { x: 240, y: 144 }

// Every healthy companion has a quiet, species-appropriate place in the
// cottage. These are resting places, not gameplay stations: the one marked
// for the next expedition remains the only companion who follows the player.
export const COTTAGE_RESIDENT_POSITIONS: Record<string, CottagePosition> = {
  hearth_hound: { x: 132, y: 166 },
  moss_fox: { x: 176, y: 190 },
  glimmer_cat: { x: 286, y: 178 },
  river_otter: { x: 354, y: 177 },
  iron_badger: { x: 404, y: 178 },
  moon_owl: { x: 292, y: 38 },
  cloud_rabbit: { x: 154, y: 206 },
  ember_drake: { x: 238, y: 174 },
}

export function getCottageResidentPosition(speciesId: string) {
  return { ...(COTTAGE_RESIDENT_POSITIONS[speciesId] || COTTAGE_COMPANION_POSITION) }
}

/**
 * Small, safe circuits for a companion that is enjoying the cottage on its
 * own.  They deliberately remain inside each creature's familiar corner;
 * evolution widens that circuit a little, rather than turning a companion
 * into a generic wandering NPC.
 */
export function getCottageWanderPoints(companion: { species_id: string; stage?: number; evolution_path?: string }) {
  const stage = Number(companion.stage || 0)
  const home = getCottageResidentPosition(companion.species_id)
  const paths: Record<string, CottagePosition[]> = {
    hearth_hound: [{ x: 112, y: 170 }, { x: 140, y: 184 }, { x: 166, y: 171 }],
    moss_fox: [{ x: 154, y: 190 }, { x: 182, y: 202 }, { x: 206, y: 184 }],
    glimmer_cat: [{ x: 264, y: 181 }, { x: 294, y: 166 }, { x: 314, y: 186 }],
    river_otter: [{ x: 326, y: 184 }, { x: 356, y: 196 }, { x: 378, y: 179 }],
    iron_badger: [{ x: 376, y: 188 }, { x: 404, y: 199 }, { x: 420, y: 179 }],
    moon_owl: [{ x: 264, y: 47 }, { x: 294, y: 38 }, { x: 318, y: 60 }],
    cloud_rabbit: [{ x: 132, y: 208 }, { x: 160, y: 216 }, { x: 188, y: 202 }],
    ember_drake: [{ x: 218, y: 180 }, { x: 245, y: 166 }, { x: 270, y: 185 }],
  }
  const circuit = paths[companion.species_id] || [home]
  if (stage < 1) return [home, ...circuit]
  // Grown partners range a little farther while preserving their familiar
  // habits: the owl keeps to the high shelves, while the drake circles the
  // warm centre of the room.
  const evolved: Record<string, CottagePosition> = {
    hearth_hound: { x: 102, y: 156 }, moss_fox: { x: 210, y: 164 }, glimmer_cat: { x: 306, y: 146 },
    river_otter: { x: 314, y: 160 }, iron_badger: { x: 366, y: 171 }, moon_owl: { x: 332, y: 42 },
    cloud_rabbit: { x: 198, y: 184 }, ember_drake: { x: 278, y: 168 },
  }
  // Final forms retain the same small circuit but gain one expression of the
  // life they have grown into.  These are positional flavour only; no growth
  // rule or companion identity is changed here.
  const finalHabit: Record<string, CottagePosition> = {
    hearth_hound_ember_tail: { x: 94, y: 173 },
    hearth_hound_pine_shadow: { x: 182, y: 160 },
    hearth_hound_moon_paw: { x: 124, y: 142 },
    moss_fox_forest_crown: { x: 220, y: 155 },
    glimmer_cat_night_glass: { x: 320, y: 138 },
    river_otter_bay_current: { x: 304, y: 171 },
    iron_badger_armor_king: { x: 356, y: 162 },
    moon_owl_dusk_owl: { x: 338, y: 34 },
    cloud_rabbit_wind_tuft_rabbit: { x: 204, y: 176 },
    ember_drake_ember_drake: { x: 282, y: 154 },
  }
  const habitKey = `${companion.species_id}_${companion.evolution_path || ''}`
  return [home, ...circuit, ...(evolved[companion.species_id] ? [evolved[companion.species_id]] : []), ...(stage >= 2 && finalHabit[habitKey] ? [finalHabit[habitKey]] : [])]
}

/** The large central rug and the small doormat use their own soft footstep. */
export function getCottageFloorSoundSurface(position: CottagePosition): 'wood' | 'rug' {
  const footX = position.x + COTTAGE_PLAYER_WIDTH / 2
  const footY = position.y + COTTAGE_PLAYER_HEIGHT - 3
  const onCentralRug = footX >= 166 && footX <= 346 && footY >= 147 && footY <= 231
  const onDoorMat = footX >= 211 && footX <= 301 && footY >= 254 && footY <= 283
  return onCentralRug || onDoorMat ? 'rug' : 'wood'
}

export type CottagePosition = { x: number; y: number }
export type CottageDirection = 'north' | 'south' | 'east' | 'west'
export type CottageCompanionMode = 'follow' | 'stay' | 'wander'
export type CottageInteractionAction = 'expedition' | 'journal' | 'poetry' | 'inventory' | 'review' | 'map' | 'hearth'
export type CottageInteraction = {
  action: CottageInteractionAction
  label: string
  prompt: CottagePosition
  zone: { left: number; right: number; top: number; bottom: number }
}

const INTERACTIONS: CottageInteraction[] = [
  { action: 'poetry', label: '翻开吟游诗集', prompt: { x: 39, y: 54 }, zone: { left: 8, right: 70, top: 111, bottom: 150 } },
  { action: 'hearth', label: '照看炉火', prompt: { x: 84, y: 77 }, zone: { left: 48, right: 124, top: 74, bottom: 122 } },
  { action: 'journal', label: '翻开冒险日志', prompt: { x: 242, y: 77 }, zone: { left: 208, right: 280, top: 106, bottom: 122 } },
  { action: 'map', label: '查看制图桌上的路线', prompt: { x: 376, y: 68 }, zone: { left: 322, right: 434, top: 106, bottom: 122 } },
  { action: 'inventory', label: '打开宝箱与背包', prompt: { x: 456, y: 86 }, zone: { left: 424, right: 498, top: 116, bottom: 134 } },
  { action: 'review', label: '在床边休息与回顾', prompt: { x: 468, y: 157 }, zone: { left: 438, right: 510, top: 162, bottom: 274 } },
  { action: 'expedition', label: '走出小屋来到小镇', prompt: { x: 256, y: 260 }, zone: { left: 224, right: 288, top: 268, bottom: 291 } },
]

// 85ms input ticks: five logical pixels keeps travel brisk without making the
// 512px room feel slippery. Companion nudges use the same cadence below.
const STEP = 5
const MOVES: Record<string, { dx: number; dy: number; direction: CottageDirection }> = {
  arrowup: { dx: 0, dy: -STEP, direction: 'north' },
  w: { dx: 0, dy: -STEP, direction: 'north' },
  arrowdown: { dx: 0, dy: STEP, direction: 'south' },
  s: { dx: 0, dy: STEP, direction: 'south' },
  arrowleft: { dx: -STEP, dy: 0, direction: 'west' },
  a: { dx: -STEP, dy: 0, direction: 'west' },
  arrowright: { dx: STEP, dy: 0, direction: 'east' },
  d: { dx: STEP, dy: 0, direction: 'east' },
}

const FURNITURE = [
  { left: 8, right: 70, top: 28, bottom: 110, name: '书柜' },
  { left: 70, right: 158, top: 52, bottom: 108, name: '壁炉' },
  { left: 204, right: 284, top: 72, bottom: 114, name: '日志桌' },
  { left: 318, right: 432, top: 62, bottom: 114, name: '制图桌' },
  { left: 420, right: 500, top: 88, bottom: 126, name: '宝箱' },
  // The new bed is flush with the lower-right wall. Its foot-space begins
  // below the chest, deliberately leaving a full walkable lane between them.
  { left: 440, right: 510, top: 164, bottom: 276, name: '床铺' },
]

let rememberedPlayerPosition: CottagePosition = { ...COTTAGE_PLAYER_START_POSITION }
let rememberedCompanionPosition: CottagePosition = { ...COTTAGE_COMPANION_POSITION }
let rememberedCompanionMode: CottageCompanionMode = 'follow'

export function getRememberedCottagePlayerPosition() {
  return { ...rememberedPlayerPosition }
}

export function rememberCottagePlayerPosition(position: CottagePosition) {
  rememberedPlayerPosition = { ...position }
}

export function getRememberedCottageCompanionPosition() {
  return { ...rememberedCompanionPosition }
}

export function rememberCottageCompanionPosition(position: CottagePosition) {
  rememberedCompanionPosition = { ...position }
}

export function getRememberedCottageCompanionMode() {
  return rememberedCompanionMode
}

export function rememberCottageCompanionMode(mode: CottageCompanionMode) {
  rememberedCompanionMode = mode
}

export function isNearCottageCompanion(position: CottagePosition, companion = COTTAGE_COMPANION_POSITION) {
  const playerCenterX = position.x + COTTAGE_PLAYER_WIDTH / 2
  const playerFootY = position.y + COTTAGE_PLAYER_HEIGHT - 3
  const companionCenterX = companion.x + 16
  const companionFootY = companion.y + 29
  return Math.abs(playerCenterX - companionCenterX) <= 43 && Math.abs(playerFootY - companionFootY) <= 30
}

export function getCottageInteraction(position: CottagePosition) {
  const playerCenterX = position.x + COTTAGE_PLAYER_WIDTH / 2
  const playerFootY = position.y + COTTAGE_PLAYER_HEIGHT - 3
  return INTERACTIONS.find(({ zone }) => playerCenterX >= zone.left
    && playerCenterX <= zone.right
    && playerFootY >= zone.top
    && playerFootY <= zone.bottom) || null
}

function canPlaceCompanion(position: CottagePosition) {
  const clamped = {
    x: Math.max(8, Math.min(COTTAGE_SCENE_WIDTH - 40, position.x)),
    y: Math.max(32, Math.min(205, position.y)),
  }
  const centerX = clamped.x + 16
  const footY = clamped.y + 29
  const blocked = FURNITURE.some((item) => centerX >= item.left && centerX <= item.right && footY >= item.top && footY <= item.bottom)
  return blocked ? null : clamped
}

/** One small cardinal step for a freely roaming cottage companion. */
export function resolveCottageWanderMove(position: CottagePosition, direction: CottageDirection) {
  const delta = direction === 'north' ? { x: 0, y: -4 }
    : direction === 'south' ? { x: 0, y: 4 }
      : direction === 'west' ? { x: -4, y: 0 } : { x: 4, y: 0 }
  // Free-roaming companions use only the open floor, not the broad movement
  // envelope used by a following companion. This keeps their larger sprites
  // out of wallpaper, window alcoves, counters and the chest edge.
  const candidate = { x: position.x + delta.x, y: position.y + delta.y }
  // Moon owls begin on the high beam. Keep that one aerial lane constrained
  // too, rather than dropping a perched owl through the furniture.
  const highPerch = position.y < 100
  if (highPerch
    ? candidate.x < 236 || candidate.x > 348 || candidate.y < 32 || candidate.y > 68
    : candidate.x < 84 || candidate.x > 404 || candidate.y < 128 || candidate.y > 204) return position
  return canPlaceCompanion(candidate) || position
}

export function areCottageEntitiesCrowded(player: CottagePosition, companion: CottagePosition) {
  const playerBody = { left: player.x + COTTAGE_PLAYER_WIDTH * .25, right: player.x + COTTAGE_PLAYER_WIDTH * .75 }
  const companionBody = { left: companion.x + 5, right: companion.x + 27 }
  const playerFootY = player.y + COTTAGE_PLAYER_HEIGHT - 3
  const companionFootY = companion.y + 29
  return playerBody.left < companionBody.right
    && playerBody.right > companionBody.left
    && Math.abs(playerFootY - companionFootY) <= 20
}

/** The smaller body bounds used when two companions must share the room. */
export function areCottageCompanionsCrowded(first: CottagePosition, second: CottagePosition) {
  const horizontal = first.x + 5 < second.x + 27 && first.x + 27 > second.x + 5
  return horizontal && Math.abs((first.y + 29) - (second.y + 29)) <= 20
}

/**
 * Find a legal, unoccupied spot close to a companion's intended place.
 * This is used when the cottage is entered or its sprites are rebuilt so a
 * stale remembered coordinate can never lock the traveller and a friend into
 * the same collision body.
 */
export function findOpenCottageCompanionPosition(
  preferred: CottagePosition,
  player: CottagePosition,
  occupied: CottagePosition[],
) {
  const nearbyOffsets = [
    { x: 0, y: 0 }, { x: 32, y: 0 }, { x: -32, y: 0 }, { x: 0, y: 28 }, { x: 0, y: -28 },
    { x: 32, y: 28 }, { x: -32, y: 28 }, { x: 32, y: -28 }, { x: -32, y: -28 },
    { x: 64, y: 0 }, { x: -64, y: 0 }, { x: 0, y: 56 }, { x: 0, y: -56 },
  ]
  const roomGrid = Array.from({ length: 4 }, (_, row) => Array.from({ length: 10 }, (_, column) => ({
    x: 96 + column * 32,
    y: 132 + row * 24,
  }))).flat()
  const candidates = [
    ...nearbyOffsets.map((offset) => ({ x: preferred.x + offset.x, y: preferred.y + offset.y })),
    ...roomGrid,
  ]
  for (const candidate of candidates) {
    const legal = canPlaceCompanion(candidate)
    if (!legal || areCottageEntitiesCrowded(player, legal)) continue
    if (occupied.some((other) => areCottageCompanionsCrowded(other, legal))) continue
    return legal
  }
  // A legal preferred spot is always better than an overlap. This final
  // fallback is only defensive for malformed room data.
  return canPlaceCompanion(preferred) || { ...COTTAGE_COMPANION_POSITION }
}

function nudge(value: number, target: number, amount = STEP) {
  if (Math.abs(target - value) <= amount) return target
  return value + Math.sign(target - value) * amount
}

export function advanceCottageCompanion(
  companion: CottagePosition,
  player: CottagePosition,
  direction: CottageDirection,
  mode: CottageCompanionMode,
) {
  if (mode !== 'follow') return companion
  const vector = direction === 'north' ? { x: 0, y: -1 }
    : direction === 'south' ? { x: 0, y: 1 }
      : direction === 'west' ? { x: -1, y: 0 } : { x: 1, y: 0 }
  const playerCenterX = player.x + COTTAGE_PLAYER_WIDTH / 2
  const playerFootY = player.y + COTTAGE_PLAYER_HEIGHT - 3
  const target = {
    x: playerCenterX - 16 - vector.x * 46,
    y: playerFootY - 29 - vector.y * 38,
  }
  const deltaX = target.x - companion.x
  const deltaY = target.y - companion.y
  const horizontal = canPlaceCompanion({ x: nudge(companion.x, target.x), y: companion.y })
  const vertical = canPlaceCompanion({ x: companion.x, y: nudge(companion.y, target.y) })
  // Move along one cardinal axis per step. This reads as intentional walking
  // instead of diagonal sliding, and keeps four-direction sprite facing honest.
  const first = Math.abs(deltaX) >= Math.abs(deltaY) ? horizontal : vertical
  const second = Math.abs(deltaX) >= Math.abs(deltaY) ? vertical : horizontal
  const next = first ?? second ?? companion
  return areCottageEntitiesCrowded(player, next) ? companion : next
}

export function getCottageMoveDirection(from: CottagePosition, to: CottagePosition, fallback: CottageDirection) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return fallback
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'west' : 'east') : (dy < 0 ? 'north' : 'south')
}

export function findCottageCompanionYieldPosition(companion: CottagePosition, direction: CottageDirection) {
  const vectors = direction === 'east'
    ? [{ x: 56, y: 0 }, { x: 0, y: 48 }, { x: 0, y: -48 }, { x: -48, y: 0 }]
    : direction === 'west'
      ? [{ x: -56, y: 0 }, { x: 0, y: 48 }, { x: 0, y: -48 }, { x: 48, y: 0 }]
      : direction === 'south'
        ? [{ x: 0, y: 52 }, { x: 48, y: 0 }, { x: -48, y: 0 }, { x: 0, y: -48 }]
        : [{ x: 0, y: -52 }, { x: 48, y: 0 }, { x: -48, y: 0 }, { x: 0, y: 48 }]
  for (const vector of vectors) {
    const candidate = canPlaceCompanion({ x: companion.x + vector.x, y: companion.y + vector.y })
    if (candidate) return candidate
  }
  return null
}

export function resolveCottageMove(current: CottagePosition, key: string, companion = COTTAGE_COMPANION_POSITION) {
  const movement = MOVES[key.toLowerCase()]
  if (!movement) return null

  const nextX = Math.max(8, Math.min(COTTAGE_SCENE_WIDTH - COTTAGE_PLAYER_WIDTH - 8, current.x + movement.dx))
  const requestedY = current.y + movement.dy
  const playerCenter = nextX + COTTAGE_PLAYER_WIDTH / 2
  const playerFoot = Math.max(32, requestedY) + COTTAGE_PLAYER_HEIGHT - 3
  const alignedWithDoor = playerCenter >= 232 && playerCenter <= 280

  if (!alignedWithDoor && requestedY > 172) {
    return {
      direction: movement.direction,
      position: current.y > 172 ? current : { x: nextX, y: 172 },
      message: '这里是小屋的南墙，出口在中央门槛。',
    }
  }

  if (alignedWithDoor && requestedY > 216) {
    return {
      direction: movement.direction,
      position: { x: nextX, y: 216 },
      message: alignedWithDoor
          ? '门外是边境小镇。穿过门槛，去看看北方的道路。'
        : '这里是小屋的南墙，出口在中央门槛。',
    }
  }

  const obstruction = FURNITURE.find((item) => playerCenter >= item.left
    && playerCenter <= item.right
    && playerFoot >= item.top
    && playerFoot <= item.bottom)
  if (obstruction) {
    return {
      direction: movement.direction,
      position: current,
      message: `${obstruction.name}挡住了路。以后可以在这里查看或使用它。`,
    }
  }

  const nextPosition = { x: nextX, y: Math.max(32, requestedY) }
  if (areCottageEntitiesCrowded(nextPosition, companion)) {
    return {
      direction: movement.direction,
      position: current,
      message: '你们在同一条路上挤在一起了。换个方向走走吧。',
      blockedBy: 'companion' as const,
    }
  }

  return {
    direction: movement.direction,
    position: nextPosition,
    message: '炉火小屋 · 安全区域',
  }
}
