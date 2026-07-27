const ACHIEVEMENTS = [
  { code: 'first_focus', icon: 'spark', title: '第一束光', description: '完成第一次有效专注' },
  { code: 'focus_10h', icon: 'clock', title: '渐入佳境', description: '累计专注 10 小时' },
  { code: 'focus_50h', icon: 'flame', title: '沉浸者', description: '累计专注 50 小时' },
  { code: 'task_10', icon: 'check', title: '行动派', description: '完成 10 个学习事项' },
  { code: 'task_50', icon: 'flag', title: '可靠的完成者', description: '完成 50 个学习事项' },
  { code: 'deep_10', icon: 'mountain', title: '深潜', description: '完成 10 次至少 60 分钟的专注' },
  { code: 'explorer', icon: 'compass', title: '多面探索者', description: '在至少 3 个领域留下专注记录' },
  { code: 'reflection_7', icon: 'book', title: '诚实的镜子', description: '完成 7 次日复盘' },
  { code: 'rhythm_7', icon: 'wave', title: '找到节奏', description: '最近 14 天中有 7 天保持学习' },
]

function focusXp(activeSeconds) {
  if (!Number.isFinite(activeSeconds) || activeSeconds < 60) return 0
  return Math.min(24, Math.floor(activeSeconds / 60 / 5))
}

function completionXp(totalTaskSeconds) {
  const minutes = Math.max(0, Math.floor((Number(totalTaskSeconds) || 0) / 60))
  return 20 + Math.floor(Math.min(minutes, 180) / 2)
}

function levelFromXp(totalXp) {
  let level = 1
  let remaining = Math.max(0, Math.floor(Number(totalXp) || 0))
  let required = 100
  while (remaining >= required) {
    remaining -= required
    level += 1
    required = 100 + 25 * (level - 1)
  }
  return {
    level,
    currentXp: remaining,
    nextLevelXp: required,
    progress: required ? remaining / required : 0,
  }
}

function secondsWithinRange(startedAt, endedAt, rangeStart, rangeEnd) {
  const start = Math.max(Number(startedAt), Number(rangeStart))
  const end = Math.min(Number(endedAt), Number(rangeEnd))
  return Math.max(0, Math.floor((end - start) / 1000))
}

function localDateKey(value = Date.now()) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dayBounds(dateKey = localDateKey()) {
  const start = new Date(`${dateKey}T00:00:00`).getTime()
  const end = new Date(`${dateKey}T00:00:00`).setDate(new Date(`${dateKey}T00:00:00`).getDate() + 1)
  return { start, end }
}

function weekStartKey(value = Date.now()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return localDateKey(date.getTime())
}

function weekBounds(dateOrKey = Date.now()) {
  const value = typeof dateOrKey === 'string' ? new Date(`${dateOrKey}T12:00:00`).getTime() : dateOrKey
  const key = weekStartKey(value)
  const { start } = dayBounds(key)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end: end.getTime(), key }
}

function getReturnKind(activeSeconds) {
  const s = Math.max(0, Number(activeSeconds) || 0)
  if (s < 60) return 'brief'
  if (s < 300) return 'short'
  if (s < 1800) return 'expedition'
  return 'deep'
}

function countSessionTypes(sessions) {
  const counts = { brief: 0, short: 0, expedition: 0, deep: 0 }
  for (const s of sessions) {
    const kind = getReturnKind(Number(s.active_seconds) || 0)
    if (counts[kind] !== undefined) counts[kind]++
  }
  return counts
}

function shouldGenerateDailyLetter(facts) {
  const { sessionCounts = {}, completedTaskCount = 0 } = facts
  const { brief = 0, short = 0, expedition = 0, deep = 0 } = sessionCounts

  if (short > 0 || expedition > 0 || deep > 0) return true

  const hasWrittenReview = typeof facts.hasWrittenReview === 'boolean'
    ? facts.hasWrittenReview
    : false
  const hasOutcome = facts.hasOutcome === true
  const hasWorldEvent = facts.hasWorldEvent === true
  const hasSpecialEvent = facts.hasSpecialEvent === true

  const hasMeaningfulRecord =
    completedTaskCount > 0 ||
    hasWrittenReview ||
    hasOutcome ||
    hasWorldEvent ||
    hasSpecialEvent

  if (hasMeaningfulRecord) return true
  return false
}

function shouldGenerateWeeklyLetter(facts) {
  const { sessionCounts = {}, completedTaskCount = 0 } = facts
  const { short = 0, expedition = 0, deep = 0 } = sessionCounts

  if (short > 0 || expedition > 0 || deep > 0) return true

  const hasMeaningfulRecord =
    completedTaskCount > 0 ||
    facts.hasWrittenReview === true ||
    facts.hasOutcome === true ||
    facts.hasWorldEvent === true ||
    facts.hasSpecialEvent === true

  if (hasMeaningfulRecord) return true
  return false
}

// ── Period utilities ────────────────────────────────────────

function tzInfo(now = Date.now()) {
  const d = new Date(now)
  return {
    timezoneName: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffsetMinutes: -d.getTimezoneOffset(),
  }
}

function getDailyPeriod(now = Date.now()) {
  const key = localDateKey(now)
  const bounds = dayBounds(key)
  return { periodKey: key, periodStart: bounds.start, periodEnd: bounds.end, ...tzInfo(now) }
}

function getWeeklyPeriod(now = Date.now()) {
  const wk = weekBounds(now)
  return { periodKey: wk.key, periodStart: wk.start, periodEnd: wk.end, ...tzInfo(now) }
}

function previousWeeklyPeriod(now = Date.now()) {
  const wk = weekBounds(now)
  const prevStart = wk.start - 7 * 86400000
  return getWeeklyPeriod(prevStart)
}

// ── Simple hash seed ────────────────────────────────────────

function hashSeed(input) {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h) + input.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

// ── Subject generation ──────────────────────────────────────

function formatMd(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function generateLocalLetterSubject(type, facts, seedInput) {
  const periodStart = facts.periodStart || facts.period?.periodStart || Date.now()
  if (type === 'daily') {
    return `${formatMd(periodStart)}的星页`
  }
  // Weekly short: "旅途札记" (date range shown in subtitle)
  return '旅途札记'
}

function generateWeeklyFullTitle(periodStart) {
  const weekEnd = periodStart + 6 * 86400000
  return `${formatMd(periodStart)}—${formatMd(weekEnd)}的旅途札记`
}

function weeklyDeliveryLabel(periodEnd) {
  return `小天使整理于${formatMd(periodEnd)}`
}

// ── Template generation ─────────────────────────────────────

function formatDurationZh(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h} 小时 ${m} 分钟`
  if (m) return `${m} 分 ${sec} 秒`
  return `${sec} 秒`
}

function narrativeDirectionName(direction) {
  const fact = typeof direction === 'object' && direction !== null
    ? direction
    : { name: direction, source: String(direction || '').trim() === '通用学习' ? 'system_default' : 'user_created' }
  const raw = String(fact.name || '').trim()
  if (!raw) return null
  // Only the seeded internal category is translated.  Every name the traveler
  // chose, and every world place, remains part of their own record.
  return fact.source === 'system_default' ? '旧书页间的旅途' : raw
}

function totalDepartures(facts) {
  return Object.values(f(facts, 'sessionCounts') || {}).reduce((sum, count) => sum + (Number(count) || 0), 0)
}

function journeyFromFacts(facts) {
  const stored = facts.journey || {}
  const legacyDirection = (f(facts, 'directionBreakdown') || [])[0]
  const rawDirection = stored.mainDirection ?? legacyDirection?.name ?? null
  return {
    ...stored,
    completedTasks: stored.completedTasks || facts.completedTasks || [],
    discoveries: stored.discoveries || facts.discoveries || [],
    mainDirectionNarrative: stored.mainDirectionNarrative || (rawDirection
      ? { name: rawDirection, source: legacyDirection?.source || (rawDirection === '通用学习' ? 'system_default' : 'user_created') }
      : null),
  }
}

function namedMarks(items, max = 3) {
  return (items || []).map((item) => String(item?.title || item?.name || '').trim()).filter(Boolean).slice(0, max)
}

function marksSentence(marks, noun) {
  if (!marks.length) return null
  const quoted = marks.map((mark) => `「${mark}」`).join('、')
  return marks.length === 1 ? `我在地图边上替你留下一枚${noun}，上面写着${quoted}。` : `我把${quoted}几枚${noun}一并夹进了星页。`
}

function neutralCompare(curr, prev) {
  if (!prev) return '上周暂无记录'
  const diff = curr - prev
  if (diff === 0) return '和上周留下了相近的时间'
  return diff > 0
    ? `比上周多记录了 ${formatDurationZh(Math.abs(diff))}`
    : `比上周少记录了 ${formatDurationZh(Math.abs(diff))}`
}

// ── Narrative templates ──────────────────────────────────────
// Database facts → 小天使 narrative expression.
// 禁止: 数字、统计、数据库字段名（编程/学习/任务/专注等）、报告语言
// 允许: 季节、天气、路标、方向（自然意象）、邮局、小镇、炉火、旅途

// ── 小天使人格 ─────────────────────────────────────────────
// 名字: 没有提过。旅人叫她"小天使"就可以了。
// 工作: 天刚暗下来的时候在邮局整理信件。先按木格排好，
//       再一封一封盖邮戳、封蜡。蜡封的颜色看心情选，
//       偶尔会盖歪——但从来不重新盖。
// 边界: 她整理旅人的真实足迹，不把居民私事、维护细节或未经发生的
//       小镇传闻写进周期来信。
// 语气: 安静、细致。不说"你应该"，只说"我看见了"。
//       不评价，不鼓励。只是告诉旅人: 你走过的路，有人记得。

// ── World vocabulary ────────────────────────────────────────
// 环境: 石板路、松风林、白石河谷、旧望丘陵、灯塔、集市、城门外
// 天气: 晴、细雪、薄雾、微风、蝉鸣、霜降、雨后、晴朗夜空
// 邮局: 木格信匣、蜡封、邮戳、邮袋、窗台的花、柜台上的灯
// 小屋: 壁炉、窗外的路、门廊、行囊、地图、木匣

function weatherNote(season, seed) {
  const notes = {
    '春': ['雨后石板路还有点湿。', '风里带着一点泥土的味道。', '窗外刚下过一阵小雨，空气很干净。'],
    '夏': ['傍晚的风从河谷吹来，带着一点凉意。', '窗外的蝉鸣渐渐小了。', '邮局窗台上的花又开了两朵。'],
    '秋': ['风从旧望丘陵那边吹过来。', '集市那边飘来烤面包的味道。', '傍晚有些凉了，灯点得比平时早。'],
    '冬': ['壁炉里的火烧得很安静。', '窗外飘了一点细雪。', '石板上结了薄薄的霜，踩上去有细碎的声响。'],
  }
  const pool = notes[season] || notes['春']
  return pool[(seed || 0) % pool.length]
}

// ── Lightweight World State ───────────────────────────────────
// Pure function of periodKey. No database. Deterministic.
// Returns structured state → angelDetail renders narrative text.
// Extensible: add NPCs, events, locations via new keys in the state object.

function daysSinceEpoch(periodKey) {
  return Math.floor(new Date(periodKey).getTime() / 86400000)
}

/**
 * getWorldState(periodKey) → structured world snapshot
 *
 * Future extensions (no code changes needed in callers):
 *   state.npcs.oren.lastSeen
 *   state.npcs.lia.mapProgress
 *   state.locations.pinewood.rumors
 *   state.activeEvents.push({ type: 'merchant_arrival', daysRemaining: 3 })
 *   state.weather.today / state.weather.tomorrow
 */
function getWorldState(periodKey) {
  const days = daysSinceEpoch(periodKey)
  const d = new Date(days * 86400000)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const season = seasonForDate(d)

  // ── Locations ───────────────────────────────────────────
  const windowCycle = days % 120
  let windowPhase
  if (windowCycle < 10)       windowPhase = 'intact'
  else if (windowCycle < 14)  windowPhase = 'creaking'
  else if (windowCycle < 16)  windowPhase = 'ada_coming'
  else if (windowCycle < 20)  windowPhase = 'fixed'
  else                        windowPhase = 'intact'

  const postOfficeDecorated = (month === 11 && day >= 7 && day <= 16)
  const isFestivalStart = (month === 11 && day === 7)
  const isFestivalClimax = (month === 11 && day === 16)

  // ── Flora ───────────────────────────────────────────────
  let flowerPhase
  if (month >= 10 || month <= 2) {
    flowerPhase = 'dormant'
  } else {
    const flowerCycle = days % 180
    if (flowerCycle < 20)       flowerPhase = 'sprouting'
    else if (flowerCycle < 45)  flowerPhase = 'growing'
    else if (flowerCycle < 100) flowerPhase = 'blooming'
    else if (flowerCycle < 120) flowerPhase = 'wilting'
    else                        flowerPhase = 'sprouting' // cycle restarts
  }

  // ── NPCs ────────────────────────────────────────────────
  const adaDaysSince = windowCycle < 20 ? (windowCycle >= 16 ? days % 4 : 0) : 999
  const npcs = {
    ada: {
      status: windowCycle >= 14 && windowCycle < 20 ? 'visiting' : 'idle',
      lastInteractionDaysAgo: adaDaysSince,
    },
  }

  // ── Visitors ────────────────────────────────────────────
  const visitorCycle = days % 45
  let visitor
  if (visitorCycle === 10)      visitor = { type: 'traveler', detail: 'traveler_at_door' }
  else if (visitorCycle === 25) visitor = { type: 'cat', detail: 'cat_on_cobblestone' }
  else if (visitorCycle === 38) visitor = { type: 'caravan', detail: 'caravan_asking_directions' }
  else                          visitor = null

  // ── Active events (extensible) ──────────────────────────
  const activeEvents = []
  if (postOfficeDecorated) {
    activeEvents.push({
      type: 'returning_lights',
      phase: isFestivalStart ? 'start' : isFestivalClimax ? 'climax' : 'ongoing',
    })
  }

  return {
    days,
    season,
    locations: {
      postOffice: { windowPhase, decorated: postOfficeDecorated },
    },
    flora: { flowerPhase },
    npcs,
    visitor,
    activeEvents,
  }
}

// ── World state → narrative text ──────────────────────────────

function worldStateDetail(state, seed) {
  const pool = []

  // Window
  const winTexts = {
    intact:     '窗框很安静。自从上次修好之后就一直好好的。',
    creaking:   '窗框今天又吱了一声。不太响，就是风从河谷吹过来的时候。',
    ada_coming: '艾达说这两天过来看看窗框。她上次说木头干了就会响，不是坏了。',
    fixed:      '艾达今天来把窗框紧了一下。她说螺丝有点松，现在没事了。',
  }
  if (winTexts[state.locations.postOffice.windowPhase]) {
    pool.push(winTexts[state.locations.postOffice.windowPhase])
  }

  // Flower
  const flowerTexts = {
    dormant:   '窗台上的花在过冬。枝干还在，只是没有叶子。莉娅说春天会再开的。',
    sprouting: '花盆里冒出了一点新芽。去年莉娅留下的那株，又活过来了。',
    growing:   '花茎长高了不少。叶子也比上周多了几片。',
    blooming:  seed % 2 === 0
      ? '窗台上的花开了一朵。颜色比去年那朵浅一点。'
      : '花还在开着。有一片花瓣落在了窗台上，我没舍得扫。',
    wilting:   '花开始谢了。花瓣一片一片落在花盆边上。',
  }
  if (state.flora.flowerPhase !== 'dormant' || seed % 4 === 0) {
    pool.push(flowerTexts[state.flora.flowerPhase] || '')
  }

  // Festival
  if (state.locations.postOffice.decorated) {
    const evt = state.activeEvents.find(e => e.type === 'returning_lights')
    if (evt?.phase === 'start')  pool.push('今天镇上开始挂灯了。我在邮局门口也挂了一盏小的。节期开始了。')
    else if (evt?.phase === 'climax') pool.push('今晚是归灯夜。从窗边能看到广场上的大提灯。很安静，也很亮。')
    else pool.push('外面的灯还亮着。节期还没结束。邮局里也比平时暖和一点。')
  }

  // Visitor
  if (state.visitor) {
    const vTexts = {
      traveler_at_door: '今天有个旅人在邮局门口站了很久，看了看地图，又往松风林的方向走了。',
      cat_on_cobblestone: '楼下石板路上有猫走过，影子从窗边晃了一下。不是第一次了。',
      caravan_asking_directions: '从河谷那边来了几个商队的人。他们问起旧望丘陵的路，我给他们指了方向。',
    }
    pool.push(vTexts[state.visitor.detail] || '')
  }

  // Mailbag on Mondays
  if (new Date(state.days * 86400000).getDay() === 1) {
    pool.push('邮袋今天特别沉。周末积了不少信，我拖了好一段才拖到柜台上。')
  }

  // Always-available
  pool.push('今天邮戳差点盖歪了，不过我觉得歪一点也挺好的。')
  pool.push('蜡封用的是今天新熔的那块，颜色很深。')

  return pool[(seed || 0) % pool.length]
}

function angelDetail(periodKey, seed) {
  const state = getWorldState(periodKey)
  const text = worldStateDetail(state, seed)
  // Occasionally add light character moment
  if (seed % 3 === 0) {
    return text + '奥伦路过的时候朝邮局里看了一眼。他说灯还亮着，就知道我还没走。'
  }
  return text
}

// ── Daily letter (50–100字) ──────────────────────────────────

function dailyNoSessionLines(seed) {
  const lines = [
    '今天安安静静的。我在邮局擦了一遍你的木格。明天见。',
    '今天没有走远，但傍晚的时候我还是把你的信匣打开了——万一呢。明天见。',
    '这一小段路很短。不过行囊放在门廊上，看起来也像在等明天。',
  ]
  return lines[seed % lines.length]
}

const DAILY_POOL = [
  '今天有好几个路标。石板路走到尽头的时候，城门已经亮起了灯。',
  '今天在地图上添了几笔。我对着灯光看了很久——这条路越来越像你的了。',
  '今天的路走得很远。我整理邮袋的时候，特地把你的信匣摆正了一点。',
  '回来的时候壁炉已经生好了。今天路上的事，我都帮你记下了。',
  '我在窗边坐了一会儿，看着城门的方向。今天又走了不少路吧。',
  '今天给这封信盖邮戳的时候，蜡封的颜色很配窗外的天色。',
  '柜台上那盏灯一直亮着。我把今天收进木匣的时候，钟刚好敲了一下。',
  '集市那边今天很热闹，但你还是没有绕路。一直走到了要去的地方。',
  '今天走过的地方，有一些我没见过的路标。地图越来越丰富了。',
  '邮局今天来了几个远方的人，但他们要找的不是这里。我继续整理你的信札。',
]

// Backward-compat: facts may be v1 (flat) or v2 (nested under .stats)
function f(facts, key) { return facts.stats?.[key] ?? facts[key] }

function generateDailyTemplate(facts, seedInput) {
  const seed = hashSeed(seedInput)
  const hasSession = (f(facts, 'totalActiveSeconds') || 0) > 0
  const journey = journeyFromFacts(facts)
  const observatory = facts.observatory || {}
  const chronicle = facts.chronicle || {}
  const season = chronicle.season || seasonForDate(new Date((facts.periodStart || facts.period?.periodStart || Date.now())))
  const departures = totalDepartures(facts)
  const direction = narrativeDirectionName(journey.mainDirectionNarrative)
  const taskMarks = namedMarks(journey.completedTasks)
  const discoveries = namedMarks(chronicle.newDiscoveries || journey.discoveries, 2)
  const hasJourneyRecord = hasSession || taskMarks.length > 0 || discoveries.length > 0

  if (!hasJourneyRecord && f(facts, 'hasWrittenReview')) {
    return '天文台留下了一句话。今天有一段记录被收好。'
  }
  if (!hasJourneyRecord) {
    return dailyNoSessionLines(seed)
  }

  const parts = []
  if (departures > 0) parts.push(`今天你一共踏上了${departures}次出征，来路都落在地图上。`)
  if (direction) parts.push(`今天的旅途主要朝着${direction}延伸。`)
  const taskSentence = marksSentence(taskMarks, '路标')
  if (taskSentence) parts.push(taskSentence)
  else parts.push('今天留下的足迹，我已经按着来路收进星页里。')
  if (observatory.hasWrittenReview) parts.push('天文台旁还留着你写下的一句话，我也一并夹进了信札。')
  else parts.push('天文台把这段来路安静地记在了今日的星页上。')
    if (discoveries.length) parts.push(`${season}天的冒险日志收下了新的发现：${discoveries.map((name) => `「${name}」`).join('、')}。`)
  else parts.push(`${season}天的这一页，我已经和今日的足迹放在一起。`)
  parts.push(weatherNote(season, seed))
  parts.push('我把今天的记录收进木格里了。')
  return parts.join('')
}

// ── Weekly letter (100–200字) ────────────────────────────────

const WEEKLY_OPENINGS = [
  '七天过去了。我把这一周的信札从木格里拿出来，按日期排好。',
  '一周的旅途札记收在这里。今晚邮局的灯点得很晚。',
  '这一周走了不少路。我把地图铺在柜台上，灯油快烧完的时候才看完。',
  '今天傍晚邮局的钟敲了七下。我坐下来整理这些的时候，外面已经安静了。',
]

const WEEKLY_FIRST = [
  '这是第一封旅途札记。地图上的路才刚刚开始，但已经可以辨认出方向了。',
  '第一次替你收好这一周的旅途札记。邮袋拖过来的时候差点绊了一下，不过信纸都没有弄皱。',
]

const WEEKLY_LONGER = [
  '比上周走得更远了一些。你的木格比上周又沉了一点。',
  '路比上周长了不少。我在整理札记的时候，多翻了几页才记完。',
]

const WEEKLY_SHORTER = [
  '这周走的路比上周短些。不过每一段我都记得很清楚。',
  '路比上周短了一点。起风的时候走慢些，看到的反而更多。',
]

const WEEKLY_SAME = [
  '和上周的节奏差不多。路上的风景却不太一样。',
  '和上周走了差不多的路。但方向好像偏了一点——也许是风的关系。',
]

const WEEKLY_CLOSINGS = [
  '我把这些收进了木匣。下周这个时候，邮局的灯还会亮着。',
    '冒险日志又添了一页。我把这一周的信札放好，下周见。',
  '愿新的一周路上有风，炉火不熄。',
  '邮局的灯还亮着，你的木格也还空着一格——留给下周。',
]

function generateWeeklyTemplate(facts, seedInput) {
  const seed = hashSeed(seedInput)
  const totalSec = f(facts, 'totalActiveSeconds') || 0
  const prevSec = f(facts, 'previousPeriodTotalSeconds') || 0
  const hasPrevWeek = prevSec > 0
  const diff = totalSec - prevSec
  const journey = journeyFromFacts(facts)
  const observatory = facts.observatory || {}
  const chronicle = facts.chronicle || {}
  const season = chronicle.season || seasonForDate(new Date((facts.periodStart || facts.period?.periodStart || Date.now())))
  const departures = totalDepartures(facts)
  const direction = narrativeDirectionName(journey.mainDirectionNarrative)
  const taskMarks = namedMarks(journey.completedTasks)
  const discoveries = namedMarks(chronicle.newDiscoveries || journey.discoveries, 3)
  const parts = []

  parts.push(WEEKLY_OPENINGS[seed % WEEKLY_OPENINGS.length])
  if (departures > 0) parts.push(`这七天里，你一共踏上了${departures}次出征；每一段来路都收在这份札记里。`)
  if (direction) parts.push(`这周的路大多向${direction}那边伸去。`)
  const taskSentence = marksSentence(taskMarks, '代表性的路标')
  if (taskSentence) parts.push(taskSentence)
  else parts.push('这一周留下的路标，我都按日期夹在札记里。')
  if (observatory.weeklyNote) parts.push(`整理木格时，我也发现了一句你留下的话：「${observatory.weeklyNote}」`)

  if (!hasPrevWeek) {
    parts.push(WEEKLY_FIRST[seed % WEEKLY_FIRST.length])
  } else if (diff > 1800) {
    parts.push(WEEKLY_LONGER[seed % WEEKLY_LONGER.length])
  } else if (diff < -1800) {
    parts.push(WEEKLY_SHORTER[seed % WEEKLY_SHORTER.length])
  } else {
    parts.push(WEEKLY_SAME[seed % WEEKLY_SAME.length])
  }

    if (discoveries.length) parts.push(`${season}天的冒险日志这一页添进了新的发现：${discoveries.map((name) => `「${name}」`).join('、')}。`)
    else parts.push(`${season}天的冒险日志把这一周的来路收好了。`)
  if (seed % 4 === 0) parts.push(weatherNote(season, seed))

  parts.push(WEEKLY_CLOSINGS[seed % WEEKLY_CLOSINGS.length])

  return parts.join('')
}

// ── Facts builders ──────────────────────────────────────────

function buildJourneyFacts(stats) {
  const directions = (stats.directionBreakdown || []).map(d => ({
    id: d.id || null,
    name: d.name,
    source: d.source || (d.name === '通用学习' ? 'system_default' : 'user_created'),
    seconds: d.seconds,
  }))
  const mainDirection = directions[0] || null
  return {
    completedTasks: (stats.completedTasks || []).map(t => ({ title: t.title })),
    discoveries: (stats.discoveries || []).map(d => ({ name: d.name, kind: d.kind })),
    mainDirection: mainDirection?.name || null,
    mainDirectionNarrative: mainDirection ? { name: mainDirection.name, source: mainDirection.source } : null,
    hasOutcome: stats.hasOutcome === true,
  }
}

function buildChronicleFacts(stats, period) {
  return {
    season: seasonForDate(new Date(period.periodStart)),
    newDiscoveries: (stats.discoveries || []).map(d => ({ name: d.name, kind: d.kind })),
  }
}

function buildDailyLetterFacts(stats, period) {
  return {
    schemaVersion: 3,
    letterType: 'daily',
    period: {
      periodKey: period.periodKey,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      timezoneName: period.timezoneName,
      timezoneOffsetMinutes: period.timezoneOffsetMinutes,
    },
    stats: {
      totalActiveSeconds: stats.totalActiveSeconds,
      sessionCounts: stats.sessionCounts,
      completedTaskCount: (stats.completedTasks || []).length,
      longestSessionSeconds: stats.longestSessionSeconds || 0,
      directionBreakdown: (stats.directionBreakdown || []).map(d => ({ id: d.id || null, name: d.name, source: d.source || (d.name === '通用学习' ? 'system_default' : 'user_created'), seconds: d.seconds })),
    },
    journey: buildJourneyFacts(stats),
    observatory: {
      hasWrittenReview: stats.hasWrittenReview === true,
    },
    chronicle: buildChronicleFacts(stats, period),
    memory: {
      // populated later when annual/retrospective letters are generated
    },
  }
}

function seasonForDate(d) {
  const m = d.getMonth() + 1
  if (m >= 3 && m <= 5) return '春'
  if (m >= 6 && m <= 8) return '夏'
  if (m >= 9 && m <= 11) return '秋'
  return '冬'
}

function buildWeeklyLetterFacts(stats, period, prevTotal) {
  return {
    schemaVersion: 3,
    letterType: 'weekly',
    period: {
      periodKey: period.periodKey,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      timezoneName: period.timezoneName,
      timezoneOffsetMinutes: period.timezoneOffsetMinutes,
    },
    stats: {
      totalActiveSeconds: stats.totalActiveSeconds,
      dailyActiveSeconds: stats.dailyActiveSeconds || [0, 0, 0, 0, 0, 0, 0],
      sessionCounts: stats.sessionCounts,
      completedTaskCount: (stats.completedTasks || []).length,
      longestSessionSeconds: stats.longestSessionSeconds || 0,
      directionBreakdown: (stats.directionBreakdown || []).map(d => ({ id: d.id || null, name: d.name, source: d.source || (d.name === '通用学习' ? 'system_default' : 'user_created'), seconds: d.seconds })),
      previousPeriodTotalSeconds: prevTotal || 0,
    },
    journey: buildJourneyFacts(stats),
    observatory: {
      hasWrittenReview: stats.hasWrittenReview === true,
      weeklyNote: stats.weeklyObservatoryNote || null,
    },
    chronicle: buildChronicleFacts(stats, period),
    memory: {},
  }
}

// ── Daily stats helper (database.cjs consumer) ──────────────

function buildDailyStatsForFacts(db, period) {
  const stats = db.getCompletedStats(period.periodStart, period.periodEnd)
  const completedTasks = db.all(
    "SELECT id, title FROM tasks WHERE status = 'done' AND completed_at >= ? AND completed_at < ?",
    [period.periodStart, period.periodEnd],
  )
  const review = db.one('SELECT win, blocker, tomorrow_task, energy FROM daily_reviews WHERE review_date = ?', [period.periodKey])
  const hasWrittenReview = review
    ? Boolean(String(review.win || '').trim() || String(review.blocker || '').trim() || String(review.tomorrow_task || '').trim())
    : false
  const hasOutcome = db.one(
    "SELECT COUNT(*) AS count FROM focus_sessions WHERE status = 'completed' AND ended_at >= ? AND ended_at < ? AND outcome IS NOT NULL AND outcome != '' AND TRIM(outcome) != ''",
    [period.periodStart, period.periodEnd],
  ).count > 0
  const discoveries = db.all(`SELECT d.kind, COALESCE(r.name, n.name) AS name
    FROM discoveries d
    LEFT JOIN world_regions r ON d.kind = 'region' AND r.id = d.target_id
    LEFT JOIN world_nodes n ON d.kind = 'node' AND n.id = d.target_id
    WHERE d.created_at >= ? AND d.created_at < ? AND COALESCE(r.name, n.name) IS NOT NULL
    ORDER BY d.created_at ASC LIMIT 5`, [period.periodStart, period.periodEnd])
  return { ...stats, periodKey: period.periodKey, periodStart: period.periodStart, completedTasks, discoveries, hasWrittenReview, hasOutcome }
}

function buildWeeklyStatsForFacts(db, period) {
  const stats = db.getCompletedStats(period.periodStart, period.periodEnd)
  const dailyActiveSeconds = []
  for (let i = 0; i < 7; i++) {
    const dayStart = period.periodStart + i * 86400000
    const dayEnd = dayStart + 86400000
    const dayStats = db.getCompletedStats(dayStart, dayEnd)
    dailyActiveSeconds.push(dayStats.totalActiveSeconds)
  }
  const completedTasks = db.all(
    "SELECT id, title FROM tasks WHERE status = 'done' AND completed_at >= ? AND completed_at < ?",
    [period.periodStart, period.periodEnd],
  )
  const review = db.one(
    "SELECT COUNT(*) AS count FROM daily_reviews WHERE review_date >= ? AND review_date < ? AND (TRIM(COALESCE(win,'')) != '' OR TRIM(COALESCE(blocker,'')) != '' OR TRIM(COALESCE(tomorrow_task,'')) != '')",
    [localDateKey(period.periodStart), localDateKey(period.periodEnd - 86400000)],
  )
  const weeklyReviews = db.all(`SELECT win, blocker, tomorrow_task FROM daily_reviews
    WHERE review_date >= ? AND review_date < ?
    ORDER BY review_date DESC`, [localDateKey(period.periodStart), localDateKey(period.periodEnd - 86400000)])
  const weeklyObservatoryNote = weeklyReviews
    .flatMap((item) => [item.win, item.blocker, item.tomorrow_task])
    .map((item) => String(item || '').trim())
    .find(Boolean) || null
  const hasOutcome = db.one(
    "SELECT COUNT(*) AS count FROM focus_sessions WHERE status = 'completed' AND ended_at >= ? AND ended_at < ? AND outcome IS NOT NULL AND outcome != '' AND TRIM(outcome) != ''",
    [period.periodStart, period.periodEnd],
  ).count > 0
  const discoveries = db.all(`SELECT d.kind, COALESCE(r.name, n.name) AS name
    FROM discoveries d
    LEFT JOIN world_regions r ON d.kind = 'region' AND r.id = d.target_id
    LEFT JOIN world_nodes n ON d.kind = 'node' AND n.id = d.target_id
    WHERE d.created_at >= ? AND d.created_at < ? AND COALESCE(r.name, n.name) IS NOT NULL
    ORDER BY d.created_at ASC LIMIT 8`, [period.periodStart, period.periodEnd])
  return { ...stats, periodKey: period.periodKey, periodStart: period.periodStart, dailyActiveSeconds, completedTasks, discoveries, weeklyObservatoryNote, hasWrittenReview: review ? review.count > 0 : false, hasOutcome }
}

const TIME_WINDOWS = [
  { label: '深夜', hours: [0, 1, 2, 3, 4, 5] },
  { label: '清晨', hours: [6, 7, 8] },
  { label: '上午', hours: [9, 10, 11] },
  { label: '午后', hours: [12, 13, 14, 15, 16, 17] },
  { label: '晚间', hours: [18, 19, 20, 21, 22, 23] },
]

// ── Festival system ──────────────────────────────────────────

const FESTIVALS = {
  returning_lights: {
    name: '归灯节',
    month: 11, day: 7,
    durationDays: 10,
    finaleDay: 10,
    firstYear: 2025,
    letters: [
      { day: 1,  subtype: 'opening', subject: '灯火初燃' },
      { day: 5,  subtype: 'midway',  subject: '旧灯回响' },
      { day: 10, subtype: 'climax',  subject: '归灯夜' },
    ],
  },
}

/** Compute the UTC timestamp for a festival letter node */
function festivalDate(festival, year, dayInFestival) {
  const d = new Date(year, festival.month - 1, festival.day + dayInFestival - 1)
  d.setHours(12, 0, 0, 0)
  return d.getTime()
}

/** Return active festival letter nodes that should fire on or before `now`.
 *  `mailStartedMs` (optional) — if set, skip festival years before the player joined. */
function getActiveFestivalNodes(now, mailStartedMs) {
  const nodes = []
  const playerStartYear = mailStartedMs ? new Date(mailStartedMs).getFullYear() : 0
  for (const [key, f] of Object.entries(FESTIVALS)) {
    const startYear = Math.max(f.firstYear, playerStartYear || f.firstYear)
    const currentYear = new Date(now).getFullYear()
    for (let year = startYear; year <= currentYear; year++) {
      for (const ld of f.letters) {
        const ts = festivalDate(f, year, ld.day)
        if (ts <= now && (!mailStartedMs || ts >= mailStartedMs)) {
          nodes.push({
            eventType: 'festival',
            eventKey: `${key}:${year}:${ld.subtype}`,
            festivalKey: key,
            year,
            day: ld.day,
            subtype: ld.subtype,
            subject: ld.subject,
            timestamp: ts,
            periodStart: ts,
            periodEnd: ts + 86400000,
          })
        }
      }
    }
  }
  return nodes
}

/** Build a simple festival letter fact object */
function buildFestivalFacts(node) {
  return {
    schemaVersion: 1,
    periodType: 'festival',
    festivalKey: node.festivalKey,
    year: node.year,
    day: node.day,
    subtype: node.subtype,
    totalActiveSeconds: 0,
    sessionCounts: { brief: 0, short: 0, expedition: 0, deep: 0 },
    completedTaskCount: 0,
  }
}

const FESTIVAL_TEMPLATES = {
  returning_lights_opening:
    '归灯节到了。从今天开始，镇上的灯会一盏接一盏亮起来。' +
    '无论你此刻走到了哪里，这些灯都会一直等到归灯夜。' +
    '这几天不必急着赶路。节期里的每一盏灯，都是为了仍在路上的人。',
  returning_lights_midway:
    '归灯节已经过半。街角的提灯越聚越多，旧灯和新灯混在一起，' +
    '照亮了同一条石板路。' +
    '走过了这么多天，无论完成了多少，每一小段路都已经被记下。',
  returning_lights_climax:
    '今晚是归灯夜。每一扇窗都为仍在远方的人亮着灯。' +
    '镇上的居民聚在广场上，把最大的提灯挂在钟楼旁。' +
    '这些灯火不会问你走了多远、完成了多少——它们只是亮着。' +
    '等你想回来的时候，它们就在这里。',
}

function generateFestivalTemplate(subtype) {
  const key = `returning_lights_${subtype}`
  return FESTIVAL_TEMPLATES[key] || '归灯节的一封信。'
}

// ── Birthday system ──────────────────────────────────────────

function birthdayPeriod(year, month, day) {
  const d = new Date(year, month - 1, day, 12, 0, 0, 0)
  return {
    periodKey: `birthday:${year}`,
    periodStart: d.getTime(),
    periodEnd: d.getTime() + 86400000,
    timezoneName: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
  }
}

function generateBirthdayTemplate() {
  return '生日快乐。这是你在小镇度过的又一年。' +
    '今天广场上的面包房烤了一炉蜂蜜蛋糕。' +
    '无论你今天有没有出门远征，这份祝福都已经是你的了。' +
    '又长大了一岁，希望你在这里的每一天都像现在这样，走在自己的路上。'
}

module.exports = {
  ACHIEVEMENTS,
  FESTIVALS,
  focusXp,
  completionXp,
  levelFromXp,
  secondsWithinRange,
  localDateKey,
  dayBounds,
  weekStartKey,
  weekBounds,
  getReturnKind,
  countSessionTypes,
  shouldGenerateDailyLetter,
  shouldGenerateWeeklyLetter,
  getDailyPeriod,
  getWeeklyPeriod,
  previousWeeklyPeriod,
  hashSeed,
  generateLocalLetterSubject,
  narrativeDirectionName,
  generateWeeklyFullTitle,
  weeklyDeliveryLabel,
  generateDailyTemplate,
  generateWeeklyTemplate,
  buildDailyLetterFacts,
  buildWeeklyLetterFacts,
  buildDailyStatsForFacts,
  buildWeeklyStatsForFacts,
  formatDurationZh,
  neutralCompare,
  computeDailyHourly,
  computeWeeklyHeatmap,
  getDominantTimeWindow,
  tzInfo,
  getActiveFestivalNodes,
  buildFestivalFacts,
  getWorldState,
  worldStateDetail,
  generateFestivalTemplate,
  birthdayPeriod,
  generateBirthdayTemplate,
}

function getDominantTimeWindow(hourlyData) {
  if (!hourlyData || hourlyData.length !== 24) return null
  const sums = TIME_WINDOWS.map(w => ({
    label: w.label,
    total: w.hours.reduce((s, h) => s + (hourlyData[h] || 0), 0),
  }))
  const max = sums.reduce((m, w) => Math.max(m, w.total), 0)
  if (max === 0) return null
  return sums.find(w => w.total === max) || null
}

function computeDailyHourly(db, period) {
  const intervals = db.all(
    `SELECT i.started_at, i.ended_at FROM focus_intervals i
     JOIN focus_sessions s ON s.id = i.session_id
     WHERE s.status = 'completed' AND s.ended_at >= ? AND s.ended_at < ?`,
    [period.periodStart, period.periodEnd],
  )
  if (typeof process !== 'undefined' && process.env?.VITE_DEV_SERVER_URL) {
    console.log('[domain:computeDailyHourly]', { periodKey: period.periodKey, intervalCount: intervals.length, periodStart: new Date(period.periodStart).toISOString(), periodEnd: new Date(period.periodEnd).toISOString() })
  }
  const hourly = new Array(24).fill(0)
  for (const iv of intervals) {
    const cursor = Math.max(new Date(iv.started_at).getTime(), period.periodStart)
    const end = Math.min(iv.ended_at || Date.now(), period.periodEnd)
    let t = cursor
    while (t < end) {
      const d = new Date(t)
      const hourStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime()
      const hourEnd = hourStart + 3600000
      const overlap = Math.min(end, hourEnd) - Math.max(t, hourStart)
      if (overlap > 0) hourly[d.getHours()] += Math.round(overlap / 1000)
      t = hourEnd
    }
  }
  // Zero out future hours when viewing today
  const todayStart = dayBounds(localDateKey()).start
  if (period.periodStart >= todayStart) {
    const nowHour = new Date().getHours()
    for (let h = nowHour + 1; h < 24; h++) hourly[h] = 0
  }
  return hourly
}

function computeWeeklyHeatmap(db, period) {
  const matrix = []
  for (let day = 0; day < 7; day++) {
    const dayStart = period.periodStart + day * 86400000
    const dayEnd = dayStart + 86400000
    matrix.push(computeDailyHourly(db, { periodStart: dayStart, periodEnd: dayEnd }))
  }
  return matrix
}
