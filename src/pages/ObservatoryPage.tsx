import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { formatDuration, friendlyError } from '../lib/format'
import { formatPeriodRange, formatDailyNavLabel, formatWeeklyNavLabel, getTrendText, mapReturnKindLabel, formatSessionCounts, getDominantTimeWindow, formatPixelDuration } from '../lib/observatory'

const DEV = (import.meta as any).env?.DEV
import { buildWeeklyObservationSummary, dailySummaryNote } from '../lib/observatoryInsights'
import { Icon } from '../components/Icon'
import { ObsChart } from '../components/ObsChart'
import { hourlyOption, weeklyBarsOption, heatmapOption, monthlyBarsOption, yearlyBarsOption } from '../lib/observatoryCharts'
import { playUISound } from '../lib/audio'
import type { DailyObservatoryData, WeeklyObservatoryData, MonthlyObservatoryData, YearlyObservatoryData, NavState, NavAction } from '../types'

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const ENERGY_LABELS = ['', '较低', '偏低', '平稳', '不错', '很好']
type ObservatoryTab = 'daily' | 'weekly' | 'monthly' | 'yearly'

function shiftMonth(timestamp: number, delta: number) {
  const d = new Date(timestamp)
  d.setDate(1)
  d.setMonth(d.getMonth() + delta)
  return d.getTime()
}

function shiftYear(timestamp: number, delta: number) {
  const d = new Date(timestamp)
  d.setFullYear(d.getFullYear() + delta, 0, 1)
  return d.getTime()
}

interface ObsNavTarget { periodType: 'daily' | 'weekly'; periodStart: string; periodEnd: string }

export function ObservatoryPage({ obsNavTarget, onObsConsumed, navState, dispatch, actionsRef }: {
  obsNavTarget?: ObsNavTarget | null
  onObsConsumed?: () => void
  navState: NavState
  dispatch: (action: NavAction) => void
  actionsRef: React.MutableRefObject<{
    obsTabIndex: number; obsSetTab: (tab: ObservatoryTab) => void
    obsPrevDate: () => void; obsNextDate: () => void
  }>
}) {
  const { notify } = useApp()
  const [tab, setTab] = useState<ObservatoryTab>(obsNavTarget?.periodType || 'daily')
  const [daily, setDaily] = useState<DailyObservatoryData | null>(null)
  const [weekly, setWeekly] = useState<WeeklyObservatoryData | null>(null)
  const [monthly, setMonthly] = useState<MonthlyObservatoryData | null>(null)
  const [yearly, setYearly] = useState<YearlyObservatoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(() => {
    if (obsNavTarget) { return new Date(obsNavTarget.periodStart + 'T00:00:00').getTime() }
    return Date.now()
  })
  const [reviewWin, setReviewWin] = useState('')
  const [reviewEnergy, setReviewEnergy] = useState<number | null>(null)
  const [reviewBlocker, setReviewBlocker] = useState('')
  const [reviewFutureNote, setReviewFutureNote] = useState('')
  const [reviewExpanded, setReviewExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const reviewLoaded = useRef(false)
  const latestTs = useRef(cursor)
  const latestRequest = useRef(0)

  const load = useCallback(async (ts: number) => {
    const requestId = ++latestRequest.current
    latestTs.current = ts
    setLoading(true)
    try {
      if (tab === 'daily') {
        const d = await window.growthArc.observatory.getDaily(ts)
        if (latestRequest.current !== requestId) return
        if (DEV) console.log('[obs] cursor', ts, '→ raw daily', d)
        setDaily(d)
        if (!reviewLoaded.current && d.review) {
          setReviewWin(d.review.win || '')
          setReviewEnergy(d.review.energy)
          setReviewBlocker(d.review.blocker || '')
          setReviewFutureNote(d.review.futureNote || '')
          reviewLoaded.current = true
        }
      } else if (tab === 'weekly') {
        const w = await window.growthArc.observatory.getWeekly(ts)
        if (latestRequest.current !== requestId) return
        if (DEV) console.log('[obs] cursor', ts, '→ raw weekly', w)
        setWeekly(w)
        if (!reviewLoaded.current) {
          setReviewWin(''); setReviewEnergy(null); setReviewBlocker(''); setReviewFutureNote('')
          reviewLoaded.current = true
        }
      } else if (tab === 'monthly') {
        const m = await window.growthArc.observatory.getMonthly(ts)
        if (latestRequest.current !== requestId) return
        if (DEV) console.log('[obs] cursor', ts, '→ raw monthly', m)
        setMonthly(m)
        if (!reviewLoaded.current) {
          setReviewWin(''); setReviewEnergy(null); setReviewBlocker(''); setReviewFutureNote('')
          reviewLoaded.current = true
        }
      } else {
        const y = await window.growthArc.observatory.getYearly(ts)
        if (latestRequest.current !== requestId) return
        setYearly(y)
        if (!reviewLoaded.current) {
          setReviewWin(''); setReviewEnergy(null); setReviewBlocker(''); setReviewFutureNote('')
          reviewLoaded.current = true
        }
      }
    } catch (e) { notify(friendlyError(e), 'error') }
    finally { if (latestRequest.current === requestId) setLoading(false) }
  }, [tab, notify])

  useEffect(() => { void load(cursor) }, [load, cursor])

  useEffect(() => {
    if (obsNavTarget) { onObsConsumed?.() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const nav = (n: number) => {
    if (saving) return
    setCursor(n)
    setSaved(false)
    reviewLoaded.current = false
  }
  const goToday = () => {
    const now = Date.now()
    setCursor(now)
    setSaved(false)
    reviewLoaded.current = false
  }

  const saveReview = async () => {
    setSaving(true)
    try {
      await window.growthArc.observatory.saveReview({
        date: daily?.period?.periodKey || '',
        win: reviewWin, blocker: reviewBlocker,
        energy: reviewEnergy, tomorrowTask: reviewFutureNote,
      })
      setSaved(true)
    } catch (e) { notify(friendlyError(e), 'error') }
    finally { setSaving(false) }
  }

  // ── Expose actions for global keyboard handler ──────────────
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor
  const tabRef = useRef(tab)
  tabRef.current = tab

  actionsRef.current = {
    obsTabIndex: tab === 'daily' ? 0 : tab === 'weekly' ? 1 : tab === 'monthly' ? 2 : 3,
    obsSetTab: (t: ObservatoryTab) => { setTab(t); dispatch({ type: 'SET_OBS_FOCUS', index: t === 'daily' ? 0 : t === 'weekly' ? 1 : t === 'monthly' ? 2 : 3 }) },
    obsPrevDate: () => {
      if (tabRef.current === 'yearly') nav(shiftYear(cursorRef.current, -1))
      else if (tabRef.current === 'monthly') nav(shiftMonth(cursorRef.current, -1))
      else nav(cursorRef.current - (tabRef.current === 'daily' ? 86400000 : 7 * 86400000))
    },
    obsNextDate: () => {
      const n = tabRef.current === 'yearly'
        ? shiftYear(cursorRef.current, 1)
        : tabRef.current === 'monthly' ? shiftMonth(cursorRef.current, 1)
        : cursorRef.current + (tabRef.current === 'daily' ? 86400000 : 7 * 86400000)
      if (n <= Date.now()) nav(n)
    },
  }

  const hasReviewData = reviewWin.trim() || reviewBlocker.trim() || reviewFutureNote.trim() || reviewEnergy !== null
  const todayLocal = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
  const isToday = cursor ? (() => { const d = new Date(cursor); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })() === todayLocal : true
  const isCurrentWeek = (() => {
    const d = new Date(); d.setHours(0,0,0,0)
    const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    const monTs = d.getTime()
    const cur = new Date(cursor); cur.setHours(0,0,0,0)
    const curDay = cur.getDay(); cur.setDate(cur.getDate() - (curDay === 0 ? 6 : curDay - 1))
    return cur.getTime() === monTs
  })()
  const isCurrentMonth = (() => {
    const now = new Date()
    const current = new Date(cursor)
    return now.getFullYear() === current.getFullYear() && now.getMonth() === current.getMonth()
  })()
  const isCurrentYear = new Date().getFullYear() === new Date(cursor).getFullYear()

  // ── All hooks must stay above every early return ──────────
  const todayIdx = useMemo(() => new Date().getDay() === 0 ? 6 : new Date().getDay() - 1, [cursor])

  const dailyChartOption = useMemo(() => {
    if (!daily) { if (DEV) console.log('[obs] dailyChartOption: daily is null'); return null }
    const h: readonly number[] = daily.hourlyActiveSeconds ?? []
    const hasData = h.some((v: number) => v > 0)
    if (DEV) console.log('[obs] dailyChartOption', { hasData, sum: h.reduce((a,b)=>a+b,0), len: h.length, first: h.slice(0,4) })
    if (!hasData) return null
    return hourlyOption([...h])
  }, [daily])

  const weeklyBarsChartOption = useMemo(() => {
    if (!weekly) { if (DEV) console.log('[obs] weeklyBarsOption: weekly is null'); return null }
    const bars: readonly number[] = weekly.stats?.dailyActiveSeconds ?? []
    const hasData = bars.some((v: number) => v > 0)
    if (DEV) console.log('[obs] weeklyBarsOption', { hasData, bars })
    if (!hasData) return null
    return weeklyBarsOption([...bars], todayIdx)
  }, [weekly, todayIdx])

  const weeklyHeatChartOption = useMemo(() => {
    if (!weekly) { if (DEV) console.log('[obs] weeklyHeatOption: weekly is null'); return null }
    const grid: number[][] = weekly.hourlyActiveSecondsByDay ?? []
    const flat = grid.flat()
    const hasData = flat.some((v: number) => v > 0)
    if (DEV) console.log('[obs] weeklyHeatOption', { hasData, total: flat.reduce((a,b)=>a+b,0), rows: grid.length })
    if (!hasData) return null
    return heatmapOption(grid, todayIdx)
  }, [weekly, todayIdx])

  const monthlyChartOption = useMemo(() => {
    if (!monthly) return null
    const bars = monthly.stats.dailyActiveSeconds ?? []
    if (!bars.some(seconds => seconds > 0)) return null
    const date = new Date(monthly.period.periodStart)
    const now = new Date()
    const todayDate = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() ? now.getDate() : -1
    return monthlyBarsOption([...bars], date.getFullYear(), date.getMonth() + 1, todayDate)
  }, [monthly])

  const yearlyChartOption = useMemo(() => {
    if (!yearly || !yearly.stats.monthlyActiveSeconds.some(seconds => seconds > 0)) return null
    const selectedYear = new Date(yearly.period.periodStart).getFullYear()
    const now = new Date()
    return yearlyBarsOption(yearly.stats.monthlyActiveSeconds, selectedYear, selectedYear === now.getFullYear() ? now.getMonth() + 1 : -1)
  }, [yearly])

  const dailyNote = useMemo(() => {
    if (!daily) return null
    return dailySummaryNote({ hourlyActiveSeconds: daily.hourlyActiveSeconds ?? [], directionBreakdown: daily.stats.directionBreakdown, totalActiveSeconds: daily.stats.totalActiveSeconds })
  }, [daily])

  const weeklyHeatData: number[][] = weekly?.hourlyActiveSecondsByDay ?? []

  // ── NavState-driven focus ──────────────────────────────────
  const isActive = navState.zone === 'observatory'

  if (loading) return <div className="page obs-page"><div className="loading-state">天文台正在校准星盘…</div></div>

  return <div className="page obs-page">
    <div className="obs-hero">
      <div className="obs-hero-window"><i /><i /><i /><i /><i /><i /><i /></div>
      <div className="obs-hero-content">
        <div className="obs-hero-top">
          <div>
            <span className="obs-hero-label">OBSERVATORY · 天文台</span>
            {tab === 'daily' && daily && <h1>{formatPeriodRange(daily.period, 'daily')}</h1>}
            {tab === 'weekly' && weekly && <h1>{formatPeriodRange(weekly.period, 'weekly')}</h1>}
            {tab === 'monthly' && monthly && <h1>{new Date(monthly.period.periodStart).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}</h1>}
            {tab === 'yearly' && yearly && <h1>{new Date(yearly.period.periodStart).getFullYear()} 年度星历</h1>}
          </div>
          <div className="obs-hero-tabs">
            <button
              className={`${tab === 'daily' ? 'active' : ''} ${isActive && navState.obsFocusIndex === 0 ? 'kb-focused' : ''}`}
              onClick={() => { playUISound('select'); setTab('daily'); dispatch({ type: 'SET_OBS_FOCUS', index: 0 }) }}
              aria-label="今日观测"
            ><Icon name="sun" size={14} /> 今日观测</button>
            <button
              className={`${tab === 'weekly' ? 'active' : ''} ${isActive && navState.obsFocusIndex === 1 ? 'kb-focused' : ''}`}
              onClick={() => { playUISound('select'); setTab('weekly'); dispatch({ type: 'SET_OBS_FOCUS', index: 1 }) }}
              aria-label="本周星图"
            ><Icon name="star" size={14} /> 本周星图</button>
            <button
              className={`${tab === 'monthly' ? 'active' : ''} ${isActive && navState.obsFocusIndex === 2 ? 'kb-focused' : ''}`}
              onClick={() => { playUISound('select'); setTab('monthly'); dispatch({ type: 'SET_OBS_FOCUS', index: 2 }) }}
              aria-label="本月星向"
            ><Icon name="wave" size={14} /> 本月星向</button>
            <button
              className={`${tab === 'yearly' ? 'active' : ''} ${isActive && navState.obsFocusIndex === 3 ? 'kb-focused' : ''}`}
              onClick={() => { playUISound('select'); setTab('yearly'); dispatch({ type: 'SET_OBS_FOCUS', index: 3 }) }}
              aria-label="年度星历"
            ><Icon name="star" size={14} /> 年度星历</button>
          </div>
        </div>
        {tab === 'daily' && daily && (
          <div className="obs-hero-stats">
            <div>
              <span className="obs-hero-big">{formatPixelDuration(daily.stats.totalActiveSeconds).map((p, i) => p.isNumber ? <span key={i} className="pixel-num">{p.text}</span> : <span key={i}>{p.text}</span>)}</span>
              <span className="obs-hero-desc">今天留在星图上的时间</span>
            </div>
            <div className="obs-hero-detail">
              <span className="obs-hero-sub">
                {daily.stats.sessionCounts.deep > 0 && `深入远征 ${daily.stats.sessionCounts.deep} · `}
                {daily.stats.sessionCounts.expedition > 0 && `正式远征 ${daily.stats.sessionCounts.expedition} · `}
                {daily.stats.sessionCounts.short > 0 && `短程归来 ${daily.stats.sessionCounts.short} · `}
                {daily.stats.sessionCounts.brief > 0 && `短途折返 ${daily.stats.sessionCounts.brief} · `}
                路标 {daily.stats.completedTaskCount}
              </span>
              {daily.currentSession && (
                <span className="obs-hero-live"><Icon name="play" size={11} /> 炉火仍亮着 · 当前远征 {formatDuration(daily.currentSession.activeSeconds)}{daily.currentSession.status === 'paused' ? '（已暂停）' : ''}</span>
              )}
            </div>
          </div>
        )}
        {tab === 'weekly' && weekly && (
          <div className="obs-hero-stats">
            <div>
              <span className="obs-hero-big">{formatPixelDuration(weekly.stats.totalActiveSeconds).map((p, i) => p.isNumber ? <span key={i} className="pixel-num">{p.text}</span> : <span key={i}>{p.text}</span>)}</span>
              <span className="obs-hero-desc">这一周留下的星轨</span>
            </div>
            <div className="obs-hero-detail">
              <span className="obs-hero-sub">
                {weekly.stats.sessionCounts.deep > 0 && `深入远征 ${weekly.stats.sessionCounts.deep} · `}
                {weekly.stats.sessionCounts.expedition > 0 && `正式远征 ${weekly.stats.sessionCounts.expedition} · `}
                {weekly.stats.sessionCounts.short > 0 && `短程归来 ${weekly.stats.sessionCounts.short} · `}
                {weekly.stats.sessionCounts.brief > 0 && `短途折返 ${weekly.stats.sessionCounts.brief} · `}
                路标 {weekly.stats.completedTaskCount}
              </span>
              <span className="obs-hero-trend"><Icon name="wave" size={12} /> {getTrendText(weekly.stats.totalActiveSeconds, weekly.stats.previousPeriodTotalSeconds)}</span>
            </div>
          </div>
        )}
        {tab === 'monthly' && monthly && (
          <div className="obs-hero-stats">
            <div>
              <span className="obs-hero-big">{formatPixelDuration(monthly.stats.totalActiveSeconds).map((p, i) => p.isNumber ? <span key={i} className="pixel-num">{p.text}</span> : <span key={i}>{p.text}</span>)}</span>
              <span className="obs-hero-desc">这个月汇成的星轨</span>
            </div>
            <div className="obs-hero-detail">
              <span className="obs-hero-sub">留下足迹 {monthly.stats.activeDays} 天 · 最长一天 {formatDuration(monthly.stats.longestDaySeconds)}</span>
              <span className="obs-hero-trend"><Icon name="wave" size={12} /> {getTrendText(monthly.stats.totalActiveSeconds, monthly.stats.previousPeriodTotalSeconds)}</span>
            </div>
          </div>
        )}
        {tab === 'yearly' && yearly && (
          <div className="obs-hero-stats">
            <div>
              <span className="obs-hero-big">{formatPixelDuration(yearly.stats.totalActiveSeconds).map((p, i) => p.isNumber ? <span key={i} className="pixel-num">{p.text}</span> : <span key={i}>{p.text}</span>)}</span>
              <span className="obs-hero-desc">这一年在星空中留下的真实时间</span>
            </div>
            <div className="obs-hero-detail">
              <span className="obs-hero-sub">走过 {yearly.stats.activeDays} 天 · 点亮 {yearly.stats.activeMonths} 个月 · 完成路标 {yearly.stats.completedTaskCount}</span>
              <span className="obs-hero-trend"><Icon name="wave" size={12} /> {getTrendText(yearly.stats.totalActiveSeconds, yearly.stats.previousPeriodTotalSeconds)}</span>
            </div>
          </div>
        )}
      </div>
    </div>

    <div className="obs-nav">
      <button className="obs-nav-btn" onClick={() => { playUISound('select'); nav(tab === 'yearly' ? shiftYear(cursor, -1) : tab === 'monthly' ? shiftMonth(cursor, -1) : cursor - (tab === 'daily' ? 86400000 : 7 * 86400000)) }} aria-label="上一个">‹</button>
      <span className="obs-nav-label">
        {tab === 'daily' && daily ? formatDailyNavLabel(daily.period) : ''}
        {tab === 'weekly' && weekly ? formatWeeklyNavLabel(weekly.period) : ''}
        {tab === 'monthly' && monthly ? new Date(monthly.period.periodStart).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }) : ''}
        {tab === 'yearly' && yearly ? `${new Date(yearly.period.periodStart).getFullYear()} 年` : ''}
      </span>
      <button className="obs-nav-btn" onClick={() => { playUISound('select'); const n = tab === 'yearly' ? shiftYear(cursor, 1) : tab === 'monthly' ? shiftMonth(cursor, 1) : cursor + (tab === 'daily' ? 86400000 : 7 * 86400000); if (n <= Date.now()) nav(n) }} disabled={tab === 'yearly' ? shiftYear(cursor, 1) > Date.now() : tab === 'monthly' ? shiftMonth(cursor, 1) > Date.now() : tab === 'daily' ? cursor + 86400000 > Date.now() : cursor + 7 * 86400000 > Date.now()} aria-label="下一个">›</button>
      {!isToday && tab === 'daily' ? <button className="obs-nav-today" onClick={() => { playUISound('select'); goToday() }}>回到今天</button> : null}
      {!isCurrentWeek && tab === 'weekly' ? <button className="obs-nav-today" onClick={() => { playUISound('select'); goToday() }}>回到本周</button> : null}
      {!isCurrentMonth && tab === 'monthly' ? <button className="obs-nav-today" onClick={() => { playUISound('select'); goToday() }}>回到本月</button> : null}
      {!isCurrentYear && tab === 'yearly' ? <button className="obs-nav-today" onClick={() => { playUISound('select'); goToday() }}>回到今年</button> : null}
    </div>

    {/* ── Daily view ─────────────────────────────────────── */}
    {tab === 'daily' && daily && <>
      <section className="panel obs-panel-wood">
        <h2 className="obs-panel-title">二十四时观测</h2>
        <div key={cursor} style={{ height: 160, background: '#283342' }}>
          <ObsChart option={dailyChartOption} empty={!dailyChartOption} emptyText="这一天还没有时间记录。" />
        </div>
        {dailyNote ? <div className="obs-insight-note">{dailyNote}</div> : null}
      </section>

      <div className="obs-grid-2 obs-grid-uneven">
        <section className="panel obs-panel-wood">
          <h2 className="obs-panel-title">今日足迹</h2>
          {daily.sessions.length > 0 ? (
            <div className="obs-timeline">
              {daily.sessions.map(s => (
                <div key={s.id} className="obs-timeline-item">
                  <span className="obs-tl-time">{new Date(s.endedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="obs-tl-title" title={s.title || '临时远征'}>{s.title || '临时远征'}</span>
                  <span className="obs-tl-duration">{formatDuration(s.activeSeconds)}</span>
                  <span className={`obs-tl-kind obs-kind-${s.returnKind}`}>{mapReturnKindLabel(s.returnKind)}</span>
                </div>
              ))}
            </div>
          ) : <div className="obs-empty">星图上暂时没有今天的落点。</div>}
        </section>
        <section className="panel obs-panel-paper">
          <h2 className="obs-panel-title">旅途方向</h2>
          {daily.stats.directionBreakdown.length > 0 ? (
            <div className="obs-direction-list">
              {daily.stats.directionBreakdown.map(d => {
                const pct = daily.stats.totalActiveSeconds > 0 ? Math.round(d.seconds / daily.stats.totalActiveSeconds * 100) : 0
                return <div key={d.id} className="obs-direction-row">
                  <span className="obs-dir-name"><i style={{ background: d.color || '#8b7355' }} />{d.name || '未分类'}</span>
                  <span className="obs-dir-track"><span className="obs-dir-fill" style={{ width: `${Math.max(2, pct)}%` }} /></span>
                  <span className="obs-dir-time">{formatDuration(d.seconds)}</span>
                </div>
              })}
            </div>
          ) : <div className="obs-empty">暂无方向记录。</div>}
        </section>
      </div>
      <section className="panel obs-panel-paper">
        <h2 className="obs-panel-title">观测册</h2>
        <div className="obs-review-form">
          <label>今天最想留下的一件事<textarea rows={2} value={reviewWin} onChange={e => { setReviewWin(e.target.value); setSaved(false) }} placeholder="不必宏大，写下真正向前的一点" /></label>
          <div className="obs-review-row">
            <div className="obs-energy-group"><span className="obs-energy-label">今天的整体状态</span>
              <div className="obs-energy-dots">{[1,2,3,4,5].map(v => (
                <button key={v} className={reviewEnergy === v ? 'active' : ''} onClick={() => setReviewEnergy(v === reviewEnergy ? null : v)} aria-label={ENERGY_LABELS[v]}>{ENERGY_LABELS[v]}</button>
              ))}</div>
            </div>
            <div className="obs-review-actions">
              {saved && <span className="obs-saved-mark">已写入今日星页</span>}
              <button className="button button-ghost button-small" disabled={saving || !hasReviewData} onClick={saveReview}>{saving ? '正在收进观测册…' : saved ? '已写入今日星页' : '收进观测册'}</button>
            </div>
          </div>
          {reviewExpanded && <div className="obs-review-extra">
            <label>今天遇到的阻碍<textarea rows={2} value={reviewBlocker} onChange={e => setReviewBlocker(e.target.value)} placeholder="记录事实，不责备自己" /></label>
            <label>给未来自己的话<textarea rows={2} value={reviewFutureNote} onChange={e => setReviewFutureNote(e.target.value)} placeholder="没有想说的也可以留空" /></label>
          </div>}
          <button className="text-button" onClick={() => setReviewExpanded(v => !v)}>{reviewExpanded ? '合上这一页' : '翻开下一页'}</button>
        </div>
      </section>
      <div className="obs-herald"><span className="obs-herald-icon">✦</span><span>小天使会在夜深后整理今天的星页</span></div>
    </>}

    {/* ── Weekly view ────────────────────────────────────── */}
    {tab === 'weekly' && weekly && <>
      {(() => {
        const obs = buildWeeklyObservationSummary(weekly)
        return (obs.headline || obs.details.length > 0) ? (
          <section className="obs-starlog">
            <h2 className="obs-starlog-title">✦ 星象札记</h2>
            {obs.headline && <p className="obs-starlog-headline">{obs.headline}</p>}
            {obs.details.map((l, i) => <p key={i} className="obs-starlog-line">{l}</p>)}
          </section>
        ) : null
      })()}
      {(() => {
        const dom = getDominantTimeWindow(weeklyHeatData.flat())
        return (
          <section className="panel obs-panel-wood">
            <h2 className="obs-panel-title">本周星轨</h2>
            <div key={`h-${cursor}`} style={{ height: 220, background: '#283342' }}>
              <ObsChart option={weeklyHeatChartOption} empty={!weeklyHeatChartOption} emptyText="本周还没有形成可观察的时段分布。" />
            </div>
            {weeklyHeatChartOption && dom && <div className="obs-heat-desc" style={{ marginTop: 4 }}>本周的足迹较多出现在{dom.label}。</div>}
          </section>
        )
      })()}
      {(() => {
        return (
          <section className="panel obs-panel-wood">
            <h2 className="obs-panel-title">七日星柱</h2>
            <div key={`w-${cursor}`} style={{ height: 160, background: '#283342' }}>
              <ObsChart option={weeklyBarsChartOption} empty={!weeklyBarsChartOption} emptyText="本周星图上还没有新的落点。" />
            </div>
          </section>
        )
      })()}
      <div className="obs-grid-2">
        <section className="panel obs-panel-paper">
          <h2 className="obs-panel-title">旅途方向</h2>
          {weekly.stats.directionBreakdown.length > 0 ? (
            <div className="obs-direction-list">{weekly.stats.directionBreakdown.map(d => {
              const pct = weekly.stats.totalActiveSeconds > 0 ? Math.round(d.seconds / weekly.stats.totalActiveSeconds * 100) : 0
              return <div key={d.id} className="obs-direction-row">
                <span className="obs-dir-name"><i style={{ background: d.color || '#8b7355' }} />{d.name || '未分类'}</span>
                <span className="obs-dir-track"><span className="obs-dir-fill" style={{ width: `${Math.max(2, pct)}%` }} /></span>
                <span className="obs-dir-time">{formatDuration(d.seconds)}</span>
              </div>
            })}</div>
          ) : <div className="obs-empty">暂无方向记录。</div>}
        </section>
        <section className="panel obs-panel-paper">
          <h2 className="obs-panel-title">本周足迹</h2>
          <div className="obs-weekly-stats">
            <div className="obs-ws-row"><span>出征</span><span>{weekly.stats.sessionCounts.deep > 0 && `深入 ${weekly.stats.sessionCounts.deep} · `}{weekly.stats.sessionCounts.expedition > 0 && `正式 ${weekly.stats.sessionCounts.expedition} · `}{weekly.stats.sessionCounts.short > 0 && `短程 ${weekly.stats.sessionCounts.short} · `}{weekly.stats.sessionCounts.brief > 0 && `短途 ${weekly.stats.sessionCounts.brief}`}</span></div>
            <div className="obs-ws-row"><span>路标</span><span>{weekly.stats.completedTaskCount}</span></div>
            <div className="obs-ws-row"><span>最长远征</span><span>{formatDuration(weekly.stats.longestSessionSeconds)}</span></div>
            {weekly.representativeTasks.length > 0 && <div className="obs-task-list">{weekly.representativeTasks.map(t => <div key={t.id} className="obs-task-item"><Icon name="check" size={13} /> {t.title}</div>)}</div>}
          </div>
        </section>
      </div>
      <div className="obs-herald"><span className="obs-herald-icon">✦</span><span>周信会在本周结束后送达</span></div>
    </>}

    {/* ── Monthly view ───────────────────────────────────── */}
    {tab === 'monthly' && monthly && <>
      <section className="panel obs-panel-wood">
        <h2 className="obs-panel-title">月度星柱</h2>
        <div key={`m-${cursor}`} style={{ height: 280, background: '#283342' }}>
          <ObsChart option={monthlyChartOption} empty={!monthlyChartOption} emptyText="这个月的星图还在等待第一束光。" />
        </div>
        <div className="obs-heat-desc">纵轴记录真实专注时长，横轴记录这个月的每一天。</div>
      </section>
      <div className="obs-grid-2">
        <section className="panel obs-panel-paper">
          <h2 className="obs-panel-title">月度足迹</h2>
          <div className="obs-weekly-stats">
            <div className="obs-ws-row"><span>有星轨的日子</span><span>{monthly.stats.activeDays} 天</span></div>
            <div className="obs-ws-row"><span>最长的一天</span><span>{formatDuration(monthly.stats.longestDaySeconds)}</span></div>
            <div className="obs-ws-row"><span>最长远征</span><span>{formatDuration(monthly.stats.longestSessionSeconds)}</span></div>
            <div className="obs-ws-row"><span>完成路标</span><span>{monthly.stats.completedTaskCount}</span></div>
          </div>
        </section>
        <section className="panel obs-panel-paper">
          <h2 className="obs-panel-title">旅途方向</h2>
          {monthly.stats.directionBreakdown.length > 0 ? <div className="obs-direction-list">{monthly.stats.directionBreakdown.map(direction => {
            const pct = monthly.stats.totalActiveSeconds > 0 ? Math.round(direction.seconds / monthly.stats.totalActiveSeconds * 100) : 0
            return <div key={direction.id} className="obs-direction-row"><span className="obs-dir-name"><i style={{ background: direction.color || '#8b7355' }} />{direction.name || '未分类'}</span><span className="obs-dir-track"><span className="obs-dir-fill" style={{ width: `${Math.max(2, pct)}%` }} /></span><span className="obs-dir-time">{formatDuration(direction.seconds)}</span></div>
          })}</div> : <div className="obs-empty">暂无方向记录。</div>}
        </section>
      </div>
    </>}

    {/* ── Yearly view ────────────────────────────────────── */}
    {tab === 'yearly' && yearly && <>
      <section className="obs-year-prologue">
        <span>✦ 岁年星页</span>
        <h2>{yearly.stats.totalActiveSeconds > 0 ? '这一年走过的路，已经在夜空中连成星河。' : '新一年的星页已经翻开，正等待第一束光。'}</h2>
        <p>不必每一天都走得很远。每一段真正投入过的时间，都已经留在这里。</p>
      </section>
      <section className="panel obs-panel-wood">
        <h2 className="obs-panel-title">十二月星柱</h2>
        <div key={`y-${cursor}`} style={{ height: 320, background: '#283342' }}>
          <ObsChart option={yearlyChartOption} empty={!yearlyChartOption} emptyText="这一年的星图还在等待第一束光。" />
        </div>
        <div className="obs-heat-desc">纵轴记录真实专注时长，十二根星柱共同组成这一年的旅途。</div>
      </section>
      <div className="obs-year-highlights">
        <article><span>最明亮的月份</span><strong>{yearly.stats.brightestMonth ? `${yearly.stats.brightestMonth} 月` : '等待点亮'}</strong><small>{yearly.stats.brightestMonthSeconds ? formatDuration(yearly.stats.brightestMonthSeconds) : '尚未留下星轨'}</small></article>
        <article><span>有星轨的日子</span><strong>{yearly.stats.activeDays}</strong><small>天真实投入的时光</small></article>
        <article><span>最长的一天</span><strong>{formatDuration(yearly.stats.longestDaySeconds)}</strong><small>那天的路走得格外深</small></article>
        <article><span>最长远征</span><strong>{formatDuration(yearly.stats.longestSessionSeconds)}</strong><small>一次完整而安静的前行</small></article>
      </div>
      <div className="obs-grid-2">
        <section className="panel obs-panel-paper">
          <h2 className="obs-panel-title">这一年的相遇</h2>
          <div className="obs-year-discoveries">
            <div><span>新的同行者</span><strong>{yearly.stats.newCompanions}</strong><small>位伙伴来到炉火旁</small></div>
            <div><span>伙伴的成长</span><strong>{yearly.stats.companionGrowths}</strong><small>次羁绊留下新的模样</small></div>
            <div><span>吟游诗页</span><strong>{yearly.stats.poemsReceived}</strong><small>首诗被收进小屋</small></div>
            <div><span>初见远方</span><strong>{yearly.stats.newLocations}</strong><small>处地点第一次出现</small></div>
          </div>
        </section>
        <section className="panel obs-panel-paper">
          <h2 className="obs-panel-title">年度旅途方向</h2>
          {yearly.stats.directionBreakdown.length > 0 ? <div className="obs-direction-list">{yearly.stats.directionBreakdown.map(direction => {
            const pct = yearly.stats.totalActiveSeconds > 0 ? Math.round(direction.seconds / yearly.stats.totalActiveSeconds * 100) : 0
            return <div key={direction.id} className="obs-direction-row"><span className="obs-dir-name"><i style={{ background: direction.color || '#8b7355' }} />{direction.name || '未分类'}</span><span className="obs-dir-track"><span className="obs-dir-fill" style={{ width: `${Math.max(2, pct)}%` }} /></span><span className="obs-dir-time">{formatDuration(direction.seconds)}</span></div>
          })}</div> : <div className="obs-empty">方向尚未写入这一年的星图。</div>}
        </section>
      </div>
      <section className="obs-year-closing">
        <span>✦</span>
        <p>{yearly.stats.totalActiveSeconds > 0 ? `你在这一年留下了 ${yearly.stats.activeDays} 天星轨。它们不是冷冰冰的数字，而是你真正走过的路。炉火会替你记得。` : '旅途尚未开始也没有关系。等你准备好时，炉火仍会亮着。'}</p>
      </section>
    </>}
  </div>
}
