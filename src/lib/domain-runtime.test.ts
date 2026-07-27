import { describe, expect, it } from 'vitest'
// @ts-expect-error The Electron domain module is CommonJS and intentionally shared with tests.
import domain from '../../electron/domain.cjs'

const { focusXp, completionXp, levelFromXp, secondsWithinRange, getReturnKind, countSessionTypes, shouldGenerateDailyLetter, shouldGenerateWeeklyLetter, getDailyPeriod, getWeeklyPeriod, generateLocalLetterSubject, narrativeDirectionName, generateWeeklyFullTitle, weeklyDeliveryLabel, generateDailyTemplate, generateWeeklyTemplate, buildDailyLetterFacts, buildWeeklyLetterFacts, hashSeed, formatDurationZh, neutralCompare, getActiveFestivalNodes, buildFestivalFacts, generateFestivalTemplate, birthdayPeriod, generateBirthdayTemplate, getWorldState } = domain

describe('experience and time rules', () => {
  it('keeps focus rewards bounded and completion rewards dominant', () => {
    expect(focusXp(59)).toBe(0)
    expect(focusXp(90 * 60)).toBe(18)
    expect(focusXp(240 * 60)).toBe(24)
    expect(completionXp(0)).toBe(20)
    expect(completionXp(300 * 60)).toBe(110)
  })

  it('uses a progressive level curve', () => {
    expect(levelFromXp(100)).toMatchObject({ level: 2, currentXp: 0, nextLevelXp: 125 })
    expect(levelFromXp(240)).toMatchObject({ level: 3, currentXp: 15, nextLevelXp: 150 })
  })

  it('counts only interval overlap in reports', () => {
    expect(secondsWithinRange(1_000, 11_000, 6_000, 20_000)).toBe(5)
    expect(secondsWithinRange(1_000, 4_000, 6_000, 20_000)).toBe(0)
  })
})

describe('getReturnKind', () => {
  it('maps seconds to the correct bucket', () => {
    expect(getReturnKind(0)).toBe('brief')
    expect(getReturnKind(59)).toBe('brief')
    expect(getReturnKind(60)).toBe('short')
    expect(getReturnKind(299)).toBe('short')
    expect(getReturnKind(300)).toBe('expedition')
    expect(getReturnKind(1799)).toBe('expedition')
    expect(getReturnKind(1800)).toBe('deep')
  })
})

describe('countSessionTypes', () => {
  it('groups sessions by return kind', () => {
    const sessions = [
      { active_seconds: 0 },
      { active_seconds: 30 },
      { active_seconds: 120 },
      { active_seconds: 600 },
      { active_seconds: 3600 },
    ]
    const counts = countSessionTypes(sessions)
    expect(counts).toEqual({ brief: 2, short: 1, expedition: 1, deep: 1 })
  })
})

describe('shouldGenerateDailyLetter', () => {
  it('empty facts -> false', () => {
    expect(shouldGenerateDailyLetter({ sessionCounts: {}, completedTaskCount: 0 })).toBe(false)
  })

  it('short or longer -> true', () => {
    expect(shouldGenerateDailyLetter({ sessionCounts: { short: 1 } })).toBe(true)
    expect(shouldGenerateDailyLetter({ sessionCounts: { expedition: 1 } })).toBe(true)
    expect(shouldGenerateDailyLetter({ sessionCounts: { deep: 1 } })).toBe(true)
  })

  it('no session + completedTask > 0 -> true', () => {
    expect(shouldGenerateDailyLetter({ sessionCounts: {}, completedTaskCount: 1 })).toBe(true)
  })

  it('no session + hasWrittenReview -> true', () => {
    expect(shouldGenerateDailyLetter({ sessionCounts: {}, hasWrittenReview: true })).toBe(true)
  })

  it('no session + energy only -> false', () => {
    expect(shouldGenerateDailyLetter({ sessionCounts: {}, hasWrittenReview: false })).toBe(false)
  })

  it('brief + empty outcome -> false', () => {
    expect(shouldGenerateDailyLetter({ sessionCounts: { brief: 1 }, hasOutcome: false })).toBe(false)
  })

  it('brief + valid outcome -> true', () => {
    expect(shouldGenerateDailyLetter({ sessionCounts: { brief: 1 }, hasOutcome: true })).toBe(true)
  })

  it('no session + hasOutcome -> true', () => {
    expect(shouldGenerateDailyLetter({ sessionCounts: {}, hasOutcome: true })).toBe(true)
  })

  it('hasWorldEvent / hasSpecialEvent -> true', () => {
    expect(shouldGenerateDailyLetter({ sessionCounts: {}, hasWorldEvent: true })).toBe(true)
    expect(shouldGenerateDailyLetter({ sessionCounts: {}, hasSpecialEvent: true })).toBe(true)
  })
})

describe('shouldGenerateWeeklyLetter', () => {
  it('empty -> false', () => {
    expect(shouldGenerateWeeklyLetter({ sessionCounts: {} })).toBe(false)
  })

  it('short or longer -> true', () => {
    expect(shouldGenerateWeeklyLetter({ sessionCounts: { short: 1 } })).toBe(true)
    expect(shouldGenerateWeeklyLetter({ sessionCounts: { expedition: 1 } })).toBe(true)
    expect(shouldGenerateWeeklyLetter({ sessionCounts: { deep: 1 } })).toBe(true)
  })

  it('week of only empty brief -> false', () => {
    expect(shouldGenerateWeeklyLetter({ sessionCounts: { brief: 3 } })).toBe(false)
  })

  it('only brief but completedTask -> true', () => {
    expect(shouldGenerateWeeklyLetter({ sessionCounts: { brief: 1 }, completedTaskCount: 2 })).toBe(true)
  })

  it('only brief but hasWrittenReview -> true', () => {
    expect(shouldGenerateWeeklyLetter({ sessionCounts: { brief: 1 }, hasWrittenReview: true })).toBe(true)
  })

  it('only brief but hasOutcome -> true', () => {
    expect(shouldGenerateWeeklyLetter({ sessionCounts: { brief: 1 }, hasOutcome: true })).toBe(true)
  })

  it('only brief but hasSpecialEvent -> true', () => {
    expect(shouldGenerateWeeklyLetter({ sessionCounts: { brief: 1 }, hasSpecialEvent: true })).toBe(true)
  })
})

describe('period utilities', () => {
  it('daily period returns local day boundaries', () => {
    const p = getDailyPeriod(Date.UTC(2026, 6, 20, 14, 0, 0))
    expect(p.periodKey).toBeTruthy()
    expect(p.periodStart).toBeLessThan(p.periodEnd)
    expect(p.periodEnd - p.periodStart).toBe(86400000)
    expect(p.timezoneName).toBeTruthy()
    expect(typeof p.timezoneOffsetMinutes).toBe('number')
  })

  it('weekly period uses Monday start', () => {
    const p = getWeeklyPeriod(Date.UTC(2026, 6, 20, 14, 0, 0))
    expect(p.periodKey).toBeTruthy()
    expect(p.periodEnd - p.periodStart).toBe(7 * 86400000)
    // Key should be a Monday
    const d = new Date(p.periodStart)
    expect(d.getDay()).toBe(1) // Monday (local time)
  })
})

describe('subject generation', () => {
  const baseFacts = (overrides?: any) => ({
    sessionCounts: { brief: 0, short: 1, expedition: 0, deep: 0 },
    hasWrittenReview: false,
    periodStart: Date.UTC(2026, 6, 20),
    ...overrides,
  })

  it('stable with same seed', () => {
    const f = baseFacts()
    expect(generateLocalLetterSubject('daily', f, 'seed1')).toBe(generateLocalLetterSubject('daily', f, 'seed1'))
  })

  it('review only uses review pool', () => {
    const f = baseFacts({ sessionCounts: { brief: 1, short: 0, expedition: 0, deep: 0 }, hasWrittenReview: true, periodStart: new Date(2026, 6, 20).getTime() })
    const s = generateLocalLetterSubject('daily', f, 'test')
    expect(s).toContain('7月20日的星页')
  })

  it('daily subject always contains date', () => {
    const dates = [
      new Date(2026, 0, 1).getTime(),
      new Date(2026, 5, 15).getTime(),
      new Date(2026, 11, 31).getTime(),
    ]
    for (const ts of dates) {
      const f = baseFacts({ periodStart: ts })
      const s = generateLocalLetterSubject('daily', f, 'a')
      const d = new Date(ts)
      expect(s).toContain(`${d.getMonth() + 1}月${d.getDate()}日的星页`)
    }
  })

  it('weekly subject is concise', () => {
    const f = baseFacts({ periodStart: new Date(2026, 6, 14).getTime() })
    const s = generateLocalLetterSubject('weekly', f, 'a')
    expect(s).toBe('旅途札记')
  })

  it('weekly full title is date range', () => {
    const ts = new Date(2026, 6, 14).getTime()
    expect(generateWeeklyFullTitle(ts)).toBe('7月14日—7月20日的旅途札记')
  })

  it('weekly delivery label', () => {
    const end = new Date(2026, 6, 20).getTime()
    expect(weeklyDeliveryLabel(end)).toContain('小天使整理于7月20日')
  })

  it('no KPI words in subjects', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const f = baseFacts()
      const s = generateLocalLetterSubject('daily', f, seed)
      expect(s).not.toContain('报告')
      expect(s).not.toContain('效率')
      expect(s).not.toContain('日评')
      expect(s).not.toContain('进步')
      expect(s).not.toContain('表现')
    }
  })
})

describe('template generation', () => {
  const facts = (overrides?: any) => ({
    totalActiveSeconds: 3600,
    sessionCounts: { brief: 0, short: 0, expedition: 1, deep: 0 },
    completedTasks: [{ id: 't1', title: '复习数学' }],
    directionBreakdown: [{ id: 'a1', name: '通用学习', color: '#ccc', seconds: 3600 }],
    longestSessionSeconds: 3600,
    ...overrides,
  })

  it('daily template stable with same seed', () => {
    const f = facts()
    expect(generateDailyTemplate(f, 's1')).toBe(generateDailyTemplate(f, 's1'))
  })

  it('weekly template stable with same seed', () => {
    const f = facts()
    expect(generateWeeklyTemplate(f, 's1')).toBe(generateWeeklyTemplate(f, 's1'))
  })

  it('daily template writes the frozen journey, observatory, and chronicle without postal private matters', () => {
    const body = generateDailyTemplate({
      stats: { totalActiveSeconds: 600, sessionCounts: { brief: 0, short: 2, expedition: 1, deep: 0 } },
      journey: { mainDirection: '松风林', mainDirectionNarrative: { name: '松风林', source: 'world_place' }, completedTasks: [{ title: '确认旧路' }, { title: '收好地图边角' }] },
      observatory: { hasWrittenReview: true },
      chronicle: { season: '夏', newDiscoveries: [{ name: '林间旧亭', kind: 'node' }] },
      worldState: { locations: { postOffice: { windowPhase: 'fixed', decorated: false } }, flora: { flowerPhase: 'dormant' }, visitor: null, activeEvents: [] },
    }, '')
    expect(body).toContain('3次出征')
    expect(body).toContain('松风林')
    expect(body).toContain('确认旧路')
    expect(body).toContain('收好地图边角')
    expect(body).toContain('林间旧亭')
    expect(body).toContain('天文台')
    expect(body).toContain('夏天')
    expect(body).not.toContain('艾达')
    expect(body).not.toContain('窗框')
  })

  it('weekly template writes the main direction, representative waypoint, chronicle, and prior-week relation', () => {
    const body = generateWeeklyTemplate({
      stats: { totalActiveSeconds: 7200, previousPeriodTotalSeconds: 1800, sessionCounts: { brief: 0, short: 1, expedition: 2, deep: 0 } },
      journey: { mainDirection: '白石河谷', mainDirectionNarrative: { name: '白石河谷', source: 'world_place' }, completedTasks: [{ title: '修好旧桥的路牌' }, { title: '找到河湾石阶' }] },
      observatory: { hasWrittenReview: true, weeklyNote: '河湾的旧路终于接上了。' },
      chronicle: { season: '秋', newDiscoveries: [{ name: '河谷渡口', kind: 'region' }] },
      worldState: { locations: { postOffice: { windowPhase: 'fixed', decorated: false } }, flora: { flowerPhase: 'dormant' }, visitor: null, activeEvents: [] },
    }, '')
    expect(body).toContain('3次出征')
    expect(body).toContain('白石河谷')
    expect(body).toContain('修好旧桥的路牌')
    expect(body).toContain('找到河湾石阶')
    expect(body).toContain('河谷渡口')
    expect(body).toContain('河湾的旧路终于接上了。')
    expect(body).toContain('比上周走得更远')
    expect(body).toContain('秋天')
    expect(body).not.toContain('艾达')
    expect(body).not.toContain('窗框')
  })

  it('daily template length in range', () => {
    const body = generateDailyTemplate(facts(), 't1')
    expect(body.length).toBeGreaterThanOrEqual(10)
    expect(body.length).toBeLessThanOrEqual(300)
  })

  it('no KPI words in templates', () => {
    const d = generateDailyTemplate(facts(), 'x')
    expect(d).not.toContain('效率')
    expect(d).not.toContain('表现')
    expect(d).not.toContain('退步')
    expect(d).not.toContain('失败')
    const w = generateWeeklyTemplate(facts({ previousPeriodTotalSeconds: 7200 }), 'x')
    expect(w).not.toContain('退步')
    expect(w).not.toContain('落后')
  })

  it('review-only daily does not mention expedition', () => {
    const f = facts({ totalActiveSeconds: 0, sessionCounts: { brief: 0, short: 0, expedition: 0, deep: 0 }, hasWrittenReview: true })
    const body = generateDailyTemplate(f, 'r1')
    expect(body).not.toContain('远征')
    expect(body).not.toContain('专注')
  })

  it('weekly template handles zero previous', () => {
    const w = generateWeeklyTemplate(facts({ previousPeriodTotalSeconds: 0 }), 'w0')
    expect(w).toContain('第一次')
  })

  it('maps only the system default direction to a world-facing direction', () => {
    expect(narrativeDirectionName({ name: '通用学习', source: 'system_default' })).toBe('旧书页间的旅途')
    expect(narrativeDirectionName({ name: '通用学习', source: 'system_default' })).not.toBe('通用学习')
    expect(narrativeDirectionName({ name: '准备秋招', source: 'user_created' })).toBe('准备秋招')
  })

  it('daily and weekly templates never expose the default area name', () => {
    const facts = {
      stats: { totalActiveSeconds: 600, previousPeriodTotalSeconds: 300 },
      journey: { mainDirection: '通用学习', mainDirectionNarrative: { name: '通用学习', source: 'system_default' }, completedTasks: [{ title: '整理旧笔记' }] },
      chronicle: { season: '秋' },
      observatory: { hasWrittenReview: false },
    }
    expect(generateDailyTemplate(facts, 'default-area')).not.toContain('通用学习')
    expect(generateWeeklyTemplate(facts, 'default-area')).not.toContain('通用学习')
  })
})

describe('facts builders', () => {
  const period = { periodKey: '2026-07-20', periodStart: 1752595200000, periodEnd: 1752681600000, timezoneName: 'UTC', timezoneOffsetMinutes: 0 }

  it('daily facts snapshot includes task titles (v3 schema)', () => {
    const stats = { totalActiveSeconds: 100, sessionCounts: { brief: 0, short: 1, expedition: 0, deep: 0 }, completedTasks: [{ id: 't1', title: 'ABC' }], directionBreakdown: [], longestSessionSeconds: 100, hasOutcome: false, hasWrittenReview: false }
    const f = buildDailyLetterFacts(stats, period)
    expect(f.schemaVersion).toBe(3)
    expect(f.journey.completedTasks[0].title).toBe('ABC')
    expect(f.chronicle.season).toBeTruthy()
  })

  it('freezes narrative direction provenance and discoveries without replacing the raw direction', () => {
    const stats = {
      totalActiveSeconds: 600,
      sessionCounts: { brief: 0, short: 2, expedition: 0, deep: 0 },
      completedTasks: [{ id: 't1', title: '整理申请材料' }, { id: 't2', title: '修改简历' }],
      discoveries: [{ name: '松风林入口', kind: 'node' }],
      directionBreakdown: [{ id: 'area-1', name: '准备秋招', source: 'user_created', seconds: 600 }],
      longestSessionSeconds: 300,
      hasOutcome: false,
      hasWrittenReview: false,
    }
    const f = buildDailyLetterFacts(stats, period)
    expect(f.journey.mainDirection).toBe('准备秋招')
    expect(f.journey.mainDirectionNarrative).toEqual({ name: '准备秋招', source: 'user_created' })
    expect(f.journey.discoveries[0].name).toBe('松风林入口')
  })

  it('weekly facts includes daily breakdown and previous (v2 schema)', () => {
    const stats = { totalActiveSeconds: 7200, sessionCounts: { brief: 0, short: 0, expedition: 2, deep: 0 }, dailyActiveSeconds: [0, 3600, 0, 3600, 0, 0, 0], completedTasks: [], directionBreakdown: [], longestSessionSeconds: 3600, hasWrittenReview: false, hasOutcome: false }
    const f = buildWeeklyLetterFacts(stats, period, 5400)
    expect(f.stats.dailyActiveSeconds).toHaveLength(7)
    expect(f.stats.previousPeriodTotalSeconds).toBe(5400)
  })

  it('freezes the selected weekly observatory note for the journey letter', () => {
    const stats = { totalActiveSeconds: 7200, sessionCounts: { brief: 0, short: 1, expedition: 1, deep: 0 }, completedTasks: [], directionBreakdown: [], longestSessionSeconds: 3600, hasWrittenReview: true, weeklyObservatoryNote: '终于分清了两条旧路。' }
    const f = buildWeeklyLetterFacts(stats, period, 0)
    expect(f.observatory.weeklyNote).toBe('终于分清了两条旧路。')
  })
})

describe('helper functions', () => {
  it('formatDurationZh returns seconds for sub-minute', () => {
    expect(formatDurationZh(0)).toBe('0 秒')
    expect(formatDurationZh(18)).toBe('18 秒')
    expect(formatDurationZh(60)).toBe('1 分 0 秒')
    expect(formatDurationZh(3661)).toBe('1 小时 1 分钟')
  })

  it('neutralCompare uses soft language', () => {
    expect(neutralCompare(7200, 5400)).toContain('多记录了')
    expect(neutralCompare(5400, 7200)).toContain('少记录了')
    expect(neutralCompare(7200, 0)).toBe('上周暂无记录')
    expect(neutralCompare(7200, 7200)).toContain('相近')
  })

  it('hashSeed deterministic', () => {
    expect(hashSeed('hello')).toBe(hashSeed('hello'))
    expect(hashSeed('hello')).not.toBe(hashSeed('world'))
  })
})

// ── Festival & event mail tests ──────────────────────────────

describe('festival system', () => {
  it('generates no festival nodes before first year', () => {
    // June 2024 — before returning_lights firstYear (2025)
    const nodes = getActiveFestivalNodes(new Date(2024, 5, 15).getTime())
    expect(nodes).toHaveLength(0)
  })

  it('generates opening node on day 1 of festival', () => {
    // Nov 7 2026 12:00 UTC — day 1
    const ts = Date.UTC(2026, 10, 7, 12, 0, 0)
    const nodes = getActiveFestivalNodes(ts)
    const opening = nodes.find((n: any) => n.subtype === 'opening' && n.year === 2026)
    expect(opening).toBeDefined()
    expect(opening!.subject).toBe('灯火初燃')
    expect(opening!.eventKey).toBe('returning_lights:2026:opening')
  })

  it('generates midway node on day 5', () => {
    const ts = Date.UTC(2026, 10, 11, 12, 0, 0) // Nov 11 = day 5
    const nodes = getActiveFestivalNodes(ts)
    const midway = nodes.find((n: any) => n.subtype === 'midway' && n.year === 2026)
    expect(midway).toBeDefined()
    expect(midway!.subject).toBe('旧灯回响')
  })

  it('generates climax node on finale day (day 10)', () => {
    const ts = Date.UTC(2026, 10, 16, 12, 0, 0) // Nov 16 = day 10
    const nodes = getActiveFestivalNodes(ts)
    const climax = nodes.find((n: any) => n.subtype === 'climax' && n.year === 2026)
    expect(climax).toBeDefined()
    expect(climax!.subject).toBe('归灯夜')
    expect(climax!.eventKey).toBe('returning_lights:2026:climax')
  })

  it('does not generate festival nodes before the festival starts', () => {
    // Nov 1 2026 — 6 days before festival
    const ts = Date.UTC(2026, 10, 1, 12, 0, 0)
    const nodes = getActiveFestivalNodes(ts)
    // Should only have past years, no 2026 nodes
    const y2026 = nodes.filter((n: any) => n.year === 2026)
    expect(y2026).toHaveLength(0)
  })

  it('does not generate duplicate nodes for the same year', () => {
    const ts = Date.UTC(2027, 0, 1, 12, 0, 0) // Jan 2027 — all 2026 nodes should be active
    const nodes = getActiveFestivalNodes(ts)
    const rl2026openings = nodes.filter((n: any) => n.eventKey === 'returning_lights:2026:opening')
    expect(rl2026openings).toHaveLength(1)
  })

  it('buildFestivalFacts returns correct shape', () => {
    const node = { eventType: 'festival', eventKey: 'rl:2026:opening', festivalKey: 'returning_lights', year: 2026, day: 1, subtype: 'opening', subject: '测试', timestamp: Date.now(), periodStart: Date.now(), periodEnd: Date.now() + 86400000 }
    const facts = buildFestivalFacts(node)
    expect(facts.schemaVersion).toBe(1)
    expect(facts.festivalKey).toBe('returning_lights')
    expect(facts.subtype).toBe('opening')
  })

  it('generates festival templates for all subtypes', () => {
    expect(generateFestivalTemplate('opening').length).toBeGreaterThan(0)
    expect(generateFestivalTemplate('midway').length).toBeGreaterThan(0)
    expect(generateFestivalTemplate('climax').length).toBeGreaterThan(0)
  })
})

describe('birthday system', () => {
  it('birthdayPeriod creates correct period for a given date', () => {
    const period = birthdayPeriod(2026, 5, 12)
    expect(period.periodKey).toBe('birthday:2026')
    // periodStart should be May 12 2026 12:00 local
    const d = new Date(period.periodStart)
    expect(d.getMonth()).toBe(4) // 0-indexed May
    expect(d.getDate()).toBe(12)
  })

  it('generateBirthdayTemplate produces non-empty text', () => {
    expect(generateBirthdayTemplate().length).toBeGreaterThan(20)
  })
})

// ── Template narrative tests ─────────────────────────────────

describe('templates are narrative, not data reports', () => {
  const bannedWords = ['小时', '分钟', '完成了', '次数', '统计', '专注', '显示', '报告', '数据',
    '通用学习', '任务', 'paicli']
  const worldWords = ['邮局', '路标', '旅途', '木匣', '行囊', '地图', '壁炉', '窗']

  it('daily template has no report language or internal category names', () => {
    const facts = { totalActiveSeconds: 7200, completedTasks: [{ title: 'A' }], directionBreakdown: [{ name: '编程' }], hasWrittenReview: false, hasOutcome: false, periodStart: Date.now() }
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const body = generateDailyTemplate(facts, seed)
      expect(body.length).toBeGreaterThan(10)
      expect(body.length).toBeLessThan(200) // ~50-100 chars target
      for (const w of bannedWords) {
        expect(body).not.toContain(w)
      }
    }
  })

  it('daily template contains world vocabulary', () => {
    const facts = { totalActiveSeconds: 7200, completedTasks: [], directionBreakdown: [], hasWrittenReview: false, hasOutcome: false, periodStart: Date.now() }
    // At least one world word should appear across all variants
    const all = ['a','b','c','d','e','f','g','h'].map(s => generateDailyTemplate(facts, s)).join(' ')
    const found = worldWords.filter(w => all.includes(w))
    expect(found.length).toBeGreaterThanOrEqual(2)
  })

  it('weekly template has no report language', () => {
    const facts = { totalActiveSeconds: 20000, sessionCounts: { brief: 1, short: 2, expedition: 3, deep: 1 }, completedTasks: [{ title: 'A' }], directionBreakdown: [{ name: '编程' }], previousPeriodTotalSeconds: 15000, hasWrittenReview: false, hasOutcome: false, periodStart: Date.now() }
    for (const seed of ['a', 'b', 'c', 'd']) {
      const body = generateWeeklyTemplate(facts, seed)
      expect(body.length).toBeGreaterThan(20)
      expect(body.length).toBeLessThan(400) // ~100-200 chars target
      for (const w of bannedWords) {
        expect(body).not.toContain(w)
      }
    }
  })

  it('daily no-session template is gentle', () => {
    const facts = { totalActiveSeconds: 0, completedTasks: [], directionBreakdown: [], hasWrittenReview: false, hasOutcome: false, periodStart: Date.now() }
    const body = generateDailyTemplate(facts, 'a')
    expect(body.length).toBeGreaterThan(5)
    expect(body).not.toContain('小时')
    expect(body).not.toContain('分钟')
  })

  it('weekly first week template mentions it is the first', () => {
    const facts = { totalActiveSeconds: 7200, sessionCounts: { brief: 0, short: 1, expedition: 0, deep: 0 }, completedTasks: [], directionBreakdown: [], previousPeriodTotalSeconds: 0, hasWrittenReview: false, hasOutcome: false, periodStart: Date.now() }
    const body = generateWeeklyTemplate(facts, 'a')
    expect(body).toContain('第一次')
  })
})

// ── World state tests ────────────────────────────────────────

describe('world state', () => {
  it('returns structured state with all required keys', () => {
    const state = getWorldState('2026-07-17')
    expect(state.season).toBe('夏')
    expect(state.locations.postOffice.windowPhase).toBeTruthy()
    expect(state.flora.flowerPhase).toBeTruthy()
    expect(state.npcs.ada.status).toBeTruthy()
    expect(Array.isArray(state.activeEvents)).toBe(true)
  })

  it('window phase transitions over time', () => {
    // Same date = same state
    const a = getWorldState('2026-07-17')
    const b = getWorldState('2026-07-17')
    expect(a.locations.postOffice.windowPhase).toBe(b.locations.postOffice.windowPhase)

    // Different date = potentially different state
    const c = getWorldState('2026-09-01')
    expect(c.locations.postOffice.windowPhase).toBeTruthy()
  })

  it('festival active during Nov 7-16', () => {
    const nov7 = getWorldState('2026-11-07')
    expect(nov7.locations.postOffice.decorated).toBe(true)
    expect(nov7.activeEvents.some((e: any) => e.type === 'returning_lights')).toBe(true)

    const nov20 = getWorldState('2026-11-20')
    expect(nov20.locations.postOffice.decorated).toBe(false)
  })

  it('flower dormant in winter, blooming in summer', () => {
    const winter = getWorldState('2026-01-15')
    expect(winter.flora.flowerPhase).toBe('dormant')

    const summer = getWorldState('2026-07-15')
    expect(summer.flora.flowerPhase).not.toBe('dormant')
  })
})

// ── Festival mailStartedMs filter tests ──────────────────────

describe('festival respects world_entered_at_ms', () => {
  it('player starting 2026-07-16 sees no 2025 festival nodes', () => {
    const mailStarted = new Date(2026, 6, 16).getTime()
    const ts = Date.UTC(2026, 10, 16, 12, 0, 0) // Nov 16 2026
    const nodes = getActiveFestivalNodes(ts, mailStarted)
    const y2025 = nodes.filter((n: any) => n.year === 2025)
    expect(y2025).toHaveLength(0) // 2025 skipped — before player joined
  })

  it('player starting 2026-07-16 sees 2026 festival nodes on Nov 16', () => {
    const mailStarted = new Date(2026, 6, 16).getTime()
    const ts = Date.UTC(2026, 10, 16, 12, 0, 0)
    const nodes = getActiveFestivalNodes(ts, mailStarted)
    const y2026 = nodes.filter((n: any) => n.year === 2026)
    expect(y2026).toHaveLength(3) // opening+midway+climax for 2026
  })

  it('does not backfill nodes from before the player entered in the same year', () => {
    const entered = new Date(2026, 11, 1, 12).getTime()
    const nodes = getActiveFestivalNodes(new Date(2026, 11, 2, 12).getTime(), entered)
    expect(nodes.filter((n: any) => n.year === 2026)).toHaveLength(0)
  })

  it('player starting 2025-01-01 sees 2025 festival nodes (joined before festival)', () => {
    const mailStarted = new Date(2025, 0, 1).getTime()
    const ts = Date.UTC(2026, 10, 16, 12, 0, 0)
    const nodes = getActiveFestivalNodes(ts, mailStarted)
    const y2025 = nodes.filter((n: any) => n.year === 2025)
    expect(y2025).toHaveLength(3) // 2025 allowed — player joined before festival
  })
})

// ── Date boundary tests ──────────────────────────────────────

describe('festival date boundaries', () => {
  it('Nov 6 (day before) has no 2026 nodes', () => {
    const ts = Date.UTC(2026, 10, 6, 12, 0, 0)
    const nodes = getActiveFestivalNodes(ts)
    const y2026 = nodes.filter((n: any) => n.year === 2026)
    expect(y2026).toHaveLength(0)
  })

  it('Nov 7 (day 1) generates opening only', () => {
    const ts = Date.UTC(2026, 10, 7, 12, 0, 0)
    const nodes = getActiveFestivalNodes(ts)
    const y2026 = nodes.filter((n: any) => n.year === 2026)
    expect(y2026).toHaveLength(1)
    expect(y2026[0].subtype).toBe('opening')
  })

  it('Nov 11 (day 5) generates opening + midway', () => {
    const ts = Date.UTC(2026, 10, 11, 12, 0, 0)
    const nodes = getActiveFestivalNodes(ts)
    const y2026 = nodes.filter((n: any) => n.year === 2026)
    const subtypes = y2026.map((n: any) => n.subtype).sort()
    expect(subtypes).toEqual(['midway', 'opening'])
  })

  it('Nov 16 (day 10) generates all three nodes', () => {
    const ts = Date.UTC(2026, 10, 16, 12, 0, 0)
    const nodes = getActiveFestivalNodes(ts)
    const y2026 = nodes.filter((n: any) => n.year === 2026)
    expect(y2026).toHaveLength(3)
  })

  it('Dec 1 (after festival) still has all three nodes', () => {
    const ts = Date.UTC(2026, 11, 1, 12, 0, 0)
    const nodes = getActiveFestivalNodes(ts)
    const y2026 = nodes.filter((n: any) => n.year === 2026)
    expect(y2026).toHaveLength(3)
  })

  it('duplicate calls return same results (idempotent computation)', () => {
    const ts = Date.UTC(2026, 10, 16, 12, 0, 0)
    const a = getActiveFestivalNodes(ts)
    const b = getActiveFestivalNodes(ts)
    expect(a.map((n: any) => n.eventKey).sort()).toEqual(b.map((n: any) => n.eventKey).sort())
  })
})
