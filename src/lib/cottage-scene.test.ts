import { describe, expect, it } from 'vitest'
import { advanceCottageCompanion, areCottageEntitiesCrowded, findCottageCompanionYieldPosition, getCottageInteraction, getCottageMoveDirection, isNearCottageCompanion, resolveCottageMove } from './cottage-scene'
import { TOWN_COMPANION_START, TOWN_PLAYER_START, getTownInteraction, resolveTownMove } from './town-scene'
import { createTownGrassTileData, TOWN_GRASS_PALETTE, TOWN_GRASS_TILE_SIZE, TOWN_ROAD_TILE_HEIGHT, TOWN_ROAD_TILE_WIDTH } from './town-terrain'
import { canReachTownNorthExit, TOWN_ENTRANCE_ROAD_NODES, TOWN_ROAD_NODES } from './town-road-graph'
import { getCottageLightPeriod } from './cottage-lighting'

describe('cottage movement', () => {
  it('uses day from 06:00 inclusive to 18:00 exclusive', () => {
    expect(getCottageLightPeriod(new Date(2026, 6, 27, 5, 59))).toBe('night')
    expect(getCottageLightPeriod(new Date(2026, 6, 27, 6, 0))).toBe('day')
    expect(getCottageLightPeriod(new Date(2026, 6, 27, 17, 59))).toBe('day')
    expect(getCottageLightPeriod(new Date(2026, 6, 27, 18, 0))).toBe('night')
  })

  it('creates deterministic quiet grass terrain using only the locked four-color palette', () => {
    const first = createTownGrassTileData()
    const second = createTownGrassTileData()
    expect(first.width).toBe(TOWN_GRASS_TILE_SIZE)
    expect(first.height).toBe(TOWN_GRASS_TILE_SIZE)
    expect(first.pixels).toEqual(second.pixels)
    expect([...new Set(first.pixels)].every((color) => color >= 0 && color < TOWN_GRASS_PALETTE.length)).toBe(true)
    expect(first.pixels.filter((color) => color !== 1).length).toBeLessThan(300)
  })

  it('keeps the road validation module aligned to the 16px town grid', () => {
    expect(TOWN_ROAD_TILE_WIDTH).toBe(64)
    expect(TOWN_ROAD_TILE_HEIGHT).toBe(128)
    expect(TOWN_ROAD_TILE_WIDTH % 16).toBe(0)
    expect(TOWN_ROAD_TILE_HEIGHT % 16).toBe(0)
  })

  it('keeps every town entrance connected to the one north expedition exit', () => {
    expect(TOWN_ENTRANCE_ROAD_NODES).toHaveLength(8)
    expect(TOWN_ENTRANCE_ROAD_NODES.every((node) => canReachTownNorthExit(node.id))).toBe(true)
    expect(TOWN_ROAD_NODES.filter((node) => node.kind === 'exit').map((node) => node.id)).toEqual(['north_exit'])
  })

  it('moves in brisk five-pixel steps with WASD and arrow keys', () => {
    expect(resolveCottageMove({ x: 100, y: 80 }, 'd')?.position).toEqual({ x: 105, y: 80 })
    expect(resolveCottageMove({ x: 100, y: 80 }, 'ArrowUp')?.position).toEqual({ x: 100, y: 75 })
  })

  it('keeps the player inside the walkable room', () => {
    expect(resolveCottageMove({ x: 8, y: 32 }, 'a')?.position).toEqual({ x: 8, y: 32 })
    expect(resolveCottageMove({ x: 456, y: 80 }, 'd')?.position).toEqual({ x: 456, y: 80 })
  })

  it('distinguishes the doorway from the south wall', () => {
    expect(resolveCottageMove({ x: 232, y: 216 }, 's')?.message).toContain('边境小镇')
    expect(resolveCottageMove({ x: 40, y: 216 }, 's')?.message).toContain('南墙')
  })

  it('stops at furniture while keeping the interaction context', () => {
    const result = resolveCottageMove({ x: 196, y: 44 }, 'd')
    expect(result?.position).toEqual({ x: 196, y: 44 })
    expect(result?.message).toContain('日志桌')
  })

  it('ignores keys that are not movement controls', () => {
    expect(resolveCottageMove({ x: 100, y: 80 }, 'Enter')).toBeNull()
  })

  it('keeps companions solid at the same depth but allows front-to-back overlap', () => {
    const companion = { x: 306, y: 164 }
    const result = resolveCottageMove({ x: 276, y: 144 }, 'd', companion)
    expect(result?.position).toEqual({ x: 276, y: 144 })
    expect(result?.blockedBy).toBe('companion')
    expect(areCottageEntitiesCrowded({ x: 276, y: 100 }, companion)).toBe(false)
  })

  it('keeps a walkable lane between the upper-right chest and lower-right bed', () => {
    expect(resolveCottageMove({ x: 400, y: 60 }, 's')?.position).toEqual({ x: 400, y: 65 })
    expect(resolveCottageMove({ x: 400, y: 90 }, 's')?.position).toEqual({ x: 400, y: 95 })
  })

  it('detects when the player is close enough to talk', () => {
    expect(isNearCottageCompanion({ x: 276, y: 144 })).toBe(true)
    expect(isNearCottageCompanion({ x: 20, y: 120 })).toBe(false)
  })

  it('moves a following companion toward the player but leaves a waiting companion in place', () => {
    const companion = { x: 306, y: 164 }
    const player = { x: 180, y: 144 }
    expect(advanceCottageCompanion(companion, player, 'west', 'follow')).not.toEqual(companion)
    expect(advanceCottageCompanion(companion, player, 'west', 'stay')).toEqual(companion)
  })

  it('keeps companion facing aligned with its actual cardinal movement', () => {
    expect(getCottageMoveDirection({ x: 100, y: 100 }, { x: 104, y: 100 }, 'north')).toBe('east')
    expect(getCottageMoveDirection({ x: 100, y: 100 }, { x: 100, y: 96 }, 'east')).toBe('north')
  })

  it('asks a companion to yield a full passage instead of a tiny nudge', () => {
    expect(findCottageCompanionYieldPosition({ x: 306, y: 164 }, 'east')).toEqual({ x: 362, y: 164 })
  })

  it('finds keyboard interactions from the player foot position', () => {
    expect(getCottageInteraction({ x: 210, y: 44 })?.action).toBe('journal')
    expect(getCottageInteraction({ x: 210, y: 44 })?.prompt).toEqual({ x: 242, y: 77 })
    expect(getCottageInteraction({ x: 232, y: 216 })?.action).toBe('expedition')
    expect(getCottageInteraction({ x: 250, y: 30 })).toBeNull()
  })

  it('keeps the north road as the town expedition threshold', () => {
    expect(getTownInteraction({ x: 488, y: 32 })?.action).toBe('expedition')
    expect(getTownInteraction({ x: 630, y: 474 })?.action).toBe('cottage')
  })

  it('allows movement through the town main road while respecting building bodies', () => {
    expect(resolveTownMove({ x: 500, y: 180 }, 's', TOWN_COMPANION_START)?.position).toEqual({ x: 500, y: 185 })
    expect(resolveTownMove({ x: 100, y: 60 }, 's', TOWN_COMPANION_START)?.position).toEqual({ x: 100, y: 60 })
  })

  it('places the cottage exit on a freely walkable southern road', () => {
    expect(resolveTownMove(TOWN_PLAYER_START, 'a', TOWN_COMPANION_START)?.position).toEqual({ x: 619, y: 476 })
  })
})
