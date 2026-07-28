export const COTTAGE_SCENE_WIDTH = 512
export const COTTAGE_SCENE_HEIGHT = 288
export const COTTAGE_PLAYER_WIDTH = 48
export const COTTAGE_PLAYER_HEIGHT = 72
export const COTTAGE_COMPANION_POSITION: CottagePosition = { x: 306, y: 164 }
export const COTTAGE_PLAYER_START_POSITION: CottagePosition = { x: 240, y: 144 }

export type CottagePosition = { x: number; y: number }
export type CottageDirection = 'north' | 'south' | 'east' | 'west'
export type CottageCompanionMode = 'follow' | 'stay'
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

export function areCottageEntitiesCrowded(player: CottagePosition, companion: CottagePosition) {
  const playerBody = { left: player.x + COTTAGE_PLAYER_WIDTH * .25, right: player.x + COTTAGE_PLAYER_WIDTH * .75 }
  const companionBody = { left: companion.x + 5, right: companion.x + 27 }
  const playerFootY = player.y + COTTAGE_PLAYER_HEIGHT - 3
  const companionFootY = companion.y + 29
  return playerBody.left < companionBody.right
    && playerBody.right > companionBody.left
    && Math.abs(playerFootY - companionFootY) <= 20
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
  if (mode === 'stay') return companion
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
