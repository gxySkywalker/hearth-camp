export type PageId = 'home' | 'overview' | 'plan' | 'history' | 'review' | 'growth' | 'settings' | 'observatory' | 'mail'

// Re-exported from navState for page convenience
export type { NavState, NavAction } from './lib/navState'

export interface Area {
  id: string
  name: string
  color: string
  icon: string
  archived: number
  created_at: number
}

export interface Goal {
  id: string
  area_id: string
  title: string
  description: string
  due_date: string | null
  status: 'active' | 'done' | 'archived'
  created_at: number
  updated_at: number
}

export interface Task {
  id: string
  area_id: string
  goal_id: string | null
  title: string
  notes: string
  status: 'todo' | 'doing' | 'done' | 'archived'
  completed_at: number | null
  completion_xp_awarded: number
  sort_order: number
  created_at: number
  updated_at: number
}

export interface FocusSession {
  id: string
  task_id: string | null
  area_id: string | null
  content: string
  started_at: number
  ended_at: number | null
  status: 'running' | 'paused' | 'completed' | 'cancelled'
  active_seconds: number
  outcome: string
  blocker: string
  next_step: string
  task_completed: number
  companion_id?: string | null
  companion_name?: string
  companion_species_id?: string
  planned_seconds?: number
  task_title?: string
  area_name?: string
  area_color?: string
  xp_awarded?: number
  expedition?: ExpeditionResult | null
  contributedTasks?: Array<{ task_id: string; selection_order: number; xp_awarded: number; reason: string; title: string; area_name: string; area_color: string }>
}

export interface CompanionSpecies {
  id: string
  name: string
  kind: string
  rarity: 'starter' | 'common' | 'rare'
  palette: string
  description: string
  stages: string[]
  evolutions: Array<{ id: string; name: string; note: string }>
  discovered?: boolean
}

export interface Companion {
  id: string
  species_id: string
  nickname: string
  nickname_is_custom?: number
  bond_xp: number
  stage: number
  stageName: string
  evolution_path: string
  evolutionReady: boolean
  nextBondXp: number
  growth_completed_at?: number | null
  personalityProfile: {
    personalityTrait: string
    habit: string
    quirk: string
  }
  memories: Array<{ kind: 'first' | 'journey' | 'habit' | 'growth'; text: string; at: number }>
  is_active: number
  is_ill: number
  ill_since?: number | null
  met_at: number
  last_adventure_at: number | null
  species: CompanionSpecies
}

export interface CompanionCollection {
  owned: Companion[]
  active: Companion | null
  catalog: CompanionSpecies[]
  total: number
}

export interface CompanionGrowthEvent {
  id: string
  companion_id: string
  previous_stage: number
  stage: number
  evolution_path: string
  source_session_id: string | null
  occurred_at: number
  seen_at: number | null
  companion: Companion
}

export interface LootItem {
  id: string
  name: string
  rarity: 'common' | 'uncommon' | 'rare' | 'precious'
  icon: string
  description: string
}

export interface KnowledgeRelic {
  id: string
  session_id: string
  title: string
  content: string
  question: string
  next_step: string
  created_at: number
}

export interface PlayerProfile {
  id: 'primary'
  display_name: string
  body_type: string
  skin_tone: string
  hair_style: string
  hair_color: string
  outfit_id: string
  outfit_tint: string
  cape_enabled: boolean
  intro_status: 'unseen' | 'available' | 'seen' | 'skipped'
  intro_seen_at: number | null
  customized_at: number | null
  created_from_legacy: boolean
  created_at: number
  updated_at: number
}

export interface PlayerProfilePatch {
  displayName?: string
  bodyType?: string
  skinTone?: string
  hairStyle?: string
  hairColor?: string
  outfitId?: string
  outfitTint?: string
  capeEnabled?: boolean
  introStatus?: PlayerProfile['intro_status']
}

export type WorldDiscoveryState = 'hidden' | 'rumored' | 'discovered'

export interface WorldRegion {
  id: string
  name: string
  layer: number
  description: string
  sort_order: number
  state: WorldDiscoveryState
  discovered_at: number | null
}

export interface WorldNode {
  id: string
  region_id: string
  kind: string
  name: string
  description: string
  map_x: number
  map_y: number
  sort_order: number
  state: WorldDiscoveryState
  discovered_at: number | null
  discovery_session_id: string | null
}

export interface WorldEdge {
  id: string
  from_node_id: string
  to_node_id: string
  distance: number
  state: WorldDiscoveryState
  discovered_at: number | null
  discovery_session_id: string | null
}

export interface WorldDiscovery {
  id: string
  discovery_key: string
  kind: 'region' | 'node' | 'edge'
  target_id: string
  session_id: string | null
  event_id: string | null
  metadata_json: string
  metadata: Record<string, unknown>
  created_at: number
}

export interface WorldEvent {
  id: string
  event_key: string
  definition_id: string
  definition_version: number
  status: string
  session_id: string | null
  payload_json: string
  payload: Record<string, unknown>
  occurred_at: number
  resolved_at: number | null
}

export interface WorldFoundation {
  content: {
    namespace: string
    version: string
    installed_at?: number
    updated_at?: number
  }
  player: PlayerProfile
  map: {
    regions: WorldRegion[]
    nodes: WorldNode[]
    edges: WorldEdge[]
    discoveries: WorldDiscovery[]
  }
  recentEvents: WorldEvent[]
}

export interface ExpeditionResult {
  sessionId: string
  tier: { id: string; name: string; rareChance: number; companionChance: number; commonCount: number }
  location: string
  event: string
  drops: Array<{ item: LootItem; quantity: number }>
  rareFound: boolean
  rareChance: number
  companionChance: number
  bondXp: number
  activeCompanion: Companion | null
  newCompanion: Companion | null
  growthEvent?: CompanionGrowthEvent | null
  illness?: { companionId: string; nickname: string } | null
  caravan?: {
    chance: number
    greeting: string
    items: Array<{ item: LootItem; price: number; sold: boolean }>
  } | null
  bard?: { chance: number; greeting: string } | null
  knowledgeRelic: KnowledgeRelic | null
  returnKind?: 'brief' | 'short' | 'expedition' | 'deep'
  createdAt?: number
}

export interface WorldState {
  name: string
  foundation: WorldFoundation
  companions: CompanionCollection
  inventory: Array<{ item_id: string; quantity: number; item: LootItem; updated_at: number }>
  relics: KnowledgeRelic[]
  latestExpedition: ExpeditionResult | null
  pendingGrowthEvent: CompanionGrowthEvent | null
  rarePity: number
  companionPity: number
}

export interface RangeStats {
  focusSeconds: number
  completedTasks: number
  sessionCount: number
  averageSessionSeconds: number
  activeDays: number
  byArea: Array<{ id: string; name: string; color: string; seconds: number }>
}

export interface XpSummary {
  totalXp: number
  level: number
  currentXp: number
  nextLevelXp: number
  progress: number
  recent: Array<{ id: string; kind: string; amount: number; label: string; created_at: number }>
}

export interface Achievement {
  code: string
  icon: string
  title: string
  description: string
  unlockedAt: number | null
}

export interface Dashboard {
  date: string
  today: RangeStats
  week: RangeStats
  xp: XpSummary
  activeSession: FocusSession | null
  nextTasks: Task[]
  areas: Area[]
  achievements: Achievement[]
  settings: Record<string, string>
  world: WorldState
}

export interface Structure {
  areas: Area[]
  goals: Goal[]
  tasks: Task[]
}

export interface AiReport {
  summary: string
  wins: string[]
  patterns: string[]
  risks: string[]
  suggestions: string[]
  next_focus: string
}

export interface DailyReviewData {
  date: string
  stats: RangeStats
  review: null | {
    review_date: string
    win: string
    blocker: string
    energy: number | null
    tomorrow_task: string
    ai: AiReport | null
    ai_model?: string
  }
}

export interface WeeklyReportData {
  weekStart: string
  stats: RangeStats
  previousStats: RangeStats
  reviews: Array<{ review_date: string; win: string; blocker: string; energy: number | null; tomorrow_task: string }>
  completedTasks: Array<{ title: string; completed_at: number }>
  ai: AiReport | null
  aiModel: string | null
}

export interface GrowthArcApi {
  dashboard: () => Promise<Dashboard>
  world: {
    get: () => Promise<WorldFoundation>
    updatePlayer: (data: PlayerProfilePatch) => Promise<PlayerProfile>
  }
  structure: {
    get: () => Promise<Structure>
    getAll: () => Promise<Structure>
    createArea: (data: { name: string; color: string }) => Promise<Area>
    updateArea: (id: string, data: { name?: string; color?: string }) => Promise<Area>
    archiveArea: (id: string) => Promise<void>
    restoreArea: (id: string) => Promise<Area>
    deleteArea: (id: string) => Promise<void>
    createGoal: (data: { areaId: string; title: string; description?: string; dueDate?: string | null }) => Promise<Goal>
    updateGoal: (id: string, data: { title?: string; description?: string }) => Promise<Goal>
    deleteGoal: (id: string) => Promise<void>
    archiveGoal: (id: string) => Promise<void>
    restoreGoal: (id: string) => Promise<Goal>
    createTask: (data: { areaId: string; goalId?: string | null; title: string; notes?: string }) => Promise<Task>
    updateTask: (id: string, patch: Partial<Task> & { areaId?: string; goalId?: string | null }) => Promise<{ task: Task; unlocked: Achievement[] }>
    reorderTasks: (items: Array<{ id: string; sortOrder: number }>) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    restoreTask: (id: string) => Promise<Task>
    reopenTask: (id: string) => Promise<Task>
    manualComplete: (id: string) => Promise<{ xpAwarded: number; alreadyAwarded: boolean }>
  }
  session: {
    active: () => Promise<FocusSession | null>
    start: (data: { taskId?: string | null; areaId?: string | null; content?: string; companionId?: string | null; plannedMinutes?: number }) => Promise<FocusSession>
    heartbeat: (id: string) => Promise<FocusSession | null>
    pause: (id: string) => Promise<FocusSession | null>
    resume: (id: string) => Promise<FocusSession | null>
    stop: (id: string, data: { outcome: string; blocker: string; nextStep: string; taskCompleted: boolean; contributedTaskIds?: string[] }) => Promise<{
      session: FocusSession; xpAwarded: number; unlocked: Achievement[]; expedition: ExpeditionResult
      primaryTask: { taskId: string | null; completed: boolean; xpAwarded: number; alreadyAwarded: boolean; reason?: string }
      contributedTasks: Array<{ taskId: string; title: string; completed: boolean; xpAwarded: number; alreadyAwarded: boolean; reason: string }>
      levelUps: Array<{ level: number; rewards: Array<{ itemId: string; quantity: number }> }>
    }>
    cancel: (id: string) => Promise<null>
  }
  companions: {
    get: () => Promise<CompanionCollection>
    setActive: (id: string) => Promise<CompanionCollection>
    rename: (id: string, nickname: string) => Promise<Companion>
    getPendingGrowth: () => Promise<CompanionGrowthEvent | null>
    markGrowthSeen: (id: string) => Promise<CompanionGrowthEvent>
    evolve: (id: string, pathId: string) => Promise<Companion>
  }
  caravan: {
    buy: (sessionId: string, slotIndex: number) => Promise<ExpeditionResult>
  }
  bard: { claim: (sessionId: string) => Promise<any>; list: () => Promise<any[]> }
  history: (limit?: number) => Promise<FocusSession[]>
  review: {
    daily: (date?: string) => Promise<DailyReviewData>
    saveDaily: (data: { date: string; win: string; blocker: string; energy: number | null; tomorrowTask: string }) => Promise<unknown>
    weekly: (date?: string) => Promise<WeeklyReportData>
  }
  settings: {
    get: () => Promise<Record<string, string | boolean>>
    set: (data: Record<string, string>) => Promise<Record<string, string>>
    hasApiKey: () => Promise<boolean>
    setApiKey: (key: string) => Promise<boolean>
    clearApiKey: () => Promise<boolean>
    openDataFolder: () => Promise<string>
    getBirthday: () => Promise<{ month: number; day: number; updatedAt: number }>
    setBirthday: (month: number, day: number) => Promise<{ month: number; day: number; updatedAt: number }>
  }
  ai: {
    generate: (type: 'daily' | 'weekly', date: string) => Promise<{ report: AiReport; model: string }>
  }
  inventory: {
    use: (itemId: string) => Promise<{ consumed: boolean; itemId: string; effect: string; growthEvent?: CompanionGrowthEvent | null; consumedQuantity?: number; unlockedLocation?: string | null }>
    useTarget: (itemId: string, companionId: string) => Promise<{ consumed: boolean; itemId: string; effect: string; growthEvent?: CompanionGrowthEvent | null; consumedQuantity?: number; unlockedLocation?: string | null }>
  }
  hearth: {
    get: () => Promise<{ lit: boolean }>
    setLit: (lit: boolean) => Promise<{ lit: boolean }>
    craft: (recipeId: 'herbal_soup' | 'honey_amber') => Promise<{ lit: boolean; effect: string }>
  }
  observatory: {
    getDaily: (dateOrTimestamp?: number) => Promise<DailyObservatoryData>
    getWeekly: (dateOrTimestamp?: number) => Promise<WeeklyObservatoryData>
    getReview: (date: string) => Promise<DailyReviewData>
    saveReview: (data: { date: string; win: string; blocker: string; energy: number | null; tomorrowTask: string }) => Promise<unknown>
  }
  mail: {
    list: (opts?: { limit?: number; offset?: number; unreadOnly?: boolean; letterType?: 'daily' | 'weekly'; cursorBefore?: number }) => Promise<LetterListItem[]>
    get: (id: string) => Promise<LetterDetail>
    getUnreadCount: () => Promise<number>
    getLatestUnread: () => Promise<{ id: string; subject: string; letterType: string; createdAt: number } | null>
    markRead: (id: string) => Promise<{ id: string; isRead: boolean; readAt: number | null }>
    markUnread: (id: string) => Promise<{ id: string; isRead: boolean; readAt: number | null }>
    saveReply: (id: string, replyText: string) => Promise<{ replyText: string | null; updatedAt: number }>
    ensurePeriodic: (simTs?: number) => Promise<EnsurePeriodicLettersResult>
    testLetter: () => Promise<{ success: boolean; text?: string; provider?: string; model?: string; error?: string }>
  }
}

export interface SessionCounts {
  brief: number
  short: number
  expedition: number
  deep: number
}

export interface ObservatoryPeriod {
  periodKey: string
  periodStart: number
  periodEnd: number
  timezoneName: string
  timezoneOffsetMinutes: number
}

export interface DailyObservatoryData {
  period: ObservatoryPeriod
  stats: {
    totalActiveSeconds: number
    sessionCounts: SessionCounts
    completedTaskCount: number
    directionBreakdown: Array<{ id: string; name: string; color: string; seconds: number }>
    longestSessionSeconds: number
  }
  sessions: Array<{
    id: string; title: string; activeSeconds: number; endedAt: number
    returnKind: 'brief' | 'short' | 'expedition' | 'deep'
    areaName: string; areaColor: string
  }>
  review: { win: string; blocker: string; energy: number | null; futureNote: string } | null
  currentSession: { id: string; content: string; activeSeconds: number; status: string } | null
  hourlyActiveSeconds: number[]
  hourlyDistributionPrecision: 'exact' | 'estimated'
}

export interface WeeklyObservatoryData {
  period: ObservatoryPeriod
  stats: {
    totalActiveSeconds: number
    dailyActiveSeconds: number[]
    sessionCounts: SessionCounts
    completedTaskCount: number
    directionBreakdown: Array<{ id: string; name: string; color: string; seconds: number }>
    longestSessionSeconds: number
    previousPeriodTotalSeconds: number
  }
  representativeTasks: Array<{ id: string; title: string }>
  hourlyActiveSecondsByDay: number[][]
  hourlyDistributionPrecision: 'exact' | 'estimated'
}

export interface LetterListItem {
  id: string
  letterType: 'daily' | 'weekly' | 'festival'
  periodKey: string
  periodStart: number
  periodEnd: number
  subject: string
  bodyPreview: string
  isRead: boolean
  readAt: number | null
  createdAt: number
}

export interface LetterDetail {
  id: string
  letterType: 'daily' | 'weekly' | 'festival'
  period: ObservatoryPeriod
  subject: string
  body: string
  bodySource: 'template' | 'ai'
  aiStatus: 'pending' | 'success' | 'template' | 'failed' | 'quota_exceeded' | 'skipped'
  aiProvider?: string
  aiModel?: string
  aiPromptVersion?: number
  factSummary: { totalActiveSeconds: number; sessionCounts: SessionCounts; completedTaskCount: number }
  isRead: boolean
  readAt: number | null
  replyText: string | null
  createdAt: number
}

export interface EnsurePeriodicLettersResult {
  initialized: boolean
  daily: { checked: number; created: number; skipped: number; existing: number }
  weekly: { checked: number; created: number; skipped: number; existing: number }
}

declare global {
  interface Window {
    growthArc: GrowthArcApi
  }
}
