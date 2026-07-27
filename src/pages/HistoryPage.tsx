import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { PixelCompanion } from '../components/PixelCompanion'
import { useApp } from '../context/AppContext'
import { formatDate, formatDuration, friendlyError } from '../lib/format'
import type { Companion, ExpeditionResult, FocusSession, LootItem } from '../types'

function dateKey(value: number) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayOfLabel(value: string) {
  const d = new Date(`${value}T12:00:00`)
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]}`
}

function formatTime(ts: number) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(ts))
}

const WARM_PALETTE = ['#b68b5c', '#c4a070', '#9a8c6a', '#7a8c5a', '#8b7a60', '#a08060', '#889060', '#907a58']
function warmAreaColor(hex?: string | null) {
  if (!hex || hex === '#8b9cff' || hex === '#79c0ff' || hex === '#77bdfb' || hex === '#bc91ef' || hex === '#e98aa6') return '#b68b5c'
  // Hash the hex to pick a stable palette index
  let hash = 0
  for (let i = 0; i < (hex || '').length; i++) hash = ((hash << 5) - hash) + hex.charCodeAt(i)
  return WARM_PALETTE[Math.abs(hash) % WARM_PALETTE.length]
}

function contributedLabel(ct: { xp_awarded: number; reason?: string }) {
  if (ct.reason === 'awarded' && ct.xp_awarded > 0) return `已完成 · +${ct.xp_awarded} XP`
  if (ct.reason === 'already_awarded') return '已完成 · 已有记录'
  if (ct.reason === 'short_session') return '已完成 · 行程较短'
  if (ct.reason === 'xp_cap_reached') return '已完成 · 沿途收获已满'
  // 旧数据 reason='' 回退：有 XP 显示 XP，无 XP 显示中性文本
  if (ct.xp_awarded > 0) return `已完成 · +${ct.xp_awarded} XP`
  return '已记录完成'
}

function DropsRow({ drops, max = 3 }: { drops: ExpeditionResult['drops']; max?: number }) {
  const visible = drops.slice(0, max)
  const rest = drops.length - max
  return <span className="chronicle-drops">
    {visible.map((d) => <span key={d.item.id} className={`chronicle-drop ${d.item.rarity}`}>
      <Icon name={d.item.icon} size={15} />{d.item.name}{d.quantity > 1 ? ` ×${d.quantity}` : ''}
    </span>)}
    {rest > 0 && <span className="chronicle-drop-more">另有 {rest} 项</span>}
  </span>
}

export function HistoryPage() {
  const { notify } = useApp()
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [loading, setLoading] = useState(true)
  const [area, setArea] = useState('all')
  const { structure } = useApp()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    window.growthArc.history(200).then(setSessions).catch((error) => notify(friendlyError(error), 'error')).finally(() => setLoading(false))
  }, [notify])

  const filtered = area === 'all' ? sessions : sessions.filter((s) => s.area_id === area)
  const groups = useMemo(() => {
    const map = new Map<string, FocusSession[]>()
    for (const s of filtered) map.set(dateKey(s.ended_at || s.started_at), [...(map.get(dateKey(s.ended_at || s.started_at)) || []), s])
    return [...map.entries()]
  }, [filtered])
  const total = filtered.reduce((sum, s) => sum + Number(s.active_seconds), 0)

  const toggle = (id: string) => setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })

  return <div className="page chronicle-page">
    <header className="page-heading">
      <div><span className="eyebrow">ADVENTURE LOG</span><h1>冒险日志</h1><p>记录你真正走过的每一段路。每次远征自动成档，安静留在这里。</p></div>
      <select className="filter-select" value={area} onChange={(e) => setArea(e.target.value)}>
        <option value="all">全部方向</option>
        {structure?.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </header>

    <section className="history-overview">
      <div><span>累计远征</span><strong>{formatDuration(total)}</strong></div>
      <div><span>远征次数</span><strong>{filtered.length}</strong></div>
      <div><span>平均每次</span><strong>{formatDuration(filtered.length ? total / filtered.length : 0)}</strong></div>
    </section>

    <div className="chronicle-timeline panel">
      {loading ? <div className="loading-state">正在整理冒险日志…</div> : groups.length ? groups.map(([date, items]) => {
        const dayTotal = items.reduce((s, i) => s + Number(i.active_seconds), 0)
        return <section className="chronicle-day" key={date}>
          <header className="chronicle-day-header">
            <div className="chronicle-day-badge">{date.slice(-2)}</div>
            <div className="chronicle-day-title">
              <h3>{dayOfLabel(date)}</h3>
              <span>{items.length} 次远征 · {formatDuration(dayTotal)}</span>
            </div>
          </header>

          <div className="chronicle-entries">
            {items.map((session) => {
              const ex = session.expedition
              const isOpen = expanded.has(session.id)
              const hasOutcome = Boolean(session.outcome)
              const hasRelic = Boolean(ex?.knowledgeRelic)
              const hasNewCompanion = Boolean(ex?.newCompanion)
              const hasContributed = (session.contributedTasks?.length || 0) > 0

              return <article className={`chronicle-entry ${isOpen ? 'is-open' : ''}`} key={session.id}>
                {/* ———— 第一层：真实专注主信息 ———— */}
                <div className="chronicle-main">
                  <div className="chronicle-dot" />
                  <div className="chronicle-head">
                    <div className="chronicle-time">
                      {session.ended_at
                        ? <><span>{formatTime(session.started_at)}</span><span className="chronicle-time-sep">—</span><span>{formatTime(session.ended_at)}</span><span className="chronicle-time-dot">·</span><span>{formatDuration(session.active_seconds)}</span></>
                        : <><span>{formatTime(session.started_at)}</span><span className="chronicle-time-dot">·</span><span>{formatDuration(session.active_seconds)}</span></>
                      }
                    </div>
                    <h4 className="chronicle-content">{session.content}</h4>
                    <div className="chronicle-meta">
                      <span className="chronicle-area"><i style={{ background: warmAreaColor(session.area_color) }} />{session.area_name || '未分类'}</span>
                      {session.task_completed ? <span className="chronicle-task-done"><Icon name="check" size={11} />已完成</span> : null}
                    </div>
                  </div>
                </div>

                {/* ———— 第二层：远征身份 ———— */}
                {ex && <div className="chronicle-expedition">
                  <span className="chronicle-tier">{ex.tier.name}</span>
                  <span className="chronicle-location">{ex.location}</span>
                  {ex.activeCompanion && <span className="chronicle-companion">
                    <PixelCompanion companion={ex.activeCompanion} size="small" />
                    与{ex.activeCompanion.nickname || '伙伴'}同行
                  </span>}
                </div>}

                {/* ———— 第三层：途中见闻 ———— */}
                {ex?.event && <p className="chronicle-event"><small>途中见闻</small>{ex.event}</p>}

                {/* ———— 第四层：本次完成 + 返程所得 ———— */}
                {(hasOutcome || ex) && <div className="chronicle-result">
                  {hasOutcome && <div className="chronicle-outcome"><small>本次完成</small><p>{session.outcome}</p></div>}
                  {ex && <div className="chronicle-return">
                    {(Number(session.xp_awarded) > 0 || ex.bondXp > 0) && <div className="chronicle-growth">
                      <b>成长变化</b>
                      {Number(session.xp_awarded) > 0 && <span className="chronicle-xp">经验 +{session.xp_awarded}</span>}
                      {ex.bondXp > 0 && <span className="chronicle-bond">羁绊 +{ex.bondXp}</span>}
                    </div>}
                    {(session.contributedTasks?.length || 0) > 0 && <div className="chronicle-contrib">
                      <b>沿途抵达</b>
                      {session.contributedTasks!.map(ct => <span key={ct.task_id} className="chronicle-contrib-item">{ct.title} · {contributedLabel(ct)}</span>)}
                    </div>}
                    {ex.drops.length > 0 && <div className="chronicle-items">
                      <b>带回物品</b>
                      <DropsRow drops={ex.drops} />
                    </div>}
                    {ex.rareFound && <span className="chronicle-rare-mark">✦ 稀有发现</span>}
                    {ex.newCompanion && <span className="chronicle-new-friend">新伙伴 · {ex.newCompanion.species.name}</span>}
                  </div>}
                </div>}

                {/* ———— 展开档案 ———— */}
                <div className="chronicle-archive">
                  <button className="chronicle-archive-toggle" onClick={() => toggle(session.id)}>
                    <Icon name={isOpen ? 'close' : 'book'} size={14} />
                    {isOpen ? '收起档案' : '查看完整档案'}
                  </button>
                  {isOpen && <div className="chronicle-archive-body">
                    <div className="chronicle-archive-heading">完整档案</div>
                    <div className="chronicle-archive-meta">
                      <span>计划 {Math.round(Number(session.planned_seconds || 1500) / 60)} 分钟</span>
                      <span>实际专注 {formatDuration(session.active_seconds)}</span>
                      {session.task_completed ? <span>已抵达路标</span> : null}
                    </div>
                    {(session.blocker || session.next_step) && <div className="chronicle-archive-section">
                      {session.blocker && <p><b>困难</b>{session.blocker}</p>}
                      {session.next_step && <p><b>路标</b>{session.next_step}</p>}
                    </div>}
                    {hasRelic && <div className="chronicle-archive-section chronicle-relic">
                      <small className="chronicle-relic-label">知识遗物</small>
                      <div className="chronicle-relic-mark">▤</div>
                      <div>
                        <strong>{ex!.knowledgeRelic!.title}</strong>
                        <p>{ex!.knowledgeRelic!.content}</p>
                        {ex!.knowledgeRelic!.question && <p className="chronicle-relic-q"><b>困惑</b>{ex!.knowledgeRelic!.question}</p>}
                        {ex!.knowledgeRelic!.next_step && <p className="chronicle-relic-next"><b>下一步</b>{ex!.knowledgeRelic!.next_step}</p>}
                      </div>
                    </div>}
                    {hasContributed && <div className="chronicle-archive-section">
                      <b>沿途抵达 · {session.contributedTasks!.length} 处</b>
                      {session.contributedTasks!.map(ct => <p key={ct.task_id}>{ct.title} · {contributedLabel(ct)}</p>)}
                    </div>}
                    {hasNewCompanion && <div className="chronicle-archive-section chronicle-new-companion">
                      <PixelCompanion companion={ex!.newCompanion} size="medium" />
                      <div>
                        <strong>遇见新伙伴 · {ex!.newCompanion!.species.name}</strong>
                        <p>{ex!.newCompanion!.species.description}</p>
                      </div>
                    </div>}
                    {ex && ex.drops.length > 3 && <div className="chronicle-archive-section">
                      <b>全部带回物品</b>
                      <div className="chronicle-drops-full">
                        {ex.drops.map((d) => <span key={d.item.id} className={`chronicle-drop ${d.item.rarity}`}>
                          <Icon name={d.item.icon} size={15} />{d.item.name} ×{d.quantity}<small>{d.item.description}</small>
                        </span>)}
                      </div>
                    </div>}
                  </div>}
                </div>
              </article>
            })}
          </div>
        </section>
    }) : <div className="empty-state tall"><Icon name="history" size={32} /><strong>冒险日志还没有内容</strong><span>完成第一次远征后，属于你的旅途记录会从这里开始。</span></div>}
    </div>
  </div>
}
