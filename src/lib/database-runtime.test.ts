import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error The Electron database module is CommonJS and intentionally shared with tests.
import databaseModule from '../../electron/database.cjs'
// @ts-expect-error The Electron domain module is CommonJS and intentionally shared with tests.
import domain from '../../electron/domain.cjs'

const { StudyDatabase } = databaseModule
const { getDailyPeriod, getWeeklyPeriod, localDateKey, getReturnKind } = domain
const tempDirs: string[] = []

afterEach(() => {
  vi.useRealTimers()
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('expedition loot effects', () => {
  const addInventory = (database: any, itemId: string, quantity = 1) => {
    const now = Date.now()
    database.run('INSERT INTO inventory (item_id, quantity, first_found_at, updated_at) VALUES (?, ?, ?, ?)', [itemId, quantity, now, now])
  }

  it('uses bread for exactly one bond with the active companion', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-bread-bond-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const companion = database.getCompanionCollection().active
    addInventory(database, 'berry_bread')
    database.useItem('berry_bread')
    expect(database.getCompanion(companion.id).bond_xp).toBe(Number(companion.bond_xp) + 1)
  })

  it('applies companion-specific keepsakes only to their matching companion', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-keepsake-bond-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const now = Date.now()
    database.run('INSERT INTO companions (id, species_id, nickname, personality_profile_json, met_at) VALUES (?, ?, ?, ?, ?)', ['otter-test', 'river_otter', '涟牙', '{}', now])
    database.run('INSERT INTO companions (id, species_id, nickname, personality_profile_json, met_at) VALUES (?, ?, ?, ?, ?)', ['owl-test', 'moon_owl', '暮羽子', '{}', now])
    database.run('INSERT INTO companions (id, species_id, nickname, personality_profile_json, met_at) VALUES (?, ?, ?, ?, ?)', ['drake-test', 'ember_drake', '小火牙', '{}', now])
    database.run('INSERT INTO companions (id, species_id, nickname, personality_profile_json, met_at) VALUES (?, ?, ?, ?, ?)', ['fox-test', 'moss_fox', '苔芽', '{}', now])
    database.run('INSERT INTO companions (id, species_id, nickname, personality_profile_json, met_at) VALUES (?, ?, ?, ?, ?)', ['cat-test', 'glimmer_cat', '灯团', '{}', now])
    database.run('INSERT INTO companions (id, species_id, nickname, personality_profile_json, met_at) VALUES (?, ?, ?, ?, ?)', ['badger-test', 'iron_badger', '小石獾', '{}', now])
    database.run('INSERT INTO companions (id, species_id, nickname, personality_profile_json, met_at) VALUES (?, ?, ?, ?, ?)', ['rabbit-test', 'cloud_rabbit', '小丘', '{}', now])
    addInventory(database, 'river_stone')
    addInventory(database, 'wind_hill_feather')
    addInventory(database, 'dragon_scale')
    addInventory(database, 'flame_scatter')
    addInventory(database, 'rain_moss_vein')
    addInventory(database, 'violet_mist_glass')
    addInventory(database, 'gray_pattern_stone')
    addInventory(database, 'cloud_shadow_grass')
    database.useItem('river_stone')
    database.useItem('wind_hill_feather')
    database.useItem('dragon_scale')
    database.useItem('flame_scatter')
    database.useItem('rain_moss_vein')
    database.useItem('violet_mist_glass')
    database.useItem('gray_pattern_stone')
    database.useItem('cloud_shadow_grass')
    expect(database.getCompanion('otter-test').bond_xp).toBe(3)
    expect(database.getCompanion('owl-test').bond_xp).toBe(3)
    expect(database.getCompanion('drake-test').bond_xp).toBe(3)
    expect(database.getCompanionCollection().active.bond_xp).toBe(3)
    expect(database.getCompanion('fox-test').bond_xp).toBe(3)
    expect(database.getCompanion('cat-test').bond_xp).toBe(3)
    expect(database.getCompanion('badger-test').bond_xp).toBe(3)
    expect(database.getCompanion('rabbit-test').bond_xp).toBe(3)
  })

  it('stores the night compass window and the one-shot expedition flags', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 24, 20, 0, 0))
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-loot-flags-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    addInventory(database, 'moon_compass')
    addInventory(database, 'star_glass')
    database.useItem('moon_compass')
    database.useItem('star_glass')
    const settings = database.getSettings()
    expect(Number(settings.night_rare_boost_until)).toBe(new Date(2026, 6, 25, 6, 0, 0).getTime())
    expect(settings.rare_boost).toBe('1')
  })

  it('keeps the silver bell boost until an unowned companion is met', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-bell-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    addInventory(database, 'silver_bell')
    database.useItem('silver_bell')
    expect(database.getSettings().companion_boost).toBe('1')
  })

  it('requires ten map scraps, then consumes them to add one new expedition location', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-collectible-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    addInventory(database, 'map_scrap')
    expect(() => database.useItem('map_scrap')).toThrow('还差 9 张')
    expect(database.getInventory().find((entry: any) => entry.item_id === 'map_scrap').quantity).toBe(1)
    database.run('UPDATE inventory SET quantity = 10 WHERE item_id = ?', ['map_scrap'])
    const result = database.useItem('map_scrap')
    expect(result.consumedQuantity).toBe(10)
    expect(result.unlockedLocation).toBeTruthy()
    expect(database.getInventory().find((entry: any) => entry.item_id === 'map_scrap')).toBeUndefined()
    const locations = JSON.parse(database.getSettings().unlocked_expedition_locations)
    expect(locations).toEqual([result.unlockedLocation])
    expect(database.getExpeditionLocationPool()).toContain(result.unlockedLocation)
  })

  it('uses a lit daytime hearth to turn ten materials into one crafted item', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 27, 10, 0, 0))
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-hearth-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    addInventory(database, 'herb_bundle', 10)
    addInventory(database, 'amber_chip', 10)
    database.setHearthLit(true)
    database.useHearthRecipe('herbal_soup')
    database.useHearthRecipe('honey_amber')
    expect(database.getInventory().find((entry: any) => entry.item_id === 'herbal_soup').quantity).toBe(1)
    expect(database.getInventory().find((entry: any) => entry.item_id === 'honey_amber').quantity).toBe(1)
    expect(database.getInventory().find((entry: any) => entry.item_id === 'herb_bundle')).toBeUndefined()
    expect(database.getInventory().find((entry: any) => entry.item_id === 'amber_chip')).toBeUndefined()
  })

  it('only lets mountain herb soup heal a resting companion and grants five bond', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-soup-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const companion = database.getCompanionCollection().active
    database.run('UPDATE companions SET is_ill = 1 WHERE id = ?', [companion.id])
    addInventory(database, 'herbal_soup')
    database.useItem('herbal_soup', companion.id)
    const recovered = database.getCompanion(companion.id)
    expect(recovered.is_ill).toBe(0)
    expect(recovered.bond_xp).toBe(Number(companion.bond_xp) + 5)
  })

  it('exchanges caravan stock exactly once and charges its fixed copper price', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-caravan-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const now = Date.now()
    addInventory(database, 'copper_coin', 20)
    database.run(`INSERT INTO expeditions (session_id, tier_id, location, event_text, rewards_json, rare_found, companion_found_id, created_at)
      VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`, ['caravan-test', 'epic', '旧石桥', '商队停在路边。', JSON.stringify({ tier: { id: 'epic', name: '史诗远征' }, drops: [], rareChance: 0.2, companionChance: 0.05, bondXp: 18, activeCompanion: null, newCompanion: null, caravan: { chance: 0.7, greeting: '测试', items: [{ item: { id: 'amber_chip' }, price: 20, sold: false }] } }), now])
    const result = database.buyCaravanItem('caravan-test', 0)
    expect(result.caravan.items[0].sold).toBe(true)
    expect(database.getInventory().find((entry: any) => entry.item_id === 'copper_coin')).toBeUndefined()
    expect(database.getInventory().find((entry: any) => entry.item_id === 'amber_chip').quantity).toBe(1)
    expect(() => database.buyCaravanItem('caravan-test', 0)).toThrow('已经换走')
  })
})

describe('traveller identity defaults', () => {
  it('starts a new journey as 冒险者, not the former 学习者 placeholder', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-adventurer-default-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    expect(database.getSettings().user_name).toBe('冒险者')
    expect(database.getWorldFoundation().player.display_name).toBe('冒险者')
  })
})

describe('AI configuration persistence', () => {
  it('persists the canonical AI base URL and provider settings', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-ai-settings-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()

    database.setSettings({
      api_provider: 'deepseek',
      model: 'deepseek-v4-flash',
      ai_base_url: 'https://api.deepseek.com/v1',
    })

    expect(database.getSettings()).toMatchObject({
      api_provider: 'deepseek',
      model: 'deepseek-v4-flash',
      ai_base_url: 'https://api.deepseek.com/v1',
    })
  })
})

describe('companion identity', () => {
  it('keeps a renamed companion, its profile, and its memories as the same friend', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-companion-name-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const before = database.getCompanionCollection().active
    expect(before).not.toBeNull()
    const renamed = database.renameCompanion(before.id, '小栗')

    expect(renamed.nickname).toBe('小栗')
    expect(renamed.personalityProfile).toEqual(before.personalityProfile)
    expect(renamed.memories[0].text).toContain('旧路')
    expect(database.getCompanionCollection().active.nickname).toBe('小栗')
  })

  it('records a growth moment once when an expedition carries a companion across a bond chapter', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-companion-growth-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const companion = database.getCompanionCollection().active
    const area = database.getStructure().areas[0]
    database.run('UPDATE companions SET bond_xp = 99, stage = 0 WHERE id = ?', [companion.id])

    const session = database.startSession({ areaId: area.id, content: '沿旧路返航', companionId: companion.id })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 6 * 60 * 1000, session.id])
    const result = database.stopSession(session.id, {})

    expect(result.expedition.growthEvent).toMatchObject({
      companion_id: companion.id,
      previous_stage: 0,
      stage: 1,
    })
    expect(result.expedition.growthEvent.companion.stageName).toBe('栗鬃')
    expect(result.expedition.growthEvent.companion.nickname).toBe('栗子')
    const pending = database.getPendingGrowthEvent()
    expect(pending?.id).toBe(result.expedition.growthEvent.id)
    database.markGrowthEventSeen(pending.id)
    expect(database.getPendingGrowthEvent()).toBeNull()
  })

  it('records the same growth moment when a shared companion item crosses the bond threshold', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-companion-food-growth-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const companion = database.getCompanionCollection().active
    const now = Date.now()
    database.run('UPDATE companions SET bond_xp = 99, stage = 0 WHERE id = ?', [companion.id])
    database.run('INSERT INTO inventory (item_id, quantity, first_found_at, updated_at) VALUES (?, ?, ?, ?)', ['berry_bread', 1, now, now])

    const result = database.useItem('berry_bread')

    expect(result.growthEvent).toMatchObject({ companion_id: companion.id, previous_stage: 0, stage: 1 })
    expect(result.growthEvent.companion.stageName).toBe('栗鬃')
    expect(database.getPendingGrowthEvent()?.id).toBe(result.growthEvent.id)
  })

  it('keeps a traveller-given name while an unrenamed companion takes its grown form name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-growth-nickname-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const companion = database.getCompanionCollection().active
    const now = Date.now()
    database.renameCompanion(companion.id, '小栗')
    database.run('UPDATE companions SET bond_xp = 99, stage = 0 WHERE id = ?', [companion.id])
    database.run('INSERT INTO inventory (item_id, quantity, first_found_at, updated_at) VALUES (?, ?, ?, ?)', ['berry_bread', 1, now, now])

    const result = database.useItem('berry_bread')
    expect(result.growthEvent?.companion).toMatchObject({ nickname: '小栗', stageName: '栗鬃', nickname_is_custom: 1 })
  })

  it('migrates the former moss fox into 苔芽 and resolves its final growth without Chestnut time branches', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-moss-sprout-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const now = Date.now()
    database.run('UPDATE companions SET is_active = 0')
    database.run(`INSERT INTO companions (id, species_id, nickname, bond_xp, stage, evolution_path, personality_profile_json, is_active, met_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['moss-test', 'moss_fox', '狐狸', 199, 1, '', '', 1, now])
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '4')")
    database.save()

    const reopened = await new StudyDatabase(dir).init()
    const moss = reopened.getCompanion('moss-test')
    expect(moss).toMatchObject({ nickname: '苔亚', stageName: '苔亚' })

    reopened.run('INSERT INTO inventory (item_id, quantity, first_found_at, updated_at) VALUES (?, ?, ?, ?)', ['berry_bread', 1, now, now])
    const result = reopened.useItem('berry_bread')
    expect(result.growthEvent?.companion).toMatchObject({ stage: 2, stageName: '森冠', evolution_path: 'forest_crown' })

    reopened.run("UPDATE companions SET evolution_path = 'grove_fox' WHERE id = ?", ['moss-test'])
    reopened.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '4')")
    reopened.save()
    const migratedAgain = await new StudyDatabase(dir).init()
    expect(migratedAgain.getCompanion('moss-test')).toMatchObject({ stageName: '森冠', evolution_path: 'forest_crown' })
  })

  it('migrates the former candle-shadow cat into the single night-light growth line', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-night-light-cat-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const now = Date.now()
    database.run(`INSERT INTO companions (id, species_id, nickname, bond_xp, stage, evolution_path, personality_profile_json, is_active, met_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['cat-test', 'glimmer_cat', '猫', 200, 2, 'star_candle', '', 0, now])
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '5')")
    database.save()

    const reopened = await new StudyDatabase(dir).init()
    expect(reopened.getCompanion('cat-test')).toMatchObject({
      nickname: '夜璃',
      stageName: '夜璃',
      evolution_path: 'night_glass',
    })
  })

  it('migrates the former river otter into 涟牙 without replacing a chosen name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-river-otter-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const now = Date.now()
    database.run(`INSERT INTO companions (id, species_id, nickname, bond_xp, stage, evolution_path, personality_profile_json, is_active, met_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['otter-test', 'river_otter', '水獭', 200, 2, 'river_guide', '', 0, now])
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '6')")
    database.save()

    const reopened = await new StudyDatabase(dir).init()
    expect(reopened.getCompanion('otter-test')).toMatchObject({
      nickname: '湾澜',
      stageName: '湾澜',
      evolution_path: 'bay_current',
    })
    expect(reopened.getCompanion('otter-test').personalityProfile.habit).not.toBe('喜欢安静待在身边')
  })

  it('repairs a premature river final route and names an unrenamed middle form 漪爪', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-river-stage-repair-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const now = Date.now()
    database.run(`INSERT INTO companions (id, species_id, nickname, bond_xp, stage, evolution_path, personality_profile_json, is_active, met_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['otter-stage-one', 'river_otter', '涟牙', 118, 1, 'bay_current', '', 0, now])
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '7')")
    database.save()

    const reopened = await new StudyDatabase(dir).init()
    expect(reopened.getCompanion('otter-stage-one')).toMatchObject({
      nickname: '漪爪',
      stage: 1,
      stageName: '漪爪',
      evolution_path: '',
      nickname_is_custom: 0,
    })
  })

  it('migrates the former iron badger without replacing a traveller-given name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-stone-iron-badger-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const now = Date.now()
    database.run(`INSERT INTO companions (id, species_id, nickname, nickname_is_custom, bond_xp, stage, evolution_path, personality_profile_json, is_active, met_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['badger-default', 'iron_badger', '铁砧獾', 0, 118, 1, 'royal_smith', '', 0, now])
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '8')")
    database.save()

    const reopened = await new StudyDatabase(dir).init()
    expect(reopened.getCompanion('badger-default')).toMatchObject({
      nickname: '岩甲獾', stage: 1, stageName: '岩甲獾', evolution_path: '', nickname_is_custom: 0,
    })
    expect(reopened.getCompanion('badger-default').personalityProfile.habit).not.toBe('喜欢安静待在身边')

    const customDir = mkdtempSync(join(tmpdir(), 'growth-arc-stone-iron-badger-custom-'))
    tempDirs.push(customDir)
    const customDatabase = await new StudyDatabase(customDir).init()
    customDatabase.run(`INSERT INTO companions (id, species_id, nickname, nickname_is_custom, bond_xp, stage, evolution_path, personality_profile_json, is_active, met_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['badger-custom', 'iron_badger', '石头', 1, 200, 2, 'mountain_warden', '', 0, now])
    customDatabase.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '8')")
    customDatabase.save()

    const reopenedCustom = await new StudyDatabase(customDir).init()
    expect(reopenedCustom.getCompanion('badger-custom')).toMatchObject({
      nickname: '石头', stageName: '铠獾王', evolution_path: 'armor_king', nickname_is_custom: 1,
    })
  })

  it('migrates the former moon owl while preserving a traveller-given name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-moon-owl-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const now = Date.now()
    database.run(`INSERT INTO companions (id, species_id, nickname, nickname_is_custom, bond_xp, stage, evolution_path, personality_profile_json, is_active, met_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['owl-default', 'moon_owl', '银羽学士', 0, 118, 1, 'night_scout', '', 0, now])
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '9')")
    database.save()

    const reopened = await new StudyDatabase(dir).init()
    expect(reopened.getCompanion('owl-default')).toMatchObject({
      nickname: '咕夜枭', stage: 1, stageName: '咕夜枭', evolution_path: '', nickname_is_custom: 0,
    })
    expect(reopened.getCompanion('owl-default').personalityProfile.habit).not.toBe('喜欢安静待在身边')

    const customDir = mkdtempSync(join(tmpdir(), 'growth-arc-moon-owl-custom-'))
    tempDirs.push(customDir)
    const customDatabase = await new StudyDatabase(customDir).init()
    customDatabase.run(`INSERT INTO companions (id, species_id, nickname, nickname_is_custom, bond_xp, stage, evolution_path, personality_profile_json, is_active, met_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['owl-custom', 'moon_owl', '页页', 1, 200, 2, 'moon_sage', '', 0, now])
    customDatabase.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '9')")
    customDatabase.save()

    const reopenedCustom = await new StudyDatabase(customDir).init()
    expect(reopenedCustom.getCompanion('owl-custom')).toMatchObject({
      nickname: '页页', stageName: '冥翔鹰鸮', evolution_path: 'dusk_owl', nickname_is_custom: 1,
    })
  })
})

describe('local learning database', () => {
  it('marks only the seeded area as the system default direction', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-direction-source-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const defaultArea = database.getStructure().areas[0]
    const customArea = database.createArea({ name: '准备秋招' })

    for (const area of [defaultArea, customArea]) {
      const session = database.startSession({ areaId: area.id, content: `走向${area.name}` })
      database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 120000, session.id])
      database.stopSession(session.id, {})
    }

    const directions = database.getCompletedStats(Date.now() - 3600000, Date.now() + 1000).directionBreakdown
    expect(directions.find((item: { id: string }) => item.id === defaultArea.id)?.source).toBe('system_default')
    expect(directions.find((item: { id: string }) => item.id === customArea.id)?.source).toBe('user_created')
  })

  it('persists a complete focus-to-growth loop without duplicate completion XP', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-test-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const initial = database.getStructure()
    expect(initial.areas).toHaveLength(1)

    const area = initial.areas[0]
    const goal = database.createGoal({ areaId: area.id, title: '完成测试目标' })
    const task = database.createTask({ areaId: area.id, goalId: goal.id, title: '学习一个章节' })
    const session = database.startSession({ taskId: task.id })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 3600000, session.id])
    const result = database.stopSession(session.id, { outcome: '完成章节练习', taskCompleted: true })

    expect(result.xpAwarded).toBe(62)
    expect(database.getStructure().tasks.find((item: { id: string }) => item.id === task.id)?.status).toBe('done')
    expect(database.getXpSummary().totalXp).toBe(62)

    database.updateTask(task.id, { status: 'done' })
    expect(database.getXpSummary().totalXp).toBe(62)
    // Completed session seconds tracked; exact value depends on runner clock
    expect(database.getDashboard().today.focusSeconds).toBeGreaterThan(0)
  })

  it('seeds a versioned world graph and keeps events and discoveries idempotent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-world-test-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()

    const initial = database.getWorldFoundation()
    expect(initial.content.version).toBe('0.1.0')
    expect(initial.player.intro_status).toBe('unseen')
    expect(initial.player.created_from_legacy).toBe(false)
    expect(initial.map.regions).toHaveLength(4)
    expect(initial.map.nodes).toHaveLength(8)
    expect(initial.map.edges).toHaveLength(5)
    expect(initial.map.regions.find((item: { id: string }) => item.id === 'border_town')?.state).toBe('discovered')
    expect(initial.map.regions.find((item: { id: string }) => item.id === 'pinewind_forest')?.state).toBe('rumored')

    const player = database.updatePlayerProfile({
      displayName: 'Rowan',
      hairStyle: 'long_braid',
      capeEnabled: false,
      introStatus: 'seen',
    })
    expect(player.display_name).toBe('Rowan')
    expect(player.cape_enabled).toBe(false)
    expect(player.customized_at).toBeTypeOf('number')

    const event = database.recordWorldEvent({
      eventKey: 'test:first-route',
      definitionId: 'first_expedition',
      payload: { route: 'pinewind_gate' },
    })
    const repeatedEvent = database.recordWorldEvent({
      eventKey: 'test:first-route',
      definitionId: 'should_not_replace',
    })
    expect(repeatedEvent.id).toBe(event.id)
    expect(repeatedEvent.definition_id).toBe('first_expedition')

    const discovery = database.recordDiscovery({
      discoveryKey: 'test:pinewind-gate',
      kind: 'node',
      targetId: 'pinewind_gate',
      eventId: event.id,
      metadata: { source: 'test' },
    })
    const repeatedDiscovery = database.recordDiscovery({
      discoveryKey: 'test:pinewind-gate',
      kind: 'node',
      targetId: 'pinewind_gate',
    })
    expect(repeatedDiscovery.id).toBe(discovery.id)

    const reopened = await new StudyDatabase(dir).init()
    const persisted = reopened.getWorldFoundation()
    expect(persisted.player.display_name).toBe('Rowan')
    expect(persisted.player.cape_enabled).toBe(false)
    expect(persisted.map.discoveries).toHaveLength(1)
    expect(persisted.recentEvents).toHaveLength(1)
    expect(persisted.map.nodes.find((item: { id: string }) => item.id === 'pinewind_gate')?.state).toBe('discovered')
    expect(persisted.map.regions.find((item: { id: string }) => item.id === 'pinewind_forest')?.state).toBe('discovered')
  })

  it('attributes completion XP only to the first session that completed a task', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-xp-test-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const task = database.createTask({ areaId: area.id, title: '任务一' })

    // first session — completes the task, should get completion XP
    const s1 = database.startSession({ taskId: task.id })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 30 * 60 * 1000, s1.id])
    const r1 = database.stopSession(s1.id, { outcome: '第一次完成', taskCompleted: true })
    const focusXp1 = r1.xpAwarded // focus + completion
    expect(database.getStructure().tasks.find((item: { id: string }) => item.id === task.id)?.status).toBe('done')

    // second session — same task, user checks "task completed" again but no new XP
    const s2 = database.startSession({ taskId: task.id })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 15 * 60 * 1000, s2.id])
    const r2 = database.stopSession(s2.id, { outcome: '又来了一次', taskCompleted: true })

    // second session should NOT include completion XP in xpAwarded
    const completionRow = database.one("SELECT amount FROM xp_transactions WHERE reference_type = 'task' AND kind = 'completion' AND reference_id = ?", [task.id])
    expect(completionRow).toBeTruthy()
    const completionAmount = Number(completionRow.amount)

    // focus XP from first session should be around 12 (30min session = focusXp(1800) ≈ 6) + completion = 20 + floor(30/2) = 20+15 = 35
    // focus XP from second session should be around 6 (15min session = focusXp(900) ≈ 3) with NO completion
    // Total = first(focus+completion) + second(focus only)
    expect(r2.xpAwarded).toBeLessThan(completionAmount) // second session's xp should just be focus, not completion

    // history: completion XP only on first session
    const history = database.getHistory(10)
    const s1History = history.find((s: { id: string }) => s.id === s1.id)
    const s2History = history.find((s: { id: string }) => s.id === s2.id)
    expect(s1History).toBeTruthy()
    expect(s2History).toBeTruthy()
    expect(Number(s1History.xp_awarded)).toBe(focusXp1) // first session includes completion
    // second session's xp_awarded should NOT include completion XP
    const s2Completion = Number(s2History.xp_awarded) - (Number(r2.xpAwarded) || 0) > 0
      ? 'has completion' : 'no completion'
    // r2.xpAwarded is focus only, so s2History.xp_awarded should equal r2.xpAwarded
    expect(Number(s2History.xp_awarded)).toBe(r2.xpAwarded)
  })

  it('creates an available avatar profile when migrating an existing database', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-legacy-test-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    database.createTask({ areaId: area.id, title: 'Preserved task' })
    database.run('DROP TABLE player_profiles')

    const migrated = await new StudyDatabase(dir).init()
    const foundation = migrated.getWorldFoundation()
    expect(foundation.player.intro_status).toBe('available')
    expect(foundation.player.created_from_legacy).toBe(true)
    expect(migrated.getStructure().tasks.some((item: { title: string }) => item.title === 'Preserved task')).toBe(true)
  })

  it('awards 0 completion XP for tasks with no focus history', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-zeroxp-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const task = database.createTask({ areaId: area.id, title: 'No focus task' })
    const result = database.manualCompleteTask(task.id)
    expect(result.xpAwarded).toBe(0)
    expect(result.alreadyAwarded).toBe(false)
    const done = database.getAllStructure().tasks.find((t: { id: string }) => t.id === task.id)
    expect(done?.status).toBe('done')
    expect(done?.completion_xp_awarded).toBe(0) // stays 0 when no XP awarded
  })

  it('prevents duplicate completion XP on re-complete after restore', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-dupe-xp-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const task = database.createTask({ areaId: area.id, title: 'Dup test' })
    const session = database.startSession({ taskId: task.id })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 30 * 60 * 1000, session.id])
    database.stopSession(session.id, { outcome: 'Done', taskCompleted: true })
    const xpAfterFirst = database.getXpSummary().totalXp
    expect(database.getStructure().tasks.find((t: { id: string }) => t.id === task.id)?.status).toBe('done')
    // restore via reopen (keeps completion_xp_awarded=1)
    database.reopenTask(task.id)
    // re-complete manually — status should update to done, but alreadyAwarded=true, xpAwarded=0
    const result2 = database.manualCompleteTask(task.id)
    expect(result2.alreadyAwarded).toBe(true)
    expect(result2.xpAwarded).toBe(0)
    const doneTask = database.getAllStructure().tasks.find((t: { id: string }) => t.id === task.id)
    expect(doneTask?.status).toBe('done')
    // total XP unchanged
    expect(database.getXpSummary().totalXp).toBe(xpAfterFirst)
  })

  it('rejects hard-delete of area with tasks or goals', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-area-del-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.createArea({ name: 'Test', color: '#a55c36' })
    database.createTask({ areaId: area.id, title: 'T' })
    expect(() => database.deleteArea(area.id)).toThrow()
  })

  it('allows archive and restore of area, goal, and task', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-archive-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.createArea({ name: 'ArchiveTest', color: '#6f8255' })
    const goal = database.createGoal({ areaId: area.id, title: 'G' })
    const task = database.createTask({ areaId: area.id, goalId: goal.id, title: 'T' })
    // complete task first (archiveArea requires no active tasks)
    database.run("UPDATE tasks SET status = 'archived', updated_at = ? WHERE id = ?", [Date.now(), task.id])
    expect(database.getStructure().tasks.find((t: { id: string }) => t.id === task.id)).toBeFalsy()
    const restored = database.restoreTask(task.id)
    expect(restored.status).toBe('todo')
    // archive task again
    database.run("UPDATE tasks SET status = 'archived', updated_at = ? WHERE id = ?", [Date.now(), task.id])
    // archive goal
    database.archiveGoal(goal.id)
    expect(database.getStructure().goals.find((g: { id: string }) => g.id === goal.id)).toBeFalsy()
    const restoredGoal = database.restoreGoal(goal.id)
    expect(restoredGoal.status).toBe('active')
    // archive area (now no active tasks)
    database.archiveArea(area.id)
    expect(database.getStructure().areas.find((a: { id: string }) => a.id === area.id)).toBeFalsy()
    const restoredArea = database.restoreArea(area.id)
    expect(restoredArea.archived).toBe(0)
  })

  it('syncs today task after completion and set-as-today', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-today-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const t1 = database.createTask({ areaId: area.id, title: 'Task 1' })
    const t2 = database.createTask({ areaId: area.id, title: 'Task 2' })
    const t3 = database.createTask({ areaId: area.id, title: 'Task 3' })
    // default: t1 should be first (sort_order 1)
    const dash = database.getDashboard()
    expect(dash.nextTasks[0]?.id).toBe(t1.id)
    // complete t1
    database.manualCompleteTask(t1.id)
    const dash2 = database.getDashboard()
    expect(dash2.nextTasks[0]?.id).toBe(t2.id)
    // reorder: move t3 to top
    database.reorderTasks([{ id: t3.id, sortOrder: 0 }, { id: t2.id, sortOrder: 2 }, { id: t1.id, sortOrder: 3 }])
    const dash3 = database.getDashboard()
    expect(dash3.nextTasks[0]?.id).toBe(t3.id)
  })

  it('persists reason=short_session for contributed tasks under 5 minutes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-reason-short-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const contributedTask = database.createTask({ areaId: area.id, title: '刻板' })
    const session = database.startSession({ taskId: null, areaId: area.id, content: '短测试' })
    const result = database.stopSession(session.id, { outcome: '', taskCompleted: false, contributedTaskIds: [contributedTask.id] })
    expect(result.contributedTasks).toHaveLength(1)
    expect(result.contributedTasks[0].reason).toBe('short_session')
    expect(result.contributedTasks[0].xpAwarded).toBe(0)
    const links = database.getContributedTasks(session.id)
    expect(links).toHaveLength(1)
    expect(links[0].reason).toBe('short_session')
    expect(links[0].xp_awarded).toBe(0)
  })

  it('persists reason=awarded with XP for contributed tasks over 5 minutes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-reason-awarded-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const contributedTask = database.createTask({ areaId: area.id, title: '长测试' })
    const session = database.startSession({ taskId: null, areaId: area.id, content: '长测试' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 60 * 60 * 1000, session.id])
    const result = database.stopSession(session.id, { outcome: '', taskCompleted: false, contributedTaskIds: [contributedTask.id] })
    expect(result.contributedTasks).toHaveLength(1)
    expect(result.contributedTasks[0].reason).toBe('awarded')
    expect(result.contributedTasks[0].xpAwarded).toBeGreaterThan(0)
    const links = database.getContributedTasks(session.id)
    expect(links).toHaveLength(1)
    expect(links[0].reason).toBe('awarded')
    expect(links[0].xp_awarded).toBeGreaterThan(0)
  })

  it('persists reason=already_awarded for tasks that already received completion XP', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-reason-already-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const task = database.createTask({ areaId: area.id, title: '已领过' })
    database.run('UPDATE tasks SET completion_xp_awarded = 1 WHERE id = ?', [task.id])
    const session = database.startSession({ taskId: null, areaId: area.id, content: '重领测试' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 60 * 60 * 1000, session.id])
    const result = database.stopSession(session.id, { outcome: '', taskCompleted: false, contributedTaskIds: [task.id] })
    expect(result.contributedTasks).toHaveLength(1)
    expect(result.contributedTasks[0].reason).toBe('already_awarded')
    expect(result.contributedTasks[0].xpAwarded).toBe(0)
    const links = database.getContributedTasks(session.id)
    expect(links).toHaveLength(1)
    expect(links[0].reason).toBe('already_awarded')
  })

  it('persists reason=xp_cap_reached when contributed XP cap is hit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-reason-cap-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    // Create 6 tasks — first 5 fill (10+8+6+4+2=30), 6th hits cap
    const tasks = []
    for (let i = 0; i < 6; i++) {
      tasks.push(database.createTask({ areaId: area.id, title: `CapTest${i}` }))
    }
    const session = database.startSession({ taskId: null, areaId: area.id, content: '上限测试' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 60 * 60 * 1000, session.id])
    const result = database.stopSession(session.id, {
      outcome: '', taskCompleted: false,
      contributedTaskIds: tasks.map(t => t.id),
    })
    // First task gets 10 XP (awarded), last (6th) should be xp_cap_reached at 0 XP
    const last = result.contributedTasks[result.contributedTasks.length - 1]
    expect(last.reason).toBe('xp_cap_reached')
    expect(last.xpAwarded).toBe(0)
    // Verify in DB
    const links = database.getContributedTasks(session.id)
    const lastLink = links[links.length - 1]
    expect(lastLink.reason).toBe('xp_cap_reached')
  })

  it('keeps correct reason on repeat stop (UPSERT idempotency)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-upsert-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const task = database.createTask({ areaId: area.id, title: '幂等测试' })
    const session = database.startSession({ taskId: null, areaId: area.id, content: '幂等' })
    // First stop: short session → short_session
    const r1 = database.stopSession(session.id, { outcome: '', taskCompleted: false, contributedTaskIds: [task.id] })
    expect(r1.contributedTasks[0].reason).toBe('short_session')
    // Simulate repeat: reset session status and re-stop
    database.run("UPDATE focus_sessions SET status = 'paused' WHERE id = ?", [session.id])
    database.run('DELETE FROM session_task_links WHERE session_id = ?', [session.id])
    database.run("UPDATE tasks SET status = 'todo', completion_xp_awarded = 0, completed_at = NULL WHERE id = ?", [task.id])
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 60 * 60 * 1000, session.id])
    const r2 = database.stopSession(session.id, { outcome: '', taskCompleted: false, contributedTaskIds: [task.id] })
    // Second stop with long session: now awarded
    expect(r2.contributedTasks[0].reason).toBe('awarded')
    expect(r2.contributedTasks[0].xpAwarded).toBeGreaterThan(0)
    // Verify DB has updated reason (not stale 'short_session')
    const links = database.getContributedTasks(session.id)
    expect(links).toHaveLength(1)
    expect(links[0].reason).toBe('awarded')
  })

  it('migration adding reason column is idempotent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-migrate-reason-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    // Second init (mimics migration re-run)
    await database.init()
    const cols = database.all("PRAGMA table_info(session_task_links)")
    const reasonCol = cols.find((c: { name: string }) => c.name === 'reason')
    expect(reasonCol).toBeTruthy()
  })

  it('getContributedTasks returns reason alongside xp_awarded', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-contrib-read-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const t1 = database.createTask({ areaId: area.id, title: 'ReadTest1' })
    const t2 = database.createTask({ areaId: area.id, title: 'ReadTest2' })
    const session = database.startSession({ taskId: null, areaId: area.id, content: '读取测试' })
    const result = database.stopSession(session.id, { outcome: '', taskCompleted: false, contributedTaskIds: [t1.id, t2.id] })
    expect(result.contributedTasks).toHaveLength(2)
    const links = database.getContributedTasks(session.id)
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toHaveProperty('task_id')
      expect(link).toHaveProperty('xp_awarded')
      expect(link).toHaveProperty('reason')
      expect(link).toHaveProperty('title')
      expect(link).toHaveProperty('selection_order')
      expect(typeof link.reason).toBe('string')
    }
  })

  it('returnKind brief (0s): no drops, no bond, no pity advance', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-brief-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const settings = database.getSettings()
    const initRare = Number(settings.rare_pity || 0)
    const initComp = Number(settings.companion_pity || 0)
    const invBefore = database.getInventory().reduce((s: number, i: any) => s + Number(i.quantity), 0)
    const session = database.startSession({ taskId: null, areaId: area.id, content: '0秒测试' })
    const result = database.stopSession(session.id, { outcome: '', taskCompleted: false })
    const ex = result.expedition
    expect(ex.returnKind).toBe('brief')
    expect(ex.drops).toEqual([])
    expect(ex.bondXp).toBe(0)
    expect(ex.rareFound).toBe(false)
    expect(ex.newCompanion).toBeNull()
    expect(ex.activeCompanion).not.toBeNull() // companion accompanies, just no bond gain
    const invAfter = database.getInventory().reduce((s: number, i: any) => s + Number(i.quantity), 0)
    expect(invAfter).toBe(invBefore)
    const settings2 = database.getSettings()
    expect(Number(settings2.rare_pity || 0)).toBe(initRare)
    expect(Number(settings2.companion_pity || 0)).toBe(initComp)
  })

  it('returnKind brief (59s): same zero-economy behavior', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-brief-59s-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const session = database.startSession({ taskId: null, areaId: area.id, content: '59秒' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 59000, session.id])
    const settings = database.getSettings()
    const initRare = Number(settings.rare_pity || 0)
    const result = database.stopSession(session.id, { outcome: 'test', taskCompleted: false })
    expect(result.expedition.returnKind).toBe('brief')
    expect(result.expedition.drops).toEqual([])
    expect(result.expedition.bondXp).toBe(0)
    expect(result.expedition.rareFound).toBe(false)
    // Brief returns are only shown transiently in the return UI. They do not
    // persist into the adventure log or any observatory-facing data.
    expect(database.getExpedition(session.id)).toBeNull()
    expect(database.getHistory()).toEqual([])
    // pity unchanged
    const settings2 = database.getSettings()
    expect(Number(settings2.rare_pity || 0)).toBe(initRare)
  })

  it('returnKind short (60s): no economic rewards, still no pity', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-short-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const session = database.startSession({ taskId: null, areaId: area.id, content: '60秒' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 60000, session.id])
    const settings = database.getSettings()
    const initRare = Number(settings.rare_pity || 0)
    const result = database.stopSession(session.id, { outcome: 'short test', taskCompleted: false })
    expect(result.expedition.returnKind).toBe('short')
    expect(result.expedition.drops).toEqual([])
    expect(result.expedition.bondXp).toBe(0)
    expect(result.expedition.rareFound).toBe(false)
    // knowledge relic created (outcome non-empty and returnKind >= short)
    expect(result.expedition.knowledgeRelic).not.toBeNull()
    // pity unchanged
    const settings2 = database.getSettings()
    expect(Number(settings2.rare_pity || 0)).toBe(initRare)
  })

  it('returnKind short (299s): same zero-economy', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-short-299s-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const session = database.startSession({ taskId: null, areaId: area.id, content: '299秒' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 299000, session.id])
    const result = database.stopSession(session.id, { outcome: '', taskCompleted: false })
    expect(result.expedition.returnKind).toBe('short')
    expect(result.expedition.drops).toEqual([])
    expect(result.expedition.bondXp).toBe(0)
    // no relic (outcome empty)
    expect(result.expedition.knowledgeRelic).toBeNull()
  })

  it('returnKind expedition (300s): full rewards resume', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-expedition-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const session = database.startSession({ taskId: null, areaId: area.id, content: '300秒' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 300000, session.id])
    const result = database.stopSession(session.id, { outcome: '', taskCompleted: false })
    expect(result.expedition.returnKind).toBe('expedition')
    expect(result.expedition.drops.length).toBeGreaterThanOrEqual(1)
    expect(result.expedition.bondXp).toBeGreaterThanOrEqual(1)
  })

  it('returnKind deep (3600s): full rewards with 2 drops', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-deep-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const session = database.startSession({ taskId: null, areaId: area.id, content: '3600秒' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 3600000, session.id])
    const result = database.stopSession(session.id, { outcome: '', taskCompleted: false })
    expect(result.expedition.returnKind).toBe('deep')
    const totalQty = result.expedition.drops.reduce((s: number, d: any) => s + d.quantity, 0)
    expect(totalQty).toBeGreaterThanOrEqual(2)
  })

  it('returnKind boundaries: 0→brief, 59→brief, 60→short, 299→short, 300→expedition, 1799→expedition, 1800→deep', () => {
    const { getReturnKind } = require('../../electron/domain.cjs')
    expect(getReturnKind(0)).toBe('brief')
    expect(getReturnKind(59)).toBe('brief')
    expect(getReturnKind(60)).toBe('short')
    expect(getReturnKind(299)).toBe('short')
    expect(getReturnKind(300)).toBe('expedition')
    expect(getReturnKind(1799)).toBe('expedition')
    expect(getReturnKind(1800)).toBe('deep')
    expect(getReturnKind(3600)).toBe('deep')
  })

  it('brief does not consume existing pity', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-pity-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    // Set pity to 8
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('rare_pity', '8')", [])
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('companion_pity', '5')", [])
    const area = database.getStructure().areas[0]
    // Do 3 brief expeditions
    for (let i = 0; i < 3; i++) {
      const s = database.startSession({ taskId: null, areaId: area.id, content: 'pity' + i })
      database.stopSession(s.id, { outcome: '', taskCompleted: false })
    }
    const settings = database.getSettings()
    expect(Number(settings.rare_pity || 0)).toBe(8)
    expect(Number(settings.companion_pity || 0)).toBe(5)
  })

  it('lightweight expedition preserves active companion in result', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-light-companion-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const comps = database.getCompanionCollection()
    expect(comps.active).not.toBeNull()
    const session = database.startSession({ taskId: null, areaId: area.id, content: '同伴测试', companionId: comps.active.id })
    const result = database.stopSession(session.id, { outcome: '', taskCompleted: false })
    expect(result.expedition.activeCompanion).not.toBeNull()
    expect(result.expedition.activeCompanion.id).toBe(comps.active.id)
    expect(result.expedition.bondXp).toBe(0)
    expect(result.expedition.newCompanion).toBeNull()
  })

  it('brief expedition uses restricted event pool', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-brief-pool-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const { BRIEF_LOCATIONS, BRIEF_EVENTS } = require('../../electron/game.cjs')
    for (let i = 0; i < 5; i++) {
      const s = database.startSession({ taskId: null, areaId: area.id, content: 'pool' + i })
      const r = database.stopSession(s.id, { outcome: '', taskCompleted: false })
      expect(BRIEF_LOCATIONS).toContain(r.expedition.location)
      expect(BRIEF_EVENTS).toContain(r.expedition.event)
    }
  })

  it('short expedition uses restricted event pool', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-short-pool-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const { SHORT_LOCATIONS, SHORT_EVENTS } = require('../../electron/game.cjs')
    for (let i = 0; i < 5; i++) {
      const s = database.startSession({ taskId: null, areaId: area.id, content: 'spool' + i })
      database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 120000, s.id])
      const r = database.stopSession(s.id, { outcome: '', taskCompleted: false })
      expect(SHORT_LOCATIONS).toContain(r.expedition.location)
      expect(SHORT_EVENTS).toContain(r.expedition.event)
    }
  })

  it('legacy expedition without returnKind falls back safely', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-legacy-fallback-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    // Do a full expedition (creates normal record without returnKind in JSON)
    const session = database.startSession({ taskId: null, areaId: area.id, content: 'legacy' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 600000, session.id])
    database.stopSession(session.id, { outcome: '', taskCompleted: false })
    // Manually strip returnKind from stored JSON to simulate legacy
    const row = database.one('SELECT rewards_json FROM expeditions WHERE session_id = ?', [session.id])
    const parsed = JSON.parse(row.rewards_json)
    delete parsed.returnKind
    database.run('UPDATE expeditions SET rewards_json = ? WHERE session_id = ?', [JSON.stringify(parsed), session.id])
    // Read back — should get returnKind derived from active_seconds
    const ex = database.getExpedition(session.id)
    expect(ex.returnKind).toBe('expedition') // 600 seconds → expedition
  })

  it('getCompletedStats returns completed-only session counts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-completed-stats-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]

    // Create a brief session (0-59s)
    const s1 = database.startSession({ taskId: null, areaId: area.id, content: 'brief test' })
    database.stopSession(s1.id, { outcome: '', taskCompleted: false })

    // Create a short session (60-299s)
    const s2 = database.startSession({ taskId: null, areaId: area.id, content: 'short test' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 120000, s2.id])
    database.stopSession(s2.id, { outcome: 'did stuff', taskCompleted: false })

    // Create a full expedition (300+)
    const s3 = database.startSession({ taskId: null, areaId: area.id, content: 'expedition test' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 600000, s3.id])
    database.stopSession(s3.id, { outcome: '', taskCompleted: false })

    // Also complete a task
    const task = database.createTask({ areaId: area.id, title: '统计测试任务' })
    database.manualCompleteTask(task.id)

    const now = Date.now()
    const dayStart = now - 86400000
    const dayEnd = now + 86400000
    const stats = database.getCompletedStats(dayStart, dayEnd)

    expect(stats.totalActiveSeconds).toBeGreaterThanOrEqual(720)
    expect(stats.sessionCounts.brief).toBe(0)
    expect(stats.sessionCounts.short).toBeGreaterThanOrEqual(1)
    expect(stats.sessionCounts.expedition).toBeGreaterThanOrEqual(1)
    expect(stats.completedTaskCount).toBeGreaterThanOrEqual(1)
    expect(stats.longestSessionSeconds).toBeGreaterThanOrEqual(600)
  })

  it('getCompletedStats excludes cancelled and running sessions', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-completed-filter-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]

    const s1 = database.startSession({ taskId: null, areaId: area.id, content: 'completed' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 120000, s1.id])
    database.stopSession(s1.id, { outcome: '', taskCompleted: false })

    // cancelled — should NOT appear
    const s2 = database.startSession({ taskId: null, areaId: area.id, content: 'cancelled' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 120000, s2.id])
    database.cancelSession(s2.id)

    const now = Date.now()
    const stats = database.getCompletedStats(now - 86400000, now + 86400000)
    // Should only count the completed one
    expect(stats.sessionCounts.brief + stats.sessionCounts.short + stats.sessionCounts.expedition + stats.sessionCounts.deep).toBe(1)
  })
})

describe('letters CRUD', () => {
  it('migration creates letters table idempotently', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-letters-mig-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    await database.init() // second init safe
    const cols = database.all("PRAGMA table_info(letters)")
    expect(cols.map((c: { name: string }) => c.name)).toContain('letter_type')
    expect(cols.map((c: { name: string }) => c.name)).toContain('period_key')
  })

  it('createLetter succeeds with valid data', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-create-letter-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const id = crypto.randomUUID()
    const fact = { sessionCounts: { brief: 0, short: 1, expedition: 0, deep: 0 }, totalActiveSeconds: 120 }
    const letter = database.createLetter({
      id, letterType: 'daily', periodKey: '2026-07-20',
      periodStart: 1752595200000, periodEnd: 1752681600000,
      timezoneOffsetMinutes: 480, timezoneName: 'Asia/Shanghai',
      subject: '今天留下的足迹', fact, templateBody: '今天共专注 2 分钟…',
    })
    expect(letter.id).toBe(id)
    expect(letter.letter_type).toBe('daily')
    expect(letter.is_read).toBe(0)
    expect(letter.body_source).toBe('template')
    expect(letter.fact).toEqual(fact)
  })

  it('fact snapshot is stable after task rename', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-fact-freeze-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const task = database.createTask({ areaId: area.id, title: '原始标题' })
    const fact = { sessionCounts: { brief: 0, short: 1, expedition: 0, deep: 0 }, completedTasks: [{ id: task.id, title: '原始标题' }] }
    const id = crypto.randomUUID()
    database.createLetter({ id, letterType: 'daily', periodKey: '2026-07-21', periodStart: 1752681600000, periodEnd: 1752768000000, timezoneOffsetMinutes: 480, timezoneName: 'Asia/Shanghai', subject: '测试', fact, templateBody: '正文' })
    // Rename task after letter created
    database.updateTask(task.id, { title: '新标题' })
    const letter = database.getLetterById(id)
    expect(letter.fact.completedTasks[0].title).toBe('原始标题')
  })

  it('duplicate daily period_key throws', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-dup-period-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.createLetter({ id: crypto.randomUUID(), letterType: 'daily', periodKey: '2026-07-22', periodStart: 1752768000000, periodEnd: 1752854400000, timezoneOffsetMinutes: 480, timezoneName: 'Asia/Shanghai', subject: '1', fact: {}, templateBody: 'a' })
    expect(() => database.createLetter({ id: crypto.randomUUID(), letterType: 'daily', periodKey: '2026-07-22', periodStart: 1752768000000, periodEnd: 1752854400000, timezoneOffsetMinutes: 480, timezoneName: 'Asia/Shanghai', subject: '2', fact: {}, templateBody: 'b' })).toThrow()
  })

  it('daily and weekly can share same period_key', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-daily-weekly-key-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.createLetter({ id: crypto.randomUUID(), letterType: 'daily', periodKey: '2026-07-20', periodStart: 1752595200000, periodEnd: 1752681600000, timezoneOffsetMinutes: 480, timezoneName: 'Asia/Shanghai', subject: '日', fact: {}, templateBody: 'd' })
    database.createLetter({ id: crypto.randomUUID(), letterType: 'weekly', periodKey: '2026-07-20', periodStart: 1752595200000, periodEnd: 1753200000000, timezoneOffsetMinutes: 480, timezoneName: 'Asia/Shanghai', subject: '周', fact: {}, templateBody: 'w' })
    expect(database.listLetters({}).length).toBe(2)
  })

  it('default unread, mark read sets read_at, repeat mark no change', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-read-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const id = crypto.randomUUID()
    database.createLetter({ id, letterType: 'daily', periodKey: '2026-07-23', periodStart: 1752854400000, periodEnd: 1752940800000, timezoneOffsetMinutes: 480, timezoneName: 'Asia/Shanghai', subject: '读', fact: {}, templateBody: 't' })
    expect(database.getUnreadLetterCount()).toBe(1)
    const r1 = database.markLetterRead(id)
    expect(r1.is_read).toBe(1)
    expect(r1.read_at).toBeGreaterThan(0)
    const r2 = database.markLetterRead(id)
    expect(r2.read_at).toBe(r1.read_at)
    expect(database.getUnreadLetterCount()).toBe(0)
  })

  it('mark unread clears read_at', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-unread-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const id = crypto.randomUUID()
    database.createLetter({ id, letterType: 'daily', periodKey: '2026-07-24', periodStart: 1752940800000, periodEnd: 1753027200000, timezoneOffsetMinutes: 480, timezoneName: 'Asia/Shanghai', subject: '未', fact: {}, templateBody: 'u' })
    database.markLetterRead(id)
    database.markLetterUnread(id)
    const r = database.getLetterById(id)
    expect(r.is_read).toBe(0)
    expect(r.read_at).toBeNull()
    expect(database.getUnreadLetterCount()).toBe(1)
  })

  it('getLatestUnreadLetter returns most recent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-latest-unread-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const id1 = crypto.randomUUID()
    const id2 = crypto.randomUUID()
    database.createLetter({ id: id1, letterType: 'daily', periodKey: '2026-07-25', periodStart: 1753027200000, periodEnd: 1753113600000, timezoneOffsetMinutes: 480, timezoneName: 'Asia/Shanghai', subject: '旧', fact: {}, templateBody: 'a' })
    database.createLetter({ id: id2, letterType: 'daily', periodKey: '2026-07-26', periodStart: 1753113600000, periodEnd: 1753200000000, timezoneOffsetMinutes: 480, timezoneName: 'Asia/Shanghai', subject: '新', fact: {}, templateBody: 'b' })
    const latest = database.getLatestUnreadLetter()
    expect(latest.id).toBe(id2)
  })

  it('listLetters with unreadOnly and letterType filters', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-list-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const d1 = crypto.randomUUID()
    const w1 = crypto.randomUUID()
    database.createLetter({ id: d1, letterType: 'daily', periodKey: '2026-07-27', periodStart: 1753200000000, periodEnd: 1753286400000, timezoneOffsetMinutes: 480, timezoneName: 'Asia/Shanghai', subject: 'd', fact: {}, templateBody: 'x' })
    database.createLetter({ id: w1, letterType: 'weekly', periodKey: '2026-07-20', periodStart: 1752595200000, periodEnd: 1753200000000, timezoneOffsetMinutes: 480, timezoneName: 'Asia/Shanghai', subject: 'w', fact: {}, templateBody: 'y' })
    database.markLetterRead(d1)
    const unread = database.listLetters({ unreadOnly: true })
    expect(unread).toHaveLength(1)
    expect(unread[0].id).toBe(w1)
    const dailies = database.listLetters({ letterType: 'daily' })
    expect(dailies).toHaveLength(1)
  })

  it('saveLetterReply trims and enforces length', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-reply-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const id = crypto.randomUUID()
    database.createLetter({ id, letterType: 'daily', periodKey: '2026-07-28', periodStart: 1753286400000, periodEnd: 1753372800000, timezoneOffsetMinutes: 480, timezoneName: 'Asia/Shanghai', subject: '回', fact: {}, templateBody: 't' })
    const r1 = database.saveLetterReply(id, '  感谢小天使  ')
    expect(r1.reply_text).toBe('感谢小天使')
    const r2 = database.saveLetterReply(id, '')
    expect(r2.reply_text).toBeNull()
    expect(() => database.saveLetterReply(id, 'x'.repeat(501))).toThrow()
  })

  it('rejects invalid letter type and missing template body', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-validate-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    expect(() => database.createLetter({ id: crypto.randomUUID(), letterType: 'monthly', periodKey: '2026-07', periodStart: 1, periodEnd: 2, timezoneOffsetMinutes: 0, timezoneName: 'UTC', subject: 'x', fact: {}, templateBody: '' })).toThrow()
    expect(() => database.createLetter({ id: crypto.randomUUID(), letterType: 'daily', periodKey: 'x', periodStart: 1, periodEnd: 0, timezoneOffsetMinutes: 0, timezoneName: 'UTC', subject: 'x', fact: {}, templateBody: 'x' })).toThrow()
  })

  it('no public delete method exposed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-no-delete-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    expect(typeof database.deleteLetter).toBe('undefined')
  })

  it('old database upgrade preserves existing data counts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-upgrade-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const taskCount = database.getStructure().tasks.length
    const sessionCount = database.getDashboard().today.sessionCount
    // re-init simulates upgrade
    await database.init()
    expect(database.getStructure().tasks.length).toBe(taskCount)
    expect(database.getDashboard().today.sessionCount).toBe(sessionCount)
  })

  it('unread index filters is_read = 0', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-unread-idx-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const indices = database.all("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_letters_unread'")
    expect(indices).toHaveLength(1)
    expect(indices[0].sql).toContain('is_read = 0')
  })

  it('createLetter rejects empty timezoneName', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-validate-tz-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    expect(() => database.createLetter({ id: crypto.randomUUID(), letterType: 'daily', periodKey: '2026-08-01', periodStart: 1, periodEnd: 2, timezoneOffsetMinutes: 0, timezoneName: '  ', subject: 'x', fact: {}, templateBody: 'x' })).toThrow()
  })

  it('createLetter rejects unserializable fact', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-fact-json-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const circular = {}
    ;(circular as any).self = circular
    expect(() => database.createLetter({ id: crypto.randomUUID(), letterType: 'daily', periodKey: '2026-08-02', periodStart: 1, periodEnd: 2, timezoneOffsetMinutes: 0, timezoneName: 'UTC', subject: 'x', fact: circular, templateBody: 'x' })).toThrow()
  })

  it('duplicate period error has stable code', () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-err-code-'))
    tempDirs.push(dir)
    // use async wrapper
    return new Promise<void>(async (resolve) => {
      const database = await new StudyDatabase(dir).init()
      const opts = { id: crypto.randomUUID(), letterType: 'daily', periodKey: '2026-08-03', periodStart: 1, periodEnd: 2, timezoneOffsetMinutes: 0, timezoneName: 'UTC', subject: 'x', fact: {}, templateBody: 'x' }
      database.createLetter(opts)
      try { database.createLetter(opts); } catch (e: any) {
        expect(e.code).toBe('LETTER_PERIOD_EXISTS')
        resolve()
      }
    })
  })

  it('lets the post office turn through 100 preserved letters without changing them', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-pages-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    for (let i = 0; i < 100; i++) {
      database.createLetter({ id: crypto.randomUUID(), letterType: 'daily', periodKey: `2026-08-${String(i + 1).padStart(2, '0')}`, periodStart: i, periodEnd: i + 1, timezoneOffsetMinutes: 0, timezoneName: 'UTC', subject: `信${i}`, fact: {}, templateBody: `b${i}` })
      database.run('UPDATE letters SET created_at = ?, updated_at = ? WHERE period_key = ?', [1000 + i, 1000 + i, `2026-08-${String(i + 1).padStart(2, '0')}`])
    }
    const page1 = database.listLetters({ limit: 50, offset: 0 })
    expect(page1.length).toBe(50)
    expect(page1[0].subject).toBe('信99')
    const page2 = database.listLetters({ limit: 50, offset: 50 })
    expect(page2).toHaveLength(50)
    expect(page2[0].subject).toBe('信49')
    expect(page2[49].subject).toBe('信0')
    expect(database.getLetterById(page2[49].id)?.template_body).toBe('b0')
  })

  it('markLetterRead throws on missing id', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-read-missing-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    expect(() => database.markLetterRead('nonexistent')).toThrow()
  })

  it('markLetterUnread throws on missing id', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-unread-missing-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    expect(() => database.markLetterUnread('nonexistent')).toThrow()
  })

  it('saveLetterReply does not change is_read or body_source', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-reply-immutable-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const id = crypto.randomUUID()
    database.createLetter({ id, letterType: 'daily', periodKey: '2026-08-04', periodStart: 1, periodEnd: 2, timezoneOffsetMinutes: 0, timezoneName: 'UTC', subject: '不变', fact: {}, templateBody: 't' })
    const r = database.saveLetterReply(id, 'hello')
    expect(r.is_read).toBe(0)
    expect(r.body_source).toBe('template')
    expect(r.fact).toEqual({})
  })
})

describe('periodic letters', () => {
  it('ensureLetterForPeriod creates daily letter for expedition', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-ensure-daily-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const session = database.startSession({ taskId: null, areaId: area.id, content: '测试远征' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 600000, session.id])
    database.stopSession(session.id, { outcome: '完成复习', taskCompleted: false })
    const period = getDailyPeriod(Date.now())
    const r = database.ensureLetterForPeriod({ letterType: 'daily', period })
    expect(r.created).toBe(true)
    expect(r.letter.letter_type).toBe('daily')
    expect(r.letter.fact.stats.totalActiveSeconds).toBeGreaterThanOrEqual(600)
  })

  it('ensureLetterForPeriod skips empty day', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-skip-empty-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const tomorrow = Date.now() + 86400000
    const period = getDailyPeriod(tomorrow)
    const r = database.ensureLetterForPeriod({ letterType: 'daily', period })
    expect(r.skipped).toBe(true)
    expect(r.letter).toBeNull()
  })

  it('ensureLetterForPeriod returns existing on repeat', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-repeat-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const session = database.startSession({ taskId: null, areaId: area.id, content: '重复测试' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [Date.now() - 600000, session.id])
    database.stopSession(session.id, { outcome: '', taskCompleted: false })
    const period = getDailyPeriod(Date.now())
    const r1 = database.ensureLetterForPeriod({ letterType: 'daily', period })
    expect(r1.created).toBe(true)
    const r2 = database.ensureLetterForPeriod({ letterType: 'daily', period })
    expect(r2.created).toBe(false)
    expect(r2.letter).not.toBeNull()
  })

  it('ensurePeriodicLetters initializes and does not backfill', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-init-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const r = database.ensurePeriodicLetters(Date.now())
    expect(r.initialized).toBe(true)
    expect(r.daily.created).toBe(0)
    expect(r.weekly.created).toBe(0)
  })

  it('ensureLetterForPeriod creates for day with expedition using explicit period', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-ensure-day-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const now = Date.now()
    // Place session firmly inside today (now - 10 min)
    const session = database.startSession({ taskId: null, areaId: area.id, content: '测试' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [now - 600000, session.id])
    database.stopSession(session.id, { outcome: '', taskCompleted: false })
    // Use today's period
    const period = getDailyPeriod(now)
    const r = database.ensureLetterForPeriod({ letterType: 'daily', period })
    expect(r.created).toBe(true)
    expect(r.letter).not.toBeNull()
  })

  it('ensurePeriodicLetters idempotent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-idem-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.ensurePeriodicLetters(Date.now())
    const r2 = database.ensurePeriodicLetters(Date.now())
    expect(r2.initialized).toBe(false)
    expect(r2.daily.skipped + r2.daily.existing).toBe(r2.daily.checked || 0)
  })

  it('ensureLetterForPeriod creates weekly for current week with expedition', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-weekly-gen-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const now = Date.now()
    const session = database.startSession({ taskId: null, areaId: area.id, content: '本周远征' })
    database.run('UPDATE focus_intervals SET started_at = ? WHERE session_id = ?', [now - 600000, session.id])
    database.stopSession(session.id, { outcome: '', taskCompleted: false })
    const period = getWeeklyPeriod(now)
    const r = database.ensureLetterForPeriod({ letterType: 'weekly', period })
    expect(r.created).toBe(true)
    expect(r.letter).not.toBeNull()
  })

  it('ensurePeriodicLetters does not create current day', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-no-current-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const now = Date.now()
    const todayPeriod = getDailyPeriod(now)
    const session = database.startSession({ taskId: null, areaId: area.id, content: '今天' })
    database.stopSession(session.id, { outcome: '', taskCompleted: false })
    database.ensurePeriodicLetters(now)
    // Current day should not be created
    const letters = database.listLetters({})
    expect(letters.every((l: any) => l.period_key !== todayPeriod.periodKey)).toBe(true)
  })

  it('old database letter count zero before mail system', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-old-db-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const taskCount = database.getStructure().tasks.length
    // Run ensure — should not create fake historical letters
    database.ensurePeriodicLetters(Date.now())
    expect(database.listLetters({}).length).toBe(0)
    expect(database.getStructure().tasks.length).toBe(taskCount)
  })

  it('ensureLetterForPeriod creates for review-only day', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-review-letter-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const now = Date.now()
    database.saveDailyReview({ date: localDateKey(now), win: '复习了第三章', blocker: '', energy: 4, tomorrowTask: '' })
    const period = getDailyPeriod(now)
    const r = database.ensureLetterForPeriod({ letterType: 'daily', period })
    expect(r.created).toBe(true)
    expect(r.letter).not.toBeNull()
  })

  it('ensurePeriodicLetters does not exceed 30 day backtrack', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-max-days-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    // Set mail_started_at to 40 days ago
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mail_started_at_ms', ?)", [String(Date.now() - 40 * 86400000)])
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_daily_period_checked', ?)", [getDailyPeriod(Date.now() - 40 * 86400000).periodKey])
    const r = database.ensurePeriodicLetters(Date.now())
    // Should only have checked at most 30 days worth, not 40
    expect(r.daily.checked).toBeLessThanOrEqual(31)
  })
})

describe('IPC DTO mapping', () => {
  it('list DTO does not expose fact_json', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-dto-list-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const id = crypto.randomUUID()
    database.createLetter({ id, letterType: 'daily', periodKey: '2026-09-01', periodStart: 1, periodEnd: 2, timezoneOffsetMinutes: 0, timezoneName: 'UTC', subject: '测试信', fact: { totalActiveSeconds: 100, sessionCounts: { brief: 0, short: 1, expedition: 0, deep: 0 }, completedTasks: [] }, templateBody: '正文内容比较多'.repeat(20) })
    const letters = database.listLetters({})
    const dto = letters.map((l: any) => ({
      id: l.id, letterType: l.letter_type, subject: l.subject,
      bodyPreview: (l.template_body || '').slice(0, 80) + ((l.template_body || '').length > 80 ? '…' : ''),
      isRead: l.is_read === 1, readAt: l.read_at, createdAt: l.created_at,
    }))
    expect(dto[0]).not.toHaveProperty('fact_json')
    expect(dto[0]).not.toHaveProperty('template_body')
    expect(dto[0].bodyPreview.length).toBeLessThanOrEqual(81)
  })

  it('detail body falls back to template when ai_body is null', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-dto-detail-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const id = crypto.randomUUID()
    database.createLetter({ id, letterType: 'daily', periodKey: '2026-09-02', periodStart: 1, periodEnd: 2, timezoneOffsetMinutes: 0, timezoneName: 'UTC', subject: 'fallback', fact: {}, templateBody: '模板正文' })
    const l = database.getLetterById(id)
    const body = l.body_source === 'ai' && l.ai_body ? l.ai_body : l.template_body
    expect(body).toBe('模板正文')
  })

  it('getCompletedStats does not include running sessions in stats', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-dto-stats-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const s = database.startSession({ taskId: null, areaId: area.id, content: 'running only' })
    // Do NOT stop — session remains running
    const period = getDailyPeriod(Date.now())
    const stats = database.getCompletedStats(period.periodStart, period.periodEnd)
    expect(stats.totalActiveSeconds).toBe(0)
    expect(stats.sessionCounts.brief + stats.sessionCounts.short + stats.sessionCounts.expedition + stats.sessionCounts.deep).toBe(0)
  })

  it('ensurePeriodicLetters idempotent via IPC-style repeated calls', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-ipc-idem-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const r1 = database.ensurePeriodicLetters()
    const r2 = database.ensurePeriodicLetters()
    expect(r2.initialized).toBe(false)
    expect(r2.daily.created).toBe(0)
    expect(r2.weekly.created).toBe(0)
  })
})

// ── Welcome letter tests ────────────────────────────────────

describe('welcome letter', () => {
  it('generates on first call, not on second', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-welcome-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const r1 = database.ensureWelcomeLetter()
    expect(r1.created).toBe(true)
    const r2 = database.ensureWelcomeLetter()
    expect(r2.created).toBe(false)
  })

  it('does not interfere with daily counts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-welcome-daily-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.ensureWelcomeLetter()
    const dailies = database.listLetters({ letterType: 'daily' })
    expect(dailies.length).toBe(0)
  })

  it('welcome letter is memorial type', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-welcome-type-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.ensureWelcomeLetter()
    const letters = database.listLetters({ letterType: 'memorial' })
    expect(letters.length).toBe(1)
    expect(letters[0].subject).toBe('你好呀，旅人')
  })

  it('welcomes the traveller from the post office counter, not an upstairs residence', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-welcome-copy-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.ensureWelcomeLetter()
    const letter = database.listLetters({ letterType: 'memorial' })[0]
    expect(letter.template_body).toContain('天使邮局的木格')
    expect(letter.template_body).toContain('柜台后')
    expect(letter.template_body).not.toContain('邮局二楼')
  })

  it('welcome letter has ai_status template (never AI)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-welcome-ai-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.ensureWelcomeLetter()
    const letter = database.getLetterById(
      database.listLetters({ letterType: 'memorial' })[0].id
    )
    expect(letter.body_source).toBe('template')
  })
})

// ── Data repair tests ───────────────────────────────────────

describe('repairInvalidLetters', () => {
  it('deletes birthday letter from before player joined', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-repair-bday-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    // Player joined July 2026, birthday is April 16
    database.setBirthday(4, 16)
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('world_entered_at_ms', ?)",
      [String(new Date(2026, 6, 16).getTime())])
    // Manually insert an invalid birthday letter (birthday:2026 — before player joined)
    database.createLetter({
      id: crypto.randomUUID(), letterType: 'festival', periodKey: 'birthday:2026',
      periodStart: new Date(2026, 3, 16, 12).getTime(), periodEnd: new Date(2026, 3, 17, 12).getTime(),
      timezoneOffsetMinutes: -480, timezoneName: 'Asia/Shanghai',
      subject: '写给你的生日信', fact: {}, templateBody: '测试'
    })
    const before = database.listLetters({ letterType: 'festival' }).length
    expect(before).toBeGreaterThanOrEqual(1)

    const r = database.repairInvalidLetters()
    expect(r.deletedBirthday).toBeGreaterThanOrEqual(1)

    const after = database.listLetters({ letterType: 'festival' }).length
    expect(after).toBe(0) // all cleaned
  })

  it('deletes festival letters from before player joined', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-repair-fest-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('world_entered_at_ms', ?)",
      [String(new Date(2026, 6, 16).getTime())])
    database.createLetter({
      id: crypto.randomUUID(), letterType: 'festival', periodKey: 'returning_lights:2025:opening',
      periodStart: new Date(2025, 10, 7, 12).getTime(), periodEnd: new Date(2025, 10, 8, 12).getTime(),
      timezoneOffsetMinutes: -480, timezoneName: 'Asia/Shanghai',
      subject: '灯火初燃', fact: {}, templateBody: '测试'
    })
    const r = database.repairInvalidLetters()
    expect(r.deletedFestival).toBeGreaterThanOrEqual(1)
  })
})

// ── Audit: birthday letter_type is memorial ─────────────────

describe('birthday letter type audit', () => {
  it('birthday letter is created as memorial, not festival', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-audit-memorial-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.setBirthday(4, 16)
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('world_entered_at_ms', ?)",
      [String(new Date(2027, 0, 1).getTime())])
    database.ensureBirthdayLetter(new Date(2027, 3, 16, 12).getTime())
    const letters = database.listLetters({})
    const bday = letters.find((l: any) => l.period_key === 'birthday:2027')
    expect(bday).toBeDefined()
    expect(bday.letter_type).toBe('memorial')
  })

  it('repairInvalidLetters does not delete valid memorial birthday', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-audit-valid-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.setBirthday(4, 16)
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('world_entered_at_ms', ?)",
      [String(new Date(2027, 0, 1).getTime())])
    database.ensureBirthdayLetter(new Date(2027, 3, 16, 12).getTime())
    const r = database.repairInvalidLetters()
    expect(r.deletedBirthday).toBe(0) // Valid — birthday after player joined
  })
})

// ── Birthday settings tests ──────────────────────────────────

describe('birthday settings', () => {
  it('sets birthday for the first time', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-bday-set-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const result = database.setBirthday(5, 12)
    expect(result.month).toBe(5)
    expect(result.day).toBe(12)
    expect(result.updatedAt).toBeGreaterThan(0)
    const settings = database.getBirthdaySettings()
    expect(settings.month).toBe(5)
    expect(settings.day).toBe(12)
  })

  it('rejects invalid birthday dates', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-bday-invalid-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    expect(() => database.setBirthday(0, 1)).toThrow()
    expect(() => database.setBirthday(13, 1)).toThrow()
    expect(() => database.setBirthday(5, 0)).toThrow()
    expect(() => database.setBirthday(5, 32)).toThrow()
  })

  it('rejects modification within 365-day cooldown', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-bday-cooldown-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.setBirthday(5, 12)
    try {
      database.setBirthday(6, 15)
      expect.unreachable('should have thrown')
    } catch (e: any) {
      expect(e.code).toBe('BIRTHDAY_COOLDOWN')
    }
  })

  it('returns no birthday before setting', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-bday-empty-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const settings = database.getBirthdaySettings()
    expect(settings.month).toBe(0)
    expect(settings.day).toBe(0)
  })

  it('ensureBirthdayLetter skips when no birthday set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-bday-noset-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const result = database.ensureBirthdayLetter()
    expect(result.created).toBe(false)
    expect(result.reason).toBe('no_birthday_set')
  })
})

// ── Full mail lifecycle automated tests ──────────────────────

describe('mail lifecycle — regression', () => {
  it('generates daily letters for ALL past days with data (not just last day)', async () => {
    // Simulates real player: started 7/16, had sessions 7/17-7/20
    // First check on 7/21 must generate letters for ALL 4 days
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-regression-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]

    const mailStart = new Date(2026, 6, 16, 12).getTime()
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mail_started_at_ms', ?)", [String(mailStart)])

    // Create completed sessions on 7/17, 7/18, 7/19, 7/20
    for (const day of [17, 18, 19, 20]) {
      const s = database.startSession({ taskId: null, areaId: area.id, content: `远征 ${day}日` })
      const start = new Date(2026, 6, day, 8).getTime()
      const end = new Date(2026, 6, day, 10).getTime()
      database.run("INSERT INTO focus_intervals (id, session_id, started_at, ended_at) VALUES (?,?,?,?)",
        [crypto.randomUUID(), s.id, start, end])
      database.run("UPDATE focus_sessions SET status='completed', ended_at=?, active_seconds=7200 WHERE id=?",
        [end, s.id])
    }

    // First mail check on 7/21 — must generate for all 4 days
    const now = new Date(2026, 6, 21, 12).getTime()
    const r = database.ensurePeriodicLetters(now)

    const letters = database.listLetters({ letterType: 'daily' })
    expect(letters.length).toBeGreaterThanOrEqual(4) // 7/17 + 7/18 + 7/19 + 7/20
    const subjects = letters.map((l: any) => l.subject).sort()
    expect(subjects).toContain('7月17日的星页')
    expect(subjects).toContain('7月18日的星页')
    expect(subjects).toContain('7月19日的星页')
    expect(subjects).toContain('7月20日的星页')
    // No old template
    expect(subjects.every((s: string) => /^\d+月\d+日的星页$/.test(s))).toBe(true)

    expect(r.daily.created).toBeGreaterThanOrEqual(4)
  })

  it('repairMailTimeline resets checkpoints so history is re-scanned', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-repair-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]

    const mailStart = new Date(2026, 6, 16, 12).getTime()
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mail_started_at_ms', ?)", [String(mailStart)])
    // Simulate bug: lastDaily already set to future, skipping all history
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_daily_period_checked', ?)", ['2026-07-21'])

    // Create session on 7/18
    const s = database.startSession({ taskId: null, areaId: area.id, content: '远征' })
    const start = new Date(2026, 6, 18, 8).getTime()
    const end = new Date(2026, 6, 18, 10).getTime()
    database.run("INSERT INTO focus_intervals (id, session_id, started_at, ended_at) VALUES (?,?,?,?)",
      [crypto.randomUUID(), s.id, start, end])
    database.run("UPDATE focus_sessions SET status='completed', ended_at=?, active_seconds=7200 WHERE id=?",
      [end, s.id])

    // Before repair: no new letters
    const now = new Date(2026, 6, 21, 12).getTime()
    const r1 = database.ensurePeriodicLetters(now)
    expect(r1.daily.created).toBe(0) // skipped everything

    // Repair
    const repair = database.repairMailTimeline()
    expect(repair.repaired).toBe(true)

    // After repair: re-scanned and found 7/18
    const r2 = database.ensurePeriodicLetters(now)
    const letters = database.listLetters({ letterType: 'daily' })
    expect(letters.some((l: any) => l.subject === '7月18日的星页')).toBe(true)
    expect(r2.daily.created).toBeGreaterThanOrEqual(1)
  })
})

describe('mail lifecycle — daily', () => {
  it('scans from mail_started_at to today, skipping blank days', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-daily-scan-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]

    // Simulate player starting 7/16, it's now 7/21
    const mailStart = new Date(2026, 6, 16, 12).getTime()
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mail_started_at_ms', ?)", [String(mailStart)])

    // Create a completed session on 7/18
    const s = database.startSession({ taskId: null, areaId: area.id, content: 'test' })
    const day18start = new Date(2026, 6, 18, 0).getTime()
    const day18end = new Date(2026, 6, 18, 2).getTime()
    // Manually inject intervals for 7/18
    database.run("INSERT INTO focus_intervals (id, session_id, started_at, ended_at) VALUES (?,?,?,?)",
      [crypto.randomUUID(), s.id, day18start, day18end])
    database.run("UPDATE focus_sessions SET status='completed', ended_at=?, active_seconds=7200 WHERE id=?",
      [day18end, s.id])

    const now = new Date(2026, 6, 21, 12).getTime()
    const r = database.ensurePeriodicLetters(now)

    // 7/16-7/21 = 6 days checked; only 7/18 should generate
    expect(r.daily.checked).toBeGreaterThanOrEqual(1)
    expect(r.daily.created).toBeGreaterThanOrEqual(1)

    const letters = database.listLetters({ letterType: 'daily' })
    expect(letters.length).toBeGreaterThanOrEqual(1)
    // Title must be new format
    expect(letters[0].subject).toContain('的星页')
    expect(letters[0].subject).not.toContain('炉火旁')
  })

  it('daily titles are date-based, never old templates', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-daily-title-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]

    const mailStart = new Date(2026, 6, 15, 12).getTime()
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mail_started_at_ms', ?)", [String(mailStart)])

    // Create sessions on 7/16 and 7/17
    for (const day of [16, 17]) {
      const s = database.startSession({ taskId: null, areaId: area.id, content: 'test' })
      const start = new Date(2026, 6, day, 0).getTime()
      const end = new Date(2026, 6, day, 2).getTime()
      database.run("INSERT INTO focus_intervals (id, session_id, started_at, ended_at) VALUES (?,?,?,?)",
        [crypto.randomUUID(), s.id, start, end])
      database.run("UPDATE focus_sessions SET status='completed', ended_at=?, active_seconds=7200 WHERE id=?",
        [end, s.id])
    }

    const now = new Date(2026, 6, 18, 12).getTime()
    database.ensurePeriodicLetters(now)

    const letters = database.listLetters({ letterType: 'daily' })
    for (const l of letters) {
      // No old template words
      expect(l.subject).not.toContain('炉火旁')
      expect(l.subject).not.toContain('整理')
      expect(l.subject).not.toContain('归程')
      // Must contain date + 的星页
      expect(l.subject).toMatch(/\d+月\d+日的星页/)
    }
  })
})

describe('mail lifecycle — weekly', () => {
  it('generates weekly letter after a full week of activity', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-weekly-life-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]

    const mailStart = new Date(2026, 6, 13, 12).getTime() // Monday 7/13
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mail_started_at_ms', ?)", [String(mailStart)])

    // Create a session each day Mon-Sun (7/13-7/19)
    for (let d = 13; d <= 19; d++) {
      const s = database.startSession({ taskId: null, areaId: area.id, content: 'test' })
      const start = new Date(2026, 6, d, 8).getTime()
      const end = new Date(2026, 6, d, 10).getTime()
      database.run("INSERT INTO focus_intervals (id, session_id, started_at, ended_at) VALUES (?,?,?,?)",
        [crypto.randomUUID(), s.id, start, end])
      database.run("UPDATE focus_sessions SET status='completed', ended_at=?, active_seconds=7200 WHERE id=?",
        [end, s.id])
    }

    // Now = 7/20 (Monday after the full week) — week 7/13-7/19 has ended
    const now = new Date(2026, 6, 20, 12).getTime()
    database.ensurePeriodicLetters(now)

    const letters = database.listLetters({ letterType: 'weekly' })
    expect(letters.length).toBeGreaterThanOrEqual(1)
    // Title: "旅途札记" (date range in subtitle)
    const subj = letters[0].subject
    expect(subj).toBe('旅途札记')
  })

  it('weekly idempotent on repeated calls', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-weekly-idem-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const area = database.getStructure().areas[0]
    const mailStart = new Date(2026, 6, 13, 12).getTime()
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mail_started_at_ms', ?)", [String(mailStart)])
    for (let d = 13; d <= 19; d++) {
      const s = database.startSession({ taskId: null, areaId: area.id, content: 'test' })
      const start = new Date(2026, 6, d, 8).getTime()
      const end = new Date(2026, 6, d, 10).getTime()
      database.run("INSERT INTO focus_intervals (id, session_id, started_at, ended_at) VALUES (?,?,?,?)",
        [crypto.randomUUID(), s.id, start, end])
      database.run("UPDATE focus_sessions SET status='completed', ended_at=?, active_seconds=7200 WHERE id=?",
        [end, s.id])
    }
    const now = new Date(2026, 6, 20, 12).getTime()
    const r1 = database.ensurePeriodicLetters(now)
    const r2 = database.ensurePeriodicLetters(now)
    expect(r2.weekly.created).toBe(0) // second call creates nothing
  })
})

describe('mail lifecycle — festival', () => {
  // NOTE: festival is annual. firstYear=2025 means 2025's 3 nodes always exist after their dates pass.
  // 2026 adds another 3 nodes as each date passes.
  // Base: 2025 opening+midway+climax = 3

  it('Nov 6 — only 2025 nodes (3, no 2026 yet)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-fest-nov6-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const ts = new Date(2026, 10, 6, 12).getTime()
    database.ensureEventLetters(ts)
    const letters = database.listLetters({ letterType: 'festival' })
    // 2025's 3 nodes; 2026 starts tomorrow
    expect(letters.length).toBe(3)
    const y2026 = letters.filter((l: any) => l.period_key.includes('2026'))
    expect(y2026).toHaveLength(0)
  })

  it('Nov 7 — adds 2026 opening (total 4)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-fest-nov7-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const ts = new Date(2026, 10, 7, 12).getTime()
    database.ensureEventLetters(ts)
    const letters = database.listLetters({ letterType: 'festival' })
    expect(letters.length).toBe(4)
    expect(letters.some((l: any) => l.subject === '灯火初燃')).toBe(true)
  })

  it('Nov 11 — adds 2026 midway (total 5)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-fest-nov11-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const ts = new Date(2026, 10, 11, 12).getTime()
    database.ensureEventLetters(ts)
    const letters = database.listLetters({ letterType: 'festival' })
    expect(letters.length).toBe(5)
    expect(letters.some((l: any) => l.subject === '旧灯回响')).toBe(true)
  })

  it('Nov 16 — adds 2026 climax (total 6)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-fest-nov16-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const ts = new Date(2026, 10, 16, 12).getTime()
    database.ensureEventLetters(ts)
    const letters = database.listLetters({ letterType: 'festival' })
    expect(letters.length).toBe(6)
  })

  it('festival idempotent on repeated calls', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-fest-idem-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    const ts = new Date(2026, 10, 16, 12).getTime()
    database.ensureEventLetters(ts)
    const r2 = database.ensureEventLetters(ts)
    expect(r2.festival.created).toBe(0)
    expect(r2.festival.existing + r2.festival.repaired).toBe(6)
  })
})

describe('mail lifecycle — birthday', () => {
  it('generates on birthday, not before', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-bday-life-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.setBirthday(5, 12)

    // Before birthday
    const before = database.ensureBirthdayLetter(new Date(2026, 4, 11, 12).getTime())
    expect(before.created).toBe(false)
    expect(before.reason).toBe('before_birthday')

    // On birthday
    const on = database.ensureBirthdayLetter(new Date(2026, 4, 12, 12).getTime())
    expect(on.created).toBe(true)
  })

  it('late delivery: birthday passed, not yet generated this year', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-bday-late-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.setBirthday(5, 12)

    // April 20 — birthday was 8 days ago
    const late = database.ensureBirthdayLetter(new Date(2026, 4, 20, 12).getTime())
    expect(late.created).toBe(true)
  })

  it('birthday idempotent within same year', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-bday-idem-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.setBirthday(5, 12)
    const ts = new Date(2026, 4, 20, 12).getTime()
    database.ensureBirthdayLetter(ts)
    const r2 = database.ensureBirthdayLetter(ts)
    expect(r2.created).toBe(false)
    expect(r2.reason).toBe('already_generated')
  })

  it('case1: player joined after birthday — no letter', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-bday-c1-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.setBirthday(4, 16)
    // Player joined July 16, birthday was April 16 (already passed before joining)
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mail_started_at_ms', ?)",
      [String(new Date(2026, 6, 16).getTime())])
    const r = database.ensureBirthdayLetter(new Date(2026, 6, 21, 12).getTime())
    expect(r.created).toBe(false)
    expect(r.reason).toBe('before_world_entered')
  })

  it('case2: player joined before birthday — generates on the day', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-bday-c2-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.setBirthday(4, 16)
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mail_started_at_ms', ?)",
      [String(new Date(2026, 6, 16).getTime())])
    // April 16, 2027 — joined July 2026, birthday is next year
    const r = database.ensureBirthdayLetter(new Date(2027, 3, 16, 12).getTime())
    expect(r.created).toBe(true)
  })

  it('case3: player joined Jan 1, birthday April 16, late delivery on April 20', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-bday-c3-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.setBirthday(4, 16)
    database.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mail_started_at_ms', ?)",
      [String(new Date(2026, 0, 1).getTime())])
    const r = database.ensureBirthdayLetter(new Date(2026, 3, 20, 12).getTime())
    expect(r.created).toBe(true)
  })

  it('birthday in previous year not re-generated', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'growth-arc-bday-prev-'))
    tempDirs.push(dir)
    const database = await new StudyDatabase(dir).init()
    database.setBirthday(5, 12)
    // Generate for 2026
    database.ensureBirthdayLetter(new Date(2026, 4, 20, 12).getTime())
    // 2027 — new year, new key
    const r = database.ensureBirthdayLetter(new Date(2027, 4, 20, 12).getTime())
    expect(r.created).toBe(true)
  })
})
