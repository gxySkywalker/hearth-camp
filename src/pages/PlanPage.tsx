import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { startFocus } from '../components/FocusController'
import { useApp } from '../context/AppContext'
import { friendlyError } from '../lib/format'
import type { Structure, Task } from '../types'

type FormType = 'area' | 'goal' | 'task' | 'area-manage' | null
type StatusFilter = 'active' | 'done' | 'archived'

const COLORS = [
  { key: 'hearth', name: '壁炉橙', value: '#c9783d' },
  { key: 'amber', name: '琥珀金', value: '#dba84c' },
  { key: 'wheat', name: '麦穗黄', value: '#c4a44a' },
  { key: 'moss', name: '苔藓绿', value: '#728c5a' },
  { key: 'pine', name: '松林绿', value: '#4a6950' },
  { key: 'lake', name: '湖水蓝', value: '#5a7a8a' },
  { key: 'ridge', name: '远山蓝', value: '#6a7488' },
  { key: 'dusk', name: '暮色紫', value: '#7a6a85' },
  { key: 'brick', name: '砖红', value: '#a0553a' },
  { key: 'chestnut', name: '栗木棕', value: '#8b6040' },
  { key: 'slate', name: '石板灰', value: '#788070' },
  { key: 'cream', name: '奶油褐', value: '#a08860' },
]

export function PlanPage() {
  const { structure: globalStructure, refresh, notify } = useApp()
  const [managed, setManaged] = useState<Structure | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [selectedArea, setSelectedArea] = useState('')
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null)
  const [view, setView] = useState<'map' | 'overview'>('map')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [form, setForm] = useState<FormType>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [color, setColor] = useState(COLORS[0].value)
  const [busy, setBusy] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [duplicate, setDuplicate] = useState<{ title: string; areaName: string; goalName: string | null } | null>(null)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const menuBtnRef = useRef<Map<string, HTMLButtonElement>>(new Map())
  const dragRef = useRef<{ id: string } | null>(null)
  const helpBtnRef = useRef<HTMLButtonElement>(null)

  const normTitle = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase()

  const loadManaged = useCallback(async () => {
    try { setManaged(await window.growthArc.structure.getAll()); setLoadError(false) }
    catch (e) { setLoadError(true); notify(friendlyError(e), 'error') }
  }, [notify])

  useEffect(() => { loadManaged() }, [loadManaged])

  useEffect(() => {
    if (!openMenu) return
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.planner-task-dropdown') && !(e.target as HTMLElement).closest('.planner-task-menu-btn')) setOpenMenu(null) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null) }
    document.addEventListener('click', close)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('click', close); window.removeEventListener('keydown', esc) }
  }, [openMenu])

  const openMenuAt = (taskId: string, btn: HTMLButtonElement | null) => {
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const x = Math.min(rect.left, window.innerWidth - 140)
    const y = rect.bottom + 4 > window.innerHeight - 200 ? rect.top - 200 : rect.bottom + 4
    setMenuPos({ x, y })
    setOpenMenu(openMenu === taskId ? null : taskId)
  }

  const activeTasks = useMemo(() => (managed?.tasks || []).filter(t => t.status === 'todo' || t.status === 'doing'), [managed])
  const doneTasks = useMemo(() => (managed?.tasks || []).filter(t => t.status === 'done'), [managed])
  const archivedGlobal = useMemo(() => (managed?.tasks || []).filter(t => t.status === 'archived'), [managed])
  const counts = useMemo(() => managed ? Object.fromEntries(managed.areas.map(a => [a.id, activeTasks.filter(t => t.area_id === a.id).length])) : {}, [managed, activeTasks])

  if (!globalStructure) return null
  if (!managed) return <div className="page cartography-page"><div className="loading-state">正在展开地图…</div></div>
  if (loadError) return <div className="page cartography-page"><div className="empty-state tall"><Icon name="plan" size={32} /><strong>制图桌暂时无法载入</strong><span>请重启应用后重试。</span><button className="button button-secondary" onClick={() => { setLoadError(false); loadManaged() }}>重新加载</button></div></div>

  const areaId = selectedArea || managed.areas[0]?.id || ''
  const area = managed.areas.find(a => a.id === areaId)
  const activeAreas = managed.areas.filter(a => !a.archived)
  const archivedAreas = managed.areas.filter(a => a.archived)
  const goals = managed.goals.filter(g => g.area_id === areaId && g.status !== 'archived')
  const filtered = statusFilter === 'active' ? activeTasks : statusFilter === 'done' ? doneTasks : archivedGlobal
  const displayed = view === 'overview' || statusFilter !== 'active'
    ? filtered
    : filtered.filter(t => t.area_id === areaId && (!selectedGoal || t.goal_id === selectedGoal))
  const areaTasks = activeTasks.filter(t => t.area_id === areaId)
  const todayId = activeTasks.length > 0 ? activeTasks[0].id : null

  const openForm = (type: FormType, edit?: string) => {
    setName(''); setDesc(''); setEditId(null)
    if (type === 'area' && edit) { const a = managed.areas.find(x => x.id === edit); if (a) { setName(a.name); setColor(a.color); setEditId(edit) } }
    else if (type === 'goal' && edit) { const g = managed.goals.find(x => x.id === edit); if (g) { setName(g.title); setDesc(g.description || ''); setEditId(edit) } }
    else if (type === 'task' && edit) { const t = managed.tasks.find(x => x.id === edit); if (t) { setName(t.title); setDesc(t.notes || ''); setEditId(edit) } }
    setForm(type)
  }

  const submit = async (skipDupCheck = false) => {
    setBusy(true)
    try {
      if (form === 'task' && !editId && !skipDupCheck) {
        const normed = normTitle(name)
        const dup = managed!.tasks.find(t => t.area_id === areaId && normTitle(t.title) === normed && (t.status === 'todo' || t.status === 'doing'))
        if (dup) {
          const dupArea = managed!.areas.find(a => a.id === dup.area_id)
          const dupGoal = dup.goal_id ? managed!.goals.find(g => g.id === dup.goal_id) : null
          setDuplicate({ title: dup.title, areaName: dupArea?.name || '未分类', goalName: dupGoal?.title || null })
          setBusy(false); return
        }
      }
      setDuplicate(null)
      if (form === 'area') { if (editId) await window.growthArc.structure.updateArea(editId, { name, color }); else await window.growthArc.structure.createArea({ name, color }) }
      else if (form === 'goal') { if (editId) await window.growthArc.structure.updateGoal(editId, { title: name, description: desc }); else await window.growthArc.structure.createGoal({ areaId, title: name, description: desc }) }
      else if (form === 'task') { if (editId) await window.growthArc.structure.updateTask(editId, { title: name, notes: desc, areaId, goalId: selectedGoal }); else await window.growthArc.structure.createTask({ areaId, goalId: selectedGoal, title: name, notes: desc }) }
      setForm(null); notify(editId ? '已更新' : '路标已放入地图', 'success'); await Promise.all([refresh(), loadManaged()])
    } catch (e) { notify(friendlyError(e), 'error') } finally { setBusy(false) }
  }

  const markDone = async (id: string) => {
    try {
      const result = await window.growthArc.structure.manualComplete(id)
      if (result.alreadyAwarded) notify('再次抵达这枚路标\n完成经验已在上一次抵达时领取', 'info')
      else if (result.xpAwarded > 0) notify(`已抵达这枚路标\n旅途经验 +${result.xpAwarded}\n这段路已经被写进你的旅途。`, 'success')
      else notify('已抵达这枚路标\n这枚路标没有直接关联的专注记录，因此本次不追加完成经验。', 'info')
      await Promise.all([refresh(), loadManaged()])
    } catch (e) { notify(friendlyError(e), 'error') }
  }
  const archiveTask = async (id: string) => {
    try { await window.growthArc.structure.updateTask(id, { status: 'archived' }); notify('已归档', 'info'); await Promise.all([refresh(), loadManaged()]) }
    catch (e) { notify(friendlyError(e), 'error') }
  }
  const restoreTask = async (id: string) => {
    try { const r = await window.growthArc.structure.restoreTask(id); notify(r.status === 'done' ? '已恢复至已完成' : '已恢复至进行中', 'success'); await Promise.all([refresh(), loadManaged()]) }
    catch (e) { notify(friendlyError(e), 'error') }
  }
  const reopenTask = async (id: string) => {
    try { await window.growthArc.structure.reopenTask(id); notify('已重新打开', 'success'); await Promise.all([refresh(), loadManaged()]) }
    catch (e) { notify(friendlyError(e), 'error') }
  }
  const deleteTask = async (id: string) => {
    if (!window.confirm('确定删除这个路标吗？此操作不可撤销。')) return
    try { await window.growthArc.structure.deleteTask(id); notify('已删除', 'info'); await Promise.all([refresh(), loadManaged()]) }
    catch (e) { notify(friendlyError(e), 'error') }
  }

  const move = async (id: string, dir: -1 | 1) => {
    const list = displayed.filter(t => t.status === 'todo' || t.status === 'doing')
    const idx = list.findIndex(t => t.id === id); if (idx < 0) return
    const target = list[idx + dir]; if (!target) return
    try { await window.growthArc.structure.reorderTasks([{ id, sortOrder: target.sort_order }, { id: target.id, sortOrder: list[idx].sort_order }]); await Promise.all([refresh(), loadManaged()]) }
    catch (e) { notify(friendlyError(e), 'error') }
  }

  const onDragStart = (task: Task) => { dragRef.current = { id: task.id } }
  const onDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const onDrop = async (targetId: string) => {
    if (!dragRef.current || dragRef.current.id === targetId) return
    const list = [...displayed.filter(t => t.status === 'todo' || t.status === 'doing')]
    const srcIdx = list.findIndex(t => t.id === dragRef.current!.id); const tgtIdx = list.findIndex(t => t.id === targetId)
    if (srcIdx < 0 || tgtIdx < 0) return
    list.splice(srcIdx, 1); list.splice(tgtIdx, 0, { id: dragRef.current.id } as Task)
    dragRef.current = null
    try { await window.growthArc.structure.reorderTasks(list.map((t, i) => ({ id: t.id, sortOrder: i + 1 }))); await Promise.all([refresh(), loadManaged()]) }
    catch (e) { notify(friendlyError(e), 'error') }
  }

  const archiveArea = async (id: string) => {
    try { await window.growthArc.structure.archiveArea(id); notify('方向已归档', 'info'); await Promise.all([refresh(), loadManaged()]) }
    catch (e) { notify(friendlyError(e), 'error') }
  }
  const restoreArea = async (id: string) => {
    try { await window.growthArc.structure.restoreArea(id); notify('方向已恢复', 'success'); await Promise.all([refresh(), loadManaged()]) }
    catch (e) { notify(friendlyError(e), 'error') }
  }
  const deleteArea = async (id: string) => {
    if (!window.confirm('确定删除这个方向吗？此操作不可撤销。')) return
    try { await window.growthArc.structure.deleteArea(id); notify('方向已删除', 'info'); await Promise.all([refresh(), loadManaged()]) }
    catch (e) { notify(friendlyError(e), 'error') }
  }

  const taskAreaName = (t: Task) => managed.areas.find(a => a.id === t.area_id)?.name || '未分类'
  const taskGoalName = (t: Task) => t.goal_id ? managed.goals.find(g => g.id === t.goal_id)?.title : null
  const taskMetaText = (t: Task, isActive: boolean, isDone: boolean) => {
    const parts = [taskAreaName(t)]
    if (taskGoalName(t)) parts.push(taskGoalName(t)!)
    if (isActive && t.status === 'doing') parts.push('进行中')
    if (isDone && t.completed_at) parts.push(new Date(t.completed_at).toLocaleDateString('zh-CN'))
    if (!isActive && !isDone) parts.push('已归档')
    return parts.join(' · ')
  }
  const modalTitle = form === 'area' ? (editId ? '编辑方向' : '新建旅途方向')
    : form === 'area-manage' ? '方向管理'
    : form === 'goal' ? (editId ? '编辑目标分组' : '新建目标分组')
    : editId ? '编辑路标' : '放置路标'

  return <div className="page cartography-page">
    <header className="cartography-head">
        <div><span className="eyebrow">制图桌</span><h1>{view === 'map' ? '路标地图' : '计划总览'}</h1></div>
      <div className="cartography-head-actions">
        <div className="segmented">
          <button className={view === 'map' ? 'active' : ''} onClick={() => { setView('map'); setStatusFilter('active'); setHelpOpen(false) }}>路标地图</button>
          <button className={view === 'overview' ? 'active' : ''} onClick={() => { setView('overview'); setHelpOpen(false) }}>计划总览</button>
        </div>
        <button className="button button-primary" onClick={() => openForm('task')}><Icon name="plus" size={17} />放置路标</button>
      </div>
    </header>

    <div className="cartography-body">
      <aside className="cartography-sidebar panel">
        <div className="section-heading">
          <div style={{display:'flex',alignItems:'baseline',gap:6}}><span className="eyebrow">旅途方向</span></div>
          <div style={{display:'flex',gap:4}}>
            <button className="icon-button" onClick={() => openForm('area')} title="新建方向"><Icon name="plus" size={18} /></button>
            <button className="icon-button" onClick={() => setForm('area-manage')} title="管理方向"><Icon name="settings" size={16} /></button>
          </div>
        </div>
        <div className="area-nav">{activeAreas.map(a => <button key={a.id} className={a.id === areaId ? 'active' : ''} onClick={() => { setSelectedArea(a.id); setSelectedGoal(null); setStatusFilter('active') }}><i style={{ background: a.color }} /><span>{a.name}</span><b>{counts[a.id] || 0}</b></button>)}</div>
      </aside>

      <main className="cartography-main panel">
        <div className="cartography-tabs">
          <button className={statusFilter === 'active' ? 'active' : ''} onClick={() => { setStatusFilter('active'); setHelpOpen(false) }}>进行中 {activeTasks.length}</button>
          <button className={statusFilter === 'done' ? 'active' : ''} onClick={() => { setStatusFilter('done'); setHelpOpen(false) }}>已完成 {doneTasks.length}</button>
          <button className={statusFilter === 'archived' ? 'active' : ''} onClick={() => { setStatusFilter('archived'); setHelpOpen(false) }}>已归档 {archivedGlobal.length}</button>
          <span style={{position:'relative',marginLeft:'auto'}}>
            <button ref={helpBtnRef} className="text-button" onClick={() => setHelpOpen(v => !v)}>帮助</button>
            {helpOpen && createPortal(<HelpPopover onClose={() => setHelpOpen(false)} anchor={helpBtnRef.current?.getBoundingClientRect()} />, document.body)}
          </span>
        </div>

        {view === 'map' && statusFilter === 'active' && <div className="cartography-map-head">
          <span className="color-dot large" style={{ background: area?.color }} /><div><span className="eyebrow">当前方向</span><h2>{area?.name || '未命名区域'}</h2></div>
          <button className="button button-secondary button-small" onClick={() => openForm('goal')}><Icon name="flag" size={14} />新建目标分组</button>
        </div>}
        {view === 'map' && statusFilter === 'active' && goals.length > 0 && <div className="goal-tabs">
          <button className={!selectedGoal ? 'active' : ''} onClick={() => setSelectedGoal(null)}>全部路标</button>
          {goals.map(g => <button key={g.id} className={selectedGoal === g.id ? 'active' : ''} onClick={() => setSelectedGoal(g.id)}>{g.title}<span>{activeTasks.filter(t => t.goal_id === g.id).length}</span></button>)}
        </div>}

        <div className="cartography-list">
          {displayed.length ? displayed.map((task, idx) => {
            const isActive = statusFilter === 'active'
            const isDone = statusFilter === 'done'
            const isTodayTask = isActive && todayId === task.id
            const displayIdx = statusFilter === 'active'
              ? (view === 'overview' ? activeTasks.findIndex(t => t.id === task.id) + 1 : areaTasks.findIndex(t => t.id === task.id) + 1)
              : idx + 1
            return <article key={task.id} className={`planner-task ${task.status === 'doing' ? 'is-doing' : ''} ${isTodayTask ? 'is-today' : ''}`}
              draggable={isActive} onDragStart={() => onDragStart(task)} onDragOver={onDragOver} onDrop={() => onDrop(task.id)}
            >
              {isActive && <span className="planner-task-handle" title="拖动排序">⋮⋮</span>}
              {!isActive && <span className="planner-task-handle" style={{cursor:'default',opacity:.3}}> </span>}
              <span className="planner-task-index">{String(displayIdx).padStart(2, '0')}</span>
              <div className="planner-task-body">
                <div className="planner-task-title-row">
                  <strong>{task.title}</strong>
                  {isTodayTask && <span className="planner-task-today">⚑ 今日路标</span>}
                </div>
                <span className="planner-task-meta">{taskMetaText(task, isActive, isDone)}</span>
              </div>
              <div className="planner-task-actions">
                {isActive && <button className={isTodayTask ? 'task-play' : 'task-play-secondary'} onClick={() => startFocus(task.id)}><Icon name="play" size={15} />出发</button>}
                {isDone && <button className="planner-task-mini" onClick={() => reopenTask(task.id)}>重新打开</button>}
                {!isActive && !isDone && <button className="planner-task-mini" onClick={() => restoreTask(task.id)}>恢复路标</button>}
                <button className="planner-task-menu-btn" ref={el => { if (el) menuBtnRef.current.set(task.id, el) }} onClick={e => { e.stopPropagation(); openMenuAt(task.id, menuBtnRef.current.get(task.id) || null) }} title="更多">⋯</button>
              </div>
            </article>
          }) : <div className="empty-state map-empty">
            <Icon name="plan" size={30} /><strong>{statusFilter === 'active' ? '还没有路标' : statusFilter === 'done' ? '还没有完成的路标' : '还没有归档的路标'}</strong>
          </div>}
        </div>
      </main>
    </div>

    {openMenu && createPortal(
      <div className="planner-task-dropdown" style={{ position: 'fixed', left: menuPos.x, top: menuPos.y, zIndex: 500 }}>
        {statusFilter === 'active' && <button onClick={() => { const id = openMenu; setOpenMenu(null); markDone(id) }}>标记完成</button>}
        {statusFilter === 'active' && <button onClick={() => { const id = openMenu; setOpenMenu(null); move(id, -1) }}>上移</button>}
        {statusFilter === 'active' && <button onClick={() => { const id = openMenu; setOpenMenu(null); move(id, 1) }}>下移</button>}
        <button onClick={() => { const id = openMenu; setOpenMenu(null); openForm('task', id) }}>编辑</button>
        {statusFilter === 'active' && <button onClick={() => { const id = openMenu; setOpenMenu(null); archiveTask(id) }}>移至归档</button>}
        {statusFilter === 'done' && <button onClick={() => { const id = openMenu; setOpenMenu(null); reopenTask(id) }}>重新打开</button>}
        {statusFilter === 'done' && <button onClick={() => { const id = openMenu; setOpenMenu(null); archiveTask(id) }}>移至归档</button>}
        {statusFilter === 'archived' && <button onClick={() => { const id = openMenu; setOpenMenu(null); restoreTask(id) }}>恢复路标</button>}
        <button className="danger" onClick={() => { const id = openMenu; setOpenMenu(null); deleteTask(id) }}>删除</button>
      </div>, document.body)}

    {form && form !== 'area-manage' && <Modal title={modalTitle} onClose={() => setForm(null)}>
      <div className="modal-body form-stack">
        <label>{form === 'area' ? '方向名称' : form === 'goal' ? '分组名称' : '路标名称'}<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={form === 'area' ? '例如：Java 后端' : form === 'goal' ? '例如：Redis 专题' : '例如：实现分布式锁'} /></label>
        {(form === 'goal' || form === 'task') && <label>说明（可选）<textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} /></label>}
        {form === 'area' && <fieldset className="color-picker"><legend>识别颜色</legend>{COLORS.map(c => <button key={c.key} className={color === c.value ? 'active' : ''} style={{ background: c.value }} onClick={() => setColor(c.value)} title={c.name} aria-label={c.name} />)}</fieldset>}
        {form === 'task' && !editId && <div className="settlement-note">完成远征并确认路标完成后，将根据真实专注时长获得旅途经验。</div>}
        {form === 'task' && editId && <label>所属方向<select value={areaId} onChange={e => setSelectedArea(e.target.value)}>{managed.areas.filter(a => !a.archived).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
        {form === 'task' && !editId && <label>关联目标分组（可选）<select value={selectedGoal || ''} onChange={e => setSelectedGoal(e.target.value || null)}><option value="">不关联</option>{goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>}
      </div>
      <footer className="modal-footer"><button className="button button-ghost" onClick={() => setForm(null)}>取消</button><button className="button button-primary" disabled={busy || !name.trim()} onClick={() => submit()}>保存</button></footer>
    </Modal>}

    {duplicate && <Modal title="发现相似路标" onClose={() => setDuplicate(null)}>
      <div className="modal-body">
        <p style={{margin:0,color:'var(--muted)',fontSize:14}}>当前方向「{duplicate.areaName}」中已有：</p>
        <div style={{margin:'8px 0',padding:'8px 10px',background:'rgba(235,219,191,.5)',border:'1px solid rgba(91,62,42,.12)'}}>
          <strong style={{fontSize:16}}>「{duplicate.title}」</strong>
          {duplicate.goalName && <p style={{margin:'4px 0 0',color:'var(--muted)',fontSize:13}}>目标分组：{duplicate.goalName}</p>}
          <p style={{margin:'2px 0 0',color:'var(--muted)',fontSize:12}}>状态：进行中</p>
        </div>
        <p style={{margin:0,color:'var(--muted)',fontSize:12}}>仍然可以放置新路标，这只是一个提醒。</p>
      </div>
      <footer className="modal-footer">
        <button className="button button-ghost" onClick={() => setDuplicate(null)}>返回修改</button>
        <button className="button button-primary" onClick={() => { setDuplicate(null); submit(true) }}>仍然放置</button>
      </footer>
    </Modal>}

    {form === 'area-manage' && <Modal title="方向管理" onClose={() => setForm(null)} size="wide">
      <div className="modal-body"><div style={{display:'flex',flexDirection:'column',gap:8}}>
        {activeAreas.map(a => <div key={a.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid rgba(91,62,42,.08)'}}>
          <i style={{width:14,height:14,background:a.color,flexShrink:0}} /><span style={{flex:1,fontSize:15,fontWeight:700}}>{a.name}</span><span style={{color:'var(--muted)',fontSize:13}}>{counts[a.id] || 0} 路标</span>
          <button className="text-button" onClick={() => { setForm(null); openForm('area', a.id) }}>编辑</button>
          <button className="text-button" onClick={() => archiveArea(a.id)}>归档</button>
          <button className="text-button" style={{color:'var(--red)'}} onClick={() => deleteArea(a.id)}>删除</button>
        </div>)}
        {archivedAreas.length > 0 && <div style={{paddingTop:8,borderTop:'1px solid rgba(91,62,42,.15)'}}><span className="eyebrow" style={{marginBottom:6,display:'block'}}>已归档</span>
          {archivedAreas.map(a => <div key={a.id} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',opacity:.6}}><i style={{width:12,height:12,background:a.color,flexShrink:0}} /><span style={{flex:1,fontSize:14}}>{a.name}</span><button className="text-button" onClick={() => restoreArea(a.id)}>恢复</button></div>)}
        </div>}
      </div></div>
    </Modal>}
  </div>
}

function HelpPopover({ onClose, anchor }: { onClose: () => void; anchor?: DOMRect }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    setTimeout(() => document.addEventListener('click', close), 0)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('click', close); window.removeEventListener('keydown', esc) }
  }, [onClose])
  const top = anchor ? Math.min(anchor.bottom + 6, window.innerHeight - 240) : 120
  const left = anchor ? Math.min(anchor.left - 100, window.innerWidth - 380) : window.innerWidth - 380
  return <div ref={ref} className="help-popover" style={{ position: 'fixed', left, top, zIndex: 500, width: 340 }}>
    <div className="help-popover-item"><strong>路标</strong><p>一件可以真正完成的事，可作为远征目标。</p></div>
    <div className="help-popover-item"><strong>目标分组</strong><p>用来整理一组相关路标，例如章节或项目阶段。</p></div>
    <div className="help-popover-item"><strong>旅途方向</strong><p>用于区分不同方向，例如算法、Java 后端或秋招准备。</p></div>
  </div>
}
