// ── Unified Keyboard Navigation State ─────────────────────────
// Single source of truth for all menu navigation.
// App.tsx owns the reducer + global keydown listener.
// Pages are views: they receive navState and render ▶ accordingly.

export type AppZone = 'sidebar' | 'postoffice' | 'observatory'

export interface NavState {
  zone: AppZone
  /** Sidebar: which NAV item (0–7) */
  sidebarIndex: number
  /** PostOffice: which sub-zone */
  poZone: 'categories' | 'letters' | 'content'
  /** PostOffice: category tab index */
  poCatIndex: number
  /** PostOffice: letter list index */
  poLetterIndex: number
  /** Observatory: 0 = 今日观测, 1 = 本周星图, 2 = 本月星向, 3 = 年度星历 */
  obsFocusIndex: number
}

export type NavAction =
  | { type: 'UP' }
  | { type: 'DOWN' }
  | { type: 'LEFT' }
  | { type: 'RIGHT' }
  | { type: 'ENTER' }
  | { type: 'ESCAPE' }
  | { type: 'SET_ZONE'; zone: AppZone }
  | { type: 'SET_PO_ZONE'; poZone: NavState['poZone'] }
  | { type: 'SET_PO_CAT_INDEX'; index: number }
  | { type: 'SET_PO_LETTER_INDEX'; index: number }
  | { type: 'SET_SIDEBAR_INDEX'; index: number }
  | { type: 'SET_OBS_FOCUS'; index: number }

export const SIDEBAR_COUNT = 8

export function initialNavState(): NavState {
  return {
    zone: 'sidebar',
    sidebarIndex: 0,
    poZone: 'categories',
    poCatIndex: 0,
    poLetterIndex: 0,
    obsFocusIndex: 0,
  }
}

export function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case 'UP':
      return navUp(state)
    case 'DOWN':
      return navDown(state)
    case 'LEFT':
      return navLeft(state)
    case 'RIGHT':
      return navRight(state)
    case 'ENTER':
      return navEnter(state)
    case 'ESCAPE':
      return navEscape(state)
    case 'SET_ZONE':
      return { ...state, zone: action.zone }
    case 'SET_PO_ZONE':
      return { ...state, poZone: action.poZone }
    case 'SET_PO_CAT_INDEX':
      return { ...state, poCatIndex: action.index }
    case 'SET_PO_LETTER_INDEX':
      return { ...state, poLetterIndex: action.index }
    case 'SET_SIDEBAR_INDEX':
      return { ...state, sidebarIndex: action.index }
    case 'SET_OBS_FOCUS':
      return { ...state, obsFocusIndex: action.index }
    default:
      return state
  }
}

// ── Navigation helpers (called by the global key handler) ──────

function navUp(state: NavState): NavState {
  switch (state.zone) {
    case 'sidebar':
      return { ...state, sidebarIndex: (state.sidebarIndex - 1 + SIDEBAR_COUNT) % SIDEBAR_COUNT }
    case 'postoffice':
      if (state.poZone === 'categories')
        return { ...state, poCatIndex: Math.max(0, state.poCatIndex - 1) }
      if (state.poZone === 'letters')
        return { ...state, poLetterIndex: Math.max(0, state.poLetterIndex - 1) }
      return state
    case 'observatory':
      return { ...state, obsFocusIndex: state.obsFocusIndex === 0 ? 3 : state.obsFocusIndex - 1 }
    default:
      return state
  }
}

function navDown(state: NavState): NavState {
  switch (state.zone) {
    case 'sidebar':
      return { ...state, sidebarIndex: (state.sidebarIndex + 1) % SIDEBAR_COUNT }
    case 'postoffice':
      // item counts are injected by the global handler via refs;
      // the reducer clamps reasonably; the handler pre-clamps before dispatching
      if (state.poZone === 'categories')
        return { ...state, poCatIndex: state.poCatIndex + 1 }
      if (state.poZone === 'letters')
        return { ...state, poLetterIndex: state.poLetterIndex + 1 }
      return state
    case 'observatory':
      return { ...state, obsFocusIndex: (state.obsFocusIndex + 1) % 4 }
    default:
      return state
  }
}

function navLeft(state: NavState): NavState {
  switch (state.zone) {
    case 'postoffice':
      if (state.poZone === 'letters') return { ...state, poZone: 'categories', poLetterIndex: 0 }
      if (state.poZone === 'content') return { ...state, poZone: 'letters' }
      // categories ← → sidebar (handled by global handler as zone switch)
      return state
    case 'observatory':
      // ← adjusts dates (handled by global handler, not reducer)
      return state
    default:
      return state
  }
}

function navRight(state: NavState): NavState {
  switch (state.zone) {
    case 'sidebar':
      // → enters page (zone switch handled by global handler)
      return state
    case 'postoffice':
      if (state.poZone === 'categories') return { ...state, poZone: 'letters', poLetterIndex: 0 }
      if (state.poZone === 'letters') return { ...state, poZone: 'content' }
      return state
    case 'observatory':
      // → adjusts dates (handled by global handler)
      return state
    default:
      return state
  }
}

function navEnter(state: NavState): NavState {
  // ENTER is mostly handled by the global handler (calling page callbacks).
  // The reducer only handles zone transitions that are pure nav.
  switch (state.zone) {
    case 'sidebar':
      // global handler navigates to page + sets zone
      return state
    case 'postoffice':
      if (state.poZone === 'categories') return { ...state, poZone: 'letters', poLetterIndex: 0 }
      if (state.poZone === 'letters') return { ...state, poZone: 'content' }
      return state
    case 'observatory':
      // global handler calls setTab
      return state
    default:
      return state
  }
}

function navEscape(state: NavState): NavState {
  switch (state.zone) {
    case 'sidebar':
      return state // no escape from sidebar
    case 'postoffice':
      if (state.poZone === 'content') return { ...state, poZone: 'letters' }
      if (state.poZone === 'letters') return { ...state, poZone: 'categories', poLetterIndex: 0 }
      return state
    case 'observatory':
      return { ...state, zone: 'sidebar' }
    default:
      return state
  }
}
