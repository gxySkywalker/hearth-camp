const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const BARD_POEMS = require('../src/data/bard-poems.json')
const initSqlJs = require('sql.js')
const {
  ACHIEVEMENTS,
  focusXp,
  completionXp,
  levelFromXp,
  secondsWithinRange,
  localDateKey,
  dayBounds,
  weekBounds,
  getReturnKind,
  countSessionTypes,
  getDailyPeriod,
  getWeeklyPeriod,
  previousWeeklyPeriod,
  generateLocalLetterSubject,
  generateDailyTemplate,
  generateWeeklyTemplate,
  buildDailyLetterFacts,
  buildWeeklyLetterFacts,
  buildDailyStatsForFacts,
  buildWeeklyStatsForFacts,
  shouldGenerateDailyLetter,
  shouldGenerateWeeklyLetter,
  tzInfo,
  getActiveFestivalNodes,
  getWorldState,
  buildFestivalFacts,
  generateFestivalTemplate,
  birthdayPeriod,
  generateBirthdayTemplate,
} = require('./domain.cjs')
const {
  COMPANION_SPECIES,
  LOOT,
  LOCATIONS,
  MAP_FRAGMENT_LOCATIONS,
  rollExpedition,
  rollLightweightExpedition,
  rollCaravanEncounter,
  rollBardEncounter,
  CARAVAN_PRICES,
  companionStage,
  evolutionReady,
  growthPathForCompanion,
} = require('./game.cjs')

const WELCOME_TEMPLATE = [
  '你好呀，旅人。',
  '',
  '这封信一直放在天使邮局的木格里，等你来到这里。',
  '我是负责整理来信、盖上邮戳的小天使。',
  '',
  '每当你亲自走过一段路，',
  '我都会把那段真实的足迹收进星页。',
  '没有来信的日子，也只是安静地过去了。',
  '',
  '以后如果愿意，',
  '可以常来邮局看看。',
  '',
  '我会在柜台后，把你的信仔细收好。',
].join('\n')
const {
  WORLD_CONTENT_NAMESPACE,
  WORLD_CONTENT_VERSION,
  WORLD_REGIONS,
  WORLD_NODES,
  WORLD_EDGES,
} = require('./world-content.cjs')

const PERSONALITY_TRAITS = ['活泼', '安静', '勇敢', '胆小', '温和', '好奇', '独立', '倔强', '爱观察', '爱凑热闹', '认真', '有耐心', '贪玩', '谨慎']
const PERSONALITY_QUIRKS = [
  '有点怕雷声',
  '对陌生声音敏感',
  '不喜欢改变路线',
  '容易担心旅人',
  '有点固执',
  '总把喜欢的小东西藏得太好',
  '听见门响会先停一下',
  '不喜欢爪子沾湿',
  '对新摆设要观察很久',
  '容易被窗外的影子分走注意',
  '睡前总要绕一小圈',
  '想靠近时又会假装路过',
  '对气味格外在意',
  '会把身边的小东西推得整整齐齐',
  '听到风声会先竖起耳朵',
]
const BRAVE_INCOMPATIBLE_QUIRKS = new Set(['有点怕雷声', '对陌生声音敏感'])

function quirkPoolForTrait(personalityTrait) {
  return personalityTrait === '勇敢'
    ? PERSONALITY_QUIRKS.filter((quirk) => !BRAVE_INCOMPATIBLE_QUIRKS.has(quirk))
    : PERSONALITY_QUIRKS
}
const SPECIES_HABITS = {
  hearth_hound: ['喜欢靠近炉火', '喜欢闻旅人带回的旧物', '喜欢把小物件放在角落', '喜欢趴门槛晒太阳'],
  ember_drake: ['喜欢把自然脱落的小鳞片摆在窗边', '喜欢在清晨看远处山脊先亮起来', '喜欢把翅膀收好后靠近暖石坐一会儿', '喜欢听风从高处屋檐掠过', '喜欢盯着地图上尚未画满的空白', '喜欢在旅人收拾远行物品时，安静地看向门外'],
  moss_fox: ['喜欢观察窗外落叶', '喜欢收集漂亮的小叶片', '喜欢停在有阳光的苔石旁', '喜欢把散落的落叶拨到一处', '喜欢听雨滴落在树叶上的声音', '喜欢在盆栽旁安静地看光影移动'],
  glimmer_cat: ['喜欢在窗台边看远处还亮着的灯', '喜欢把尾灯靠近摊开的书页', '喜欢在叠好的毯子上绕两圈再坐下', '喜欢盯着墙上被灯光拉长的影子', '喜欢在夜里靠近一盏没有熄灭的小灯', '喜欢踩过地板上暖光照出的方块', '喜欢把尾巴盖在前爪旁，让灯光只剩一点', '喜欢在楼梯转角停一下，再慢慢往上走'],
  river_otter: ['喜欢把圆润的小石头排列在一起', '喜欢用前爪轻轻拨动水面', '喜欢听屋檐滴水落进木桶的声音', '喜欢观察水面里被风吹散的倒影', '喜欢收集被河水磨圆的小石子', '喜欢在雨后查看门口的小水洼', '喜欢在地图旁安静趴着，尾巴搭成一道弧', '喜欢看暖光倒映在水盆或河面上'],
  moon_owl: ['喜欢停在书架最高的一层', '喜欢把看见的羽毛放在旧书旁', '喜欢在窗框边听夜风', '喜欢注视桌上的摊开地图', '喜欢在旅人写完天文台札记后停在附近', '喜欢收集掉落的书签和纸角', '喜欢在月光照到地板的位置休息', '喜欢在小屋安静下来后才靠近壁炉'],
  iron_badger: ['喜欢把松动的小石子靠在一起', '喜欢在木箱边安静地坐一会儿', '喜欢用前爪轻敲地板，听石缝里的回声', '喜欢看地图上旧石桥旁的记号', '喜欢把圆石垒成不高的小堆', '喜欢在雨后看看门前的石阶有没有松动', '喜欢待在避风的墙角，把背靠在石面上', '喜欢在旅人收拾行囊时待在不远处'],
  cloud_rabbit: ['喜欢在晒暖的地板上把耳朵摊开', '喜欢盯着窗外云影慢慢移过', '喜欢把干草或布边拨成松软的一小圈', '喜欢在旅行地图的空白边缘停一会儿', '喜欢听风从门缝与屋檐间穿过', '喜欢在行囊收好后，仍坐在旁边不急着出发'],
}

// A nickname becomes personal only when the traveller explicitly writes one.
// Until then, a companion may naturally take the name of the form it has grown
// into. Keeping this flag avoids guessing from player-written text later.
const LEGACY_DEFAULT_NICKNAMES = {
  hearth_hound: ['栗子', '炉尾', '栗鬃', '炭尾', '松影', '月爪'],
  ember_drake: ['古龙', '余烬古龙', '火种幼龙', '赤铜翼龙', '古焰龙王', '书库守龙', '天穹寻宝龙', '小火牙', '赤翼龙'],
  moss_fox: ['狐狸', '苔原小狐', '苔尾幼狐', '苔芽', '枝绒', '苔亚', '森冠'],
  glimmer_cat: ['猫', '烛影小猫', '烛芯幼猫', '灯团', '星烛', '夜璃'],
  river_otter: ['水獭', '河湾水獭', '圆石幼獭', '涟牙', '漪爪', '湾澜'],
  moon_owl: ['月塔猫头鹰', '猫头鹰', '圆羽雏鸟', '银羽学士', '月塔贤者', '夜空巡游者', '暮羽子', '咕夜枭', '冥翔鹰鸮'],
  iron_badger: ['铁砧獾', '獾', '灰爪幼獾', '铜锤工匠', '王城铸造师', '山门守卫', '小石獾', '岩甲獾', '铠獾王'],
  cloud_rabbit: ['兔子', '云丘垂耳兔', '云团幼兔', '风铃旅兔', '云丘信使', '风暴疾行者', '小丘', '云丘兔', '风茸旅兔'],
}

function stageNameForCompanion(speciesId, stage, evolutionPath) {
  const species = COMPANION_SPECIES.find((item) => item.id === speciesId)
  if (!species) return '伙伴'
  if (stage >= 2) {
    const finalForm = species.evolutions.find((item) => item.id === evolutionPath)
    if (finalForm) return finalForm.name
  }
  return species.stages[Math.max(0, Math.min(stage, species.stages.length - 1))] || species.name
}

function matchesDefaultCompanionNickname(row) {
  const species = COMPANION_SPECIES.find((item) => item.id === row.species_id)
  const defaults = new Set([
    ...(LEGACY_DEFAULT_NICKNAMES[row.species_id] || []),
    species?.name,
    species?.kind,
    species?.defaultNickname,
    ...(species?.stages || []),
    ...(species?.evolutions || []).map((item) => item.name),
  ].filter(Boolean))
  return defaults.has(String(row.nickname || '').trim())
}

function isDefaultCompanionNickname(row) {
  if (Number(row.nickname_is_custom) === 1) return false
  if (Number(row.nickname_is_custom) === 0) return true
  return matchesDefaultCompanionNickname(row)
}

function automaticGrowthNickname(row, stage, evolutionPath) {
  // 栗子是初始同行犬始终沿用的默认称呼；炉尾、栗鬃等是物种的
  // 成长章节，不应在任何羁绊阶段覆盖玩家眼中陪伴自己的名字。
  if (row.species_id === 'hearth_hound' && isDefaultCompanionNickname(row)) {
    return '栗子'
  }
  return isDefaultCompanionNickname(row)
    ? stageNameForCompanion(row.species_id, stage, evolutionPath)
    : row.nickname
}

// Bond milestones describe how much a companion has shared with the traveller.
// A form lock never takes those memories away: it only asks the visual growth
// chapter to remain at a chosen, already-lived shape.
function displayStageForCompanion(row) {
  if (row?.form_lock_mode === 'rewound' || row?.form_lock_mode === 'eternal') {
    return Math.max(0, Math.min(2, Number(row.stage) || 0))
  }
  return companionStage(row?.bond_xp)
}

function isFormLocked(row) {
  return row?.form_lock_mode === 'rewound' || row?.form_lock_mode === 'eternal'
}

function isNightExpeditionTime(timestamp) {
  const hour = new Date(timestamp).getHours()
  return hour >= 18 || hour < 6
}

function nightBoostExpiry(timestamp) {
  const expiry = new Date(timestamp)
  if (expiry.getHours() >= 6) expiry.setDate(expiry.getDate() + 1)
  expiry.setHours(6, 0, 0, 0)
  return expiry.getTime()
}

function profileForCompanion(id, speciesId) {
  const digest = crypto.createHash('sha256').update(`${id}:${speciesId}`).digest()
  const habits = SPECIES_HABITS[speciesId] || ['喜欢安静待在身边']
  const personalityTrait = PERSONALITY_TRAITS[digest[0] % PERSONALITY_TRAITS.length]
  const quirks = quirkPoolForTrait(personalityTrait)
  return {
    personalityTrait,
    habit: habits[digest[1] % habits.length],
    quirk: quirks[digest[2] % quirks.length],
  }
}

function parsePersonalityProfile(value, id, speciesId) {
  try {
    const parsed = JSON.parse(value || '')
    if (parsed?.personalityTrait && parsed?.habit && parsed?.quirk) {
      const fallback = profileForCompanion(id, speciesId)
      const personalityTrait = parsed.personalityTrait === '慢热' ? '勇敢' : parsed.personalityTrait
      const quirk = personalityTrait === '勇敢' && BRAVE_INCOMPATIBLE_QUIRKS.has(parsed.quirk)
        ? quirkPoolForTrait(personalityTrait)[crypto.createHash('sha256').update(`${id}:${speciesId}:quirk`).digest()[0] % quirkPoolForTrait(personalityTrait).length]
        : parsed.quirk
      return { ...parsed, personalityTrait, quirk }
    }
  } catch {}
  return profileForCompanion(id, speciesId)
}

class StudyDatabase {
  constructor(dataDir) {
    this.dataDir = dataDir
    this.filePath = path.join(dataDir, 'growth-arc.sqlite')
    this.db = null
    this.hadExistingDatabase = false
  }

  async init() {
    fs.mkdirSync(this.dataDir, { recursive: true })
    const wasmBinary = fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'))
    const SQL = await initSqlJs({ wasmBinary })
    this.hadExistingDatabase = fs.existsSync(this.filePath)
    const existing = this.hadExistingDatabase ? fs.readFileSync(this.filePath) : undefined
    this.db = existing ? new SQL.Database(existing) : new SQL.Database()
    this.db.run('PRAGMA foreign_keys = ON;')
    this.migrate()
    this.runSchemaMigrations()
    this.seed()
    this.recoverStaleSession()
    return this
  }

  // ── Versioned schema migrations (run once per version) ────

  runSchemaMigrations() {
    const s = this.getSettings()
    const version = Number(s.schema_version) || 0

    if (version < 1) {
      // V1: repair invalid letters (birthday/festival before player joined, orphans, duplicates)
      this.repairInvalidLetters()
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '1')")
    }

    if (version < 2) {
      // V2: migrate mail_started_at_ms → world_entered_at_ms
      if (s.mail_started_at_ms && !s.world_entered_at_ms) {
        this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('world_entered_at_ms', ?)", [s.mail_started_at_ms])
      }
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '2')")
    }

    if (version < 3) {
      // V3: AI fields for letter narrative
      const aiCols = new Set(this.all('PRAGMA table_info(letters)').map(c => c.name))
      if (!aiCols.has('ai_status')) this.db.run("ALTER TABLE letters ADD COLUMN ai_status TEXT NOT NULL DEFAULT 'template'")
      if (!aiCols.has('ai_provider')) this.db.run("ALTER TABLE letters ADD COLUMN ai_provider TEXT")
      if (!aiCols.has('ai_model')) this.db.run("ALTER TABLE letters ADD COLUMN ai_model TEXT")
      if (!aiCols.has('ai_prompt_version')) this.db.run("ALTER TABLE letters ADD COLUMN ai_prompt_version INTEGER")
      if (!aiCols.has('ai_retry_count')) this.db.run("ALTER TABLE letters ADD COLUMN ai_retry_count INTEGER NOT NULL DEFAULT 0")
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '3')")
    }

    if (version < 4) {
      // V4: companion instances carry only narrative individuality. Existing
      // companions keep their identity and receive a deterministic profile.
      const columns = new Set(this.all('PRAGMA table_info(companions)').map(c => c.name))
      if (!columns.has('personality_profile_json')) this.db.run("ALTER TABLE companions ADD COLUMN personality_profile_json TEXT NOT NULL DEFAULT ''")
      if (!columns.has('growth_completed_at')) this.db.run('ALTER TABLE companions ADD COLUMN growth_completed_at INTEGER')
      const rows = this.all('SELECT id, species_id, personality_profile_json, evolution_path, bond_xp FROM companions')
      for (const row of rows) {
        const profile = parsePersonalityProfile(row.personality_profile_json, row.id, row.species_id)
        let path = row.evolution_path || ''
        // Preserve the intent of pre-v2 Chestnut saves without retaining old
        // player-facing names. New growth is resolved from actual local time.
        if (row.species_id === 'hearth_hound' && path === 'hearth_guard') path = 'ember_tail'
        if (row.species_id === 'hearth_hound' && path === 'moon_trail') path = 'moon_paw'
        this.run('UPDATE companions SET personality_profile_json = ?, evolution_path = ? WHERE id = ?', [JSON.stringify(profile), path, row.id], false)
      }
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '4')")
    }

    if (version < 5) {
      // V5: the former moss fox is now the single-route Lin Yuan fox. Keep
      // player-chosen names intact while replacing only legacy defaults and
      // obsolete final-path identifiers.
      const rows = this.all('SELECT id, species_id, nickname, evolution_path FROM companions WHERE species_id = ?', ['moss_fox'])
      for (const row of rows) {
        const nickname = ['狐狸', '苔原小狐', '苔尾幼狐'].includes(row.nickname) ? '苔芽' : row.nickname
        const path = ['grove_fox', 'ruin_fox'].includes(row.evolution_path) ? 'forest_crown' : row.evolution_path
        this.run('UPDATE companions SET nickname = ?, evolution_path = ? WHERE id = ?', [nickname, path, row.id], false)
      }
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '5')")
    }

    if (version < 6) {
      // V6: the former candle-shadow cat is now the single-route night-light
      // cat. Legacy defaults change, but any player-provided nickname stays.
      const rows = this.all('SELECT id, nickname, evolution_path FROM companions WHERE species_id = ?', ['glimmer_cat'])
      for (const row of rows) {
        const nickname = ['猫', '烛影小猫', '烛芯幼猫'].includes(row.nickname) ? '灯团' : row.nickname
        const path = ['star_candle', 'velvet_shadow'].includes(row.evolution_path) ? 'night_glass' : row.evolution_path
        this.run('UPDATE companions SET nickname = ?, evolution_path = ? WHERE id = ?', [nickname, path, row.id], false)
      }
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '6')")
    }

    if (version < 7) {
      // V7: the former utility-flavoured river otter becomes 涟牙. Preserve
      // a player's chosen name and personality/quirk, but replace obsolete
      // defaults, old final paths and the previous generic habit text.
      const rows = this.all('SELECT id, nickname, evolution_path, personality_profile_json FROM companions WHERE species_id = ?', ['river_otter'])
      for (const row of rows) {
        const nickname = ['水獭', '河湾水獭', '圆石幼獭'].includes(row.nickname) ? '涟牙' : row.nickname
        const path = ['river_guide', 'pearl_keeper'].includes(row.evolution_path) ? 'bay_current' : row.evolution_path
        const profile = parsePersonalityProfile(row.personality_profile_json, row.id, 'river_otter')
        profile.habit = profileForCompanion(row.id, 'river_otter').habit
        this.run('UPDATE companions SET nickname = ?, evolution_path = ?, personality_profile_json = ? WHERE id = ?', [nickname, path, JSON.stringify(profile), row.id], false)
      }
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '7')")
    }

    if (version < 8) {
      // V8: distinguish a traveller's chosen nickname from a species default.
      // Also repair old saves where a final route was stored before bond had
      // reached the final chapter (which could select a final camp portrait).
      const columns = new Set(this.all('PRAGMA table_info(companions)').map((column) => column.name))
      const hadNicknameCustomFlag = columns.has('nickname_is_custom')
      if (!hadNicknameCustomFlag) this.db.run('ALTER TABLE companions ADD COLUMN nickname_is_custom INTEGER NOT NULL DEFAULT 0')
      const rows = this.all('SELECT id, species_id, nickname, nickname_is_custom, bond_xp, evolution_path FROM companions')
      for (const row of rows) {
        const stage = companionStage(row.bond_xp)
        const nicknameIsCustom = hadNicknameCustomFlag
          ? (Number(row.nickname_is_custom) === 1 ? 1 : 0)
          : (matchesDefaultCompanionNickname(row) ? 0 : 1)
        const path = stage < 2 ? '' : (row.evolution_path || '')
        // Existing growth chapters should use their grown form name unless the
        // traveller chose a personal name. This also repairs the stage-one
        // river companion that used to point at a final form prematurely.
        const nickname = stage > 0 && !nicknameIsCustom
          ? stageNameForCompanion(row.species_id, stage, path)
          : row.nickname
        this.run('UPDATE companions SET nickname = ?, nickname_is_custom = ?, evolution_path = ? WHERE id = ?', [nickname, nicknameIsCustom, path, row.id], false)
      }
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '8')")
    }

    if (version < 9) {
      // V9: the former utility-flavoured iron badger is now the single-route
      // 石铁獾. Preserve a traveller's personal name, while replacing only
      // former defaults, obsolete growth routes and its generic habit text.
      const rows = this.all('SELECT id, nickname, nickname_is_custom, bond_xp, evolution_path, personality_profile_json FROM companions WHERE species_id = ?', ['iron_badger'])
      for (const row of rows) {
        const stage = companionStage(row.bond_xp)
        const nicknameIsCustom = Number(row.nickname_is_custom) === 1
        const path = stage < 2 ? '' : (row.evolution_path === 'armor_king' ? 'armor_king' : 'armor_king')
        const nickname = nicknameIsCustom ? row.nickname : stageNameForCompanion('iron_badger', stage, path)
        const profile = parsePersonalityProfile(row.personality_profile_json, row.id, 'iron_badger')
        profile.habit = profileForCompanion(row.id, 'iron_badger').habit
        this.run('UPDATE companions SET nickname = ?, nickname_is_custom = ?, evolution_path = ?, personality_profile_json = ? WHERE id = ?', [nickname, nicknameIsCustom ? 1 : 0, path, JSON.stringify(profile), row.id], false)
      }
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '9')")
    }

    if (version < 10) {
      // V10: the former multi-route moon owl becomes the single-route 月塔鸮.
      // Keep traveller-given names and personality/quirk; replace only legacy
      // defaults, obsolete paths and its generic habit text.
      const rows = this.all('SELECT id, nickname, nickname_is_custom, bond_xp, evolution_path, personality_profile_json FROM companions WHERE species_id = ?', ['moon_owl'])
      for (const row of rows) {
        const stage = companionStage(row.bond_xp)
        const nicknameIsCustom = Number(row.nickname_is_custom) === 1
        const path = stage < 2 ? '' : 'dusk_owl'
        const nickname = nicknameIsCustom ? row.nickname : stageNameForCompanion('moon_owl', stage, path)
        const profile = parsePersonalityProfile(row.personality_profile_json, row.id, 'moon_owl')
        profile.habit = profileForCompanion(row.id, 'moon_owl').habit
        this.run('UPDATE companions SET nickname = ?, nickname_is_custom = ?, evolution_path = ?, personality_profile_json = ? WHERE id = ?', [nickname, nicknameIsCustom ? 1 : 0, path, JSON.stringify(profile), row.id], false)
      }
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '10')")
    }

    if (version < 11) {
      // V11: replace the former courier/speed-flavoured cloud rabbit with the
      // single-route 云丘垂耳兔. Traveller-given names remain untouched;
      // former defaults, paths and generic habits become the new narrative set.
      const rows = this.all('SELECT id, nickname, nickname_is_custom, bond_xp, evolution_path, personality_profile_json FROM companions WHERE species_id = ?', ['cloud_rabbit'])
      for (const row of rows) {
        const stage = companionStage(row.bond_xp)
        const nicknameIsCustom = Number(row.nickname_is_custom) === 1
        const path = stage < 2 ? '' : 'wind_tuft_rabbit'
        const nickname = nicknameIsCustom ? row.nickname : stageNameForCompanion('cloud_rabbit', stage, path)
        const profile = parsePersonalityProfile(row.personality_profile_json, row.id, 'cloud_rabbit')
        profile.habit = profileForCompanion(row.id, 'cloud_rabbit').habit
        this.run('UPDATE companions SET nickname = ?, nickname_is_custom = ?, evolution_path = ?, personality_profile_json = ? WHERE id = ?', [nickname, nicknameIsCustom ? 1 : 0, path, JSON.stringify(profile), row.id], false)
      }
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '11')")
    }

    if (version < 12) {
      // V12: the former utility-flavoured ember dragon becomes the single-route
      // 余烬古龙. Preserve traveller-given names while replacing old defaults,
      // final paths and generic habits with the narrative companion profile.
      const rows = this.all('SELECT id, nickname, nickname_is_custom, bond_xp, evolution_path, personality_profile_json FROM companions WHERE species_id = ?', ['ember_drake'])
      for (const row of rows) {
        const stage = companionStage(row.bond_xp)
        const nicknameIsCustom = Number(row.nickname_is_custom) === 1
        const path = stage < 2 ? '' : 'ember_drake'
        const nickname = nicknameIsCustom ? row.nickname : stageNameForCompanion('ember_drake', stage, path)
        const profile = parsePersonalityProfile(row.personality_profile_json, row.id, 'ember_drake')
        profile.habit = profileForCompanion(row.id, 'ember_drake').habit
        this.run('UPDATE companions SET nickname = ?, nickname_is_custom = ?, evolution_path = ?, personality_profile_json = ? WHERE id = ?', [nickname, nicknameIsCustom ? 1 : 0, path, JSON.stringify(profile), row.id], false)
      }
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '12')")
    }

    if (version < 13) {
      // V13: map scraps are now route-collection material. The old one-shot
      // rare bonus is retired rather than silently changing its source.
      this.run("DELETE FROM settings WHERE key = 'rare_boost'", [], false)
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '13')")
    }

    if (version < 14) {
      // V14: the angel works at the post office; welcome letters no longer
      // describe an upstairs residence. This only refreshes the fixed welcome
      // copy and leaves its event, facts, read state and any reply untouched.
      this.run("UPDATE letters SET template_body = ?, updated_at = ? WHERE letter_type = 'memorial' AND period_key = 'welcome:first_visit'", [WELCOME_TEMPLATE, Date.now()], false)
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '14')")
    }

    if (version < 15) {
      // V15: periodic letters now belong to the traveller's record, not to
      // incidental post-office life. Rebuild only their narrative layer from
      // each letter's frozen facts; dates, facts, read state and replies stay.
      // Some early v0.7 installs recorded a newer migration marker without
      // every AI column. Keep this repair idempotent before touching them.
      const aiColumns = new Set(this.all('PRAGMA table_info(letters)').map((column) => column.name))
      if (!aiColumns.has('ai_status')) this.db.run("ALTER TABLE letters ADD COLUMN ai_status TEXT NOT NULL DEFAULT 'template'")
      if (!aiColumns.has('ai_provider')) this.db.run('ALTER TABLE letters ADD COLUMN ai_provider TEXT')
      if (!aiColumns.has('ai_model')) this.db.run('ALTER TABLE letters ADD COLUMN ai_model TEXT')
      if (!aiColumns.has('ai_prompt_version')) this.db.run('ALTER TABLE letters ADD COLUMN ai_prompt_version INTEGER')
      if (!aiColumns.has('ai_retry_count')) this.db.run('ALTER TABLE letters ADD COLUMN ai_retry_count INTEGER NOT NULL DEFAULT 0')
      const letters = this.all("SELECT id, letter_type, period_key, fact_json FROM letters WHERE letter_type IN ('daily', 'weekly')")
      for (const letter of letters) {
        const facts = JSON.parse(letter.fact_json)
        const seed = `${letter.letter_type}:${letter.period_key}:1`
        const templateBody = letter.letter_type === 'daily'
          ? generateDailyTemplate(facts, seed)
          : generateWeeklyTemplate(facts, seed)
        this.run("UPDATE letters SET template_body = ?, ai_body = NULL, body_source = 'template', ai_status = 'pending', ai_provider = NULL, ai_model = NULL, ai_prompt_version = NULL, ai_retry_count = 0, updated_at = ? WHERE id = ?", [templateBody, Date.now(), letter.id], false)
      }
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '15')")
    }

    if (version < 16) {
      // 制图桌现在只区分进行中与已完成。旧归档路标保留历史，
      // 并以完成状态继续显示，而不是从地图中消失。
      this.run("UPDATE tasks SET status = 'done', completed_at = COALESCE(completed_at, updated_at, created_at) WHERE status = 'archived'")
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '16')")
    }
    if (version < 17) {
      const columns = new Set(this.all('PRAGMA table_info(companions)').map((column) => column.name))
      if (!columns.has('is_ill')) this.db.run('ALTER TABLE companions ADD COLUMN is_ill INTEGER NOT NULL DEFAULT 0')
      if (!columns.has('ill_since')) this.db.run('ALTER TABLE companions ADD COLUMN ill_since INTEGER')
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('hearth_lit', '0')")
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '17')")
    }
    if (version < 18) {
      this.db.exec('CREATE TABLE IF NOT EXISTS poetry_collection (id TEXT PRIMARY KEY, session_id TEXT UNIQUE, poem_id TEXT NOT NULL, obtained_at INTEGER NOT NULL)')
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '18')")
    }
    if (version < 19) {
      const total = Number(this.one('SELECT COALESCE(SUM(amount), 0) AS total FROM xp_transactions')?.total || 0)
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('level_rewarded_through', ?)", [String(levelFromXp(total).level)])
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '19')")
    }
    if (version < 20) {
      // V20: replace the former generic “慢热” trait with “勇敢”, expand the
      // quirk pool, and keep brave companions free of fear-based quirks.
      const rows = this.all('SELECT id, species_id, personality_profile_json FROM companions')
      for (const row of rows) {
        const profile = parsePersonalityProfile(row.personality_profile_json, row.id, row.species_id)
        this.run('UPDATE companions SET personality_profile_json = ? WHERE id = ?', [JSON.stringify(profile), row.id], false)
      }
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '20')")
    }
    if (version < 21) {
      // V21: 栗子是初始同行犬的固定默认称呼。保留所有自定义名字，
      // 只修复曾被自动成长逻辑换成炉尾／栗鬃等阶段名的默认昵称。
      this.run("UPDATE companions SET nickname = '栗子' WHERE species_id = 'hearth_hound' AND nickname_is_custom = 0", [], false)
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '21')")
    }
    if (version < 22) {
      // “学习者”与早期英文名只是旧版占位称呼。只迁移这些明确的
      // 默认值，绝不覆盖玩家自行填写的旅人名字。
      const placeholderNames = ['学习者', 'Traveler']
      const currentName = String(this.getSettings().user_name || '').trim()
      if (!currentName || placeholderNames.includes(currentName)) {
        this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('user_name', '冒险者')", [], false)
      }
      const profile = this.one("SELECT display_name FROM player_profiles WHERE id = 'primary'")
      if (profile && (!String(profile.display_name || '').trim() || placeholderNames.includes(String(profile.display_name).trim()))) {
        this.run("UPDATE player_profiles SET display_name = '冒险者', updated_at = ? WHERE id = 'primary'", [Date.now()], false)
      }
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '22')")
    }
    if (version < 23) {
      // V23: form-lock relics keep a companion's appearance without changing
      // the bond they have already built. Existing saves begin unlocked.
      const columns = new Set(this.all('PRAGMA table_info(companions)').map((column) => column.name))
      if (!columns.has('form_lock_mode')) this.db.run("ALTER TABLE companions ADD COLUMN form_lock_mode TEXT NOT NULL DEFAULT 'none'")
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '23')")
    }
    if (version < 24) {
      // V24: permanent-form relics receive their own memory ledger so a
      // companion's first promise or return can be revisited later.
      this.db.exec(`CREATE TABLE IF NOT EXISTS companion_form_events (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('rewind', 'eternal')),
        previous_stage INTEGER NOT NULL,
        stage INTEGER NOT NULL,
        occurred_at INTEGER NOT NULL,
        UNIQUE(companion_id, kind)
      )`)
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '24')")
    }
    if (version < 25) {
      // V25: 炉边手记是玩家主动书写的私密本地内容。它与远征、
      // 邮局事实和 AI 上下文完全分离，升级时只增表、不触碰旧数据。
      this.db.exec(`CREATE TABLE IF NOT EXISTS memo_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memos (
        id TEXT PRIMARY KEY,
        folder_id TEXT REFERENCES memo_folders(id) ON DELETE SET NULL,
        kind TEXT NOT NULL DEFAULT 'note' CHECK(kind IN ('note', 'checklist')),
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        checklist_json TEXT NOT NULL DEFAULT '[]',
        pinned INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memos_folder_updated ON memos(folder_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memos_deleted_updated ON memos(deleted_at, updated_at DESC);`)
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '25')")
    }
    if (version < 26) {
      // V26: 正文与清单不再是互斥的手记类型。一页纸由有序内容块
      // 组成；旧正文和旧清单仍保留在原列，并在读取时无损转换。
      const memoColumns = new Set(this.all('PRAGMA table_info(memos)').map((column) => column.name))
      if (!memoColumns.has('content_json')) this.db.run("ALTER TABLE memos ADD COLUMN content_json TEXT NOT NULL DEFAULT '[]'")
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '26')")
    }
    if (version < 27) {
      // V27: 单一连续编辑面取代彼此隔离的输入框，保留浏览器原生的
      // 跨段选择、撤销、软换行与列表行为。旧内容块仍用于无损迁移。
      const memoColumns = new Set(this.all('PRAGMA table_info(memos)').map((column) => column.name))
      if (!memoColumns.has('content_html')) this.db.run("ALTER TABLE memos ADD COLUMN content_html TEXT NOT NULL DEFAULT ''")
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '27')")
    }
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS areas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'book',
        archived INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        area_id TEXT NOT NULL REFERENCES areas(id),
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        area_id TEXT NOT NULL REFERENCES areas(id),
        goal_id TEXT REFERENCES goals(id),
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',
        completed_at INTEGER,
        completion_xp_awarded INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS focus_sessions (
        id TEXT PRIMARY KEY,
        task_id TEXT REFERENCES tasks(id),
        area_id TEXT REFERENCES areas(id),
        content TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        status TEXT NOT NULL,
        last_heartbeat_at INTEGER NOT NULL,
        active_seconds INTEGER NOT NULL DEFAULT 0,
        outcome TEXT NOT NULL DEFAULT '',
        blocker TEXT NOT NULL DEFAULT '',
        next_step TEXT NOT NULL DEFAULT '',
        task_completed INTEGER NOT NULL DEFAULT 0,
        long_notified INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS focus_intervals (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE,
        started_at INTEGER NOT NULL,
        ended_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS daily_reviews (
        review_date TEXT PRIMARY KEY,
        win TEXT NOT NULL DEFAULT '',
        blocker TEXT NOT NULL DEFAULT '',
        energy INTEGER,
        tomorrow_task TEXT NOT NULL DEFAULT '',
        ai_json TEXT,
        ai_model TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS weekly_reports (
        week_start TEXT PRIMARY KEY,
        stats_json TEXT NOT NULL,
        ai_json TEXT,
        ai_model TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS xp_transactions (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reference_type TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        label TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(kind, reference_id)
      );
      CREATE TABLE IF NOT EXISTS achievement_unlocks (
        code TEXT PRIMARY KEY,
        unlocked_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS companions (
        id TEXT PRIMARY KEY,
        species_id TEXT NOT NULL UNIQUE,
        nickname TEXT NOT NULL,
        nickname_is_custom INTEGER NOT NULL DEFAULT 0,
        bond_xp INTEGER NOT NULL DEFAULT 0,
        stage INTEGER NOT NULL DEFAULT 0,
        evolution_path TEXT NOT NULL DEFAULT '',
        form_lock_mode TEXT NOT NULL DEFAULT 'none',
        personality_profile_json TEXT NOT NULL DEFAULT '',
        growth_completed_at INTEGER,
        is_active INTEGER NOT NULL DEFAULT 0,
        met_at INTEGER NOT NULL,
        last_adventure_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS companion_growth_events (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
        previous_stage INTEGER NOT NULL,
        stage INTEGER NOT NULL,
        evolution_path TEXT NOT NULL DEFAULT '',
        source_session_id TEXT REFERENCES focus_sessions(id) ON DELETE SET NULL,
        occurred_at INTEGER NOT NULL,
        seen_at INTEGER,
        UNIQUE(companion_id, stage)
      );
      CREATE TABLE IF NOT EXISTS companion_form_events (
        id TEXT PRIMARY KEY,
        companion_id TEXT NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('rewind', 'eternal')),
        previous_stage INTEGER NOT NULL,
        stage INTEGER NOT NULL,
        occurred_at INTEGER NOT NULL,
        UNIQUE(companion_id, kind)
      );
      CREATE TABLE IF NOT EXISTS inventory (
        item_id TEXT PRIMARY KEY,
        quantity INTEGER NOT NULL DEFAULT 0,
        first_found_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS expeditions (
        session_id TEXT PRIMARY KEY REFERENCES focus_sessions(id) ON DELETE CASCADE,
        tier_id TEXT NOT NULL,
        location TEXT NOT NULL,
        event_text TEXT NOT NULL,
        rewards_json TEXT NOT NULL,
        rare_found INTEGER NOT NULL DEFAULT 0,
        companion_found_id TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS knowledge_relics (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE REFERENCES focus_sessions(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        question TEXT NOT NULL DEFAULT '',
        next_step TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memo_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memos (
        id TEXT PRIMARY KEY,
        folder_id TEXT REFERENCES memo_folders(id) ON DELETE SET NULL,
        kind TEXT NOT NULL DEFAULT 'note' CHECK(kind IN ('note', 'checklist')),
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        checklist_json TEXT NOT NULL DEFAULT '[]',
        content_json TEXT NOT NULL DEFAULT '[]',
        content_html TEXT NOT NULL DEFAULT '',
        pinned INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS content_versions (
        namespace TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        installed_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS player_profiles (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        body_type TEXT NOT NULL DEFAULT 'traveler',
        skin_tone TEXT NOT NULL DEFAULT 'warm_2',
        hair_style TEXT NOT NULL DEFAULT 'short_windswept',
        hair_color TEXT NOT NULL DEFAULT 'chestnut',
        outfit_id TEXT NOT NULL DEFAULT 'traveler_clothes',
        outfit_tint TEXT NOT NULL DEFAULT 'forest',
        cape_enabled INTEGER NOT NULL DEFAULT 1,
        intro_status TEXT NOT NULL DEFAULT 'unseen',
        intro_seen_at INTEGER,
        customized_at INTEGER,
        created_from_legacy INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS world_regions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        layer INTEGER NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        state TEXT NOT NULL DEFAULT 'hidden',
        discovered_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS world_nodes (
        id TEXT PRIMARY KEY,
        region_id TEXT NOT NULL REFERENCES world_regions(id),
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        map_x REAL NOT NULL DEFAULT 0,
        map_y REAL NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        state TEXT NOT NULL DEFAULT 'hidden',
        discovered_at INTEGER,
        discovery_session_id TEXT REFERENCES focus_sessions(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS world_edges (
        id TEXT PRIMARY KEY,
        from_node_id TEXT NOT NULL REFERENCES world_nodes(id),
        to_node_id TEXT NOT NULL REFERENCES world_nodes(id),
        distance REAL NOT NULL DEFAULT 1,
        state TEXT NOT NULL DEFAULT 'hidden',
        discovered_at INTEGER,
        discovery_session_id TEXT REFERENCES focus_sessions(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS world_events (
        id TEXT PRIMARY KEY,
        event_key TEXT NOT NULL UNIQUE,
        definition_id TEXT NOT NULL,
        definition_version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'resolved',
        session_id TEXT REFERENCES focus_sessions(id) ON DELETE SET NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        occurred_at INTEGER NOT NULL,
        resolved_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS discoveries (
        id TEXT PRIMARY KEY,
        discovery_key TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        target_id TEXT NOT NULL,
        session_id TEXT REFERENCES focus_sessions(id) ON DELETE SET NULL,
        event_id TEXT REFERENCES world_events(id) ON DELETE SET NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_area ON tasks(area_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_started ON focus_sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_intervals_session ON focus_intervals(session_id);
      CREATE INDEX IF NOT EXISTS idx_companions_active ON companions(is_active);
      CREATE INDEX IF NOT EXISTS idx_companion_growth_events_pending ON companion_growth_events(seen_at, occurred_at);
      CREATE TABLE IF NOT EXISTS session_task_links (
        session_id TEXT NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE,
        task_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'contributed',
        selection_order INTEGER NOT NULL DEFAULT 0,
        xp_awarded INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        UNIQUE(session_id, task_id)
      );
      CREATE INDEX IF NOT EXISTS idx_relics_created ON knowledge_relics(created_at);
      CREATE INDEX IF NOT EXISTS idx_memos_folder_updated ON memos(folder_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memos_deleted_updated ON memos(deleted_at, updated_at DESC);
    `)
    const linkCols = new Set(this.all('PRAGMA table_info(session_task_links)').map((c) => c.name))
    if (!linkCols.has('selection_order')) this.db.run('ALTER TABLE session_task_links ADD COLUMN selection_order INTEGER NOT NULL DEFAULT 0')
    if (!linkCols.has('reason')) this.db.run("ALTER TABLE session_task_links ADD COLUMN reason TEXT NOT NULL DEFAULT ''")
    this.db.run(`CREATE TABLE IF NOT EXISTS letters (
      id TEXT PRIMARY KEY,
      letter_type TEXT NOT NULL,
      period_key TEXT NOT NULL,
      period_start INTEGER NOT NULL,
      period_end INTEGER NOT NULL,
      timezone_offset_minutes INTEGER NOT NULL,
      timezone_name TEXT NOT NULL,
      subject TEXT NOT NULL,
      fact_json TEXT NOT NULL,
      template_body TEXT NOT NULL,
      ai_body TEXT,
      body_source TEXT NOT NULL DEFAULT 'template',
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at INTEGER,
      reply_text TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      generation_version INTEGER NOT NULL DEFAULT 1,
      ai_status TEXT,
      UNIQUE(letter_type, period_key)
    )`)
    this.db.run(`CREATE TABLE IF NOT EXISTS letter_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      event_key TEXT NOT NULL UNIQUE,
      triggered_at INTEGER NOT NULL,
      letter_id TEXT,
      FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE SET NULL
    )`)
    this.db.run('CREATE INDEX IF NOT EXISTS idx_letter_events_type ON letter_events(event_type)')
    this.db.run('CREATE INDEX IF NOT EXISTS idx_letters_period ON letters(letter_type, period_start)')
    this.db.run('DROP INDEX IF EXISTS idx_letters_unread')
    this.db.run('CREATE INDEX IF NOT EXISTS idx_letters_unread ON letters(created_at DESC) WHERE is_read = 0')
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_world_nodes_region ON world_nodes(region_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_world_edges_nodes ON world_edges(from_node_id, to_node_id);
      CREATE INDEX IF NOT EXISTS idx_world_events_occurred ON world_events(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_discoveries_created ON discoveries(created_at);
    `)
    const sessionColumns = new Set(this.all('PRAGMA table_info(focus_sessions)').map((column) => column.name))
    if (!sessionColumns.has('companion_id')) this.db.run('ALTER TABLE focus_sessions ADD COLUMN companion_id TEXT')
    if (!sessionColumns.has('planned_seconds')) this.db.run('ALTER TABLE focus_sessions ADD COLUMN planned_seconds INTEGER NOT NULL DEFAULT 1500')
    const taskColumns = new Set(this.all('PRAGMA table_info(tasks)').map((column) => column.name))
    if (!taskColumns.has('sort_order')) {
      this.db.run('ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0')
      const legacy = this.all("SELECT id FROM tasks ORDER BY CASE status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END, created_at DESC")
      legacy.forEach((row, i) => this.run('UPDATE tasks SET sort_order = ? WHERE id = ?', [i + 1, row.id], false))
    }
    this.save()
  }

  seed() {
    const now = Date.now()
    if (!this.one('SELECT id FROM areas LIMIT 1')) {
      const defaultAreaId = crypto.randomUUID()
      this.run('INSERT INTO areas (id, name, color, icon, created_at) VALUES (?, ?, ?, ?, ?)', [
        defaultAreaId, '通用学习', '#79c0ff', 'book', now,
      ], false)
      this.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['system_default_area_id', defaultAreaId], false)
    }
    const defaults = {
      user_name: '冒险者',
      model: 'gpt-5.6-luna',
      theme: 'hearth',
      accent: '#c9783d',
      world_name: '炉火营地',
      rare_pity: '0',
      companion_pity: '0',
      api_provider: 'openai',
      ai_base_url: '',
      proxy_url: '',
    }
    for (const [key, value] of Object.entries(defaults)) {
      this.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value], false)
    }
    // The original seeded area is the only internal direction.  Keep its id
    // outside the area row so user-created areas with the same name remain
    // user-owned narrative material.
    if (!this.one("SELECT value FROM settings WHERE key = 'system_default_area_id'")) {
      const legacyDefault = this.one("SELECT id FROM areas WHERE name = '通用学习' AND color = '#79c0ff' AND icon = 'book' ORDER BY created_at LIMIT 1")
      if (legacyDefault) this.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['system_default_area_id', legacyDefault.id], false)
    }
    if (!this.one('SELECT id FROM companions LIMIT 1')) {
      const id = crypto.randomUUID()
      this.run("INSERT INTO companions (id, species_id, nickname, personality_profile_json, is_active, met_at) VALUES (?, 'hearth_hound', '栗子', ?, 1, ?)", [id, JSON.stringify(profileForCompanion(id, 'hearth_hound')), now], false)
    }
    this.seedWorldFoundation(now)
    this.save()
  }

  seedWorldFoundation(now = Date.now()) {
    this.run('INSERT INTO content_versions (namespace, version, installed_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(namespace) DO UPDATE SET version = excluded.version, updated_at = excluded.updated_at', [
      WORLD_CONTENT_NAMESPACE, WORLD_CONTENT_VERSION, now, now,
    ], false)

    const settings = this.getSettings()
    if (!this.one('SELECT id FROM player_profiles WHERE id = \'primary\'')) {
      const legacy = this.hadExistingDatabase ? 1 : 0
      this.run('INSERT INTO player_profiles (id, display_name, intro_status, created_from_legacy, created_at, updated_at) VALUES (\'primary\', ?, ?, ?, ?, ?)', [
        String(settings.user_name || '冒险者').trim() || '冒险者',
        legacy ? 'available' : 'unseen', legacy, now, now,
      ], false)
    }

    for (const region of WORLD_REGIONS) this.seedWorldRegion(region, now)
    for (const node of WORLD_NODES) this.seedWorldNode(node, now)
    for (const edge of WORLD_EDGES) this.seedWorldEdge(edge, now)
  }

  seedWorldRegion(region, now) {
    const discoveredAt = region.initialState === 'discovered' ? now : null
    this.run('INSERT INTO world_regions (id, name, layer, description, sort_order, state, discovered_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, layer = excluded.layer, description = excluded.description, sort_order = excluded.sort_order', [
      region.id, region.name, region.layer, region.description, region.sortOrder,
      region.initialState, discoveredAt,
    ], false)
  }

  seedWorldNode(node, now) {
    const discoveredAt = node.initialState === 'discovered' ? now : null
    this.run('INSERT INTO world_nodes (id, region_id, kind, name, description, map_x, map_y, sort_order, state, discovered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET region_id = excluded.region_id, kind = excluded.kind, name = excluded.name, description = excluded.description, map_x = excluded.map_x, map_y = excluded.map_y, sort_order = excluded.sort_order', [
      node.id, node.regionId, node.kind, node.name, node.description,
      node.mapX, node.mapY, node.sortOrder, node.initialState, discoveredAt,
    ], false)
  }

  seedWorldEdge(edge, now) {
    const discoveredAt = edge.initialState === 'discovered' ? now : null
    this.run('INSERT INTO world_edges (id, from_node_id, to_node_id, distance, state, discovered_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET from_node_id = excluded.from_node_id, to_node_id = excluded.to_node_id, distance = excluded.distance', [
      edge.id, edge.fromNodeId, edge.toNodeId, edge.distance,
      edge.initialState, discoveredAt,
    ], false)
  }

  save() {
    const bytes = this.db.export()
    const temp = `${this.filePath}.tmp`
    fs.writeFileSync(temp, Buffer.from(bytes))
    fs.copyFileSync(temp, this.filePath)
    fs.unlinkSync(temp)
  }

  all(sql, params = []) {
    const statement = this.db.prepare(sql)
    statement.bind(params)
    const rows = []
    while (statement.step()) rows.push(statement.getAsObject())
    statement.free()
    return rows
  }

  one(sql, params = []) {
    return this.all(sql, params)[0] || null
  }

  run(sql, params = [], persist = true) {
    this.db.run(sql, params)
    if (persist) this.save()
  }

  transaction(callback) {
    this.db.run('BEGIN')
    try {
      const result = callback()
      this.db.run('COMMIT')
      this.save()
      return result
    } catch (error) {
      this.db.run('ROLLBACK')
      throw error
    }
  }

  // ── Player timeline ───────────────────────────────────────
  // world_entered_at_ms: when the player first entered the game world.
  // Backward-compat: falls back to player_created_at_ms → mail_started_at_ms

  worldEnteredAtMs() {
    const s = this.getSettings()
    return Number(s.world_entered_at_ms || s.player_created_at_ms || s.mail_started_at_ms) || 0
  }

  getSettings() {
    const values = Object.fromEntries(this.all('SELECT key, value FROM settings').map((row) => [row.key, row.value]))
    return values
  }

  setSettings(values) {
    this.transaction(() => {
      for (const [key, value] of Object.entries(values)) {
        if (!['user_name', 'model', 'theme', 'accent', 'world_name', 'birthday', 'proxy_url', 'ai_base_url', 'api_provider', 'focus_widget_theme'].includes(key)) continue
        this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)], false)
      }
    })
    return this.getSettings()
  }

  getPlayerProfile() {
    const row = this.one('SELECT * FROM player_profiles WHERE id = ?', ['primary'])
    if (!row) return null
    return {
      ...row,
      cape_enabled: Boolean(row.cape_enabled),
      created_from_legacy: Boolean(row.created_from_legacy),
    }
  }

  updatePlayerProfile(patch = {}) {
    const current = this.one('SELECT * FROM player_profiles WHERE id = ?', ['primary'])
    if (!current) throw new Error('Player profile is missing')
    const now = Date.now()
    const cleanName = String(patch.displayName ?? current.display_name).trim().slice(0, 40)
    if (!cleanName) throw new Error('Player name is required')
    const cleanId = (value, fallback) => {
      const clean = String(value ?? fallback).trim().slice(0, 64)
      return /^[a-z0-9_.-]+$/i.test(clean) ? clean : fallback
    }
    const introStatus = String(patch.introStatus ?? current.intro_status)
    if (!['unseen', 'available', 'seen', 'skipped'].includes(introStatus)) throw new Error('Invalid intro status')
    const appearanceChanged = ['displayName', 'bodyType', 'skinTone', 'hairStyle', 'hairColor', 'outfitId', 'outfitTint', 'capeEnabled']
      .some((key) => patch[key] !== undefined)
    const values = {
      displayName: cleanName,
      bodyType: cleanId(patch.bodyType, current.body_type),
      skinTone: cleanId(patch.skinTone, current.skin_tone),
      hairStyle: cleanId(patch.hairStyle, current.hair_style),
      hairColor: cleanId(patch.hairColor, current.hair_color),
      outfitId: cleanId(patch.outfitId, current.outfit_id),
      outfitTint: cleanId(patch.outfitTint, current.outfit_tint),
      capeEnabled: patch.capeEnabled === undefined ? Number(current.cape_enabled) : (patch.capeEnabled ? 1 : 0),
      introStatus,
      introSeenAt: introStatus === 'seen' ? (current.intro_seen_at || now) : current.intro_seen_at,
      customizedAt: appearanceChanged ? now : current.customized_at,
    }
    this.transaction(() => {
      this.run('UPDATE player_profiles SET display_name = ?, body_type = ?, skin_tone = ?, hair_style = ?, hair_color = ?, outfit_id = ?, outfit_tint = ?, cape_enabled = ?, intro_status = ?, intro_seen_at = ?, customized_at = ?, updated_at = ? WHERE id = ?', [
        values.displayName, values.bodyType, values.skinTone, values.hairStyle,
        values.hairColor, values.outfitId, values.outfitTint, values.capeEnabled,
        values.introStatus, values.introSeenAt, values.customizedAt, now, 'primary',
      ], false)
      this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['user_name', values.displayName], false)
    })
    return this.getPlayerProfile()
  }

  parseStoredJson(value) {
    try {
      return JSON.parse(value || '{}')
    } catch {
      return {}
    }
  }

  getWorldFoundation() {
    const content = this.one('SELECT * FROM content_versions WHERE namespace = ?', [WORLD_CONTENT_NAMESPACE])
    const discoveries = this.all('SELECT * FROM discoveries ORDER BY created_at').map((row) => ({
      ...row,
      metadata: this.parseStoredJson(row.metadata_json),
    }))
    const recentEvents = this.all('SELECT * FROM world_events ORDER BY occurred_at DESC LIMIT 20').map((row) => ({
      ...row,
      payload: this.parseStoredJson(row.payload_json),
    }))
    return {
      content: content || { namespace: WORLD_CONTENT_NAMESPACE, version: WORLD_CONTENT_VERSION },
      player: this.getPlayerProfile(),
      map: {
        regions: this.all('SELECT * FROM world_regions ORDER BY sort_order, id'),
        nodes: this.all('SELECT * FROM world_nodes ORDER BY sort_order, id'),
        edges: this.all('SELECT * FROM world_edges ORDER BY id'),
        discoveries,
      },
      recentEvents,
    }
  }

  recordWorldEvent(data, persist = true) {
    const eventKey = String(data?.eventKey || '').trim()
    if (!eventKey) throw new Error('Event key is required')
    const existing = this.one('SELECT * FROM world_events WHERE event_key = ?', [eventKey])
    if (existing) return { ...existing, payload: this.parseStoredJson(existing.payload_json) }
    const id = crypto.randomUUID()
    const occurredAt = Number(data.occurredAt) || Date.now()
    const write = () => this.run('INSERT INTO world_events (id, event_key, definition_id, definition_version, status, session_id, payload_json, occurred_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      id,
      eventKey,
      String(data.definitionId || eventKey),
      Math.max(1, Number(data.definitionVersion) || 1),
      String(data.status || 'resolved'),
      data.sessionId || null,
      JSON.stringify(data.payload || {}),
      occurredAt,
      data.resolvedAt || (data.status === 'pending' ? null : occurredAt),
    ], false)
    if (persist) this.transaction(write)
    else write()
    const row = this.one('SELECT * FROM world_events WHERE id = ?', [id])
    return { ...row, payload: this.parseStoredJson(row.payload_json) }
  }

  recordDiscovery(data, persist = true) {
    const discoveryKey = String(data?.discoveryKey || '').trim()
    const kind = String(data?.kind || '')
    const targetId = String(data?.targetId || '').trim()
    if (!discoveryKey || !targetId) throw new Error('Discovery key and target are required')
    const existing = this.one('SELECT * FROM discoveries WHERE discovery_key = ?', [discoveryKey])
    if (existing) return { ...existing, metadata: this.parseStoredJson(existing.metadata_json) }
    const targetTables = { region: 'world_regions', node: 'world_nodes', edge: 'world_edges' }
    const targetTable = targetTables[kind]
    if (!targetTable) throw new Error('Invalid discovery kind')
    if (!this.one(`SELECT id FROM ${targetTable} WHERE id = ?`, [targetId])) throw new Error('Discovery target does not exist')
    const id = crypto.randomUUID()
    const createdAt = Number(data.createdAt) || Date.now()
    const write = () => {
      this.run('INSERT INTO discoveries (id, discovery_key, kind, target_id, session_id, event_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        id, discoveryKey, kind, targetId, data.sessionId || null, data.eventId || null,
        JSON.stringify(data.metadata || {}), createdAt,
      ], false)
      if (kind === 'region') {
        this.run('UPDATE world_regions SET state = ?, discovered_at = COALESCE(discovered_at, ?) WHERE id = ?', ['discovered', createdAt, targetId], false)
      } else {
        this.run(`UPDATE ${targetTable} SET state = ?, discovered_at = COALESCE(discovered_at, ?), discovery_session_id = COALESCE(discovery_session_id, ?) WHERE id = ?`, [
          'discovered', createdAt, data.sessionId || null, targetId,
        ], false)
        if (kind === 'node') {
          this.run('UPDATE world_regions SET state = ?, discovered_at = COALESCE(discovered_at, ?) WHERE id = (SELECT region_id FROM world_nodes WHERE id = ?)', [
            'discovered', createdAt, targetId,
          ], false)
        }
      }
    }
    if (persist) this.transaction(write)
    else write()
    const row = this.one('SELECT * FROM discoveries WHERE id = ?', [id])
    return { ...row, metadata: this.parseStoredJson(row.metadata_json) }
  }

  getStructure() {
    return {
      areas: this.all('SELECT * FROM areas WHERE archived = 0 ORDER BY created_at'),
      goals: this.all("SELECT * FROM goals WHERE status != 'archived' ORDER BY created_at DESC"),
      tasks: this.all("SELECT * FROM tasks WHERE status != 'archived' ORDER BY sort_order ASC, created_at ASC, id ASC"),
    }
  }

  getAllStructure() {
    return {
      areas: this.all('SELECT * FROM areas ORDER BY archived, created_at'),
      goals: this.all('SELECT * FROM goals ORDER BY status, created_at DESC'),
      tasks: this.all('SELECT * FROM tasks ORDER BY CASE WHEN status IN (\'todo\',\'doing\') THEN 0 WHEN status = \'done\' THEN 1 ELSE 2 END, sort_order ASC, created_at ASC, id ASC'),
    }
  }

  memoFromRow(row) {
    if (!row) return null
    let checklist = []
    try {
      const parsed = JSON.parse(row.checklist_json || '[]')
      if (Array.isArray(parsed)) checklist = parsed
    } catch (_) { /* malformed legacy text becomes an empty checklist */ }
    let content = []
    try {
      const parsed = JSON.parse(row.content_json || '[]')
      if (Array.isArray(parsed)) content = parsed
    } catch (_) { /* malformed content falls back to the legacy columns */ }
    if (!content.length) {
      if (row.kind === 'checklist' && checklist.length) {
        content = checklist.map((item) => ({
          id: String(item.id || crypto.randomUUID()), kind: 'checklist',
          text: String(item.text || ''), style: 'body', done: Boolean(item.done),
        }))
      } else {
        const paragraphs = String(row.body || '').split(/\r?\n/)
        content = paragraphs.map((text) => ({ id: crypto.randomUUID(), kind: 'text', text, style: 'body', done: false }))
      }
    }
    return { ...row, pinned: Number(row.pinned) === 1, checklist, content, content_html: String(row.content_html || '') }
  }

  getMemoLibrary() {
    return {
      folders: this.all('SELECT * FROM memo_folders ORDER BY name COLLATE NOCASE, created_at'),
      notes: this.all('SELECT * FROM memos ORDER BY pinned DESC, updated_at DESC, created_at DESC').map((row) => this.memoFromRow(row)),
    }
  }

  createMemoFolder(name) {
    const clean = String(name || '').trim().slice(0, 40)
    if (!clean) throw new Error('分类册名称不能为空')
    if (this.one('SELECT id FROM memo_folders WHERE lower(name) = lower(?)', [clean])) throw new Error('已经有同名的分类册了')
    const id = crypto.randomUUID()
    const now = Date.now()
    this.run('INSERT INTO memo_folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [id, clean, now, now])
    return this.one('SELECT * FROM memo_folders WHERE id = ?', [id])
  }

  updateMemoFolder(id, name) {
    const folder = this.one('SELECT * FROM memo_folders WHERE id = ?', [id])
    if (!folder) throw new Error('分类册不存在')
    const clean = String(name || '').trim().slice(0, 40)
    if (!clean) throw new Error('分类册名称不能为空')
    if (this.one('SELECT id FROM memo_folders WHERE lower(name) = lower(?) AND id != ?', [clean, id])) throw new Error('已经有同名的分类册了')
    this.run('UPDATE memo_folders SET name = ?, updated_at = ? WHERE id = ?', [clean, Date.now(), id])
    return this.one('SELECT * FROM memo_folders WHERE id = ?', [id])
  }

  deleteMemoFolder(id) {
    if (!this.one('SELECT id FROM memo_folders WHERE id = ?', [id])) throw new Error('分类册不存在')
    this.transaction(() => {
      this.run('UPDATE memos SET folder_id = NULL, updated_at = ? WHERE folder_id = ?', [Date.now(), id], false)
      this.run('DELETE FROM memo_folders WHERE id = ?', [id], false)
    })
    return this.getMemoLibrary()
  }

  createMemo(data = {}) {
    const kind = data.kind === 'checklist' ? 'checklist' : 'note'
    const folderId = data.folderId && this.one('SELECT id FROM memo_folders WHERE id = ?', [data.folderId]) ? data.folderId : null
    const id = crypto.randomUUID()
    const now = Date.now()
    const firstBlock = JSON.stringify([{ id: crypto.randomUUID(), kind: 'text', text: '', style: 'body', done: false }])
    this.run('INSERT INTO memos (id, folder_id, kind, title, body, checklist_json, content_json, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)', [
      id, folderId, kind, '', '', '[]', firstBlock, now, now,
    ])
    return this.memoFromRow(this.one('SELECT * FROM memos WHERE id = ?', [id]))
  }

  updateMemo(id, patch = {}) {
    const memo = this.one('SELECT * FROM memos WHERE id = ?', [id])
    if (!memo) throw new Error('这页手记不存在')
    const folderId = patch.folderId === undefined
      ? memo.folder_id
      : (patch.folderId && this.one('SELECT id FROM memo_folders WHERE id = ?', [patch.folderId]) ? patch.folderId : null)
    const kind = patch.kind === undefined ? memo.kind : (patch.kind === 'checklist' ? 'checklist' : 'note')
    const title = String(patch.title === undefined ? memo.title : patch.title).slice(0, 120)
    const body = String(patch.body === undefined ? memo.body : patch.body).slice(0, 100000)
    const checklist = patch.checklist === undefined ? memo.checklist_json : JSON.stringify(Array.isArray(patch.checklist) ? patch.checklist.slice(0, 300).map((item) => ({
      id: String(item?.id || crypto.randomUUID()),
      text: String(item?.text || '').slice(0, 1000),
      done: Boolean(item?.done),
    })) : [])
    const content = patch.content === undefined ? (memo.content_json || '[]') : JSON.stringify(Array.isArray(patch.content) ? patch.content.slice(0, 500).map((block) => ({
      id: String(block?.id || crypto.randomUUID()),
      kind: block?.kind === 'checklist' ? 'checklist' : 'text',
      text: String(block?.text || '').slice(0, 4000),
      style: ['small', 'body', 'emphasis', 'heading'].includes(block?.style) ? block.style : 'body',
      done: Boolean(block?.done),
    })) : [])
    const contentHtml = String(patch.content_html === undefined ? (memo.content_html || '') : patch.content_html)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
      .slice(0, 250000)
    const pinned = patch.pinned === undefined ? Number(memo.pinned) : (patch.pinned ? 1 : 0)
    this.run('UPDATE memos SET folder_id = ?, kind = ?, title = ?, body = ?, checklist_json = ?, content_json = ?, content_html = ?, pinned = ?, updated_at = ? WHERE id = ?', [
      folderId, kind, title, body, checklist, content, contentHtml, pinned, Date.now(), id,
    ])
    return this.memoFromRow(this.one('SELECT * FROM memos WHERE id = ?', [id]))
  }

  trashMemo(id) {
    if (!this.one('SELECT id FROM memos WHERE id = ?', [id])) throw new Error('这页手记不存在')
    this.run('UPDATE memos SET pinned = 0, deleted_at = ?, updated_at = ? WHERE id = ?', [Date.now(), Date.now(), id])
    return this.memoFromRow(this.one('SELECT * FROM memos WHERE id = ?', [id]))
  }

  restoreMemo(id) {
    if (!this.one('SELECT id FROM memos WHERE id = ?', [id])) throw new Error('这页手记不存在')
    this.run('UPDATE memos SET deleted_at = NULL, updated_at = ? WHERE id = ?', [Date.now(), id])
    return this.memoFromRow(this.one('SELECT * FROM memos WHERE id = ?', [id]))
  }

  deleteMemoPermanently(id) {
    const memo = this.one('SELECT * FROM memos WHERE id = ?', [id])
    if (!memo?.deleted_at) throw new Error('只有旧纸篓里的手记才能永久清理')
    this.run('DELETE FROM memos WHERE id = ?', [id])
    return { id }
  }

  createArea({ name, color = '#8b9cff', icon = 'book' }) {
    const id = crypto.randomUUID()
    const clean = String(name || '').trim()
    if (!clean) throw new Error('领域名称不能为空')
    this.run('INSERT INTO areas (id, name, color, icon, created_at) VALUES (?, ?, ?, ?, ?)', [id, clean, color, icon, Date.now()])
    return this.one('SELECT * FROM areas WHERE id = ?', [id])
  }

  createGoal({ areaId, title, description = '', dueDate = null }) {
    const id = crypto.randomUUID()
    const now = Date.now()
    if (!this.one('SELECT id FROM areas WHERE id = ?', [areaId])) throw new Error('请选择有效领域')
    if (!String(title || '').trim()) throw new Error('目标名称不能为空')
    this.run('INSERT INTO goals (id, area_id, title, description, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      id, areaId, title.trim(), String(description || '').trim(), dueDate || null, now, now,
    ])
    return this.one('SELECT * FROM goals WHERE id = ?', [id])
  }

  createTask({ areaId, goalId = null, title, notes = '' }) {
    const id = crypto.randomUUID()
    const now = Date.now()
    if (!this.one('SELECT id FROM areas WHERE id = ?', [areaId])) throw new Error('请选择有效领域')
    if (goalId && !this.one('SELECT id FROM goals WHERE id = ?', [goalId])) throw new Error('目标不存在')
    if (!String(title || '').trim()) throw new Error('事项名称不能为空')
    const maxOrder = Number(this.one('SELECT COALESCE(MAX(sort_order), 0) AS m FROM tasks').m)
    this.run('INSERT INTO tasks (id, area_id, goal_id, title, notes, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      id, areaId, goalId || null, title.trim(), String(notes || '').trim(), maxOrder + 1, now, now,
    ])
    return this.one('SELECT * FROM tasks WHERE id = ?', [id])
  }

  updateTask(id, patch) {
    const task = this.one('SELECT * FROM tasks WHERE id = ?', [id])
    if (!task) throw new Error('事项不存在')
    const status = patch.status ?? task.status
    const title = String(patch.title ?? task.title).trim()
    if (!title) throw new Error('事项名称不能为空')
    const now = Date.now()
    this.transaction(() => {
      this.run(`UPDATE tasks SET title = ?, notes = ?, area_id = ?, goal_id = ?, status = ?, completed_at = ?, updated_at = ? WHERE id = ?`, [
        title,
        patch.notes ?? task.notes,
        patch.areaId ?? task.area_id,
        patch.goalId === undefined ? task.goal_id : (patch.goalId || null),
        status,
        status === 'done' ? (task.completed_at || now) : null,
        now,
        id,
      ], false)
      if (status === 'done' && !task.completion_xp_awarded) this.awardTaskCompletion(id, false, true)
    })
    const unlocked = this.checkAchievements()
    return { task: this.one('SELECT * FROM tasks WHERE id = ?', [id]), unlocked }
  }

  reorderTasks(items) {
    this.transaction(() => {
      for (const { id, sortOrder } of items) {
        this.run('UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?', [sortOrder, Date.now(), id], false)
      }
    })
  }

  deleteTask(id) {
    const refs = Number(this.one('SELECT COUNT(*) AS count FROM focus_sessions WHERE task_id = ?', [id]).count)
    if (refs > 0) throw new Error('该路标已被远征记录引用，不可删除。请改为归档。')
    this.run('DELETE FROM tasks WHERE id = ?', [id])
  }

  reopenTask(id) {
    const task = this.one('SELECT * FROM tasks WHERE id = ?', [id])
    if (!task || task.status !== 'done') throw new Error('只能重新打开已完成的路标')
    this.run('UPDATE tasks SET status = ?, completed_at = NULL, updated_at = ? WHERE id = ?', ['todo', Date.now(), id])
    return this.one('SELECT * FROM tasks WHERE id = ?', [id])
  }

  restoreTask(id) {
    const task = this.one('SELECT * FROM tasks WHERE id = ?', [id])
    if (!task || task.status !== 'archived') throw new Error('只能恢复已归档的路标')
    const targetStatus = task.completed_at ? 'done' : 'todo'
    this.run('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', [targetStatus, Date.now(), id])
    return this.one('SELECT * FROM tasks WHERE id = ?', [id])
  }

  updateGoal(id, { title, description }) {
    const goal = this.one('SELECT * FROM goals WHERE id = ?', [id])
    if (!goal) throw new Error('目标分组不存在')
    this.run('UPDATE goals SET title = ?, description = ?, updated_at = ? WHERE id = ?', [
      String(title || goal.title).trim() || goal.title,
      description !== undefined ? String(description || '').trim() : goal.description,
      Date.now(), id,
    ])
    return this.one('SELECT * FROM goals WHERE id = ?', [id])
  }

  getUnlockedExpeditionLocations() {
    const raw = this.getSettings().unlocked_expedition_locations
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return [...new Set(parsed.filter((location) => MAP_FRAGMENT_LOCATIONS.includes(location)))]
    } catch {
      return []
    }
  }

  getExpeditionLocationPool() {
    return [...LOCATIONS, ...this.getUnlockedExpeditionLocations()]
  }

  getHearthState() {
    const hour = new Date().getHours()
    const automatic = hour < 6 || hour >= 18
    return { lit: automatic || Number(this.getSettings().hearth_lit || 0) === 1, automatic }
  }

  getPoetryCollection() {
    return this.all('SELECT * FROM poetry_collection ORDER BY obtained_at DESC').map((row) => ({ ...row, poem: BARD_POEMS.find((poem) => poem.id === row.poem_id) || null }))
  }

  claimBardPoem(sessionId) {
    const expedition = this.one('SELECT rewards_json, created_at FROM expeditions WHERE session_id = ?', [sessionId])
    if (!expedition) throw new Error('这段远征尚未留下吟游诗人的踪迹')
    const rewards = JSON.parse(expedition.rewards_json || '{}')
    if (!rewards.bard) throw new Error('这次远征没有遇见吟游诗人')
    const existing = this.one('SELECT * FROM poetry_collection WHERE session_id = ?', [sessionId])
    if (existing) return { ...existing, poem: BARD_POEMS.find((poem) => poem.id === existing.poem_id), gift: rewards.bard.gift || null }
    const owned = new Set(this.all('SELECT poem_id FROM poetry_collection').map((row) => row.poem_id))
    const candidates = BARD_POEMS.filter((poem) => !owned.has(poem.id))
    if (!candidates.length) return { exhausted: true }
    const poem = candidates[crypto.createHash('sha256').update(`${sessionId}:poem`).digest().readUInt32LE(0) % candidates.length]
    const row = { id: crypto.randomUUID(), session_id: sessionId, poem_id: poem.id, obtained_at: expedition.created_at }
    this.run('INSERT INTO poetry_collection (id, session_id, poem_id, obtained_at) VALUES (?, ?, ?, ?)', [row.id, row.session_id, row.poem_id, row.obtained_at])
    return { ...row, poem, gift: rewards.bard.gift || null }
  }

  setHearthLit(lit) {
    const hour = new Date().getHours()
    if (hour < 6 || hour >= 18) return this.getHearthState()
    this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['hearth_lit', lit ? '1' : '0'])
    this.save()
    return this.getHearthState()
  }

  useHearthRecipe(recipeId) {
    if (!this.getHearthState().lit) throw new Error('先点燃炉火，才能开始熬制或锻造')
    const recipes = {
      herbal_soup: { source: 'herb_bundle', amount: 10, output: 'herbal_soup', text: '山野药草在炉火上慢慢熬成了山草药汤。' },
      honey_amber: { source: 'amber_chip', amount: 10, output: 'honey_amber', text: '蜜色琥珀碎片在炉火中熔成了一枚珍稀蜜色琥珀。' },
    }
    const recipe = recipes[recipeId]
    if (!recipe) throw new Error('这份炉火配方不存在')
    const source = this.one('SELECT * FROM inventory WHERE item_id = ?', [recipe.source])
    if (!source || Number(source.quantity) < recipe.amount) throw new Error(`需要 ${recipe.amount} 件材料才能开始`)
    const now = Date.now()
    this.transaction(() => {
      this.run('UPDATE inventory SET quantity = quantity - ?, updated_at = ? WHERE item_id = ?', [recipe.amount, now, recipe.source], false)
      this.run(`INSERT INTO inventory (item_id, quantity, first_found_at, updated_at) VALUES (?, 1, ?, ?)
        ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + 1, updated_at = excluded.updated_at`, [recipe.output, now, now], false)
    })
    return { ...this.getHearthState(), effect: recipe.text }
  }

  deleteGoal(id) {
    const goal = this.one('SELECT id FROM goals WHERE id = ?', [id])
    if (!goal) throw new Error('目标分组不存在')
    this.transaction(() => {
      this.run('UPDATE tasks SET goal_id = NULL, updated_at = ? WHERE goal_id = ?', [Date.now(), id], false)
      this.run('DELETE FROM goals WHERE id = ?', [id], false)
    })
  }

  restoreGoal(id) {
    const goal = this.one("SELECT * FROM goals WHERE id = ? AND status = 'archived'", [id])
    if (!goal) throw new Error('只能恢复已归档的目标分组')
    this.run("UPDATE goals SET status = 'active', updated_at = ? WHERE id = ?", [Date.now(), id])
    return this.one('SELECT * FROM goals WHERE id = ?', [id])
  }

  archiveGoal(id) {
    this.run("UPDATE goals SET status = 'archived', updated_at = ? WHERE id = ?", [Date.now(), id])
  }

  updateArea(id, { name, color }) {
    const area = this.one('SELECT * FROM areas WHERE id = ?', [id])
    if (!area) throw new Error('领域不存在')
    this.run('UPDATE areas SET name = ?, color = ? WHERE id = ?', [
      String(name || area.name).trim() || area.name,
      color || area.color,
      id,
    ])
    return this.one('SELECT * FROM areas WHERE id = ?', [id])
  }

  restoreArea(id) {
    const area = this.one('SELECT * FROM areas WHERE id = ? AND archived = 1', [id])
    if (!area) throw new Error('只能恢复已归档的领域')
    this.run('UPDATE areas SET archived = 0 WHERE id = ?', [id])
    return this.one('SELECT * FROM areas WHERE id = ?', [id])
  }

  deleteArea(id) {
    const activeCount = Number(this.one('SELECT COUNT(*) AS count FROM areas WHERE archived = 0').count)
    if (activeCount <= 1 && !this.one('SELECT archived FROM areas WHERE id = ?', [id])?.archived) throw new Error('至少保留一个活跃学习领域')
    const refTasks = Number(this.one('SELECT COUNT(*) AS count FROM tasks WHERE area_id = ?', [id]).count)
    const refGoals = Number(this.one('SELECT COUNT(*) AS count FROM goals WHERE area_id = ?', [id]).count)
    const refSessions = Number(this.one('SELECT COUNT(*) AS count FROM focus_sessions WHERE area_id = ?', [id]).count)
    if (refTasks > 0 || refGoals > 0) throw new Error(`该领域下还有 ${refTasks} 个路标和 ${refGoals} 个目标分组，请先移动或清理`)
    if (refSessions > 0) throw new Error('该领域已有关联远征历史，不可删除。请改为归档。')
    this.run('DELETE FROM areas WHERE id = ?', [id])
  }

  archiveArea(id) {
    const areaCount = Number(this.one('SELECT COUNT(*) AS count FROM areas WHERE archived = 0').count)
    const activeTasks = Number(this.one("SELECT COUNT(*) AS count FROM tasks WHERE area_id = ? AND status IN ('todo','doing')", [id]).count)
    if (activeTasks > 0) throw new Error(`该领域下还有 ${activeTasks} 个进行中路标，请先移动或完成`)
    if (areaCount <= 1) throw new Error('至少保留一个活跃学习领域')
    this.run('UPDATE areas SET archived = 1 WHERE id = ?', [id])
  }

  getActiveSession() {
    const session = this.one(`SELECT s.*, t.title AS task_title, a.name AS area_name, a.color AS area_color,
        c.nickname AS companion_name, c.species_id AS companion_species_id
      FROM focus_sessions s
      LEFT JOIN tasks t ON t.id = s.task_id
      LEFT JOIN areas a ON a.id = s.area_id
      LEFT JOIN companions c ON c.id = s.companion_id
      WHERE s.status IN ('running', 'paused') ORDER BY s.started_at DESC LIMIT 1`)
    if (!session) return null
    return { ...session, active_seconds: this.sessionActiveSeconds(session.id) }
  }

  startSession({ taskId = null, areaId = null, content = '', companionId = null, plannedMinutes = 25 }) {
    if (this.getActiveSession()) throw new Error('已有进行中的专注')
    let task = null
    if (taskId) task = this.one('SELECT * FROM tasks WHERE id = ?', [taskId])
    const resolvedArea = task?.area_id || areaId || null
    const resolvedContent = String(task?.title || content || '').trim()
    if (!resolvedContent) throw new Error('请输入本次专注内容')
    if (!resolvedArea) throw new Error('请选择学习领域')
    const companion = companionId
      ? this.one('SELECT * FROM companions WHERE id = ?', [companionId])
      : this.one('SELECT * FROM companions WHERE is_active = 1 ORDER BY met_at LIMIT 1')
    if (companionId && !companion) throw new Error('同行伙伴不存在')
    if (companion?.is_ill) throw new Error(`${companion.nickname || '这位伙伴'}正在小屋里休养，今天不能出征`)
    const plannedSeconds = Math.max(1, Math.min(180, Math.round(Number(plannedMinutes) || 25))) * 60
    const id = crypto.randomUUID()
    const intervalId = crypto.randomUUID()
    const now = Date.now()
    this.transaction(() => {
      this.run(`INSERT INTO focus_sessions (id, task_id, area_id, content, companion_id, planned_seconds, started_at, status, last_heartbeat_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?)`, [id, taskId || null, resolvedArea, resolvedContent, companion?.id || null, plannedSeconds, now, now, now], false)
      this.run('INSERT INTO focus_intervals (id, session_id, started_at) VALUES (?, ?, ?)', [intervalId, id, now], false)
      if (task && task.status === 'todo') this.run("UPDATE tasks SET status = 'doing', updated_at = ? WHERE id = ?", [now, task.id], false)
    })
    return this.getActiveSession()
  }

  heartbeat(id) {
    const session = this.one("SELECT * FROM focus_sessions WHERE id = ? AND status = 'running'", [id])
    if (!session) return this.getActiveSession()
    this.run('UPDATE focus_sessions SET last_heartbeat_at = ? WHERE id = ?', [Date.now(), id])
    return this.getActiveSession()
  }

  pauseSession(id, at = Date.now()) {
    const session = this.one("SELECT * FROM focus_sessions WHERE id = ? AND status = 'running'", [id])
    if (!session) return this.getActiveSession()
    this.transaction(() => {
      this.run('UPDATE focus_intervals SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL', [at, id], false)
      this.run("UPDATE focus_sessions SET status = 'paused', last_heartbeat_at = ? WHERE id = ?", [at, id], false)
    })
    return this.getActiveSession()
  }

  resumeSession(id) {
    const session = this.one("SELECT * FROM focus_sessions WHERE id = ? AND status = 'paused'", [id])
    if (!session) return this.getActiveSession()
    const now = Date.now()
    this.transaction(() => {
      this.run('INSERT INTO focus_intervals (id, session_id, started_at) VALUES (?, ?, ?)', [crypto.randomUUID(), id, now], false)
      this.run("UPDATE focus_sessions SET status = 'running', last_heartbeat_at = ? WHERE id = ?", [now, id], false)
    })
    return this.getActiveSession()
  }

  cancelSession(id) {
    const now = Date.now()
    this.transaction(() => {
      this.run('UPDATE focus_intervals SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL', [now, id], false)
      this.run("UPDATE focus_sessions SET status = 'cancelled', ended_at = ?, active_seconds = ? WHERE id = ?", [now, this.sessionActiveSeconds(id, now), id], false)
    })
    return null
  }

  stopSession(id, { outcome = '', blocker = '', nextStep = '', taskCompleted = false, contributedTaskIds = [] } = {}) {
    const session = this.one("SELECT * FROM focus_sessions WHERE id = ? AND status IN ('running', 'paused')", [id])
    if (!session) throw new Error('没有可结束的专注')
    const now = Date.now()
    let xpAwarded = 0
    let expedition = null
    const levelBefore = this.getXpSummary().level
    const primaryResult = { taskId: session.task_id, completed: false, xpAwarded: 0, alreadyAwarded: false }
    const contributedResults = []
    this.transaction(() => {
      this.run('UPDATE focus_intervals SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL', [now, id], false)
      const activeSeconds = this.sessionActiveSeconds(id, now)
      this.run(`UPDATE focus_sessions SET status = 'completed', ended_at = ?, active_seconds = ?, outcome = ?, blocker = ?, next_step = ?, task_completed = ? WHERE id = ?`, [
        now, activeSeconds, String(outcome || '').trim(), String(blocker || '').trim(), String(nextStep || '').trim(), taskCompleted ? 1 : 0, id,
      ], false)
      xpAwarded = focusXp(activeSeconds)
      if (xpAwarded > 0) {
        this.insertXp('focus', xpAwarded, 'session', id, `专注 ${Math.round(activeSeconds / 60)} 分钟`, false)
      }
      // Primary task — requires both this session >= 300s AND total accumulated >= 300s
      if (taskCompleted && session.task_id) {
        const task = this.one('SELECT * FROM tasks WHERE id = ?', [session.task_id])
        if (task && task.status !== 'done') {
          this.run("UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?", [now, now, task.id], false)
        }
        if (task && !task.completion_xp_awarded && activeSeconds >= 300) {
          const amount = this.awardTaskCompletion(task.id, false, true)
          xpAwarded += amount
          primaryResult.completed = true; primaryResult.xpAwarded = amount
          if (amount === 0) primaryResult.reason = task.completion_xp_awarded ? 'already_awarded' : 'short_session'
          else primaryResult.reason = 'awarded'
        } else if (task && task.completion_xp_awarded) {
          primaryResult.completed = true; primaryResult.alreadyAwarded = true; primaryResult.reason = 'already_awarded'
        } else if (task) {
          primaryResult.completed = true; primaryResult.xpAwarded = 0; primaryResult.reason = 'short_session'
        } else {
          primaryResult.completed = false
        }
      }
      // Contributed tasks — no hard limit, XP decays
      const uniqueTasks = [...new Set(contributedTaskIds)].filter(tid => tid && tid !== session.task_id)
      let contributedXpRunning = 0
      const CONTRIBUTED_XP_CAP = 30
      const DECAY = [10, 8, 6, 4, 2] // indices 0-3, then 2 for index 4+
      uniqueTasks.forEach((tid, index) => {
        const task = this.one("SELECT * FROM tasks WHERE id = ? AND status IN ('todo','doing')", [tid])
        const result = { taskId: tid, title: task?.title || '', order: index, completed: false, xpAwarded: 0, alreadyAwarded: false, reason: 'awarded' }
        if (!task) { result.reason = 'invalid'; contributedResults.push(result); return }
        // Determine reason before persisting
        if (task.completion_xp_awarded) {
          result.alreadyAwarded = true; result.completed = true; result.reason = 'already_awarded'
        } else if (activeSeconds < 300) {
          result.completed = true; result.reason = 'short_session'
        } else if (contributedXpRunning >= CONTRIBUTED_XP_CAP) {
          result.completed = true; result.reason = 'xp_cap_reached'
        } else {
          const xp = index < DECAY.length ? DECAY[index] : 2
          const awarded = Math.min(xp, CONTRIBUTED_XP_CAP - contributedXpRunning)
          if (awarded > 0) {
            this.insertXp('contributed_completion', awarded, 'task', tid, `沿途完成：${task.title}`, false)
            this.run('UPDATE tasks SET completion_xp_awarded = 1 WHERE id = ?', [tid], false)
            contributedXpRunning += awarded
            result.xpAwarded = awarded; result.reason = 'awarded'
          } else {
            result.reason = 'xp_cap_reached'
          }
          result.completed = true
        }
        // UPSERT with correct reason and xp_awarded
        this.run(`INSERT INTO session_task_links (session_id, task_id, role, selection_order, xp_awarded, reason, created_at)
          VALUES (?, ?, 'contributed', ?, ?, ?, ?)
          ON CONFLICT(session_id, task_id)
          DO UPDATE SET role = excluded.role, selection_order = excluded.selection_order, xp_awarded = excluded.xp_awarded, reason = excluded.reason`,
          [id, tid, index, result.xpAwarded, result.reason, now], false)
        this.run("UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?", [now, now, tid], false)
        contributedResults.push(result)
      })
      const returnKind = getReturnKind(activeSeconds)
      const skipEconomicRewards = returnKind === 'brief' || returnKind === 'short'
      if (skipEconomicRewards) {
        expedition = this.createLightweightExpedition({
          sessionId: id,
          activeSeconds,
          returnKind,
          companionId: session.companion_id,
          content: session.content,
          outcome,
          blocker,
          nextStep,
          createdAt: now,
        })
      } else {
        expedition = this.createExpeditionReward({
          sessionId: id,
          activeSeconds,
          companionId: session.companion_id,
          content: session.content,
          outcome,
          blocker,
          nextStep,
          createdAt: now,
          startedAt: session.started_at,
        })
      }
    })
    const levelUps = this.awardLevelUpRewards(levelBefore, this.getXpSummary().level)
    const unlocked = this.checkAchievements()
    return {
      session: this.one('SELECT * FROM focus_sessions WHERE id = ?', [id]),
      xpAwarded,
      unlocked,
      expedition,
      primaryTask: primaryResult,
      contributedTasks: contributedResults,
      levelUps,
    }
  }

  createExpeditionReward({ sessionId, activeSeconds, companionId, content, outcome, blocker, nextStep, createdAt, startedAt }) {
    const existing = this.getExpedition(sessionId)
    if (existing) return existing
    const settings = this.getSettings()
    const ownedSpeciesIds = this.all('SELECT species_id FROM companions').map((row) => row.species_id)
    const rareBoost = Number(settings.rare_boost || 0) > 0
    const nightRareBoost = Number(settings.night_rare_boost_until || 0) > createdAt
    const companionBoost = Number(settings.companion_boost || 0) > 0
    const rolled = rollExpedition({
      sessionId,
      activeSeconds,
      rarePity: Number(settings.rare_pity || 0),
      companionPity: Number(settings.companion_pity || 0),
      ownedSpeciesIds,
      rareBoost,
      nightRareBoost,
      companionBoost,
      locations: this.getExpeditionLocationPool(),
    })
    if (rareBoost) this.run("DELETE FROM settings WHERE key = 'rare_boost'", [], false)
    // The bard is a separate road encounter. It is deliberately not gated by
    // the dusk caravan: a quiet song can find the traveller on any valid road.
    const bard = rollBardEncounter({ sessionId, activeSeconds })

    for (const drop of rolled.drops) {
      this.run(`INSERT INTO inventory (item_id, quantity, first_found_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = excluded.updated_at`,
      [drop.item.id, drop.quantity, createdAt, createdAt], false)
    }
    if (bard?.gift) {
      this.run(`INSERT INTO inventory (item_id, quantity, first_found_at, updated_at)
        VALUES (?, 1, ?, ?)
        ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = excluded.updated_at`,
      [bard.gift.id, createdAt, createdAt], false)
    }

    let activeCompanion = null
    let growthEvent = null
    if (companionId) {
      const current = this.one('SELECT * FROM companions WHERE id = ?', [companionId])
      if (current) {
        const previousStage = displayStageForCompanion(current)
        const bondXp = Number(current.bond_xp) + rolled.bondXp
        const locked = isFormLocked(current)
        const stage = locked ? previousStage : companionStage(bondXp)
        const growthPath = locked ? (current.evolution_path || '') : (stage === 2 && !current.evolution_path ? growthPathForCompanion(current.species_id, createdAt) : current.evolution_path)
        const growthCompletedAt = !locked && stage === 2 && !current.evolution_path ? createdAt : current.growth_completed_at
        const nickname = automaticGrowthNickname(current, stage, growthPath)
        this.run('UPDATE companions SET nickname = ?, bond_xp = ?, stage = ?, evolution_path = ?, growth_completed_at = ?, last_adventure_at = ? WHERE id = ?', [nickname, bondXp, stage, growthPath, growthCompletedAt, createdAt, companionId], false)
        if (!locked) growthEvent = this.createGrowthEvent({ companionId, previousStage, stage, evolutionPath: growthPath, sourceSessionId: sessionId, occurredAt: createdAt })
        activeCompanion = this.getCompanion(companionId)
      }
    }

    let newCompanion = null
    if (rolled.companionSpecies) {
      const newId = crypto.randomUUID()
      this.run('INSERT OR IGNORE INTO companions (id, species_id, nickname, personality_profile_json, met_at, last_adventure_at) VALUES (?, ?, ?, ?, ?, ?)',
        [newId, rolled.companionSpecies.id, rolled.companionSpecies.defaultNickname || rolled.companionSpecies.kind, JSON.stringify(profileForCompanion(newId, rolled.companionSpecies.id)), createdAt, createdAt], false)
      const row = this.one('SELECT * FROM companions WHERE species_id = ?', [rolled.companionSpecies.id])
      newCompanion = row ? this.enrichCompanion(row) : null
      if (companionBoost) this.run("DELETE FROM settings WHERE key = 'companion_boost'", [], false)
    }

    let illness = null
    const healthyCount = Number(this.one('SELECT COUNT(*) AS count FROM companions WHERE is_ill = 0')?.count || 0)
    if (companionId && healthyCount > 1) {
      const roll = crypto.createHash('sha256').update(`${sessionId}:illness`).digest().readUInt32LE(0) / 0x1_0000_0000
      if (roll < 0.01) {
        const sick = this.one('SELECT * FROM companions WHERE id = ?', [companionId])
        if (sick && !sick.is_ill) {
          this.run('UPDATE companions SET is_ill = 1, ill_since = ?, is_active = 0 WHERE id = ?', [createdAt, sick.id], false)
          const replacement = this.one('SELECT id FROM companions WHERE is_ill = 0 ORDER BY met_at LIMIT 1')
          if (replacement) this.run('UPDATE companions SET is_active = 1 WHERE id = ?', [replacement.id], false)
          illness = { companionId: sick.id, nickname: sick.nickname }
          activeCompanion = this.getCompanion(sick.id)
        }
      }
    }

    this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['rare_pity', String(rolled.rareFound ? 0 : Number(settings.rare_pity || 0) + 1)], false)
    const noMoreSpecies = ownedSpeciesIds.length + (newCompanion ? 1 : 0) >= COMPANION_SPECIES.length
    this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['companion_pity', String(newCompanion || noMoreSpecies ? 0 : Number(settings.companion_pity || 0) + 1)], false)

    const caravan = rollCaravanEncounter({ sessionId, activeSeconds, startedAt })
    const rewards = {
      tier: rolled.tier,
      drops: rolled.drops,
      rareFound: rolled.rareFound,
      rareChance: rolled.rareChance,
      companionChance: rolled.companionChance,
      bondXp: rolled.bondXp,
      activeCompanion,
      newCompanion,
      growthEvent,
      illness,
      caravan,
      bard,
    }
    this.run(`INSERT INTO expeditions (session_id, tier_id, location, event_text, rewards_json, rare_found, companion_found_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      sessionId,
      rolled.tier.id,
      rolled.location,
      rolled.event,
      JSON.stringify(rewards),
      rolled.rareFound ? 1 : 0,
      newCompanion?.id || null,
      createdAt,
    ], false)

    let knowledgeRelic = null
    const cleanOutcome = String(outcome || '').trim()
    if (cleanOutcome) {
      const relicId = crypto.randomUUID()
      this.run(`INSERT INTO knowledge_relics (id, session_id, title, content, question, next_step, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        relicId,
        sessionId,
        String(content || '本次远征').trim(),
        cleanOutcome,
        String(blocker || '').trim(),
        String(nextStep || '').trim(),
        createdAt,
      ], false)
      knowledgeRelic = this.one('SELECT * FROM knowledge_relics WHERE id = ?', [relicId])
    }
    return { sessionId, location: rolled.location, event: rolled.event, ...rewards, knowledgeRelic, returnKind: getReturnKind(activeSeconds) }
  }

  // Lightweight expedition for brief/short — no economic rewards, no pity, narrative only.
  // A brief return (< 60s) is deliberately ephemeral: it can close gracefully
  // in the UI but never enters the adventure log or observatory data.
  // Knowledge relic is created only if outcome is non-empty AND returnKind is at least 'short'.
  // Completed expedition record ≠ formal expedition; formal threshold is active_seconds >= 300.
  createLightweightExpedition({ sessionId, activeSeconds, returnKind, companionId, content, outcome, blocker, nextStep, createdAt }) {
    const existing = this.getExpedition(sessionId)
    if (existing && returnKind !== 'brief') return { ...existing, returnKind: getReturnKind(activeSeconds) }

    const rolled = rollLightweightExpedition({ sessionId, activeSeconds, returnKind })

    let activeCompanion = null
    if (companionId) {
      activeCompanion = this.getCompanion(companionId)
    }

    const row = {
      tier: rolled.tier,
      location: rolled.location,
      event: rolled.event,
      drops: rolled.drops,
      rareFound: rolled.rareFound,
      rareChance: rolled.rareChance,
      companionChance: rolled.companionChance,
      bondXp: rolled.bondXp,
      activeCompanion,
      newCompanion: null,
    }

    if (returnKind !== 'brief') {
      this.run(`INSERT INTO expeditions (session_id, tier_id, location, event_text, rewards_json, rare_found, companion_found_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        sessionId,
        rolled.tier.id,
        rolled.location,
        rolled.event,
        JSON.stringify(row),
        rolled.rareFound ? 1 : 0,
        null,
        createdAt,
      ], false)
    }

    let knowledgeRelic = null
    const cleanOutcome = String(outcome || '').trim()
    if (cleanOutcome && returnKind !== 'brief') {
      const relicId = crypto.randomUUID()
      this.run(`INSERT INTO knowledge_relics (id, session_id, title, content, question, next_step, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        relicId,
        sessionId,
        String(content || '本次远征').trim(),
        cleanOutcome,
        String(blocker || '').trim(),
        String(nextStep || '').trim(),
        createdAt,
      ], false)
      knowledgeRelic = this.one('SELECT * FROM knowledge_relics WHERE id = ?', [relicId])
    }

    return { sessionId, location: rolled.location, event: rolled.event, ...row, knowledgeRelic, returnKind }
  }

  getExpedition(sessionId) {
    const row = this.one('SELECT * FROM expeditions WHERE session_id = ?', [sessionId])
    if (!row) return null
    const rewards = JSON.parse(row.rewards_json)
    // Derive returnKind for legacy records; prefer stored value, fall back to active_seconds.
    let returnKind = rewards.returnKind
    if (!returnKind) {
      const session = this.one('SELECT active_seconds FROM focus_sessions WHERE id = ?', [sessionId])
      returnKind = session ? getReturnKind(Number(session.active_seconds) || 0) : 'expedition'
    }
    return {
      sessionId: row.session_id,
      tier: rewards.tier,
      location: row.location,
      event: row.event_text,
      drops: rewards.drops,
      rareFound: Boolean(row.rare_found),
      rareChance: rewards.rareChance,
      companionChance: rewards.companionChance,
      bondXp: rewards.bondXp,
      activeCompanion: rewards.activeCompanion,
      newCompanion: rewards.newCompanion,
      growthEvent: rewards.growthEvent || null,
      illness: rewards.illness || null,
      caravan: rewards.caravan || null,
      bard: rewards.bard || null,
      knowledgeRelic: this.one('SELECT * FROM knowledge_relics WHERE session_id = ?', [sessionId]),
      createdAt: row.created_at,
      returnKind,
    }
  }

  buyCaravanItem(sessionId, slotIndex) {
    const index = Number(slotIndex)
    if (!Number.isInteger(index) || index < 0 || index > 4) throw new Error('商队货位不存在')
    let expedition = null
    this.transaction(() => {
      const row = this.one('SELECT * FROM expeditions WHERE session_id = ?', [sessionId])
      if (!row) throw new Error('这支商队已经离开了')
      const rewards = JSON.parse(row.rewards_json)
      const caravan = rewards.caravan
      const entry = caravan?.items?.[index]
      if (!entry) throw new Error('这支商队没有留下这件货物')
      if (entry.sold) throw new Error('这件旅途遗存已经换走了')
      const item = LOOT.find((candidate) => candidate.id === entry.item?.id)
      if (!item || item.rarity === 'common') throw new Error('商队货物记录有误')
      const price = CARAVAN_PRICES[item.rarity]
      const coins = this.one('SELECT * FROM inventory WHERE item_id = ?', ['copper_coin'])
      if (!coins || Number(coins.quantity) < price) throw new Error(`旧王朝铜币不足，需要 ${price} 枚`)
      const now = Date.now()
      this.run('UPDATE inventory SET quantity = quantity - ?, updated_at = ? WHERE item_id = ?', [price, now, 'copper_coin'], false)
      this.run(`INSERT INTO inventory (item_id, quantity, first_found_at, updated_at)
        VALUES (?, 1, ?, ?)
        ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + 1, updated_at = excluded.updated_at`, [item.id, now, now], false)
      caravan.items[index] = { item, price, sold: true }
      rewards.caravan = caravan
      this.run('UPDATE expeditions SET rewards_json = ? WHERE session_id = ?', [JSON.stringify(rewards), sessionId], false)
      expedition = this.getExpedition(sessionId)
    })
    this.save()
    return expedition
  }

  enrichCompanion(row) {
    const species = COMPANION_SPECIES.find((item) => item.id === row.species_id)
    if (!species) return { ...row, species: null, stageName: '未知伙伴', evolutionReady: false }
    const stage = displayStageForCompanion(row)
    const chosenEvolution = stage >= 2 ? species.evolutions.find((item) => item.id === row.evolution_path) : null
    return {
      ...row,
      stage,
      species,
      personalityProfile: parsePersonalityProfile(row.personality_profile_json, row.id, row.species_id),
      stageName: chosenEvolution?.name || species.stages[stage],
      evolutionReady: !isFormLocked(row) && evolutionReady(row.bond_xp, row.evolution_path),
      form_lock_mode: row.form_lock_mode || 'none',
      nextBondXp: stage === 0 ? 100 : stage === 1 ? 200 : Number(row.bond_xp),
      memories: this.getCompanionMemories(row),
    }
  }

  getCompanionMemories(companion) {
    const journeys = this.all(`SELECT e.location, e.event_text, e.created_at
      FROM expeditions e
      JOIN focus_sessions s ON s.id = e.session_id
      WHERE s.companion_id = ? ORDER BY e.created_at ASC`, [companion.id])
    const growthEvents = this.all(`SELECT previous_stage, stage, evolution_path, occurred_at
      FROM companion_growth_events
      WHERE companion_id = ? ORDER BY occurred_at ASC`, [companion.id])
    const formEvents = this.all(`SELECT kind, previous_stage, stage, occurred_at
      FROM companion_form_events
      WHERE companion_id = ? ORDER BY occurred_at ASC`, [companion.id])
    const profile = parsePersonalityProfile(companion.personality_profile_json, companion.id, companion.species_id)
    const species = COMPANION_SPECIES.find((item) => item.id === companion.species_id)
    const stageName = (stage, evolutionPath) => {
      if (!species) return '新的模样'
      if (Number(stage) >= 2 && evolutionPath) return species.evolutions.find((item) => item.id === evolutionPath)?.name || species.stages[2]
      return species.stages[Number(stage)] || '新的模样'
    }
    const first = companion.species_id === 'hearth_hound'
      ? '抵达边境小镇前，栗子已经在旧路上与你同行。'
      : '你们的相遇，被收进了旅途的第一页。'
    const visitedLocations = new Set()
    const journeyMemories = journeys.map((journey) => {
      const firstVisit = !visitedLocations.has(journey.location)
      visitedLocations.add(journey.location)
      return {
        kind: firstVisit ? 'place' : 'journey',
        text: firstVisit
          ? `第一次抵达${journey.location}。${journey.event_text}`
          : `在${journey.location}，${journey.event_text}`,
        at: journey.created_at,
      }
    })
    const memories = [
      { kind: 'first', text: first, at: companion.met_at },
      ...journeyMemories,
      ...(journeys.length === 0 ? [{ kind: 'habit', text: `${profile.habit}。这是它留在小屋里的小小习惯。`, at: companion.met_at }] : []),
      ...growthEvents.map((event) => ({
        kind: 'growth',
        text: `在这一天，${stageName(event.previous_stage, '')}的羁绊长成了${stageName(event.stage, event.evolution_path)}。`,
        at: event.occurred_at,
      })),
      ...formEvents.map((event) => ({
        kind: event.kind,
        text: event.kind === 'rewind'
          ? `在这一天，${stageName(event.previous_stage, '')}回望成了${stageName(event.stage, '')}的模样。羁绊仍被好好留下。`
          : `在这一天，${stageName(event.stage, companion.evolution_path)}收下永恒钻石，决定安住在此刻的模样。`,
        at: event.occurred_at,
      })),
    ]
    return memories.sort((firstMemory, secondMemory) => Number(firstMemory.at || 0) - Number(secondMemory.at || 0))
  }

  createGrowthEvent({ companionId, previousStage, stage, evolutionPath, sourceSessionId, occurredAt }) {
    if (stage <= previousStage) return null
    const id = crypto.randomUUID()
    this.run(`INSERT OR IGNORE INTO companion_growth_events
      (id, companion_id, previous_stage, stage, evolution_path, source_session_id, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, companionId, previousStage, stage, evolutionPath || '', sourceSessionId || null, occurredAt], false)
    const event = this.one('SELECT * FROM companion_growth_events WHERE companion_id = ? AND stage = ?', [companionId, stage])
    return event ? this.enrichGrowthEvent(event) : null
  }

  enrichGrowthEvent(event) {
    const companion = this.getCompanion(event.companion_id)
    return { ...event, companion }
  }

  getPendingGrowthEvent() {
    const event = this.one('SELECT * FROM companion_growth_events WHERE seen_at IS NULL ORDER BY occurred_at ASC LIMIT 1')
    return event ? this.enrichGrowthEvent(event) : null
  }

  markGrowthEventSeen(id) {
    const event = this.one('SELECT * FROM companion_growth_events WHERE id = ?', [id])
    if (!event) throw new Error('成长记录不存在')
    this.run('UPDATE companion_growth_events SET seen_at = ? WHERE id = ?', [Date.now(), id])
    return this.enrichGrowthEvent(this.one('SELECT * FROM companion_growth_events WHERE id = ?', [id]))
  }

  getCompanion(id) {
    const row = this.one('SELECT * FROM companions WHERE id = ?', [id])
    return row ? this.enrichCompanion(row) : null
  }

  getCompanionCollection() {
    const owned = this.all('SELECT * FROM companions ORDER BY is_active DESC, met_at').map((row) => this.enrichCompanion(row))
    const ownedSpecies = new Set(owned.map((item) => item.species_id))
    return {
      owned,
      active: owned.find((item) => item.is_active && !item.is_ill) || owned.find((item) => !item.is_ill) || null,
      catalog: COMPANION_SPECIES.map((species) => ({ ...species, discovered: ownedSpecies.has(species.id) })),
      total: COMPANION_SPECIES.length,
    }
  }

  setActiveCompanion(id) {
    const companion = this.one('SELECT * FROM companions WHERE id = ?', [id])
    if (!companion) throw new Error('伙伴不存在')
    if (companion.is_ill) throw new Error(`${companion.nickname || '这位伙伴'}正在小屋里休养`)
    this.transaction(() => {
      this.run('UPDATE companions SET is_active = 0', [], false)
      this.run('UPDATE companions SET is_active = 1 WHERE id = ?', [id], false)
    })
    return this.getCompanionCollection()
  }

  renameCompanion(id, nickname) {
    const companion = this.one('SELECT id FROM companions WHERE id = ?', [id])
    if (!companion) throw new Error('伙伴不存在')
    const name = String(nickname || '').trim().replace(/\s+/g, ' ')
    if (!name) throw new Error('请先写下想称呼它的名字')
    if (Array.from(name).length > 12) throw new Error('伙伴名字请控制在 12 个字以内')
    this.run('UPDATE companions SET nickname = ?, nickname_is_custom = 1 WHERE id = ?', [name, id])
    return this.getCompanion(id)
  }

  evolveCompanion(id) {
    const companion = this.getCompanion(id)
    if (!companion) throw new Error('伙伴不存在')
    if (isFormLocked(companion)) throw new Error('它已经安住在此刻的形态，不会再继续进化')
    if (!companion.evolutionReady) throw new Error('羁绊尚未达到进化条件')
    const completedAt = Date.now()
    const pathId = growthPathForCompanion(companion.species_id, completedAt)
    const nickname = automaticGrowthNickname(companion, 2, pathId)
    this.run('UPDATE companions SET nickname = ?, evolution_path = ?, stage = 2, growth_completed_at = ? WHERE id = ?', [nickname, pathId, completedAt, id])
    return this.getCompanion(id)
  }

  getInventory() {
    return this.all('SELECT * FROM inventory WHERE quantity > 0 ORDER BY updated_at DESC').map((row) => ({
      ...row,
      item: LOOT.find((item) => item.id === row.item_id) || { id: row.item_id, name: '未知物品', rarity: 'common', icon: 'box', description: '' },
    }))
  }

  useItem(itemId, targetCompanionId = null, targetStage = null) {
    const entry = this.one('SELECT * FROM inventory WHERE item_id = ?', [itemId])
    if (!entry || Number(entry.quantity) <= 0) throw new Error('物品不足')
    const now = Date.now()
    let effect = ''
    let growthEvent = null
    let formChange = null
    let consumedQuantity = 1
    let unlockedLocation = null

    const grantBond = (companion, amount) => {
      const previousStage = displayStageForCompanion(companion)
      const newBond = Number(companion.bond_xp) + amount
      const locked = isFormLocked(companion)
      const stage = locked ? previousStage : companionStage(newBond)
      const growthPath = locked ? (companion.evolution_path || '') : (stage === 2 && !companion.evolution_path ? growthPathForCompanion(companion.species_id, now) : companion.evolution_path)
      const growthCompletedAt = !locked && stage === 2 && !companion.evolution_path ? now : companion.growth_completed_at
      const nickname = automaticGrowthNickname(companion, stage, growthPath)
      this.run('UPDATE companions SET nickname = ?, bond_xp = ?, stage = ?, evolution_path = ?, growth_completed_at = ? WHERE id = ?', [nickname, newBond, stage, growthPath, growthCompletedAt, companion.id], false)
      if (!locked) growthEvent = this.createGrowthEvent({
          companionId: companion.id,
          previousStage,
          stage,
          evolutionPath: growthPath,
          sourceSessionId: null,
          occurredAt: now,
        })
    }

    if (itemId === 'map_scrap') {
      if (Number(entry.quantity) < 10) throw new Error(`还差 ${10 - Number(entry.quantity)} 张手绘地图碎片，才能拼合新的地点`)
      const unlocked = this.getUnlockedExpeditionLocations()
      const candidates = MAP_FRAGMENT_LOCATIONS.filter((location) => !unlocked.includes(location))
      if (!candidates.length) throw new Error('所有可绘入地图的地点都已标好，这些碎片会先安静留在行囊里')
      const seed = crypto.createHash('sha256').update(`${now}:${entry.quantity}:${unlocked.join('|')}`).digest().readUInt32LE(0)
      unlockedLocation = candidates[seed % candidates.length]
      this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['unlocked_expedition_locations', JSON.stringify([...unlocked, unlockedLocation])], false)
      consumedQuantity = 10
      effect = `十张碎片在桌上拼成了一条新路：「${unlockedLocation}」已经绘入远征地图。`
    } else if (itemId === 'herbal_soup') {
      const companion = targetCompanionId ? this.one('SELECT * FROM companions WHERE id = ?', [targetCompanionId]) : null
      if (!companion?.is_ill) throw new Error('山草药汤只能给正在休养的伙伴使用')
      grantBond(companion, 5)
      this.run('UPDATE companions SET is_ill = 0, ill_since = NULL WHERE id = ?', [companion.id], false)
      effect = `${companion.nickname || '伙伴'}喝下山草药汤，慢慢恢复了精神，羁绊 +5。`
    } else if (itemId === 'honey_amber') {
      const companion = targetCompanionId ? this.one('SELECT * FROM companions WHERE id = ?', [targetCompanionId]) : this.one('SELECT * FROM companions WHERE is_active = 1')
      if (!companion) throw new Error('请先选择想分享蜜色琥珀的伙伴')
      grantBond(companion, 10)
      effect = `${companion.nickname || '伙伴'}收下了珍稀蜜色琥珀，羁绊 +10。`
    } else if (itemId === 'rewind_gem') {
      const companion = targetCompanionId ? this.one('SELECT * FROM companions WHERE id = ?', [targetCompanionId]) : null
      if (!companion) throw new Error('请先选择想回望旧日模样的伙伴')
      const previousStage = displayStageForCompanion(companion)
      if (previousStage < 1) throw new Error('只有已经走过羁绊成长章节的伙伴，才能使用回溯宝石')
      if (isFormLocked(companion)) throw new Error('它已经安住在自己的形态里，回溯宝石不会再打扰它')
      const nextStage = Math.max(0, Math.min(previousStage - 1, Number(targetStage)))
      if (!Number.isInteger(Number(targetStage)) || nextStage >= previousStage) throw new Error('请选择它曾经走过的形态')
      const nickname = automaticGrowthNickname(companion, nextStage, '')
      this.run("UPDATE companions SET nickname = ?, stage = ?, evolution_path = '', growth_completed_at = NULL, form_lock_mode = 'rewound' WHERE id = ?", [nickname, nextStage, companion.id], false)
      this.run('INSERT OR IGNORE INTO companion_form_events (id, companion_id, kind, previous_stage, stage, occurred_at) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), companion.id, 'rewind', previousStage, nextStage, now], false)
      const changed = this.getCompanion(companion.id)
      formChange = { id: crypto.randomUUID(), companion: changed, previous_stage: previousStage, stage: nextStage, evolution_path: '' }
      effect = `${changed.nickname || '伙伴'}回望了曾经的模样。羁绊仍是 ${changed.bond_xp}，只是从今以后不再继续进化。`
    } else if (itemId === 'eternal_diamond') {
      const companion = targetCompanionId ? this.one('SELECT * FROM companions WHERE id = ?', [targetCompanionId]) : null
      if (!companion) throw new Error('请先选择当前与你同行的伙伴')
      if (!companion.is_active) throw new Error('永恒钻石只会回应当前准备与你同行的伙伴')
      if (isFormLocked(companion)) throw new Error('它已经安住在自己的形态里')
      const stage = displayStageForCompanion(companion)
      this.run("UPDATE companions SET stage = ?, form_lock_mode = 'eternal' WHERE id = ?", [stage, companion.id], false)
      this.run('INSERT OR IGNORE INTO companion_form_events (id, companion_id, kind, previous_stage, stage, occurred_at) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), companion.id, 'eternal', stage, stage, now], false)
      const changed = this.getCompanion(companion.id)
      effect = `${changed.nickname || '伙伴'}收下永恒钻石，安住在此刻的模样。羁绊仍会继续累积。`
    } else if (itemId === 'berry_bread') {
      const companion = targetCompanionId ? this.one('SELECT * FROM companions WHERE id = ?', [targetCompanionId]) : this.one('SELECT * FROM companions WHERE is_active = 1')
      if (!companion || companion.is_ill) throw new Error('请靠近一位正在小屋里的伙伴，再分享这份面包')
      grantBond(companion, 1)
      effect = `${companion.nickname || '伙伴'}慢慢吃完了莓果旅行面包，羁绊 +1。`
    } else if (['river_stone', 'wind_hill_feather', 'dragon_scale', 'flame_scatter', 'rain_moss_vein', 'violet_mist_glass', 'gray_pattern_stone', 'cloud_shadow_grass'].includes(itemId)) {
      const companionKeepsakes = {
        river_stone: 'river_otter',
        wind_hill_feather: 'moon_owl',
        dragon_scale: 'ember_drake',
        flame_scatter: 'hearth_hound',
        rain_moss_vein: 'moss_fox',
        violet_mist_glass: 'glimmer_cat',
        gray_pattern_stone: 'iron_badger',
        cloud_shadow_grass: 'cloud_rabbit',
      }
      const speciesId = companionKeepsakes[itemId]
      const companion = this.one('SELECT * FROM companions WHERE species_id = ?', [speciesId])
      if (!companion) throw new Error('这份礼物要等对应伙伴加入旅途后才能使用')
      if (targetCompanionId && companion.id !== targetCompanionId) throw new Error('这份纪念物只属于眼前这位伙伴')
      if (companion.is_ill) throw new Error(`${companion.nickname || '这位伙伴'}正在休养，等恢复后再收下这份纪念物吧`)
      grantBond(companion, 3)
      effect = `${companion.nickname || '伙伴'}收下了这份只属于它的旅途纪念，羁绊 +3。`
    } else if (itemId === 'moon_compass') {
      if (!isNightExpeditionTime(now)) throw new Error('月银罗盘只能在夜晚出征前使用（18:00 至次日 06:00）')
      if (Number(this.getSettings().night_rare_boost_until || 0) > now) throw new Error('月银罗盘已经生效，等到次日清晨后再使用下一枚')
      const until = nightBoostExpiry(now)
      this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['night_rare_boost_until', String(until)], false)
      effect = '罗盘在夜色中苏醒：至次日 06:00 前，远征稀有发现概率 +3%。'
    } else if (itemId === 'star_glass') {
      if (Number(this.getSettings().rare_boost || 0) > 0) throw new Error('星辉玻璃的下一次远征加成已经准备好了')
      this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['rare_boost', '1'], false)
      effect = '下一次正式远征的稀有发现概率 +10%。'
    } else if (itemId === 'silver_bell') {
      if (Number(this.getSettings().companion_boost || 0) > 0) throw new Error('银铃已经系在行囊上，正等待新的伙伴回应')
      const owned = this.all('SELECT species_id FROM companions').map((row) => row.species_id)
      const remaining = COMPANION_SPECIES.some((species) => species.id !== 'hearth_hound' && !owned.includes(species.id))
      if (!remaining) throw new Error('所有伙伴都已相遇，银铃会先安静留在收藏中')
      this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['companion_boost', '1'], false)
      effect = '银铃化作一段留在行囊上的铃声：新伙伴相遇概率 +10%，直到相遇发生。'
    } else {
      throw new Error('这件物品目前仅可收藏；它的用途会在后续旅途中开放')
    }

    this.run('UPDATE inventory SET quantity = quantity - ?, updated_at = ? WHERE item_id = ?', [consumedQuantity, now, itemId])
    this.save()
    return { consumed: true, itemId, effect, growthEvent, formChange, consumedQuantity, unlockedLocation }
  }

  getKnowledgeRelics(limit = 8) {
    return this.all('SELECT * FROM knowledge_relics ORDER BY created_at DESC LIMIT ?', [Math.max(1, Math.min(Number(limit) || 8, 100))])
  }

  getWorldState() {
    const settings = this.getSettings()
    const latest = this.one('SELECT session_id FROM expeditions ORDER BY created_at DESC LIMIT 1')
    return {
      name: settings.world_name || '炉火营地',
      foundation: this.getWorldFoundation(),
      companions: this.getCompanionCollection(),
      inventory: this.getInventory(),
      relics: this.getKnowledgeRelics(6),
      latestExpedition: latest ? this.getExpedition(latest.session_id) : null,
      pendingGrowthEvent: this.getPendingGrowthEvent(),
      rarePity: Number(settings.rare_pity || 0),
      companionPity: Number(settings.companion_pity || 0),
    }
  }

  sessionActiveSeconds(id, openEnd = Date.now()) {
    return this.all('SELECT started_at, ended_at FROM focus_intervals WHERE session_id = ?', [id])
      .reduce((sum, row) => sum + Math.max(0, Math.floor(((row.ended_at || openEnd) - row.started_at) / 1000)), 0)
  }

  awardTaskCompletion(taskId, persist = true, inTransaction = false) {
    const task = this.one('SELECT * FROM tasks WHERE id = ?', [taskId])
    if (!task || task.completion_xp_awarded) return 0
    const total = Number(this.one("SELECT COALESCE(SUM(active_seconds), 0) AS total FROM focus_sessions WHERE task_id = ? AND status = 'completed'", [taskId]).total)
    if (total < 300) return 0 // unified 5-min threshold
    const amount = completionXp(total)
    if (amount > 0) {
      this.insertXp('completion', amount, 'task', taskId, `完成：${task.title}`, false)
      this.run('UPDATE tasks SET completion_xp_awarded = 1 WHERE id = ?', [taskId], false)
    }
    if (persist && !inTransaction) this.save()
    return amount
  }

  manualCompleteTask(taskId) {
    let xpAwarded = 0
    let alreadyAwarded = false
    const now = Date.now()
    this.transaction(() => {
      const task = this.one('SELECT * FROM tasks WHERE id = ?', [taskId])
      if (!task) throw new Error('路标不存在')
      if (task.status === 'archived') throw new Error('已归档的路标不能直接完成，请先恢复')
      if (task.status === 'done') throw new Error('路标已经是完成状态')
      // Always update status to done first
      this.run('UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?', ['done', now, now, taskId], false)
      // Then handle XP — awardTaskCompletion checks completion_xp_awarded internally
      if (!task.completion_xp_awarded) {
        xpAwarded = this.awardTaskCompletion(taskId, false, true)
      } else {
        alreadyAwarded = true
      }
    })
    return { xpAwarded, alreadyAwarded }
  }

  insertXp(kind, amount, referenceType, referenceId, label, persist = true) {
    this.run('INSERT OR IGNORE INTO xp_transactions (id, kind, amount, reference_type, reference_id, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      crypto.randomUUID(), kind, amount, referenceType, referenceId, label, Date.now(),
    ], persist)
  }

  recoverStaleSession() {
    const session = this.one("SELECT * FROM focus_sessions WHERE status = 'running' ORDER BY started_at DESC LIMIT 1")
    if (!session || Date.now() - session.last_heartbeat_at <= 90000) return
    this.transaction(() => {
      this.run('UPDATE focus_intervals SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL', [session.last_heartbeat_at, session.id], false)
      this.run("UPDATE focus_sessions SET status = 'paused' WHERE id = ?", [session.id], false)
    })
  }

  autoPauseForSuspend() {
    const active = this.getActiveSession()
    if (active?.status === 'running') return this.pauseSession(active.id)
    return active
  }

  getXpSummary() {
    const totalXp = Number(this.one('SELECT COALESCE(SUM(amount), 0) AS total FROM xp_transactions').total)
    return {
      totalXp,
      ...levelFromXp(totalXp),
      recent: this.all('SELECT * FROM xp_transactions ORDER BY created_at DESC LIMIT 8'),
    }
  }

  awardLevelUpRewards(previousLevel, currentLevel) {
    const rewardedThrough = Math.max(Number(this.getSettings().level_rewarded_through || previousLevel), previousLevel)
    const levels = []
    for (let level = rewardedThrough + 1; level <= currentLevel; level += 1) levels.push(level)
    if (!levels.length) return []
    const now = Date.now()
    this.transaction(() => {
      for (const itemId of ['berry_bread', 'copper_coin']) this.run(`INSERT INTO inventory (item_id, quantity, first_found_at, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + 1, updated_at = excluded.updated_at`, [itemId, levels.length, now, now], false)
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('level_rewarded_through', ?)", [String(currentLevel)], false)
    })
    return levels.map((level) => ({ level, rewards: [{ itemId: 'berry_bread', quantity: 1 }, { itemId: 'copper_coin', quantity: 1 }] }))
  }

  checkAchievements() {
    const totals = {
      sessions: Number(this.one("SELECT COUNT(*) AS count FROM focus_sessions WHERE status = 'completed' AND active_seconds >= 60").count),
      seconds: Number(this.one("SELECT COALESCE(SUM(active_seconds), 0) AS total FROM focus_sessions WHERE status = 'completed'").total),
      tasks: Number(this.one("SELECT COUNT(*) AS count FROM tasks WHERE status = 'done'").count),
      deep: Number(this.one("SELECT COUNT(*) AS count FROM focus_sessions WHERE status = 'completed' AND active_seconds >= 3600").count),
      areas: Number(this.one("SELECT COUNT(DISTINCT area_id) AS count FROM focus_sessions WHERE status = 'completed'").count),
      reviews: Number(this.one('SELECT COUNT(*) AS count FROM daily_reviews').count),
    }
    const fourteenDaysAgo = Date.now() - 13 * 86400000
    const activeDays = new Set(this.all("SELECT started_at FROM focus_sessions WHERE status = 'completed' AND started_at >= ?", [fourteenDaysAgo]).map((row) => localDateKey(row.started_at))).size
    const shouldUnlock = new Set()
    if (totals.sessions >= 1) shouldUnlock.add('first_focus')
    if (totals.seconds >= 36000) shouldUnlock.add('focus_10h')
    if (totals.seconds >= 180000) shouldUnlock.add('focus_50h')
    if (totals.tasks >= 10) shouldUnlock.add('task_10')
    if (totals.tasks >= 50) shouldUnlock.add('task_50')
    if (totals.deep >= 10) shouldUnlock.add('deep_10')
    if (totals.areas >= 3) shouldUnlock.add('explorer')
    if (totals.reviews >= 7) shouldUnlock.add('reflection_7')
    if (activeDays >= 7) shouldUnlock.add('rhythm_7')
    const existing = new Set(this.all('SELECT code FROM achievement_unlocks').map((row) => row.code))
    const unlocked = [...shouldUnlock].filter((code) => !existing.has(code))
    if (unlocked.length) {
      this.transaction(() => {
        for (const code of unlocked) this.run('INSERT OR IGNORE INTO achievement_unlocks (code, unlocked_at) VALUES (?, ?)', [code, Date.now()], false)
      })
    }
    return unlocked.map((code) => ACHIEVEMENTS.find((item) => item.code === code))
  }

  getAchievements() {
    const unlocks = Object.fromEntries(this.all('SELECT * FROM achievement_unlocks').map((row) => [row.code, row.unlocked_at]))
    return ACHIEVEMENTS.map((item) => ({ ...item, unlockedAt: unlocks[item.code] || null }))
  }

  rangeStats(start, end) {
    const now = Date.now()
    const intervals = this.all(`SELECT i.started_at, i.ended_at, s.area_id, a.name AS area_name, a.color AS area_color
      FROM focus_intervals i
      JOIN focus_sessions s ON s.id = i.session_id
      LEFT JOIN areas a ON a.id = s.area_id
      WHERE s.status IN ('running', 'paused', 'completed') AND i.started_at < ? AND COALESCE(i.ended_at, ?) > ?`, [end, now, start])
    let focusSeconds = 0
    const byArea = new Map()
    const activeDays = new Set()
    for (const interval of intervals) {
      const seconds = secondsWithinRange(interval.started_at, interval.ended_at || now, start, end)
      focusSeconds += seconds
      const key = interval.area_id || 'none'
      const existing = byArea.get(key) || { id: key, name: interval.area_name || '未分类', color: interval.area_color || '#718096', seconds: 0 }
      existing.seconds += seconds
      byArea.set(key, existing)
      if (seconds > 0) {
        let cursor = Math.max(interval.started_at, start)
        const stop = Math.min(interval.ended_at || now, end)
        while (cursor < stop) {
          activeDays.add(localDateKey(cursor))
          const next = dayBounds(localDateKey(cursor)).end
          cursor = Math.min(next, stop)
        }
      }
    }
    const completedTasks = Number(this.one("SELECT COUNT(*) AS count FROM tasks WHERE status = 'done' AND completed_at >= ? AND completed_at < ?", [start, end]).count)
    const sessions = this.all("SELECT active_seconds FROM focus_sessions WHERE status = 'completed' AND ended_at >= ? AND ended_at < ?", [start, end])
    return {
      focusSeconds,
      completedTasks,
      sessionCount: sessions.length,
      averageSessionSeconds: sessions.length ? Math.round(sessions.reduce((sum, row) => sum + Number(row.active_seconds), 0) / sessions.length) : 0,
      activeDays: activeDays.size,
      byArea: [...byArea.values()].sort((a, b) => b.seconds - a.seconds),
    }
  }

  // Completed-only statistics for observatory and letter facts.
  // Running/paused sessions are excluded; use getDashboard() for live overlay.
  getCompletedStats(start, end) {
    const systemDefaultAreaId = this.one("SELECT value FROM settings WHERE key = 'system_default_area_id'")?.value || null
    const sessions = this.all(
      "SELECT s.active_seconds, s.area_id, a.name AS area_name, a.color AS area_color FROM focus_sessions s LEFT JOIN areas a ON a.id = s.area_id WHERE s.status = 'completed' AND s.active_seconds >= 60 AND s.ended_at >= ? AND s.ended_at < ?",
      [start, end],
    )
    const totalActiveSeconds = sessions.reduce((sum, s) => sum + Number(s.active_seconds || 0), 0)
    const sessionCounts = countSessionTypes(sessions)
    const completedTaskCount = Number(this.one(
      "SELECT COUNT(*) AS count FROM tasks WHERE status = 'done' AND completed_at >= ? AND completed_at < ?",
      [start, end],
    ).count)
    const byArea = new Map()
    for (const s of sessions) {
      if (!s.area_id) continue
      const key = s.area_id
      const existing = byArea.get(key) || {
        id: key,
        name: s.area_name || key,
        color: s.area_color || '',
        source: key === systemDefaultAreaId && s.area_name === '通用学习' ? 'system_default' : 'user_created',
        seconds: 0,
      }
      existing.seconds += Number(s.active_seconds || 0)
      byArea.set(key, existing)
    }
    const maxSession = sessions.reduce((m, s) => Math.max(m, Number(s.active_seconds || 0)), 0)
    return {
      totalActiveSeconds,
      sessionCounts,
      completedTaskCount,
      directionBreakdown: [...byArea.values()].sort((a, b) => b.seconds - a.seconds),
      longestSessionSeconds: maxSession,
    }
  }

  // ── Letters CRUD (phase 2A) ──────────────────────────────

  createLetter({ id, letterType, periodKey, periodStart, periodEnd, timezoneOffsetMinutes, timezoneName, subject, fact, templateBody }) {
    if (!id) throw new Error('信件 id 不能为空')
    if (!['daily', 'weekly', 'festival', 'memorial'].includes(letterType)) throw new Error('letter_type 只允许 daily / weekly / festival / memorial')
    if (!String(subject || '').trim()) throw new Error('信件标题不能为空')
    if (!String(timezoneName || '').trim()) throw new Error('时区名称不能为空')
    if (!String(templateBody || '').trim()) throw new Error('信件正文不能为空')
    if (periodEnd <= periodStart) throw new Error('period_end 必须大于 period_start')
    let factJson
    try { factJson = JSON.stringify(fact) } catch (_) { throw new Error('fact 无法序列化') }
    const existing = this.one('SELECT id FROM letters WHERE letter_type = ? AND period_key = ?', [letterType, periodKey])
    if (existing) { const err = new Error('相同周期的信件已存在'); err.code = 'LETTER_PERIOD_EXISTS'; throw err }
    const now = Date.now()
    try {
      this.transaction(() => {
        this.run(`INSERT INTO letters (id, letter_type, period_key, period_start, period_end, timezone_offset_minutes, timezone_name, subject, fact_json, template_body, ai_body, body_source, is_read, read_at, reply_text, created_at, updated_at, generation_version, ai_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'template', 0, NULL, NULL, ?, ?, 1, 'pending')`, [
          id, letterType, periodKey, periodStart, periodEnd, timezoneOffsetMinutes, timezoneName,
          subject.trim(), factJson, templateBody.trim(),
          now, now,
        ], false)
      })
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE constraint failed')) {
        const err = new Error('相同周期的信件已存在'); err.code = 'LETTER_PERIOD_EXISTS'; throw err
      }
      throw e
    }
    return this.getLetterById(id)
  }

  getLetterById(id) {
    const row = this.one('SELECT * FROM letters WHERE id = ?', [id])
    if (!row) return null
    return { ...row, fact: JSON.parse(row.fact_json) }
  }

  listLetters({ limit = 50, offset = 0, unreadOnly = false, letterType, cursorBefore } = {}) {
    const clauses = []
    const params = []
    if (unreadOnly) { clauses.push('is_read = 0'); }
    if (letterType) { clauses.push('letter_type = ?'); params.push(letterType); }
    if (cursorBefore !== undefined) { clauses.push('(created_at < ? OR (created_at = ? AND id < ?))'); params.push(cursorBefore, cursorBefore, cursorBefore); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const take = Math.max(1, Math.min(Number(limit) || 50, 200))
    const skip = Math.max(0, Math.floor(Number(offset) || 0))
    const rows = this.all(`SELECT * FROM letters ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, [...params, take, skip])
    return rows.map(row => ({ ...row, fact: JSON.parse(row.fact_json) }))
  }

  getUnreadLetterCount() {
    return Number(this.one('SELECT COUNT(*) AS count FROM letters WHERE is_read = 0').count)
  }

  getLatestUnreadLetter() {
    const row = this.one("SELECT * FROM letters WHERE is_read = 0 ORDER BY created_at DESC LIMIT 1")
    if (!row) return null
    return { ...row, fact: JSON.parse(row.fact_json) }
  }

  markLetterRead(id) {
    const letter = this.one('SELECT is_read FROM letters WHERE id = ?', [id])
    if (!letter) throw new Error('信件不存在')
    if (letter.is_read) return this.getLetterById(id)
    const now = Date.now()
    this.run('UPDATE letters SET is_read = 1, read_at = ?, updated_at = ? WHERE id = ?', [now, now, id])
    return this.getLetterById(id)
  }

  markLetterUnread(id) {
    const letter = this.one('SELECT is_read FROM letters WHERE id = ?', [id])
    if (!letter) throw new Error('信件不存在')
    if (!letter.is_read) return this.getLetterById(id)
    this.run('UPDATE letters SET is_read = 0, read_at = NULL, updated_at = ? WHERE id = ?', [Date.now(), id])
    return this.getLetterById(id)
  }

  saveLetterReply(id, replyText) {
    const letter = this.one('SELECT id FROM letters WHERE id = ?', [id])
    if (!letter) throw new Error('信件不存在')
    const trimmed = String(replyText || '').trim()
    if (trimmed.length > 500) throw new Error('回信不能超过 500 个字符')
    this.run('UPDATE letters SET reply_text = ?, updated_at = ? WHERE id = ?', [trimmed || null, Date.now(), id])
    return this.getLetterById(id)
  }

  // ── Periodic letter generation ──────────────────────────────

  ensureLetterForPeriod({ letterType, period }) {
    const existing = this.one('SELECT * FROM letters WHERE letter_type = ? AND period_key = ?', [letterType, period.periodKey])
    if (existing) return { letter: { ...existing, fact: JSON.parse(existing.fact_json) }, created: false }

    const facts = letterType === 'daily'
      ? buildDailyStatsForFacts(this, period)
      : buildWeeklyStatsForFacts(this, period)

    const shouldGen = letterType === 'daily'
      ? shouldGenerateDailyLetter(facts)
      : shouldGenerateWeeklyLetter(facts)

    if (!shouldGen) return { letter: null, created: false, skipped: true }

    const seed = `${letterType}:${period.periodKey}:1`
    const subject = generateLocalLetterSubject(letterType, facts, seed)
    const factObj = letterType === 'daily'
      ? buildDailyLetterFacts(facts, period)
      : buildWeeklyLetterFacts(facts, period, letterType === 'weekly' ? (() => {
          const prev = previousWeeklyPeriod(period.periodStart)
          return this.getCompletedStats(prev.periodStart, prev.periodEnd).totalActiveSeconds
        })() : undefined)
    factObj.worldState = getWorldState(period.periodKey)
    const templateBody = letterType === 'daily'
      ? generateDailyTemplate(factObj, seed)
      : generateWeeklyTemplate(factObj, seed)

    try {
      this.createLetter({
        id: crypto.randomUUID(),
        letterType,
        periodKey: period.periodKey,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        timezoneOffsetMinutes: period.timezoneOffsetMinutes,
        timezoneName: period.timezoneName,
        subject,
        fact: factObj,
        templateBody,
      })
      return { letter: this.getLetterById(this.one('SELECT id FROM letters WHERE letter_type = ? AND period_key = ?', [letterType, period.periodKey]).id), created: true }
    } catch (e) {
      if (e.code === 'LETTER_PERIOD_EXISTS') {
        const row = this.one('SELECT * FROM letters WHERE letter_type = ? AND period_key = ?', [letterType, period.periodKey])
        return { letter: { ...row, fact: JSON.parse(row.fact_json) }, created: false }
      }
      throw e
    }
  }

  ensurePeriodicLetters(now = Date.now()) {
    const s = this.getSettings()
    const worldEntered = this.worldEnteredAtMs()
    const DAY = 86400000
    const d = getDailyPeriod(now)
    const w = getWeeklyPeriod(now)

    const result = {
      initialized: !worldEntered,
      daily: { checked: 0, created: 0, skipped: 0, existing: 0 },
      weekly: { checked: 0, created: 0, skipped: 0, existing: 0 },
    }

    if (!worldEntered) {
      // Set world_entered_at_ms to the day before the earliest completed session
      const earliest = this.one("SELECT MIN(ended_at) as ts FROM focus_sessions WHERE status='completed'")
      const startTs = earliest && earliest.ts
        ? new Date(earliest.ts).setHours(0,0,0,0) - 86400000  // day before first session
        : now
      this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('world_entered_at_ms', ?)", [String(startTs)])
    }

    // ── Daily: scan from after lastDaily to today ──────────────
    const lastDaily = s.last_daily_period_checked || ''
    const dailyStart = lastDaily
      ? Math.max(worldEntered, dayBounds(lastDaily).end)
      : worldEntered
    let cursor = Math.max(dailyStart, now - 30 * DAY)

    while (cursor < d.periodStart) {
      const p = getDailyPeriod(cursor)
      result.daily.checked++
      const r = this.ensureLetterForPeriod({ letterType: 'daily', period: p })
      if (r.created) result.daily.created++
      else if (r.skipped) result.daily.skipped++
      else result.daily.existing++
      cursor = p.periodEnd
    }
    // lastDaily = the most recent date actually scanned (yesterday, since today hasn't ended)
    const yesterdayKey = localDateKey(now - DAY)
    this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_daily_period_checked', ?)", [yesterdayKey])

    // ── Weekly: scan from after lastWeekly to today ────────────
    const lastWeekly = s.last_weekly_period_checked || ''
    const weeklyStart = lastWeekly
      ? Math.max(worldEntered, weekBounds(lastWeekly).end)
      : worldEntered
    let wCursor = Math.max(weeklyStart, now - 30 * DAY)

    while (wCursor < w.periodStart) {
      const pw = getWeeklyPeriod(wCursor)
      result.weekly.checked++
      const r = this.ensureLetterForPeriod({ letterType: 'weekly', period: pw })
      if (r.created) result.weekly.created++
      else if (r.skipped) result.weekly.skipped++
      else result.weekly.existing++
      wCursor = pw.periodEnd
    }
    // lastWeekly = last fully-completed week (not current week)
    const lastWeeklyKey = localDateKey(Math.min(now - DAY, w.periodStart - DAY))
    this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_weekly_period_checked', ?)", [lastWeeklyKey])

    return result
  }

  // ── Welcome letter (first visit) ─────────────────────────

  ensureWelcomeLetter() {
    const eventKey = 'welcome:first_visit'
    const existing = this.one("SELECT id FROM letter_events WHERE event_key = ?", [eventKey])
    if (existing) return { created: false }

    const tz = tzInfo()
    // Use the player's actual world-entered date, not current time
    const worldEntered = this.worldEnteredAtMs() || Date.now()
    const letterId = crypto.randomUUID()
    const templateBody = WELCOME_TEMPLATE

    try {
      this.createLetter({
        id: letterId,
        letterType: 'memorial',
        periodKey: eventKey,
        periodStart: worldEntered,
        periodEnd: worldEntered + 86400000,
        timezoneOffsetMinutes: tz.timezoneOffsetMinutes,
        timezoneName: tz.timezoneName,
        subject: '你好呀，旅人',
        fact: { schemaVersion: 1, letterType: 'memorial', subtype: 'welcome' },
        templateBody,
      })
      this.run("INSERT INTO letter_events (id, event_type, event_key, triggered_at, letter_id) VALUES (?,?,?,?,?)",
        [crypto.randomUUID(), 'welcome', eventKey, worldEntered, letterId])
      return { created: true, letterId }
    } catch (e) {
      if (e.code === 'LETTER_PERIOD_EXISTS') return { created: false }
      throw e
    }
  }

  // ── Event-driven letters (festivals, birthday) ──────────

  ensureEventLetters(now = Date.now()) {
    const result = { festival: { checked: 0, created: 0, existing: 0, repaired: 0 } }
    const worldEnteredMs = this.worldEnteredAtMs()
    const nodes = getActiveFestivalNodes(now, worldEnteredMs)

    for (const node of nodes) {
      result.festival.checked++

      // Idempotency: check letter_events
      const existingEvent = this.one("SELECT id, letter_id FROM letter_events WHERE event_key = ?", [node.eventKey])
      if (existingEvent) {
        // Verify the linked letter still exists
        const letter = this.one("SELECT id FROM letters WHERE id = ?", [existingEvent.letter_id])
        if (letter) { result.festival.existing++; continue }
        // Orphan event — clean up and re-create below
        this.run("DELETE FROM letter_events WHERE id = ?", [existingEvent.id])
      }

      // Check if letter exists (orphan letter without event)
      const existingLetter = this.one("SELECT id FROM letters WHERE letter_type = 'festival' AND period_key = ?", [node.eventKey])
      if (existingLetter) {
        // Repair: letter exists but event missing → insert event record
        this.run("INSERT INTO letter_events (id, event_type, event_key, triggered_at, letter_id) VALUES (?, ?, ?, ?, ?)",
          [crypto.randomUUID(), node.eventType, node.eventKey, now, existingLetter.id])
        result.festival.repaired++
        continue
      }

      // Neither exists → create both
      const tz = tzInfo(now)
      const facts = buildFestivalFacts(node)
      const templateBody = generateFestivalTemplate(node.subtype)
      const letterId = crypto.randomUUID()
      const eventId = crypto.randomUUID()

      try {
        // createLetter has its own transaction; just call sequentially
        this.createLetter({
          id: letterId,
          letterType: 'festival',
          periodKey: node.eventKey,
          periodStart: node.timestamp,
          periodEnd: node.timestamp + 86400000,
          timezoneOffsetMinutes: tz.timezoneOffsetMinutes,
          timezoneName: tz.timezoneName,
          subject: node.subject,
          fact: facts,
          templateBody,
        })
        this.run("INSERT INTO letter_events (id, event_type, event_key, triggered_at, letter_id) VALUES (?, ?, ?, ?, ?)",
          [eventId, node.eventType, node.eventKey, now, letterId])
        result.festival.created++
      } catch (e) {
        if (e.code === 'LETTER_PERIOD_EXISTS') {
          // Race condition: another call already created the letter
          const repaired = this.one("SELECT id FROM letters WHERE letter_type = 'festival' AND period_key = ?", [node.eventKey])
          if (repaired) {
            this.run("INSERT OR IGNORE INTO letter_events (id, event_type, event_key, triggered_at, letter_id) VALUES (?, ?, ?, ?, ?)",
              [eventId, node.eventType, node.eventKey, now, repaired.id])
            result.festival.repaired++
          } else {
            result.festival.existing++
          }
        } else throw e
      }
    }
    return result
  }

  ensureBirthdayLetter(now = Date.now()) {
    const s = this.getSettings()
    const month = Number(s.birthday_month) || 0
    const day = Number(s.birthday_day) || 0
    if (!month || !day) return { created: false, reason: 'no_birthday_set' }

    const year = new Date(now).getFullYear()
    const eventKey = `birthday:${year}`
    const existing = this.one("SELECT id FROM letter_events WHERE event_key = ?", [eventKey])
    if (existing) return { created: false, reason: 'already_generated' }

    // Late delivery: allow if birthday this year has passed (or is today)
    const birthdayThisYear = new Date(year, month - 1, day, 12).getTime()
    if (now < birthdayThisYear) {
      return { created: false, reason: 'before_birthday' }
    }

    // Don't generate if player joined AFTER this year's birthday
    const worldEntered = this.worldEnteredAtMs()
    if (worldEntered && birthdayThisYear < worldEntered) {
      return { created: false, reason: 'before_world_entered' }
    }

    const period = birthdayPeriod(year, month, day)
    const templateBody = generateBirthdayTemplate()
    const facts = { schemaVersion: 1, periodType: 'memorial', subtype: 'birthday', year }

    try {
      const letterId = crypto.randomUUID()
      this.createLetter({
        id: letterId,
        letterType: 'memorial',
        periodKey: eventKey,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        timezoneOffsetMinutes: period.timezoneOffsetMinutes,
        timezoneName: period.timezoneName,
        subject: '写给你的生日信',
        fact: facts,
        templateBody,
      })
      this.run("INSERT INTO letter_events (id, event_type, event_key, triggered_at, letter_id) VALUES (?, ?, ?, ?, ?)",
        [crypto.randomUUID(), 'birthday', eventKey, now, letterId])
      return { created: true, letterId }
    } catch (e) {
      if (e.code === 'LETTER_PERIOD_EXISTS') return { created: false, reason: 'already_generated' }
      throw e
    }
  }

  // ── Birthday settings ────────────────────────────────────

  getBirthdaySettings() {
    const s = this.getSettings()
    return {
      month: Number(s.birthday_month) || 0,
      day: Number(s.birthday_day) || 0,
      updatedAt: Number(s.birthday_updated_at) || 0,
    }
  }

  setBirthday(month, day) {
    if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
      const err = new Error('生日日期无效')
      err.code = 'INVALID_BIRTHDAY'
      throw err
    }
    const current = this.getBirthdaySettings()
    const now = Date.now()
    if (current.updatedAt && (now - current.updatedAt) < 365 * 86400000) {
      const err = new Error('一年内只能修改一次生日')
      err.code = 'BIRTHDAY_COOLDOWN'
      throw err
    }
    this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('birthday_month', ?)", [String(month)])
    this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('birthday_day', ?)", [String(day)])
    this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('birthday_updated_at', ?)", [String(now)])
    return { month, day, updatedAt: now }
  }

  // ── Data integrity repair: remove invalid letters ──────────

  repairInvalidLetters() {
    const playerCreated = this.worldEnteredAtMs()
    const result = { deletedBirthday: 0, deletedFestival: 0, deletedOrphanEvents: 0, deletedDuplicates: 0 }

    if (playerCreated) {
      // Delete birthday letters where the birthday date < player_created_at
      const badBirthdays = this.all(
        "SELECT id, period_key, period_start FROM letters WHERE letter_type IN ('festival','memorial') AND period_key LIKE 'birthday:%' AND period_start < ?",
        [playerCreated]
      )
      for (const b of badBirthdays) {
        this.run("DELETE FROM letter_events WHERE letter_id = ?", [b.id])
        this.run("DELETE FROM letters WHERE id = ?", [b.id])
        result.deletedBirthday++
      }

      // Delete festival letters where festival date < player_created_at
      const badFestivals = this.all(
        "SELECT id, period_key, period_start FROM letters WHERE letter_type='festival' AND period_key LIKE 'returning_lights:%' AND period_start < ?",
        [playerCreated]
      )
      for (const f of badFestivals) {
        this.run("DELETE FROM letter_events WHERE letter_id = ?", [f.id])
        this.run("DELETE FROM letters WHERE id = ?", [f.id])
        result.deletedFestival++
      }
    }

    // Delete orphan letter_events (no matching letter)
    const orphans = this.all(
      "SELECT e.id FROM letter_events e WHERE NOT EXISTS (SELECT 1 FROM letters l WHERE l.id = e.letter_id)"
    )
    for (const o of orphans) {
      this.run("DELETE FROM letter_events WHERE id = ?", [o.id])
      result.deletedOrphanEvents++
    }

    // Delete duplicate letters (keep newest)
    const dups = this.all(
      "SELECT letter_type, period_key, MAX(created_at) as keep_ts FROM letters GROUP BY letter_type, period_key HAVING COUNT(*) > 1"
    )
    for (const d of dups) {
      this.run(
        "DELETE FROM letters WHERE letter_type = ? AND period_key = ? AND created_at < ?",
        [d.letter_type, d.period_key, d.keep_ts]
      )
      result.deletedDuplicates++
    }
    return result
  }

  // ── One-time repair: reset scan checkpoints so history is re-scanned ──

  repairMailTimeline() {
    const worldEntered = this.worldEnteredAtMs()
    if (!worldEntered) return { repaired: false, reason: 'no world_entered_at_ms' }
    const dayBefore = localDateKey(worldEntered - 86400000)
    this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_daily_period_checked', ?)", [dayBefore])
    this.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_weekly_period_checked', ?)", [dayBefore])
    return { repaired: true, worldEntered: new Date(worldEntered).toISOString(), resetDailyTo: dayBefore }
  }

  getDbInfo() {
    const diag = this.diagnoseMail()
    const recent = this.all("SELECT subject, letter_type, period_key, created_at FROM letters ORDER BY created_at DESC LIMIT 10")
    const s = this.getSettings()
    return {
      path: this.filePath,
      dataDir: this.dataDir,
      letters: diag.letters,
      events: diag.events,
      orphans: { letters: diag.orphanLetters, events: diag.orphanEvents },
      cycle: diag.cycle,
      birthday: { month: Number(s.birthday_month) || 0, day: Number(s.birthday_day) || 0 },
      recentLetters: recent.map(l => ({ subject: l.subject, type: l.letter_type, key: l.period_key })),
    }
  }

  // ── Dev-only: clean test event data ──────────────────────

  cleanTestEvents() {
    const result = { festival: 0, birthday: 0, world: 0, events: 0 }
    this.transaction(() => {
      const types = ['festival', 'birthday', 'world']
      for (const t of types) {
        const info = this.one("SELECT COUNT(*) as cnt FROM letters WHERE letter_type = ?", [t])
        if (info && info.cnt > 0) {
          this.run("DELETE FROM letters WHERE letter_type = ?", [t])
          result[t] = info.cnt
        }
      }
      const evtInfo = this.one("SELECT COUNT(*) as cnt FROM letter_events")
      if (evtInfo && evtInfo.cnt > 0) {
        this.run("DELETE FROM letter_events")
        result.events = evtInfo.cnt
      }
    })
    return result
  }

  // ── Dev-only: mail timeline reset ─────────────────────────
  // Only touches letters + letter_events.
  // Never touches settings, profile, birthday, chronicles, companions, camp, or world progression.

  resetMailTimeline() {
    const before = this.diagnoseMail()
    this.transaction(() => {
      this.run("DELETE FROM letters")
      this.run("DELETE FROM letter_events")
      // Reset scan checkpoints so history is re-scanned, but keep mail_started_at_ms
      this.run("DELETE FROM settings WHERE key IN ('last_daily_period_checked','last_weekly_period_checked')")
    })
    // Rebuild: scan daily/weekly history + generate current festival/birthday
    this.ensurePeriodicLetters()
    this.ensureEventLetters()
    this.ensureBirthdayLetter()
    const after = this.diagnoseMail()
    return { before, after }
  }

  // ── Mail diagnostics ──────────────────────────────────────

  diagnoseMail() {
    const counts = {}
    for (const t of ['daily', 'weekly', 'festival', 'birthday', 'world']) {
      const r = this.one("SELECT COUNT(*) as cnt FROM letters WHERE letter_type = ?", [t])
      counts[t] = r ? r.cnt : 0
    }
    const eventCount = this.one("SELECT COUNT(*) as cnt FROM letter_events")
    const latest = this.one("SELECT MAX(created_at) as ts FROM letters")
    const s = this.getSettings()

    // Orphan detection
    const orphanLetters = this.all(
      "SELECT l.id, l.letter_type, l.period_key FROM letters l WHERE l.letter_type IN ('festival','birthday') AND NOT EXISTS (SELECT 1 FROM letter_events e WHERE e.letter_id = l.id)"
    )
    const orphanEvents = this.all(
      "SELECT e.id, e.event_key FROM letter_events e WHERE e.letter_id IS NULL OR NOT EXISTS (SELECT 1 FROM letters l WHERE l.id = e.letter_id)"
    )

    // Duplicate detection: same letter_type + period_key
    const duplicates = this.all(
      "SELECT letter_type, period_key, COUNT(*) as cnt FROM letters GROUP BY letter_type, period_key HAVING cnt > 1"
    )

    return {
      letters: counts,
      events: eventCount ? eventCount.cnt : 0,
      latestCreatedAt: latest ? latest.ts : null,
      cycle: {
        worldEnteredAtMs: this.worldEnteredAtMs(),
        worldEnteredAtDate: this.worldEnteredAtMs() ? new Date(this.worldEnteredAtMs()).toISOString() : null,
        lastDailyChecked: s.last_daily_period_checked || null,
        lastWeeklyChecked: s.last_weekly_period_checked || null,
      },
      orphanLetters: orphanLetters.length,
      orphanEvents: orphanEvents.length,
      orphanLetterIds: orphanLetters.map(l => l.id),
      orphanEventIds: orphanEvents.map(e => e.id),
      duplicatePeriods: duplicates.length,
      duplicateDetails: duplicates,
    }
  }

  getDashboard() {
    const todayKey = localDateKey()
    const today = dayBounds(todayKey)
    const week = weekBounds(Date.now())
    const structure = this.getStructure()
    return {
      date: todayKey,
      today: this.rangeStats(today.start, today.end),
      week: this.rangeStats(week.start, week.end),
      xp: this.getXpSummary(),
      activeSession: this.getActiveSession(),
      nextTasks: structure.tasks.filter((task) => ['todo', 'doing'].includes(task.status)).slice(0, 6),
      areas: structure.areas,
      achievements: this.getAchievements(),
      settings: this.getSettings(),
      world: this.getWorldState(),
    }
  }

  getContributedTasks(sessionId) {
    return this.all(`SELECT l.task_id, l.selection_order, l.xp_awarded, l.reason, t.title, a.name AS area_name, a.color AS area_color
      FROM session_task_links l
      JOIN tasks t ON t.id = l.task_id
      LEFT JOIN areas a ON a.id = t.area_id
      WHERE l.session_id = ?
      ORDER BY l.selection_order, t.sort_order`, [sessionId])
  }

  getHistory(limit = 80) {
    const sessions = this.all(`SELECT s.*, t.title AS task_title, a.name AS area_name, a.color AS area_color
      FROM focus_sessions s
      LEFT JOIN tasks t ON t.id = s.task_id
      LEFT JOIN areas a ON a.id = s.area_id
      WHERE s.status = 'completed' AND s.active_seconds >= 60
      ORDER BY s.ended_at DESC LIMIT ?`, [Math.max(1, Math.min(Number(limit) || 80, 200))])
    if (!sessions.length) return []
    const ids = sessions.map((s) => `'${s.id}'`).join(',')
    const xpRows = this.all(`SELECT reference_id, SUM(amount) AS xp FROM xp_transactions WHERE reference_type = 'session' AND reference_id IN (${ids}) GROUP BY reference_id`)
    const xpMap = Object.fromEntries(xpRows.map((r) => [r.reference_id, Number(r.xp)]))
    // add completion XP — only for the FIRST session that completed each task
    const completedTaskIds = [...new Set(sessions.filter((s) => s.task_completed && s.task_id).map((s) => s.task_id))]
    if (completedTaskIds.length) {
      const quoted = completedTaskIds.map((id) => `'${id}'`).join(',')
      const taskXpRows = this.all(`SELECT reference_id, amount FROM xp_transactions WHERE reference_type = 'task' AND kind = 'completion' AND reference_id IN (${quoted})`)
      const taskXpByTaskId = Object.fromEntries(taskXpRows.map((r) => [r.reference_id, Number(r.amount)]))
      // find the earliest session that completed each task (by ended_at)
      const firstCompletionSession = new Map()
      for (const session of sessions) {
        if (!session.task_completed || !session.task_id || !taskXpByTaskId[session.task_id]) continue
        const existing = firstCompletionSession.get(session.task_id)
        if (!existing || (session.ended_at && session.ended_at < existing.ended_at)) {
          firstCompletionSession.set(session.task_id, session)
        }
      }
      for (const [taskId, session] of firstCompletionSession) {
        xpMap[session.id] = (xpMap[session.id] || 0) + taskXpByTaskId[taskId]
      }
    }
    return sessions.map((session) => ({ ...session, xp_awarded: xpMap[session.id] || 0, expedition: this.getExpedition(session.id), contributedTasks: this.getContributedTasks(session.id) }))
  }

  saveDailyReview(data) {
    const date = data.date || localDateKey()
    this.run(`INSERT OR REPLACE INTO daily_reviews (review_date, win, blocker, energy, tomorrow_task, ai_json, ai_model, updated_at)
      VALUES (?, ?, ?, ?, ?, COALESCE((SELECT ai_json FROM daily_reviews WHERE review_date = ?), NULL), COALESCE((SELECT ai_model FROM daily_reviews WHERE review_date = ?), NULL), ?)`, [
      date, String(data.win || '').trim(), String(data.blocker || '').trim(), data.energy || null, String(data.tomorrowTask || '').trim(), date, date, Date.now(),
    ])
    const unlocked = this.checkAchievements()
    return { review: this.getDailyReview(date), unlocked }
  }

  getDailyReview(date = localDateKey()) {
    const row = this.one('SELECT * FROM daily_reviews WHERE review_date = ?', [date])
    const { start, end } = dayBounds(date)
    return { date, stats: this.rangeStats(start, end), review: row ? { ...row, ai: row.ai_json ? JSON.parse(row.ai_json) : null } : null }
  }

  getWeeklyReport(date = localDateKey()) {
    const current = weekBounds(new Date(`${date}T12:00:00`).getTime())
    const previous = { start: current.start - 7 * 86400000, end: current.start }
    const stats = this.rangeStats(current.start, current.end)
    const previousStats = this.rangeStats(previous.start, previous.end)
    const reviews = this.all('SELECT * FROM daily_reviews WHERE review_date >= ? AND review_date < ? ORDER BY review_date', [
      localDateKey(current.start), localDateKey(current.end),
    ])
    const tasks = this.all("SELECT title, completed_at FROM tasks WHERE status = 'done' AND completed_at >= ? AND completed_at < ? ORDER BY completed_at", [current.start, current.end])
    const saved = this.one('SELECT * FROM weekly_reports WHERE week_start = ?', [current.key])
    return {
      weekStart: current.key,
      stats,
      previousStats,
      reviews,
      completedTasks: tasks,
      ai: saved?.ai_json ? JSON.parse(saved.ai_json) : null,
      aiModel: saved?.ai_model || null,
    }
  }

  saveAiReport(type, date, report, model) {
    if (type === 'daily') {
      const current = this.getDailyReview(date)
      const review = current.review || {}
      this.run(`INSERT OR REPLACE INTO daily_reviews (review_date, win, blocker, energy, tomorrow_task, ai_json, ai_model, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [date, review.win || '', review.blocker || '', review.energy || null, review.tomorrow_task || '', JSON.stringify(report), model, Date.now()])
    } else {
      const weekly = this.getWeeklyReport(date)
      this.run('INSERT OR REPLACE INTO weekly_reports (week_start, stats_json, ai_json, ai_model, updated_at) VALUES (?, ?, ?, ?, ?)', [
        weekly.weekStart, JSON.stringify(weekly.stats), JSON.stringify(report), model, Date.now(),
      ])
    }
  }

  getAiPayload(type, date) {
    return type === 'daily' ? this.getDailyReview(date) : this.getWeeklyReport(date)
  }

  openDataPath() {
    return this.dataDir
  }

  shouldSendLongNotification() {
    const active = this.getActiveSession()
    if (!active || active.status !== 'running' || active.long_notified || active.active_seconds < 5400) return null
    this.run('UPDATE focus_sessions SET long_notified = 1 WHERE id = ?', [active.id])
    return active
  }
}

module.exports = { StudyDatabase }
