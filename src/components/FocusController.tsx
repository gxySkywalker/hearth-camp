import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { friendlyError, formatClock, formatDuration } from '../lib/format'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { setInputContext, getInputContext } from '../lib/inputContext'
import { PixelCompanion } from './PixelCompanion'
import { CompanionGrowthCeremony } from './CompanionGrowthCeremony'
import type { CompanionGrowthEvent, ExpeditionResult } from '../types'
import { bgm } from '../lib/audio'

const DURATION_OPTIONS = [15, 25, 45, 60, 90]
const CONTRIB_XP_TABLE = [10, 8, 6, 4, 2]
const CONTRIB_XP_CAP = 30

function calcContribXp(tasks: { id: string; sort_order: number }[], contributed: string[], activeSeconds: number): Array<{ taskId: string; xp: number; reason: 'awarded' | 'short_session' | 'xp_cap_reached' }> {
  const selected = tasks.filter(t => contributed.includes(t.id)).sort((a, b) => a.sort_order - b.sort_order)
  if (activeSeconds < 300) return selected.map(t => ({ taskId: t.id, xp: 0, reason: 'short_session' }))
  let running = 0
  return selected.map((t, i) => {
    const base = i < CONTRIB_XP_TABLE.length ? CONTRIB_XP_TABLE[i] : 2
    const awarded = Math.min(base, CONTRIB_XP_CAP - running)
    running += awarded
    const reason: 'awarded' | 'xp_cap_reached' = awarded > 0 ? 'awarded' : 'xp_cap_reached'
    return { taskId: t.id, xp: awarded, reason }
  })
}

export function FocusController({ showLauncher = true }: { showLauncher?: boolean }) {
  const { activeSession, setActiveSession, structure, dashboard, refresh, notify } = useApp()
  const [startOpen, setStartOpen] = useState(false)
  const [stopOpen, setStopOpen] = useState(false)
  const [expedition, setExpedition] = useState<ExpeditionResult | null>(null)
  const [growthEvent, setGrowthEvent] = useState<CompanionGrowthEvent | null>(null)
  const [stopResult, setStopResult] = useState<{ primaryTask: any; contributedTasks: any[]; xpAwarded: number; session: any } | null>(null)
  const [taskId, setTaskId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [content, setContent] = useState('')
  const [companionId, setCompanionId] = useState('')
  const [plannedMinutes, setPlannedMinutes] = useState(25)
  const [outcome, setOutcome] = useState('')
  const [taskCompleted, setTaskCompleted] = useState(false)
  const [contributed, setContributed] = useState<string[]>([])
  const [contribSearch, setContribSearch] = useState('')
  const [contribArea, setContribArea] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [confirmCancelBusy, setConfirmCancelBusy] = useState(false)

  // ── Dialog input context ──────────────────────────────────
  useEffect(() => {
    if (startOpen || stopOpen || confirmCancelOpen || expedition || growthEvent) {
      setInputContext('dialog')
    } else {
      setInputContext('menu') // restore menu context when all dialogs close
    }
  }, [startOpen, stopOpen, confirmCancelOpen, expedition])
  const [muted, setMuted] = useState(false)
  const [tick, setTick] = useState(Date.now())
  const snapshotAt = useRef(Date.now())
  const emptyReturnBtnRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLDivElement>(null)
  const companions = dashboard?.world.companions.owned || []

  useEffect(() => {
    if (activeSession?.status === 'running') bgm.play('assets/audio/bgm/expedition.mp3')
    else bgm.play('assets/audio/bgm/cottage.mp3')
  }, [activeSession?.status])

  useEffect(() => {
    snapshotAt.current = Date.now()
    let raf = 0
    const loop = () => { setTick(Date.now()); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [activeSession?.id, activeSession?.status])

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running') return
    const hb = window.setInterval(async () => {
      try { const s = await window.growthArc.session.heartbeat(activeSession.id); snapshotAt.current = Date.now(); setActiveSession(s) } catch {}
    }, 30000)
    return () => window.clearInterval(hb)
  }, [activeSession?.id, activeSession?.status, setActiveSession])

  // Esc key dismisses confirm dialog
  useEffect(() => {
    if (!confirmCancelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmCancelBusy) closeConfirmCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmCancelOpen, confirmCancelBusy])

  // Focus trap: Tab cycles between the two confirm buttons
  useEffect(() => {
    if (!confirmCancelOpen) return
    const el = confirmRef.current
    if (!el) return
    const btns = el.querySelectorAll<HTMLElement>('button:not([disabled])')
    if (btns.length < 2) return
    const first = btns[0]
    const last = btns[btns.length - 1]
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || confirmCancelBusy) return
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', trap)
    return () => window.removeEventListener('keydown', trap)
  }, [confirmCancelOpen, confirmCancelBusy])

  // Clean up confirm dialog if return checklist closes externally
  useEffect(() => {
    if (!stopOpen) setConfirmCancelOpen(false)
  }, [stopOpen])

  const elapsed = useMemo(() => {
    if (!activeSession) return 0
    if (activeSession.status !== 'running') return Number(activeSession.active_seconds)
    return Number(activeSession.active_seconds) + Math.max(0, Math.floor((tick - snapshotAt.current) / 1000))
  }, [activeSession, tick])

  const activeCompanion = useMemo(() => {
    if (!dashboard) return null
    return dashboard.world.companions.owned.find(c => c.id === activeSession?.companion_id) || dashboard.world.companions.active
  }, [activeSession?.companion_id, dashboard])

  const resetStart = () => { setTaskId(''); setAreaId(structure?.areas[0]?.id || ''); setContent(''); setCompanionId(dashboard?.world.companions.active?.id || ''); setPlannedMinutes(25) }
  const openStart = (presetTaskId?: string) => {
    resetStart()
    if (presetTaskId) { const t = structure?.tasks.find(x => x.id === presetTaskId); setTaskId(presetTaskId); if (t) setAreaId(t.area_id) }
    setStartOpen(true)
  }
  useEffect(() => {
    const listener = (e: Event) => openStart((e as CustomEvent<string>).detail)
    window.addEventListener('growtharc:start-focus', listener)
    return () => window.removeEventListener('growtharc:start-focus', listener)
  })

  const start = async () => {
    setBusy(true)
    try {
      const s = await window.growthArc.session.start({ taskId: taskId || null, areaId: areaId || null, content, companionId: companionId || null, plannedMinutes })
      snapshotAt.current = Date.now(); setActiveSession(s); setStartOpen(false)
      notify('城门已经打开。接下来只需要专注赶路。', 'success'); await refresh()
    } catch (e) { notify(friendlyError(e), 'error') } finally { setBusy(false) }
  }

  const togglePause = async () => {
    if (!activeSession) return
    try {
      const next = activeSession.status === 'running' ? await window.growthArc.session.pause(activeSession.id) : await window.growthArc.session.resume(activeSession.id)
      snapshotAt.current = Date.now(); setActiveSession(next)
    } catch (e) { notify(friendlyError(e), 'error') }
  }

  const stop = async () => {
    if (!activeSession) return
    setBusy(true)
    try {
      const result = await window.growthArc.session.stop(activeSession.id, { outcome, blocker: '', nextStep: '', taskCompleted, contributedTaskIds: contributed })
      setActiveSession(null); setStopOpen(false)
      setExpedition(result.expedition); setStopResult({ primaryTask: result.primaryTask, contributedTasks: result.contributedTasks, xpAwarded: result.xpAwarded, session: result.session })
      setOutcome(''); setTaskCompleted(false); setContributed([]); setContribSearch(''); setContribArea('')
      await refresh()
    } catch (e) { notify(friendlyError(e), 'error') } finally { setBusy(false) }
  }

  const cancel = () => {
    if (!activeSession) return
    setConfirmCancelOpen(true)
  }

  const closeConfirmCancel = () => {
    if (confirmCancelBusy) return
    setConfirmCancelOpen(false)
    requestAnimationFrame(() => emptyReturnBtnRef.current?.focus())
  }

  const confirmCancel = async () => {
    if (!activeSession || confirmCancelBusy) return
    const sessionId = activeSession.id
    setConfirmCancelBusy(true)
    try {
      await window.growthArc.session.cancel(sessionId)
      setConfirmCancelOpen(false)
      setActiveSession(null)
      setStopOpen(false)
      await refresh()
    } catch (e) {
      notify(friendlyError(e), 'error')
    } finally {
      setConfirmCancelBusy(false)
    }
  }

  const plannedSeconds = Number(activeSession?.planned_seconds || 1500)
  const progress = Math.min(100, elapsed / Math.max(1, plannedSeconds) * 100)
  const destinationReached = elapsed >= plannedSeconds
  const xpPreview = calcContribXp(structure?.tasks || [], contributed, elapsed)
  const xpTotal = xpPreview.reduce((s, p) => s + (p.xp || 0), 0)
  const contribCandidates = (structure?.tasks || []).filter(t => t.id !== activeSession?.task_id && (t.status === 'todo' || t.status === 'doing'))
    .filter(t => !contribArea || t.area_id === contribArea)
    .filter(t => !contribSearch || t.title.toLowerCase().includes(contribSearch.toLowerCase()))
    .sort((a, b) => a.sort_order - b.sort_order)

  const normalizeText = (v?: string | null) => (v ?? '').trim().replace(/\s+/g, ' ')
  const sessionTitle = normalizeText(stopResult?.session?.content) || '未命名远征'
  const outcomeText = normalizeText(stopResult?.session?.outcome)
  const relicText = normalizeText(expedition?.knowledgeRelic?.content)
  const showRelicContent = !!relicText && relicText !== outcomeText

  // Compact layout conditions
  const completedContributed = stopResult?.contributedTasks?.filter((t: any) => t.completed) ?? []
  const useCompactResults =
    !!stopResult?.primaryTask?.completed &&
    completedContributed.length >= 1 &&
    completedContributed.length <= 2
  const isCompactScene = !expedition?.rareFound && !expedition?.newCompanion
  const isLightweight = expedition?.returnKind === 'brief' || expedition?.returnKind === 'short'
  const drops = expedition?.drops ?? []
  const hasRelic = !!expedition?.knowledgeRelic
  const compactRewards = drops.length <= 2 && !expedition?.rareFound
  const returnToHome = () => {
    const event = expedition?.growthEvent || null
    setExpedition(null)
    setStopResult(null)
    if (event) setGrowthEvent(event)
  }
  const completeGrowthCeremony = async () => {
    if (!growthEvent) return
    try {
      await window.growthArc.companions.markGrowthSeen(growthEvent.id)
      await refresh()
    } catch (error) {
      notify(friendlyError(error), 'error')
    } finally {
      setGrowthEvent(null)
    }
  }

  return <>
    {activeSession ? <section className={`focus-expedition ${activeSession.status === 'paused' ? 'is-paused' : ''}`}>
      <div className="focus-sky"><i /><i /><i /></div>
      <div className="focus-mountains mountain-back" /><div className="focus-mountains mountain-front" />
      <div className="focus-path" />
      <header className="focus-topbar">
        <div><span className="focus-live-dot" />{activeSession.status === 'paused' ? '队伍正在路边休息' : '远征途中 · 请勿打扰'}</div>
        <div style={{display:'flex',gap:10}}>
          <button className="quiet-exit" onClick={() => { const nm = !muted; setMuted(nm); bgm.volume(nm ? 0 : bgm.getLastVolume()) }}>{muted || bgm.getVolume() === 0 ? '🔇' : '🔊'}</button>
          <button className="quiet-exit" onClick={() => setStopOpen(true)}>准备返航</button>
        </div>
      </header>
      <div className="focus-journey">
        <div className="focus-companion"><PixelCompanion companion={activeCompanion} /><span className="walking-dust">···</span></div>
        <div className="focus-copy">
          <span>{activeSession.area_name || '今日远征'}</span><h1>{activeSession.content}</h1>
          <p>{destinationReached ? '已经抵达计划中的目的地。可以从容收尾，也可以再探索一会儿。' : `${activeCompanion?.nickname || '伙伴'}正安静陪你赶路。`}</p>
          <time>{formatClock(elapsed)}</time>
          <div className="journey-progress"><i style={{width:`${Math.max(2,progress)}%`}} /><b style={{left:`${Math.min(97,progress)}%`}}>◆</b></div>
          <div className="journey-labels"><span>营地</span><span>{destinationReached ? '已抵达' : `计划 ${Math.round(plannedSeconds/60)} 分钟`}</span></div>
          <div className="expedition-volume"><Icon name="play" size={12} /><input type="range" min="0" max="100" value={bgm.getVolume() === 0 ? 0 : Math.round(bgm.getLastVolume() * 100)} onChange={e => { const v = Number(e.target.value) / 100; bgm.volume(v); setMuted(v === 0) }} /><span style={{fontSize:10,color:'rgba(255,243,217,.5)'}}>{Math.round((bgm.getVolume()||bgm.getLastVolume())*100)}%</span></div>
          <div className="focus-controls">
            <button className="button button-soft" onClick={togglePause}><Icon name={activeSession.status === 'running' ? 'pause' : 'play'} />{activeSession.status === 'running' ? '路边休息' : '继续赶路'}</button>
            <button className="button button-primary" onClick={() => setStopOpen(true)}><Icon name="flag" />带着成果回小屋</button>
          </div>
        </div>
      </div>
      <footer className="focus-whisper">随机事件正在旅途中安静发生，返航时再一起翻开日志。</footer>
    </section> : showLauncher ? <button className="floating-focus" onClick={() => openStart()}><Icon name="play" size={18} />开始远征</button> : null}

    {/* 开始远征弹窗 */}
    {startOpen && <Modal title="准备下一次远征" onClose={() => setStartOpen(false)} size="wide">
      <div className="modal-body expedition-setup">
        <div className="setup-main form-stack">
          <label>从地图选择任务（可选）<select value={taskId} onChange={e => { setTaskId(e.target.value); const t = structure?.tasks.find(x => x.id === e.target.value); if (t) setAreaId(t.area_id) }}><option value="">临时远征</option>{structure?.tasks.filter(t => t.status !== 'done').map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
          {!taskId && <><label>探索区域<select value={areaId} onChange={e => setAreaId(e.target.value)}>{structure?.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>这次只推进什么？<input autoFocus value={content} onChange={e => setContent(e.target.value)} placeholder="例如：读完第三章并整理两个例题" /></label></>}
          <fieldset><legend>计划走多远</legend><div className="duration-picks">{DURATION_OPTIONS.map(m => <button type="button" className={plannedMinutes === m ? 'selected' : ''} key={m} onClick={() => setPlannedMinutes(m)}><strong>{m}</strong><span>分钟</span></button>)}</div></fieldset>
        </div>
        <aside className="companion-pick"><span>本次同行伙伴</span><PixelCompanion companion={companions.find(c => c.id === companionId) || dashboard?.world.companions.active || null} size="medium" /><select value={companionId} onChange={e => setCompanionId(e.target.value)}>{companions.map(c => <option key={c.id} value={c.id}>{c.nickname} · {c.stageName}</option>)}</select><p>本次远征会增加你们之间的羁绊。</p></aside>
      </div>
      <footer className="modal-footer"><button className="button button-ghost" onClick={() => setStartOpen(false)}>再准备一下</button><button className="button button-primary" disabled={busy || (!taskId && (!content.trim() || !areaId))} onClick={start}><Icon name="play" />穿过城门</button></footer>
    </Modal>}

    {/* 返程清点弹窗 */}
    {stopOpen && activeSession && <div className="modal-backdrop" onClick={() => {}}><div className="modal modal-wide return-modal">
      <header className="modal-header"><h2>返程清点</h2><button className="icon-button" onClick={() => setStopOpen(false)}><Icon name="close" size={20} /></button></header>
      <div className="return-modal-body">
        <div className="session-summary-strip"><div><span>远征目标</span><strong>{activeSession.content}</strong></div><div><span>有效专注</span><strong>{formatClock(elapsed)}</strong></div></div>

        <div className="return-form">
          <label>这次完成了什么？<textarea rows={2} value={outcome} onChange={e => setOutcome(e.target.value)} placeholder="只需写下已经完成的事" /></label>
        </div>

        {activeSession.task_id && <div className="return-primary">
          <span className="return-section-label">主要路标</span>
          <label className="check-row return-primary-row">
            <span className="pixel-checkbox">
              <input type="checkbox" checked={taskCompleted} onChange={e => setTaskCompleted(e.target.checked)} />
              <span className="pixel-checkbox-visual" />
            </span>
            <span className="return-primary-info">
              <strong>{activeSession.content}</strong>
              <small>确认后，这枚路标将记为已抵达</small>
            </span>
          </label>
        </div>}

        <div className="return-contributed">
          <span className="return-section-label">沿途抵达</span>
          {elapsed < 300 && <div className="contrib-short-notice">这次行程较短。抵达的路标仍会留下记录。<small>有效专注达到 5 分钟的远征，才会结算沿途经验。</small></div>}
          <small className="return-contributed-hint">这次远征中，你还抵达了哪些路标？经验按计划顺序依次结算，单场最多 30 XP。</small>
          <div className="return-contributed-filters">
            <input className="contrib-search" placeholder="搜索路标…" value={contribSearch} onChange={e => setContribSearch(e.target.value)} />
            <select className="contrib-area-filter" value={contribArea} onChange={e => setContribArea(e.target.value)}>
              <option value="">全部方向</option>
              {structure?.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="return-contributed-list">
            {contribCandidates.map(t => {
              const p = xpPreview.find(x => x.taskId === t.id)
              const checked = contributed.includes(t.id)
              const area = structure?.areas.find(a => a.id === t.area_id)
              return <label key={t.id} className={`check-row contrib-row ${checked ? 'contrib-checked' : ''}`}>
                <span className="pixel-checkbox">
                  <input type="checkbox" checked={checked} onChange={e => setContributed(prev => e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id))} />
                  <span className="pixel-checkbox-visual" />
                </span>
                <span className="contrib-row-info">
                  <strong>{t.title}</strong>
                  <small>{area?.name || '未分类'}</small>
                </span>
                {checked && p && <span className="contrib-xp-preview">{p.reason === 'short_session' ? <span className="contrib-xp-dim">行程较短·已记录</span> : p.xp > 0 ? `+${p.xp} XP` : <span className="contrib-xp-dim">已达上限·已记录</span>}</span>}
                {!checked && <span className="contrib-xp-preview contrib-xp-dim">—</span>}
              </label>
            })}
          </div>
        </div>
      </div>

      <div className="return-bottom">
        {contributed.length > 0 && <div className="return-checklist">
          <span className="return-checklist-label">返程清单</span>
          主要路标：{taskCompleted ? '已确认' : '未确认'}
          <span>·</span>
          沿途抵达：{contributed.length} 处
          {elapsed >= 300 && <><span>·</span>预计沿途经验：<span className="contrib-xp-sum">+{xpTotal} XP</span></>}
          {xpTotal >= CONTRIB_XP_CAP && <span className="contrib-cap-note">已达到本场沿途经验上限，其余路标仍会正常记录为完成</span>}
        </div>}
        <footer className="modal-footer split-footer">
          <button className="button button-danger-ghost" ref={emptyReturnBtnRef} onClick={cancel}>空手返回</button>
          <div>
            <button className="button button-ghost" onClick={() => setStopOpen(false)}>再走一会儿</button>
            <button className="button button-primary" disabled={busy} onClick={stop}><Icon name="home" />带着成果回小屋</button>
          </div>
        </footer>
      </div>
    </div></div>}

    {/* 确认空手返回 */}
    {confirmCancelOpen && (
      <Modal title="确认空手返回？" onClose={closeConfirmCancel} className="empty-return-confirm-modal">
        <div ref={confirmRef} className="empty-return-confirm">
          <div className="modal-body empty-return-confirm-body">
            <p className="empty-return-confirm-message">这次远征将只保留专注时长。</p>
            <p className="empty-return-confirm-detail">不会抵达路标，也不会带回旅途收获。</p>
          </div>
          <footer className="modal-footer empty-return-confirm-footer">
            <button className="button button-ghost" onClick={closeConfirmCancel} disabled={confirmCancelBusy} autoFocus>继续清点</button>
            <button className="button button-danger" onClick={confirmCancel} disabled={confirmCancelBusy}>空手返回</button>
          </footer>
        </div>
      </Modal>
    )}

    {/* 远征归来结果 */}
    {expedition && (
      isLightweight ? (
        <div className="modal-backdrop" onClick={returnToHome}>
          <div className="modal return-brief-card">
            <header className="modal-header"><h2>{expedition.returnKind === 'brief' ? '短途折返' : '短程归来'}</h2><button className="icon-button" onClick={returnToHome} aria-label="关闭"><Icon name="close" /></button></header>
            <div className="modal-body return-brief-body">
              <div className="return-brief-hero">
                {expedition.activeCompanion ? (
                  <PixelCompanion companion={expedition.activeCompanion} size="medium" />
                ) : (
                  <span className="return-brief-anchor"><Icon name="home" size={28} /></span>
                )}
              </div>
              <p className="return-brief-location">{expedition.location}</p>
              <p className="return-brief-event">{expedition.event}</p>
              <p className="return-brief-duration">
                {formatDuration(stopResult?.session?.active_seconds ?? 0)}
                {expedition.returnKind === 'brief'
                  ? ' · 已记入旅途'
                  : showRelicContent
                    ? ' · 知识遗物已归档'
                    : ' · 已收入冒险日志'}
              </p>
              {stopResult?.primaryTask?.completed && (
                <p className="return-brief-task">抵达路标 · {sessionTitle}</p>
              )}
              {expedition.returnKind === 'short' && showRelicContent && (
                <div className="relic-return return-brief-relic">
                  <span>▤</span><div><small>知识遗物已归档</small><strong>{expedition.knowledgeRelic!.title}</strong><p>{expedition.knowledgeRelic!.content}</p></div>
                </div>
              )}
            </div>
            <footer className="modal-footer"><button className="button button-primary" onClick={returnToHome}>回到小屋</button></footer>
          </div>
        </div>
      ) : (
        <Modal title="远征归来" onClose={returnToHome} size="wide" className="return-result-modal">
        <div className="return-result-scroll">
          <div className={`return-scene${isCompactScene ? ' return-scene-compact' : ''}`}>
            <span className="return-tier">{expedition.tier.name}</span><h2>{expedition.location}</h2><p>{expedition.event}</p>
            <div className="chest"><i /><b>✦</b></div>
          </div>
          <div className="modal-body reward-body">
            {stopResult && (stopResult.primaryTask.completed || stopResult.contributedTasks.length > 0) && <div className={`stop-task-results${useCompactResults ? ' stop-task-results-compact' : ''}`}>
              {stopResult.primaryTask.completed && <div className="stop-result-item">
                <span>主要抵达</span>
                <strong>{sessionTitle}</strong>
                {stopResult.primaryTask.xpAwarded > 0 && <em>旅途经验 +{stopResult.primaryTask.xpAwarded}</em>}
                {stopResult.primaryTask.xpAwarded === 0 && stopResult.primaryTask.reason === 'already_awarded' && <em>这枚路标此前已有记录</em>}
                {stopResult.primaryTask.xpAwarded === 0 && stopResult.primaryTask.reason === 'short_session' && <em>路标已完成</em>}
                {stopResult.primaryTask.xpAwarded === 0 && !stopResult.primaryTask.reason && <em>路标已完成</em>}
              </div>}
              {stopResult.contributedTasks.filter((t: any) => t.completed).map((t: any) => <div key={t.taskId} className="stop-result-item contributed">
                <span>沿途抵达</span>
                <strong>{t.title}</strong>
                {t.xpAwarded > 0 && <em>+{t.xpAwarded} XP</em>}
                {!t.xpAwarded && t.alreadyAwarded && <em>已有记录</em>}
                {t.reason === 'short_session' && <em>行程较短</em>}
                {t.reason === 'xp_cap_reached' && <em>沿途收获已满</em>}
              </div>)}
            </div>}
            <header><div><small>本次收获</small>{expedition.rareFound && <h3>宝箱里闪着少见的光</h3>}</div><span>羁绊 +{expedition.bondXp}</span></header>
            <div className={compactRewards ? 'reward-grid reward-grid-compact' : 'reward-grid'}>
              {drops.map(d => <article className={d.item.rarity} key={d.item.id}><span><Icon name={d.item.icon} size={20} style={{color:d.item.rarity==='rare'?'var(--gold)':'inherit'}} /></span><div><small>{d.item.rarity==='rare'?'稀有宝藏':'常规掉落'}</small><strong>{d.item.name}</strong><p>{d.item.description}</p></div><b>×{d.quantity}</b></article>)}
              {hasRelic && (
                <div className={compactRewards ? 'relic-return relic-return-inline' : 'relic-return relic-return-wide'}>
                  <span>▤</span><div><small>知识遗物已经归档</small><strong>{expedition.knowledgeRelic!.title}</strong>{showRelicContent && <p>{expedition.knowledgeRelic!.content}</p>}</div>
                </div>
              )}
            </div>
            {expedition.newCompanion && <div className="new-friend"><PixelCompanion companion={expedition.newCompanion} size="medium" /><div><small>旅途中传来了新的脚步声</small><h3>遇见了 {expedition.newCompanion.species.name}</h3><p>{expedition.newCompanion.species.description}</p></div></div>}
          </div>
        </div>
        <footer className="modal-footer"><button className="button button-primary" onClick={returnToHome}>把宝藏放回小屋</button></footer>
      </Modal>
    ))}
    {growthEvent && <CompanionGrowthCeremony event={growthEvent} onComplete={completeGrowthCeremony} />}
  </>
}

export function startFocus(taskId?: string) {
  window.dispatchEvent(new CustomEvent('growtharc:start-focus', { detail: taskId || '' }))
}
