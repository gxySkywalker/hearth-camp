import { describe, expect, it } from 'vitest'
// @ts-expect-error The Electron game module is CommonJS and intentionally shared with tests.
import game from '../../electron/game.cjs'

const { durationTier, rollExpedition, rollCaravanEncounter, companionStage, evolutionReady, growthPathForCompanion, COMPANION_SPECIES, LOOT } = game

describe('expedition rules', () => {
  it('improves reward tiers with healthy duration caps', () => {
    expect(durationTier(5 * 60).id).toBe('scout')
    expect(durationTier(45 * 60).rareChance).toBe(0.10)
    expect(durationTier(90 * 60).rareChance).toBe(0.20)
    expect(durationTier(240 * 60).rareChance).toBe(0.20)
  })

  it('is deterministic and keeps the rare pity guarantee independent from companion encounters', () => {
    const first = rollExpedition({ sessionId: 'same-session', activeSeconds: 45 * 60, rarePity: 9, companionPity: 7, ownedSpeciesIds: ['hearth_hound'] })
    const second = rollExpedition({ sessionId: 'same-session', activeSeconds: 45 * 60, rarePity: 9, companionPity: 7, ownedSpeciesIds: ['hearth_hound'] })
    expect(second).toEqual(first)
    expect(first.rareFound).toBe(true)
    expect(first.companionChance).toBeCloseTo(0.06)
  })

  it('has the four loot grades and applies expedition boosts to the correct rolls', () => {
    expect(LOOT.filter((item: { rarity: string }) => item.rarity === 'common')).toHaveLength(4)
    expect(LOOT.filter((item: { rarity: string }) => item.rarity === 'uncommon')).toHaveLength(7)
    expect(LOOT.filter((item: { rarity: string }) => item.rarity === 'rare')).toHaveLength(5)
    expect(LOOT.filter((item: { rarity: string }) => item.rarity === 'precious')).toHaveLength(3)
    const boosted = rollExpedition({ sessionId: 'boosted', activeSeconds: 5 * 60, ownedSpeciesIds: ['hearth_hound'], rareBoost: true, nightRareBoost: true, companionBoost: true })
    expect(boosted.rareChance).toBeCloseTo(0.14)
    expect(boosted.companionChance).toBeCloseTo(0.101)
  })

  it('adds a second rare-journey keepsake slot to long expeditions', () => {
    expect(durationTier(60 * 60)).toMatchObject({ uncommonCount: 2, uncommonChance: 0.40 })
    expect(durationTier(90 * 60)).toMatchObject({ uncommonCount: 2, uncommonChance: 0.50 })
    expect(durationTier(60 * 60).commonCount).toBe(3)
    expect(durationTier(90 * 60).commonCount).toBe(4)
  })

  it('only brings a fixed five-slot caravan to evening departures, with one repeated item', () => {
    expect(rollCaravanEncounter({ sessionId: 'noon', activeSeconds: 90 * 60, startedAt: new Date(2026, 6, 27, 12).getTime() })).toBeNull()
    let caravan: any = null
    for (let index = 0; index < 40 && !caravan; index += 1) caravan = rollCaravanEncounter({ sessionId: `caravan-${index}`, activeSeconds: 90 * 60, startedAt: new Date(2026, 6, 27, 18).getTime() })
    expect(caravan).not.toBeNull()
    expect(caravan.items).toHaveLength(5)
    expect(caravan.chance).toBe(0.70)
    expect(caravan.items.every((entry: any) => entry.item.rarity !== 'common')).toBe(true)
    expect([...new Set(caravan.items.map((entry: any) => entry.item.id))]).toHaveLength(4)
  })

  it('uses fixed bond chapters and resolves final growth from local time', () => {
    expect(companionStage(99)).toBe(0)
    expect(companionStage(100)).toBe(1)
    expect(companionStage(200)).toBe(2)
    expect(evolutionReady(200)).toBe(true)
  })

  it('keeps the Lin Yuan fox on its single forest growth route', () => {
    const mossFox = COMPANION_SPECIES.find((species: { id: string }) => species.id === 'moss_fox')
    expect(mossFox).toMatchObject({
      name: '枝绒',
      kind: '林缘小狐',
      defaultNickname: '苔芽',
      stages: ['枝绒', '苔亚', '森冠'],
      finalGrowthMode: 'single',
    })
    expect(growthPathForCompanion('moss_fox', new Date('2026-07-23T22:00:00').getTime())).toBe('forest_crown')
  })

  it('keeps the night-light cat on its one quiet growth route', () => {
    const cat = COMPANION_SPECIES.find((species: { id: string }) => species.id === 'glimmer_cat')
    expect(cat).toMatchObject({
      name: '灯团',
      kind: '夜灯小猫',
      stages: ['灯团', '星烛', '夜璃'],
      finalGrowthMode: 'single',
    })
    expect(growthPathForCompanion('glimmer_cat')).toBe('night_glass')
  })

  it('keeps the river otter on one non-utility growth route', () => {
    const otter = COMPANION_SPECIES.find((species: { id: string }) => species.id === 'river_otter')
    expect(otter).toMatchObject({
      name: '涟牙',
      kind: '河湾水獭',
      defaultNickname: '涟牙',
      stages: ['涟牙', '漪爪', '湾澜'],
      finalGrowthMode: 'single',
    })
    expect(growthPathForCompanion('river_otter')).toBe('bay_current')
  })

  it('keeps the stone-iron badger on its one non-utility growth route', () => {
    const badger = COMPANION_SPECIES.find((species: { id: string }) => species.id === 'iron_badger')
    expect(badger).toMatchObject({
      name: '石铁獾',
      kind: '石铁獾',
      defaultNickname: '小石獾',
      stages: ['小石獾', '岩甲獾', '铠獾王'],
      finalGrowthMode: 'single',
    })
    expect(growthPathForCompanion('iron_badger')).toBe('armor_king')
  })

  it('keeps the moon owl on its one quiet night-page growth route', () => {
    const owl = COMPANION_SPECIES.find((species: { id: string }) => species.id === 'moon_owl')
    expect(owl).toMatchObject({
      name: '暮羽子',
      kind: '月塔鸮',
      defaultNickname: '暮羽子',
      stages: ['暮羽子', '咕夜枭', '冥翔鹰鸮'],
      finalGrowthMode: 'single',
    })
    expect(growthPathForCompanion('moon_owl')).toBe('dusk_owl')
  })
})
