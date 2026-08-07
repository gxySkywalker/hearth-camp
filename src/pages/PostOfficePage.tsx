import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { PageId, NavState, NavAction, LetterListItem } from '../types'
import { Icon } from '../components/Icon'
import { LetterViewer } from '../components/LetterViewer'
import { CATEGORY_LABELS, canViewObservatory, observatoryLinkLabel, type MockCategory, type MockLetter, type ObservatoryTarget } from '../lib/mailMock'
import { playUISound } from '../lib/audio'
import mailReadImage from '../../assets/art/mail/mail_read.png'
import mailSpecialImage from '../../assets/art/mail/mail_special.png'
import mailUnreadImage from '../../assets/art/mail/mail_unread.png'

// ── IPC-derived letter → UI-compatible MockLetter adapter ─────

function senderForType(letterType: string, periodKey?: string): string {
  if (letterType === 'festival') return '小镇'
  if (letterType === 'memorial') {
    // Welcome letter comes from 小天使 herself
    if (periodKey && periodKey.startsWith('welcome:')) return '小天使'
    return '小镇'
  }
  return '小天使'
}

function dateLabelFromPeriod(letterType: string, periodStart: number, periodEnd?: number): string {
  const d = new Date(periodStart)
  const year = d.getFullYear()
  if (letterType === 'weekly' && periodEnd) {
    const e = new Date(periodEnd - 86400000) // last day of the period
    return `${year}年${d.getMonth() + 1}月${d.getDate()}日—${e.getMonth() + 1}月${e.getDate()}日`
  }
  return `${year}年${d.getMonth() + 1}月${d.getDate()}日`
}

function categoryFromType(letterType: string): MockCategory {
  if (letterType === 'daily') return 'daily'
  if (letterType === 'weekly') return 'weekly'
  if (letterType === 'festival') return 'festival'
  if (letterType === 'memorial') return 'memorial'
  return 'world'
}

function observatoryTargetFromPeriod(letterType: string, periodStart: number, periodEnd: number): ObservatoryTarget | undefined {
  if (letterType === 'daily') return { periodType: 'daily', periodStart: ymd(periodStart), periodEnd: ymd(periodStart) }
  if (letterType === 'weekly') return { periodType: 'weekly', periodStart: ymd(periodStart), periodEnd: ymd(periodEnd - 86400000) }
  return undefined
}

function ymd(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Convert an IPC LetterListItem + cached detail into a UI MockLetter */
function ipcToLetter(item: LetterListItem, detail?: { body: string; factSummary: any; replyText: string | null }): MockLetter {
  return {
    id: item.id,
    category: categoryFromType(item.letterType),
    subtype: item.letterType,
    senderName: senderForType(item.letterType, item.periodKey),
    subject: item.subject,
    body: detail?.body ?? item.bodyPreview ?? '',
    dateLabel: dateLabelFromPeriod(item.letterType, item.periodStart, item.periodEnd),
    occurredAt: ymd(item.periodStart),
    isRead: item.isRead,
    hasReply: detail ? (detail.replyText ?? '').trim().length > 0 : false,
    replyText: detail?.replyText ?? '',
    factSummary: detail?.factSummary,
    observatoryTarget: observatoryTargetFromPeriod(item.letterType, item.periodStart, item.periodEnd),
  }
}

// ── Session persistence (notes & memories only — read/reply migrate to IPC) ──
const SK_NOTES = 'growth-arc.post-office.prototype.notes'
const SK_MEMORIES = 'growth-arc.post-office.prototype.memories'
const HISTORY_BATCH_SIZE = 50

function loadJson<T>(key: string, fallback: T): T {
  try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback }
  catch { return fallback }
}
function saveJson(key: string, value: unknown) { sessionStorage.setItem(key, JSON.stringify(value)) }

function letterDateLabel(l: MockLetter) { return l.dateLabel }
function letterSubLabel(l: MockLetter) {
  if (l.category === 'daily') return '每日来信'
  if (l.category === 'weekly') return '每周来信'
  if (l.category === 'festival') {
    if (l.subtype.includes('climax')) return '归灯夜'
    return '节庆来信'
  }
  if (l.category === 'memorial') return '纪念来信'
  if (l.category === 'world') return '友人来信'
  return l.category
}

type InteractionMode = 'note' | 'memory' | 'reply' | 'none'

function emptyMessage(cat: MockCategory): string {
  if (cat === 'daily') return '今天还没有来信。\n完成一次远征后，小天使会整理今日的足迹。'
  if (cat === 'weekly') return '这一页木格还空着。\n下一段旅途结束后，小天使会替你收好新的星页。'
  if (cat === 'festival') return '这里暂时没有节庆来信。\n归灯季到来时，会有新的消息。'
  if (cat === 'memorial') return '纪念来信将在未来开启。\n那些重要的日子会被记得。'
  if (cat === 'world') return '还没有来自友人的消息。\n商队和旅人的信会随着时间抵达。'
  return '这里还没有信。'
}

function getInteractionMode(letter: MockLetter): InteractionMode {
  if (letter.category === 'daily' || letter.category === 'weekly') return 'note'
  if (letter.category === 'festival' || letter.category === 'memorial') return 'memory'
  if (letter.category === 'world') return 'reply'
  return 'none'
}

interface PostOfficePageProps {
  onNavigate?: (target: PageId | { page: PageId; obsTarget?: ObservatoryTarget }) => void
  navState: NavState
  dispatch: (action: NavAction) => void
  actionsRef: React.MutableRefObject<{
    poCatCount: number; poLetterCount: number
    poSetCategory: (index: number) => void
    poOpenLetter: (index: number) => void
    poBackFromContent: () => void
  }>
}

export function PostOfficePage({ onNavigate, navState, dispatch, actionsRef }: PostOfficePageProps) {
  const [activeCategory, setActiveCategory] = useState<MockCategory>('new')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // ── Real mail data from IPC ─────────────────────────────────
  const [ipcLetters, setIpcLetters] = useState<LetterListItem[] | null>(null)
  const [ipcLoading, setIpcLoading] = useState(true)
  const [hasOlderLetters, setHasOlderLetters] = useState(false)
  const [loadingOlderLetters, setLoadingOlderLetters] = useState(false)
  const detailCache = useRef<Map<string, { body: string; factSummary: any; replyText: string | null; aiStatus?: string }>>(new Map())
  const [detailRevision, refreshLetterDetail] = useState(0)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [replyMap, setReplyMap] = useState<Record<string, string>>({})

  // Bootstrap: ensure periodic letters + load list
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const list = await window.growthArc.mail.list({ limit: HISTORY_BATCH_SIZE, offset: 0 })
        if (cancelled) return
        setIpcLetters(list)
        setHasOlderLetters(list.length === HISTORY_BATCH_SIZE)
        setReadIds(new Set(list.filter(l => l.isRead).map(l => l.id)))
      } catch (e) {
        console.warn('[mail] IPC init failed', e)
      } finally {
        if (!cancelled) setIpcLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // A letter can be opened while its optional AI narration is still running
  // in Electron. Refresh that one cached detail until the worker finishes, so
  // the completed narration replaces the fallback without asking the player
  // to leave the post office or restart the app.
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0
    const poll = async () => {
      try {
        const detail = await window.growthArc.mail.get(selectedId)
        if (cancelled) return
        const previous = detailCache.current.get(selectedId)
        detailCache.current.set(selectedId, {
          body: detail.body,
          factSummary: detail.factSummary,
          replyText: detail.replyText,
          aiStatus: detail.aiStatus,
        })
        if (!previous || previous.body !== detail.body || previous.aiStatus !== detail.aiStatus) {
          refreshLetterDetail((revision) => revision + 1)
        }
        attempts += 1
        if ((detail.aiStatus === 'pending' || detail.aiStatus === 'skipped') && attempts < 30) {
          timer = setTimeout(poll, 2000)
        }
      } catch (error) {
        if (!cancelled && attempts++ < 5) timer = setTimeout(poll, 2500)
      }
    }
    timer = setTimeout(poll, 1200)
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [selectedId])

  const loadOlderLetters = useCallback(async () => {
    if (loadingOlderLetters || !hasOlderLetters) return
    setLoadingOlderLetters(true)
    try {
      const offset = ipcLetters?.length || 0
      const older = await window.growthArc.mail.list({ limit: HISTORY_BATCH_SIZE, offset })
      setIpcLetters((current) => {
        const existing = new Set((current || []).map((letter) => letter.id))
        return [...(current || []), ...older.filter((letter) => !existing.has(letter.id))]
      })
      setHasOlderLetters(older.length === HISTORY_BATCH_SIZE)
    } catch (error) {
      console.warn('[mail] older letters could not be opened', error)
    } finally {
      setLoadingOlderLetters(false)
    }
  }, [hasOlderLetters, ipcLetters, loadingOlderLetters])

  const [noteMap, setNoteMap] = useState<Record<string, string>>(() => loadJson(SK_NOTES, {}))
  const [memoryMap, setMemoryMap] = useState<Record<string, string>>(() => loadJson(SK_MEMORIES, {}))
  const [memoryOpen, setMemoryOpen] = useState<Record<string, boolean>>({})
  const [sealJustBroke, setSealJustBroke] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  useEffect(() => {
    if (navState.zone === 'postoffice' && navState.poZone === 'content') {
      dispatch({ type: 'SET_PO_ZONE', poZone: 'categories' })
    }
  }, [])

  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openAnimTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { saveJson(SK_NOTES, noteMap) }, [noteMap])
  useEffect(() => { saveJson(SK_MEMORIES, memoryMap) }, [memoryMap])
  useEffect(() => () => { if (readTimer.current) clearTimeout(readTimer.current) }, [])
  useEffect(() => () => { if (openAnimTimer.current) clearTimeout(openAnimTimer.current) }, [])

  // ── Derive letter arrays ────────────────────────────────────
  const allLetters: MockLetter[] = useMemo(() => {
    const ipc = ipcLetters
    if (ipc) {
      return ipc.map(item => {
        const detail = detailCache.current.get(item.id)
        return ipcToLetter(item, detail)
      })
    }
    return []
  }, [ipcLetters])

  const newLetters = useMemo(() => allLetters.filter(l => !l.isRead), [allLetters])

  const lettersByCat = useMemo(() => {
    const map: Record<string, MockLetter[]> = {}
    for (const cat of ['daily', 'weekly', 'festival', 'memorial', 'world'] as MockCategory[]) {
      map[cat] = allLetters.filter(l => l.category === cat)
    }
    map['all'] = allLetters.filter(l => readIds.has(l.id))
    return map
  }, [allLetters, readIds])

  const letters = activeCategory === 'new' ? newLetters
    : (lettersByCat[activeCategory] || [])
  const hasUnread = newLetters.length > 0

  const ALL_CATEGORIES: MockCategory[] = ['daily', 'weekly', 'festival', 'memorial', 'world']
  const categories: MockCategory[] = useMemo(() => {
    const cats: MockCategory[] = ['new']
    cats.push(...ALL_CATEGORIES)
    cats.push('all')
    return cats
  }, [])

  const categoryHasUnread = (cat: MockCategory) => {
    if (cat === 'new' || cat === 'all') return false
    return (lettersByCat[cat] || []).some(l => !readIds.has(l.id))
  }

  const selectedLetter = allLetters.find(l => l.id === selectedId) || null

  // ── Expose actions for global keyboard handler ──────────────
  actionsRef.current = {
    poCatCount: categories.length,
    poLetterCount: letters.length,
    poSetCategory: (i: number) => {
      const cat = categories[i]
      if (cat != null) { setActiveCategory(cat); setSelectedId(null) }
    },
    poOpenLetter: (i: number) => {
      const letter = letters[i]
      if (letter) openLetter(letter)
    },
    poBackFromContent: () => { setSelectedId(null) },
  }

  // ── Read state via IPC ──────────────────────────────────────
  const markRead = useCallback((id: string) => {
    if (!readIds.has(id)) {
      setReadIds(prev => new Set([...prev, id]))
      setSealJustBroke(id)
      if (readTimer.current) clearTimeout(readTimer.current)
      readTimer.current = setTimeout(() => { setSealJustBroke(null) }, 1000)
      // Persist to backend
      window.growthArc.mail.markRead(id).catch(() => {})
    }
  }, [readIds])

  // ── Open letter: fetch full detail if needed ────────────────
  const openLetter = useCallback(async (letter: MockLetter) => {
    setSelectedId(letter.id)
    const isUnread = !readIds.has(letter.id)

    // Fetch full detail from IPC if not cached
    if (!detailCache.current.has(letter.id)) {
      try {
        const detail = await window.growthArc.mail.get(letter.id)
        detailCache.current.set(letter.id, {
          body: detail.body,
          factSummary: detail.factSummary,
          replyText: detail.replyText,
          aiStatus: detail.aiStatus,
        })
        // List data contains an intentionally short preview. Always re-render
        // after loading the detail, including when an archived letter is
        // already read and therefore does not change its read state.
        refreshLetterDetail((revision) => revision + 1)
        // Update replyMap from server state
        if (detail.replyText) {
          setReplyMap(prev => ({ ...prev, [letter.id]: detail.replyText! }))
        }
      } catch (e) {
        console.warn('[mail] get failed for', letter.id, e)
      }
    }

    if (isUnread) {
      setOpeningId(letter.id)
      playUISound('mail_open')
      if (openAnimTimer.current) clearTimeout(openAnimTimer.current)
      openAnimTimer.current = setTimeout(() => setOpeningId(null), 720)
    }
    markRead(letter.id)
  }, [readIds, markRead])

  // Re-fetch selected letter when cache updates
  const selectedLetterFull = useMemo(() => {
    if (!selectedLetter || !detailCache.current.has(selectedLetter.id)) return selectedLetter
    const detail = detailCache.current.get(selectedLetter.id)!
    return { ...selectedLetter, body: detail.body, factSummary: detail.factSummary, replyText: detail.replyText ?? '', hasReply: (detail.replyText ?? '').trim().length > 0 }
  }, [selectedLetter, readIds, detailRevision])

  const getValue = (letter: MockLetter): string => {
    const mode = getInteractionMode(letter)
    if (mode === 'note') return noteMap[letter.id] ?? ''
    if (mode === 'memory') return memoryMap[letter.id] ?? ''
    if (mode === 'reply') return replyMap[letter.id] ?? (letter.replyText || '')
    return ''
  }
  const setValue = (letter: MockLetter, value: string) => {
    const mode = getInteractionMode(letter)
    if (mode === 'note') setNoteMap(prev => ({ ...prev, [letter.id]: value }))
    if (mode === 'memory') setMemoryMap(prev => ({ ...prev, [letter.id]: value }))
    if (mode === 'reply') {
      setReplyMap(prev => ({ ...prev, [letter.id]: value }))
      // Persist reply to backend
      window.growthArc.mail.saveReply(letter.id, value).catch(() => {})
    }
  }
  const hasValue = (letter: MockLetter) => getValue(letter).trim().length > 0
  const isRead = (id: string) => readIds.has(id)

  // ── kb-focused from NavState ────────────────────────────────
  const isActive = navState.zone === 'postoffice'
  const isCatFocused = (i: number) => isActive && navState.poZone === 'categories' && navState.poCatIndex === i
  const isLetterFocused = (i: number) => isActive && navState.poZone === 'letters' && navState.poLetterIndex === i

  const isFirstVisit = ipcLetters !== null && ipcLetters.length === 0

  // ── Loading state ───────────────────────────────────────────
  if (ipcLoading) {
    return <div className="page mail-page"><div className="loading-state">小天使正在整理邮袋…</div></div>
  }

  const cubbyPanel = (
    <div className="mail-cubby">
      <div className="mail-cubby-tabs">
        {categories.map((cat, i) => (
          <button
            key={cat}
            className={`mail-cubby-tab ${activeCategory === cat ? 'active' : ''} ${isCatFocused(i) ? 'kb-focused' : ''}`}
            onClick={() => { playUISound('select'); dispatch({ type: 'SET_PO_CAT_INDEX', index: i }); actionsRef.current.poSetCategory(i); dispatch({ type: 'SET_PO_ZONE', poZone: 'letters' }) }}
            aria-label={CATEGORY_LABELS[cat]}
          >
            <span>{CATEGORY_LABELS[cat]}</span>
            {categoryHasUnread(cat) && <span className="mail-cat-unread" />}
          </button>
        ))}
      </div>
      <div className="mail-env-list">
        {letters.map((letter, i) => {
          const unread = !isRead(letter.id)
          const isSelected = selectedId === letter.id
          const replied = hasValue(letter)
          const isSpecial = letter.category === 'festival' || letter.category === 'memorial'
          // Importing the artwork makes Vite copy it into the packaged renderer.
          // A plain runtime path worked in development but was absent from app.asar.
          const envSrc = !unread ? mailReadImage
            : isSpecial ? mailSpecialImage
            : mailUnreadImage
          return (
            <button
              key={letter.id}
              data-ui-sound="mail_open"
              className={`mail-env ${isSelected ? 'selected' : ''} ${unread ? 'unread' : 'read'} ${openingId === letter.id ? 'opening' : ''} ${isLetterFocused(i) ? 'kb-focused' : ''}`}
              onClick={() => { playUISound('select'); dispatch({ type: 'SET_PO_LETTER_INDEX', index: i }); openLetter(letter); dispatch({ type: 'SET_PO_ZONE', poZone: 'content' }) }}
              aria-label={`${letter.subject} — ${letter.senderName}`}
            >
              <img className="mail-env-visual" src={envSrc} alt="" />
              <span className="mail-env-info">
                <span className="mail-env-subject">{letter.subject}</span>
                <span className="mail-env-meta">{letterDateLabel(letter)} · {letterSubLabel(letter)}</span>
              </span>
              <span className="mail-env-reply-mark">{replied ? '✎' : ''}</span>
            </button>
          )
        })}
        {letters.length === 0 && <div className="mail-empty">{emptyMessage(activeCategory)}</div>}
      </div>
      {hasOlderLetters && <div style={{padding:'8px 12px 12px', textAlign:'center'}}><button className="text-button" disabled={loadingOlderLetters} onClick={loadOlderLetters}>{loadingOlderLetters ? '小天使正在翻找旧木格…' : '翻阅旧信'}</button></div>}
    </div>
  )

  const letterInteraction = selectedLetterFull && (() => {
    const mode = getInteractionMode(selectedLetterFull)
    const val = getValue(selectedLetterFull)
    const saved = hasValue(selectedLetterFull)
    const setV = (v: string) => setValue(selectedLetterFull, v)

    if (mode === 'none') return null
    if (mode === 'note') {
      const label = selectedLetterFull.category === 'weekly' ? '留一句给这一周的话……' : '在今天的星页旁留一句话……'
      return <div className="mail-reply-slip"><span className="mail-reply-icon">✎</span><textarea className="mail-reply-input" rows={1} placeholder={label} value={val} onChange={e => setV(e.target.value)} />{saved && <span className="mail-reply-saved">已夹进信里</span>}</div>
    }
    if (mode === 'memory') {
      const isOpen = memoryOpen[selectedLetterFull.id] || saved
      if (!isOpen) return <div className="mail-memory-toggle"><button className="text-button" onClick={() => setMemoryOpen(prev => ({ ...prev, [selectedLetterFull.id]: true }))}>✎ 在这封信后留一句话</button></div>
      return <div className="mail-reply-slip"><span className="mail-reply-icon">✎</span><textarea className="mail-reply-input" rows={1} placeholder="写下今年想记住的一句话……" value={val} onChange={e => setV(e.target.value)} />{saved && <span className="mail-reply-saved">已随这封信收好</span>}</div>
    }
    if (mode === 'reply') {
      return <div className="mail-reply-slip"><span className="mail-reply-icon">✎</span><textarea className="mail-reply-input" rows={1} placeholder={`回给${selectedLetterFull.senderName}……`} value={val} onChange={e => setV(e.target.value)} />{saved && <span className="mail-reply-saved">回信草稿已收好</span>}</div>
    }
    return null
  })()

  const showObsLink = selectedLetterFull && canViewObservatory(selectedLetterFull)

  const pendingAI = selectedLetterFull && detailCache.current.has(selectedLetterFull.id)
    ? detailCache.current.get(selectedLetterFull.id)!.aiStatus === 'pending'
    : false

  const letterPaper = selectedLetterFull ? (<>
    <LetterViewer
      letter={selectedLetterFull}
      isRead={isRead(selectedLetterFull.id)}
      sealJustBroke={sealJustBroke === selectedLetterFull.id}
      viewMode={isRead(selectedLetterFull.id) || activeCategory === 'all' ? 'archive' : 'opening'}
    >
      {letterInteraction}
      {showObsLink && (
        <div className="mail-obs-link">
          <button className="text-button" onClick={() => onNavigate?.(selectedLetterFull?.observatoryTarget ? { page: 'observatory', obsTarget: selectedLetterFull.observatoryTarget } : 'observatory')}>
            <Icon name="star" size={13} /> {observatoryLinkLabel(selectedLetterFull)}
          </button>
        </div>
      )}
    </LetterViewer>
    {pendingAI && (
      <div style={{marginTop:8,fontSize:11,color:'var(--muted)',fontFamily:'Fusion Pixel SC, monospace',textAlign:'center'}}>
        小天使正在整理这封信笺……
      </div>
    )}
  </>) : (
    <div className="mail-letter-paper">
      <div className="mail-empty mail-empty-letter">这里暂时没有信。<br />远方的风，会带来下一封消息。</div>
    </div>
  )

  return <div className="page mail-page">
    <div className="mail-header">
      <div className="mail-header-bg" data-asset-placeholder="post-office-background" />
      <div className="mail-header-props"><div className="mail-header-prop" data-asset-placeholder="window" /><div className="mail-header-prop" data-asset-placeholder="mail-sack" /><div className="mail-header-prop mail-header-prop-lamp" data-asset-placeholder="lamp" /></div>
      <div className="mail-header-angel" data-asset-placeholder="angel" />
      <div className="mail-header-foreground" data-asset-placeholder="counter" />
      <div className="mail-header-text">
        <div className="mail-header-title"><span className="eyebrow">POST OFFICE</span><h1>天使邮局</h1><p className="mail-header-season">盛夏 · 窗边吹来一点暖风</p></div>
        <div className="mail-header-hint">{isFirstVisit ? '邮局的灯刚刚亮起。木格里还没有太多信件，但小天使每天傍晚都会来这里看看。也许下一封信，正在路上。' : hasUnread ? '有一封信刚刚放进了你的木格。' : '今天的邮袋已经整理好了。'}</div>
      </div>
    </div>
    <div className="mail-workspace">
      <div className="mail-cubby-col mail-cubby-narrow-hide">{cubbyPanel}</div>
      <div className="mail-desk-col mail-desk-narrow-full">
        <button className="text-button mail-back-btn" onClick={() => { playUISound('select'); setSelectedId(null); dispatch({ type: 'SET_PO_ZONE', poZone: 'letters' }) }}>← 回到信件列表</button>
        <div className="mail-desk">{letterPaper}</div>
      </div>
    </div>
  </div>
}
