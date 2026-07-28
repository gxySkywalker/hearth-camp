const { app, BrowserWindow, ipcMain, Notification, Menu, Tray, nativeImage, safeStorage, shell, powerMonitor } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')
const { ProxyAgent } = require('undici')
const { StudyDatabase } = require('./database.cjs')
const { generateAngelNarrative, isAngelNarrativeEligible, shouldUseAiBody, resolveAngelAiConfig } = require('./angel-ai.cjs')

let mainWindow
let tray
let database
let allowQuit = false
const APP_NAME = '炉火营地'
const APP_ID = 'com.personal.hearthcamp'
const APP_ICON_PATH = path.join(__dirname, '..', 'assets', 'branding', 'app-icon.png')

function trayIcon() {
  // Windows 的通知区域对运行时 SVG 的支持并不稳定，直接使用项目图标。
  const image = nativeImage.createFromPath(APP_ICON_PATH)
  return image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 })
}

function showWindow() {
  if (!mainWindow) return
  mainWindow.show()
  mainWindow.focus()
}

function createTray() {
  if (tray) return
  tray = new Tray(trayIcon())
  tray.setToolTip(APP_NAME)
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `打开${APP_NAME}`, click: showWindow },
    { type: 'separator' },
    { label: '退出', click: () => { allowQuit = true; app.quit() } },
  ]))
  tray.on('double-click', showWindow)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0b0e16',
    title: APP_NAME,
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  if (process.env.GROWTH_ARC_DEBUG_RENDERER === '1') {
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.error(`[renderer:${level}] ${sourceId}:${line} ${message}`)
    })
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[renderer-gone] ${details.reason} (${details.exitCode})`)
    })
    mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
      console.error(`[renderer-load-failed] ${code} ${description} ${url}`)
    })
  }
  mainWindow.once('ready-to-show', () => mainWindow.show())
  if (process.env.GROWTH_ARC_DEBUG_CAPTURE) {
    mainWindow.once('ready-to-show', () => {
      setTimeout(async () => {
        try {
          const image = await mainWindow.webContents.capturePage()
          fs.writeFileSync(process.env.GROWTH_ARC_DEBUG_CAPTURE, image.toPNG())
        } catch (error) {
          console.error('[renderer-capture-failed]', error?.message || error)
        }
      }, 3000)
    })
  }
  mainWindow.on('close', (event) => {
    if (!allowQuit) {
      event.preventDefault()
      mainWindow.hide()
      if (Notification.isSupported()) new Notification({ title: `${APP_NAME}仍在运行`, body: '计时器已留在系统托盘。' }).show()
    }
  })
}

function secretPath() {
  return path.join(app.getPath('userData'), 'secret.bin')
}

function saveApiKey(key) {
  const clean = String(key || '').trim()
  if (!clean) throw new Error('API Key 不能为空')
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows 安全存储当前不可用')
  fs.writeFileSync(secretPath(), safeStorage.encryptString(clean))
}

function readApiKey() {
  const file = secretPath()
  if (!fs.existsSync(file) || !safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(fs.readFileSync(file))
  } catch {
    return null
  }
}

function clearApiKey() {
  if (fs.existsSync(secretPath())) fs.unlinkSync(secretPath())
}

function bgmFolderPath() {
  return path.join(app.getPath('userData'), 'audio', 'bgm')
}

function ensureBgmFolder() {
  const folder = bgmFolderPath()
  fs.mkdirSync(folder, { recursive: true })
  return folder
}

function getBgmSources() {
  const folder = ensureBgmFolder()
  const sourceFor = (filename) => {
    const file = path.join(folder, filename)
    try {
      return fs.statSync(file).isFile() ? pathToFileURL(file).toString() : null
    } catch {
      return null
    }
  }
  return {
    folder,
    cottage: sourceFor('cottage.mp3'),
    expedition: sourceFor('expedition.mp3'),
  }
}

function parseResponseText(response) {
  if (typeof response.output_text === 'string') return response.output_text
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text
    }
  }
  throw new Error('模型没有返回可读取的报告')
}

// ── Angel letter AI narrative ───────────────────────────────

const ANGEL_PROMPT = fs.readFileSync(path.join(__dirname, 'prompts', 'angel-letter.txt'), 'utf-8')
const ANGEL_PROMPT_VERSION = 4

async function generateLetterNarrative(letter) {
  return generateAngelNarrative({
    letter,
    apiKey: readApiKey(),
    settings: database.getSettings(),
    prompt: ANGEL_PROMPT,
  })
}

function migrateRetiredDeepSeekLetterModel() {
  const settings = database.getSettings()
  if (settings.api_provider !== 'deepseek' || settings.model !== 'deepseek-chat') return 0

  database.setSettings({ model: 'deepseek-v4-flash' })
  // The old alias can have exhausted the normal retry budget. Give only the
  // affected template letters one fresh attempt with the supported model;
  // never replace an existing AI body or alter frozen facts.
  database.run(
    "UPDATE letters SET ai_status = 'pending', ai_retry_count = 0 WHERE letter_type IN ('daily', 'weekly') AND ai_body IS NULL AND ai_status = 'failed'"
  )
  return 0
}

async function ensureAiNarratives() {
  const MAX_RETRIES = 3
  const GLOBAL_TIMEOUT = 60000 // 60s max for all letters
  const deadline = Date.now() + GLOBAL_TIMEOUT
  const summary = { considered: 0, polished: 0, failed: 0, skipped: 0 }

  migrateRetiredDeepSeekLetterModel()

  // Only process NEW letters (pending), not historical template letters.
  // Failed letters with retries remaining are also retried.
  if (!readApiKey()) {
    database.run("UPDATE letters SET ai_status = 'skipped' WHERE ai_status = 'pending'")
    return summary
  }

  const pending = database.all(
    `SELECT * FROM letters WHERE template_body IS NOT NULL AND template_body != ''
     AND letter_type IN ('daily', 'weekly')
     AND (ai_status IN ('pending', 'skipped')
       OR (ai_status = 'failed' AND COALESCE(ai_retry_count,0) < ?))
     ORDER BY created_at DESC LIMIT 10`, [MAX_RETRIES]
  )
  for (const letter of pending) {
    if (Date.now() > deadline) break // global timeout
    if (!isAngelNarrativeEligible(letter)) continue
    summary.considered += 1
    const result = await generateLetterNarrative(letter)
    if (result.success) {
      const useAiBody = shouldUseAiBody(letter) ? 1 : 0
      database.run(
        "UPDATE letters SET ai_body = ?, body_source = CASE WHEN ? = 1 AND is_read = 0 AND body_source = 'template' THEN 'ai' ELSE body_source END, ai_status = 'success', ai_provider = ?, ai_model = ?, ai_prompt_version = ?, ai_retry_count = 0 WHERE id = ?",
        [result.text, useAiBody, result.provider, result.model, ANGEL_PROMPT_VERSION, letter.id]
      )
      summary.polished += 1
    } else if (result.status === 'skipped') {
      database.run("UPDATE letters SET ai_status = 'skipped' WHERE id = ?", [letter.id])
      summary.skipped += 1
    } else {
      const newRetry = (letter.ai_retry_count || 0) + 1
      const finalStatus = newRetry >= MAX_RETRIES ? 'failed' : result.status
      database.run(
        "UPDATE letters SET ai_status = ?, ai_retry_count = ? WHERE id = ?",
        [finalStatus, newRetry, letter.id]
      )
      summary.failed += 1
    }
  }
  return summary
}

// ── Test letter: verify AI configuration works ──────────────

async function generateTestLetter() {
  const apiKey = readApiKey()
  if (!apiKey) return { success: false, error: '没有配置信笺钥匙' }

  const settings = database.getSettings()
  let config
  try { config = resolveAngelAiConfig(settings) } catch (error) { return { success: false, error: error.message } }
  const { provider, model, baseUrl } = config

  const testFact = {
    letterType: 'daily',
    fact: { chronicle: { season: '夏' }, journey: { mainDirection: '松风林' } },
  }
  const systemPrompt = ANGEL_PROMPT + '\n\n## 测试信笺\n' + JSON.stringify(testFact)

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, max_tokens: 200,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '请写一封很短的测试信，20字以内。' },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { success: false, error: json?.error?.message || `HTTP ${response.status}` }
    }
    const text = json.choices?.[0]?.message?.content?.trim()
    return text ? { success: true, text, provider, model } : { success: false, error: '空响应' }
  } catch (e) {
    return { success: false, error: e?.message || '网络请求失败' }
  }
}

// ── Existing AI report ──────────────────────────────────────

async function generateAiReport(type, date) {
  const apiKey = readApiKey()
  if (!apiKey) throw new Error('请先在设置中配置 API Key')
  const settings = database.getSettings()
  const provider = settings.api_provider || 'openai'
  const proxyUrl = settings.proxy_url || ''
  const fetchOptions = {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  }
  if (proxyUrl) fetchOptions.dispatcher = new ProxyAgent(proxyUrl)
  const payload = database.getAiPayload(type, date)
  const periodName = type === 'daily' ? '日复盘' : '周成长报告'

  if (provider === 'deepseek') {
    const model = !settings.model || settings.model === 'deepseek-chat'
      ? 'deepseek-v4-flash'
      : settings.model
    const schemaDesc = `返回严格 JSON：{"summary":"一段温和总结","wins":["最多4条"],"patterns":["最多4条"],"risks":["最多3条"],"suggestions":["最多3条"],"next_focus":"一个足够小的下一步"}`
    const body = {
      model,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `你是一位温和但诚实的个人学习教练。只根据给定数据总结，不制造焦虑，不使用连续打卡压力。用简洁中文指出真实成果、可观察规律和一个足够小的下一步。\n${schemaDesc}` },
        { role: 'user', content: `请生成${periodName}。学习数据如下：\n${JSON.stringify(payload)}` },
      ],
    }
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', { ...fetchOptions, body: JSON.stringify(body) })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(json?.error?.message || `请求失败（HTTP ${response.status}）`)
    let report
    try {
      report = JSON.parse(json.choices[0].message.content)
    } catch (error) {
      throw new Error(`AI 报告格式无效：${error.message}`)
    }
    database.saveAiReport(type, date, report, model)
    return { report, model }
  }

  // OpenAI path (default)
  const model = settings.model || 'gpt-5.6-luna'
  const response = await fetch('https://api.openai.com/v1/responses', {
    ...fetchOptions,
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 1600,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: '你是一位温和但诚实的个人学习教练。只根据给定数据总结，不制造焦虑，不使用连续打卡压力。用简洁中文指出真实成果、可观察规律和一个足够小的下一步。' }] },
        { role: 'user', content: [{ type: 'input_text', text: `请生成${periodName}。学习数据如下：\n${JSON.stringify(payload)}` }] },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'learning_report',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: { type: 'string' },
              wins: { type: 'array', items: { type: 'string' }, maxItems: 4 },
              patterns: { type: 'array', items: { type: 'string' }, maxItems: 4 },
              risks: { type: 'array', items: { type: 'string' }, maxItems: 3 },
              suggestions: { type: 'array', items: { type: 'string' }, maxItems: 3 },
              next_focus: { type: 'string' },
            },
            required: ['summary', 'wins', 'patterns', 'risks', 'suggestions', 'next_focus'],
          },
        },
      },
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.message || `请求失败（HTTP ${response.status}）`)
  let report
  try { report = JSON.parse(parseResponseText(body)) }
  catch (error) { throw new Error(`AI 报告格式无效：${error.message}`) }
  database.saveAiReport(type, date, report, model)
  return { report, model }
}

function handle(channel, callback) {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      return await callback(payload)
    } catch (error) {
      throw new Error(error?.message || '操作失败')
    }
  })
}

function registerHandlers() {
  handle('dashboard:get', () => database.getDashboard())
  handle('world:get', () => database.getWorldFoundation())
  handle('player:update', (data) => database.updatePlayerProfile(data))
  handle('structure:get', () => database.getStructure())
  handle('structure:get-all', () => database.getAllStructure())
  handle('area:create', (data) => database.createArea(data))
  handle('area:update', ({ id, data }) => database.updateArea(id, data))
  handle('area:archive', (id) => database.archiveArea(id))
  handle('area:restore', (id) => database.restoreArea(id))
  handle('area:delete', (id) => database.deleteArea(id))
  handle('goal:create', (data) => database.createGoal(data))
  handle('goal:update', ({ id, data }) => database.updateGoal(id, data))
  handle('goal:delete', (id) => database.deleteGoal(id))
  handle('goal:archive', (id) => database.archiveGoal(id))
  handle('goal:restore', (id) => database.restoreGoal(id))
  handle('task:create', (data) => database.createTask(data))
  handle('task:update', ({ id, patch }) => database.updateTask(id, patch))
  handle('task:reorder', (items) => database.reorderTasks(items))
  handle('task:delete', (id) => database.deleteTask(id))
  handle('task:restore', (id) => database.restoreTask(id))
  handle('task:reopen', (id) => database.reopenTask(id))
  handle('task:manual-complete', (id) => database.manualCompleteTask(id))
  handle('session:active', () => database.getActiveSession())
  handle('session:start', (data) => database.startSession(data))
  handle('session:heartbeat', (id) => database.heartbeat(id))
  handle('session:pause', (id) => database.pauseSession(id))
  handle('session:resume', (id) => database.resumeSession(id))
  handle('session:stop', ({ id, data }) => database.stopSession(id, data))
  handle('session:cancel', (id) => database.cancelSession(id))
  handle('caravan:buy', ({ sessionId, slotIndex }) => database.buyCaravanItem(sessionId, slotIndex))
  handle('bard:claim', (sessionId) => database.claimBardPoem(sessionId))
  handle('bard:list', () => database.getPoetryCollection())
    handle('companions:get', () => database.getCompanionCollection())
    handle('companions:set-active', (id) => database.setActiveCompanion(id))
    handle('companions:rename', ({ id, nickname }) => database.renameCompanion(id, nickname))
    handle('companions:get-pending-growth', () => database.getPendingGrowthEvent())
    handle('companions:mark-growth-seen', (id) => database.markGrowthEventSeen(id))
    handle('companions:evolve', ({ id, pathId }) => database.evolveCompanion(id, pathId))
  handle('history:get', (limit) => database.getHistory(limit))
  handle('review:daily', (date) => database.getDailyReview(date))
  handle('review:save-daily', (data) => database.saveDailyReview(data))
  handle('review:weekly', (date) => database.getWeeklyReport(date))
  handle('settings:get', () => ({ ...database.getSettings(), hasApiKey: Boolean(readApiKey()) }))
  handle('settings:set', (data) => {
    const result = database.setSettings(data)
    if (data && ['api_provider', 'model', 'ai_base_url', 'proxy_url'].some((key) => Object.hasOwn(data, key))) {
      database.run("UPDATE letters SET ai_status = 'pending', ai_retry_count = 0 WHERE ai_status IN ('skipped', 'failed', 'quota_exceeded')")
      ensureAiNarratives().catch(() => {})
    }
    return result
  })
  handle('settings:has-api-key', () => Boolean(readApiKey()))
  handle('settings:set-api-key', (key) => {
    saveApiKey(key)
    database.run("UPDATE letters SET ai_status = 'pending', ai_retry_count = 0 WHERE ai_status IN ('skipped', 'failed', 'quota_exceeded')")
    ensureAiNarratives().catch(() => {})
    return true
  })
  handle('settings:clear-api-key', () => { clearApiKey(); return true })
  handle('settings:open-data-folder', async () => shell.openPath(database.openDataPath()))
  handle('settings:get-bgm-sources', () => getBgmSources())
  handle('settings:open-bgm-folder', async () => shell.openPath(ensureBgmFolder()))
  handle('ai:generate', ({ type, date }) => generateAiReport(type, date))
  handle('inventory:use', (itemId) => database.useItem(itemId))
  handle('inventory:use-target', ({ itemId, companionId }) => database.useItem(itemId, companionId))
  handle('hearth:get', () => database.getHearthState())
  handle('hearth:set-lit', (lit) => database.setHearthLit(lit))
  handle('hearth:craft', (recipeId) => database.useHearthRecipe(recipeId))
  handle('observatory:get-daily', (dateOrTimestamp) => {
    const d = require('./domain.cjs')
    const now = dateOrTimestamp ? Number(dateOrTimestamp) : Date.now()
    const period = d.getDailyPeriod(now)
    const act = database.getActiveSession()
    const isToday = d.localDateKey() === period.periodKey
    if (process.env.VITE_DEV_SERVER_URL) { console.log('[obs:get-daily]', { inputTs: dateOrTimestamp, periodKey: period.periodKey, hasActive: !!act }) }
    const cur = isToday && act && act.status !== 'cancelled' ? { id: act.id, content: act.content, activeSeconds: act.active_seconds, status: act.status } : null
    const stats = database.getCompletedStats(period.periodStart, period.periodEnd)
    const sessions = database.all(
      "SELECT id, content, active_seconds, ended_at, area_id FROM focus_sessions WHERE status = 'completed' AND active_seconds >= 60 AND ended_at >= ? AND ended_at < ? ORDER BY ended_at DESC",
      [period.periodStart, period.periodEnd],
    ).map(s => ({ id: s.id, title: s.content, activeSeconds: s.active_seconds, endedAt: s.ended_at, returnKind: d.getReturnKind(s.active_seconds), areaName: '', areaColor: '' }))
    const hourly = d.computeDailyHourly(database, period)
    const review = database.getDailyReview(period.periodKey).review
    return {
      period, stats: { totalActiveSeconds: stats.totalActiveSeconds, sessionCounts: stats.sessionCounts, completedTaskCount: stats.completedTaskCount, directionBreakdown: stats.directionBreakdown, longestSessionSeconds: stats.longestSessionSeconds },
      sessions, hourlyActiveSeconds: hourly, hourlyDistributionPrecision: 'exact',
      review: review ? { win: review.win || '', blocker: review.blocker || '', energy: review.energy, futureNote: review.tomorrow_task || '' } : null,
      currentSession: cur,
    }
  })
  handle('observatory:get-weekly', (dateOrTimestamp) => {
    const d = require('./domain.cjs')
    const now = dateOrTimestamp ? Number(dateOrTimestamp) : Date.now()
    const period = d.getWeeklyPeriod(now)
    const stats = database.getCompletedStats(period.periodStart, period.periodEnd)
    const dailyActiveSeconds = []
    for (let i = 0; i < 7; i++) {
      const ds = database.getCompletedStats(period.periodStart + i * 86400000, period.periodStart + (i + 1) * 86400000)
      dailyActiveSeconds.push(ds.totalActiveSeconds)
    }
    const prev = d.previousWeeklyPeriod(period.periodStart)
    const prevStats = database.getCompletedStats(prev.periodStart, prev.periodEnd)
    const tasks = database.all(
      "SELECT id, title FROM tasks WHERE status = 'done' AND completed_at >= ? AND completed_at < ? ORDER BY completed_at DESC LIMIT 10",
      [period.periodStart, period.periodEnd],
    )
    const heatmap = d.computeWeeklyHeatmap(database, period)
    return { period, stats: { totalActiveSeconds: stats.totalActiveSeconds, dailyActiveSeconds, sessionCounts: stats.sessionCounts, completedTaskCount: stats.completedTaskCount, directionBreakdown: stats.directionBreakdown, longestSessionSeconds: stats.longestSessionSeconds, previousPeriodTotalSeconds: prevStats.totalActiveSeconds }, representativeTasks: tasks, hourlyActiveSecondsByDay: heatmap, hourlyDistributionPrecision: 'exact' }
  })
  handle('observatory:get-review', (date) => {
    const d = database.getDailyReview(date)
    return d
  })
  handle('observatory:save-review', (data) => database.saveDailyReview(data))
  handle('mail:list', (opts) => {
    const letters = database.listLetters(opts)
    return letters.map(l => ({
      id: l.id, letterType: l.letter_type, periodKey: l.period_key, periodStart: l.period_start, periodEnd: l.period_end,
      subject: l.subject, bodyPreview: (l.template_body || '').slice(0, 80) + ((l.template_body || '').length > 80 ? '…' : ''),
      isRead: l.is_read === 1, readAt: l.read_at, createdAt: l.created_at,
    }))
  })
  handle('mail:get', (id) => {
    const l = database.getLetterById(id)
    if (!l) { const e = new Error('信件不存在'); e.code = 'LETTER_NOT_FOUND'; throw e }
    const body = l.body_source === 'ai' && l.ai_body ? l.ai_body : l.template_body
    const fact = l.fact
    return {
      id: l.id, letterType: l.letter_type,
      period: { periodKey: l.period_key, periodStart: l.period_start, periodEnd: l.period_end, timezoneName: l.timezone_name, timezoneOffsetMinutes: l.timezone_offset_minutes },
      subject: l.subject, body, bodySource: l.body_source,
      aiStatus: l.ai_status || 'template',
      aiProvider: l.ai_provider || undefined,
      aiModel: l.ai_model || undefined,
      aiPromptVersion: l.ai_prompt_version || undefined,
      factSummary: { totalActiveSeconds: fact.totalActiveSeconds || 0, sessionCounts: fact.sessionCounts || {}, completedTaskCount: (fact.completedTasks || []).length },
      isRead: l.is_read === 1, readAt: l.read_at, replyText: l.reply_text, createdAt: l.created_at,
    }
  })
  handle('mail:get-unread-count', () => database.getUnreadLetterCount())
  handle('mail:get-latest-unread', () => {
    const l = database.getLatestUnreadLetter()
    return l ? { id: l.id, subject: l.subject, letterType: l.letter_type, createdAt: l.created_at } : null
  })
  handle('mail:mark-read', (id) => { const l = database.markLetterRead(id); return { id: l.id, isRead: l.is_read === 1, readAt: l.read_at } })
  handle('mail:mark-unread', (id) => { const l = database.markLetterUnread(id); return { id: l.id, isRead: l.is_read === 1, readAt: l.read_at } })
  handle('mail:save-reply', ({ id, replyText }) => {
    try { const l = database.saveLetterReply(id, replyText); return { replyText: l.reply_text, updatedAt: l.updated_at } }
    catch (e) { const err = new Error(e.message); err.code = 'INVALID_REPLY'; throw err }
  })
  handle('settings:get-birthday', () => database.getBirthdaySettings())
  handle('settings:set-birthday', ({ month, day }) => database.setBirthday(month, day))
  handle('dev:db-info', () => database.getDbInfo())
  handle('mail:generate-narratives', () => ensureAiNarratives())
  handle('mail:test-letter', () => generateTestLetter())
  handle('dev:repair-mail-timeline', () => database.repairMailTimeline())
  handle('dev:clean-test-events', () => database.cleanTestEvents())
  handle('dev:reset-mail-timeline', () => database.resetMailTimeline())
  handle('dev:diagnose-mail', () => database.diagnoseMail())
  handle('mail:ensure-periodic', (simTs) => {
    const now = typeof simTs === 'number' ? simTs : Date.now()
    const periodic = database.ensurePeriodicLetters(now)
    const events = database.ensureEventLetters(now)
    const birthday = database.ensureBirthdayLetter(now)
    // Periodic letters can also be created while the app remains open. Queue
    // their optional narration immediately, without delaying the UI or the
    // template-letter fallback.
    ensureAiNarratives().catch(() => {})
    return { ...periodic, events, birthday }
  })
  ipcMain.on('window:show', showWindow)
}

app.setAppUserModelId(APP_ID)

app.whenReady().then(async () => {
  database = await new StudyDatabase(app.getPath('userData')).init()
  registerHandlers()
  try { database.ensureWelcomeLetter() } catch (_) { /* non-critical */ }
  try { database.ensurePeriodicLetters(); database.ensureEventLetters(); database.ensureBirthdayLetter() } catch (_) { /* non-critical on startup */ }
  createWindow()
  // AI narratives run in background — never block the game
  ensureAiNarratives().catch(() => {})
  createTray()
  powerMonitor.on('suspend', () => database.autoPauseForSuspend())
  powerMonitor.on('resume', () => {
    try { database.ensurePeriodicLetters(); database.ensureEventLetters(); database.ensureBirthdayLetter() } catch (_) { /* non-critical */ }
    ensureAiNarratives().catch(() => {})
    if (database.getActiveSession()?.status === 'paused' && Notification.isSupported()) {
      new Notification({ title: '专注已自动暂停', body: '电脑刚刚恢复，请确认是否继续。' }).show()
    }
  })
  setInterval(() => {
    const session = database.shouldSendLongNotification()
    if (session && Notification.isSupported()) {
      new Notification({ title: '已经专注 90 分钟', body: '状态允许的话，起身活动一下再继续。' }).show()
    }
  }, 60000)
})

app.on('activate', showWindow)
app.on('before-quit', () => { allowQuit = true })
app.on('window-all-closed', () => {})
