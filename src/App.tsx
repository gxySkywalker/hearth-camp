import { useState, useEffect, useReducer, useRef, useCallback } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { FocusController } from './components/FocusController'
import { Icon } from './components/Icon'
import { bgm, playUISound, BGM_DEFAULT_VOLUME, resumeWorldSoundsAfterUserGesture } from './lib/audio'
import { navReducer, initialNavState, SIDEBAR_COUNT, type NavState } from './lib/navState'
import { canHandle, setInputContext, getInputContext } from './lib/inputContext'
import { HomePage } from './pages/HomePage'
import { CottagePage } from './pages/CottagePage'
import { PlanPage } from './pages/PlanPage'
import { NotesPage } from './pages/NotesPage'
import { HistoryPage } from './pages/HistoryPage'
import { ReviewPage } from './pages/ReviewPage'
import { ObservatoryPage } from './pages/ObservatoryPage'
import { PostOfficePage } from './pages/PostOfficePage'
import { GrowthPage } from './pages/GrowthPage'
import { SettingsPage } from './pages/SettingsPage'
import type { PageId } from './types'

const NAV: Array<{ id: PageId; label: string; icon: string }> = [
  { id: 'home', label: '炉火小屋', icon: 'home' },
  { id: 'overview', label: '旅程总览', icon: 'book' },
  { id: 'plan', label: '制图桌', icon: 'plan' },
  { id: 'notes', label: '炉边手记', icon: 'book' },
  { id: 'growth', label: '伙伴营地', icon: 'growth' },
  { id: 'history', label: '冒险日志', icon: 'history' },
  { id: 'observatory', label: '天文台', icon: 'star' },
  { id: 'mail', label: '天使邮局', icon: 'mail' },
]

/** Callbacks that pages expose for the global keyboard handler */
interface PageActions {
  // PostOffice
  poCatCount: number
  poLetterCount: number
  poSetCategory: (index: number) => void
  poOpenLetter: (index: number) => void
  poBackFromContent: () => void
  // Observatory
  obsTabIndex: number
  obsSetTab: (tab: 'daily' | 'weekly' | 'monthly' | 'yearly') => void
  obsPrevDate: () => void
  obsNextDate: () => void
}

function AppShell() {
  const [page, setPage] = useState<PageId>('home')
  const [muted, setMuted] = useState(false)
  const [vol, setVol] = useState(BGM_DEFAULT_VOLUME)
  const [obsNavTarget, setObsNavTarget] = useState<{ periodType: 'daily' | 'weekly'; periodStart: string; periodEnd: string } | null>(null)
  const [mailRefreshKey, setMailRefreshKey] = useState(0)
  const [navState, dispatch] = useReducer(navReducer, undefined, initialNavState)
  const { dashboard, loading } = useApp()

  // One shared sound layer for the ordinary DOM interface. Feature-specific
  // interactions (for example the Pixi cottage and opening a letter) can opt
  // out with data-ui-sound and retain their own sound.
  useEffect(() => {
    const interactiveSelector = 'button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], select, input[type="range"], input[type="date"]'
    const getInteractive = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>(interactiveSelector) : null
    const isDisabled = (element: HTMLElement) => element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true'
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return
      const element = getInteractive(event.target)
      if (!element || isDisabled(element) || element.closest('[data-ui-sound]')) return
      // Native form controls report their committed choice through change;
      // waiting for it avoids a second sound when a select menu closes.
      if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) return
      playUISound('select')
    }
    const onChange = (event: Event) => {
      const element = getInteractive(event.target)
      if (!element || isDisabled(element) || element.closest('[data-ui-sound]')) return
      playUISound('select')
    }
    window.addEventListener('click', onClick, true)
    window.addEventListener('change', onChange, true)
    return () => {
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('change', onChange, true)
    }
  }, [])

  // ── Stable refs for the global keydown handler ────────────
  const navStateRef = useRef<NavState>(navState)
  navStateRef.current = navState
  const pageRef = useRef<PageId>(page)
  pageRef.current = page
  const actionsRef = useRef<PageActions>({
    poCatCount: 0, poLetterCount: 0,
    poSetCategory: () => {}, poOpenLetter: () => {}, poBackFromContent: () => {},
    obsTabIndex: 0, obsSetTab: () => {}, obsPrevDate: () => {}, obsNextDate: () => {},
  })

  // ── SINGLE global keyboard entry point ────────────────────
  const globalKeyHandler = useCallback((e: KeyboardEvent) => {
    // Never intercept when user is typing in a text field
    const target = e.target as HTMLElement | null
    const tag = target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable || target?.closest?.('[contenteditable="true"]')) return

    const ctx = getInputContext()
    const ns = navStateRef.current
    const acts = actionsRef.current

    // ── Escape: universal back ──────────────────────────────
    if (e.key === 'Escape') {
      if (ctx === 'dialog') return // dialog handles its own Escape
      e.preventDefault()
      playUISound('select')
      if (ctx === 'world') {
        // Leave world scene → back to sidebar, stay on home page
        setInputContext('menu')
        dispatch({ type: 'SET_ZONE', zone: 'sidebar' })
        return
      }
      // menu context: hierarchical back
      if (ns.zone === 'postoffice') {
        // RPG-style layered return: content → letters → categories → sidebar
        if (ns.poZone === 'content') {
          acts.poBackFromContent()
          dispatch({ type: 'SET_PO_ZONE', poZone: 'letters' })
        } else if (ns.poZone === 'letters') {
          dispatch({ type: 'SET_PO_ZONE', poZone: 'categories' })
        } else {
          dispatch({ type: 'SET_ZONE', zone: 'sidebar' })
        }
      } else if (ns.zone === 'observatory') {
        dispatch({ type: 'SET_ZONE', zone: 'sidebar' })
      } else if (ns.zone !== 'sidebar') {
        dispatch({ type: 'SET_ZONE', zone: 'sidebar' })
      }
      return
    }

    // ── Menu-only keys ──────────────────────────────────────
    if (ctx !== 'menu') return

    switch (ns.zone) {
      // ── SIDEBAR ──────────────────────────────────────────
      case 'sidebar': {
        switch (e.key) {
          case 'ArrowUp': case 'ArrowDown':
            e.preventDefault()
            dispatch({ type: e.key === 'ArrowUp' ? 'UP' : 'DOWN' })
            playUISound('select')
            break
          case 'ArrowRight': case 'Enter': {
            e.preventDefault()
            playUISound('select')
            const pid = NAV[ns.sidebarIndex].id
            setPage(pid)
            setObsNavTarget(null)
            // Determine zone for the target page
            const newZone = pageZone(pid)
            dispatch({ type: 'SET_ZONE', zone: newZone })
            break
          }
        }
        break
      }

      // ── POST OFFICE ──────────────────────────────────────
      case 'postoffice': {
        switch (ns.poZone) {
          case 'categories': {
            switch (e.key) {
              case 'ArrowUp': case 'ArrowDown': {
                e.preventDefault()
                const dir = e.key === 'ArrowUp' ? -1 : 1
                const next = ns.poCatIndex + dir
                if (next >= 0 && next < acts.poCatCount) {
                  dispatch({ type: 'SET_PO_CAT_INDEX', index: next })
                  playUISound('select')
                }
                break
              }
              case 'ArrowRight': {
                e.preventDefault()
                if (acts.poLetterCount > 0) {
                  dispatch({ type: 'RIGHT' })
                  playUISound('select')
                }
                break
              }
              case 'Enter': {
                e.preventDefault()
                acts.poSetCategory(ns.poCatIndex)
                dispatch({ type: 'SET_PO_ZONE', poZone: 'letters' })
                playUISound('select')
                break
              }
              case 'ArrowLeft': {
                e.preventDefault()
                dispatch({ type: 'SET_ZONE', zone: 'sidebar' })
                playUISound('select')
                break
              }
            }
            break
          }
          case 'letters': {
            switch (e.key) {
              case 'ArrowUp': case 'ArrowDown': {
                e.preventDefault()
                const dir = e.key === 'ArrowUp' ? -1 : 1
                const next = ns.poLetterIndex + dir
                if (next >= 0 && next < acts.poLetterCount) {
                  dispatch({ type: 'SET_PO_LETTER_INDEX', index: next })
                  playUISound('select')
                }
                break
              }
              case 'ArrowRight': {
                e.preventDefault()
                dispatch({ type: 'RIGHT' })
                playUISound('select')
                break
              }
              case 'Enter': {
                e.preventDefault()
                acts.poOpenLetter(ns.poLetterIndex)
                dispatch({ type: 'SET_PO_ZONE', poZone: 'content' })
                playUISound('select')
                break
              }
              case 'ArrowLeft': case 'Escape': {
                e.preventDefault()
                dispatch({ type: 'LEFT' })
                playUISound('select')
                break
              }
            }
            break
          }
          case 'content': {
            if (e.key === 'ArrowLeft' || e.key === 'Escape') {
              e.preventDefault()
              acts.poBackFromContent()
              dispatch({ type: 'LEFT' })
              playUISound('select')
            }
            break
          }
        }
        break
      }

      // ── OBSERVATORY ──────────────────────────────────────
      case 'observatory': {
        switch (e.key) {
          case 'ArrowUp': case 'ArrowDown':
            e.preventDefault()
            dispatch({ type: e.key === 'ArrowUp' ? 'UP' : 'DOWN' })
            playUISound('select')
            break
          case 'ArrowLeft':
            e.preventDefault()
            acts.obsPrevDate()
            playUISound('select')
            break
          case 'ArrowRight':
            e.preventDefault()
            acts.obsNextDate()
            playUISound('select')
            break
          case 'Enter':
            e.preventDefault()
            acts.obsSetTab(ns.obsFocusIndex === 0 ? 'daily' : ns.obsFocusIndex === 1 ? 'weekly' : ns.obsFocusIndex === 2 ? 'monthly' : 'yearly')
            playUISound('select')
            break
          case 'Escape':
            e.preventDefault()
            dispatch({ type: 'ESCAPE' })
            playUISound('select')
            break
        }
        break
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', globalKeyHandler)
    return () => window.removeEventListener('keydown', globalKeyHandler)
  }, [globalKeyHandler])

  // Sync sidebarIndex + input context to current page
  useEffect(() => {
    const idx = NAV.findIndex(item => item.id === page)
    if (idx >= 0) dispatch({ type: 'SET_SIDEBAR_INDEX', index: idx })
    setInputContext(page === 'home' ? 'world' : 'menu')
  }, [page])

  useEffect(() => {
    // Bundled music is the fallback; a matching local BGM pack takes priority.
    window.growthArc.settings.getBgmSources()
      .then(({ cottage, expedition }) => bgm.setSources({ cottage, expedition }))
      .catch(() => bgm.setSources({ cottage: null, expedition: null }))
    bgm.play('cottage')
    // Some Chromium builds require a user gesture before allowing audio.
    // A one-time retry makes initial music reliable without bothering players.
    const resumeMusic = () => {
      bgm.resumeAfterUserGesture()
      resumeWorldSoundsAfterUserGesture()
    }
    window.addEventListener('pointerdown', resumeMusic, { once: true, capture: true })
    window.addEventListener('keydown', resumeMusic, { once: true, capture: true })
    return () => {
      window.removeEventListener('pointerdown', resumeMusic, { capture: true })
      window.removeEventListener('keydown', resumeMusic, { capture: true })
      bgm.stop()
    }
  }, [])

  if (loading) return <div className="app-loading"><div className="loading-fire">◆</div><strong>正在点亮壁炉</strong><span>伙伴们在整理昨夜的行囊…</span></div>

  const worldName = dashboard?.world.name || '炉火营地'

  // Determine which AppZone a given page maps to
  const currentPageZone = pageZone(page)

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setPage('home')}>
        <span className="brand-crest">♜</span>
        <span><strong>{worldName}</strong><small>你的私人远征小屋</small></span>
      </button>
      <nav>{NAV.map((item, i) => (
        <button
          key={item.id}
          className={`${page === item.id ? 'active' : ''} ${navState.zone === 'sidebar' && navState.sidebarIndex === i ? 'kb-focused' : ''}`}
          onClick={() => { playUISound('select'); setPage(item.id); dispatch({ type: 'SET_ZONE', zone: pageZone(item.id) }) }}
        >
          <Icon name={item.icon} /><span>{item.label}</span>
        </button>
      ))}</nav>
      <div className="sidebar-bottom">
        <button onClick={() => { const next = !muted; setMuted(next); bgm.volume(next ? 0 : bgm.getLastVolume()) }} title={muted ? '开启背景音乐' : '静音'}><Icon name={muted ? 'spark' : 'play'} /><span>{muted ? '音乐已关' : '背景音乐'}</span></button>
        <div className="volume-slider"><Icon name="play" size={14} /><input type="range" min="0" max="100" value={muted ? 0 : Math.round(vol * 100)} onChange={e => { const v = Number(e.target.value) / 100; setVol(v); setMuted(false); bgm.volume(v) }} /><Icon name="play" size={18} /></div>
        <button className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}><Icon name="settings" /><span>旅人手册</span></button>
        <div className="local-badge"><i /><span>旅程只保存在本地</span></div>
      </div>
    </aside>
    <main className={`main-content ${page === 'home' ? 'cottage-main-content' : ''}`}>
      {page === 'home' && <CottagePage onNavigate={setPage} />}
      {page === 'overview' && <HomePage onNavigate={setPage} />}
      {page === 'plan' && <PlanPage />}
      {page === 'notes' && <NotesPage />}
      {page === 'history' && <HistoryPage />}
      {page === 'review' && (
        <ObservatoryPage navState={navState} dispatch={dispatch} actionsRef={actionsRef} />
      )}
      {page === 'observatory' && (
        <ObservatoryPage
          obsNavTarget={obsNavTarget}
          onObsConsumed={() => setObsNavTarget(null)}
          navState={navState}
          dispatch={dispatch}
          actionsRef={actionsRef}
        />
      )}
      {page === 'mail' && (
        <PostOfficePage
          key={mailRefreshKey}
          onNavigate={(target) => { if (typeof target === 'string') { setPage(target); setObsNavTarget(null) } else { setPage(target.page); setObsNavTarget(target.obsTarget ?? null) } }}
          navState={navState}
          dispatch={dispatch}
          actionsRef={actionsRef}
        />
      )}
      {page === 'growth' && <GrowthPage />}
      {page === 'settings' && <SettingsPage />}
    </main>
    <FocusController showLauncher={false} />
  </div>
}

/** Map a PageId to the AppZone the global handler should enter */
function pageZone(page: PageId): NavState['zone'] {
  if (page === 'observatory') return 'observatory'
  if (page === 'mail') return 'postoffice'
  return 'sidebar' // home/overview/plan/growth/history/settings → sidebar zone
}

export default function App() {
  return <AppProvider><AppShell /></AppProvider>
}
