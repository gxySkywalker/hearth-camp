const { narrativeDirectionName } = require('./domain.cjs')

function parseLetterFact(letter) {
  const raw = letter?.fact ?? letter?.fact_json
  if (!raw) throw new Error('信件缺少冻结事实')
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

function narrativeDirection(fact) {
  const journey = fact.journey || {}
  const raw = journey.mainDirectionNarrative || (journey.mainDirection
    ? { name: journey.mainDirection, source: journey.mainDirection === '通用学习' ? 'system_default' : 'user_created' }
    : null)
  return narrativeDirectionName(raw)
}

function narrativeNames(items) {
  return (items || []).map((item) => String(item?.title || item?.name || item || '').trim()).filter(Boolean)
}

function narrativeStories(journey) {
  const stories = journey?.expeditionStories || {}
  const travelled = narrativeNames(stories.companionsTravelled)
  // 早期冻结事实可能同时留下“栗子”和默认成长阶段旧名；它们不是两位伙伴。
  const formerHearthHoundNames = new Set(['炉尾', '栗鬃', '炭尾', '松影', '月爪'])
  const companionsTravelled = travelled.includes('栗子')
    ? travelled.filter((name) => !formerHearthHoundNames.has(name))
    : travelled
  return {
    locations: narrativeNames(stories.locations),
    moments: narrativeNames(stories.moments),
    companionsMet: narrativeNames(stories.companionsMet),
    companionsTravelled,
    rareFinds: narrativeNames(stories.rareFinds),
  }
}

function narrativeDepartures(stats) {
  return Object.values(stats?.sessionCounts || {}).reduce((sum, count) => sum + (Number(count) || 0), 0)
}

// This is the only fact contract exposed to a model. It deliberately does not
// mirror fact_json: ids, schema/version details, direction source labels, and
// raw internal category names never leave the program boundary.
function buildNarrativeFactEnvelope(letter) {
  const fact = parseLetterFact(letter)
  const stats = fact.stats || {}
  const journey = fact.journey || {}
  const chronicle = fact.chronicle || {}
  const period = fact.period || {}
  return {
    letterType: fact.letterType || letter.letter_type,
    period: { periodKey: period.periodKey || letter.period_key || null },
    stats: {
      departures: narrativeDepartures(stats),
      completedTaskCount: narrativeNames(journey.completedTasks).length,
      // 周信可以感知整周走过的时间，但提示词禁止把它写成数字报告。
      weeklyTotalActiveSeconds: (fact.letterType || letter.letter_type) === 'weekly'
        ? Math.max(0, Number(stats.totalActiveSeconds) || 0)
        : null,
    },
    journey: {
      direction: narrativeDirection(fact),
      completedTasks: narrativeNames(journey.completedTasks),
      discoveries: narrativeNames(journey.discoveries),
      expeditionStories: narrativeStories(journey),
    },
    observatory: {
      hasWrittenReview: fact.observatory?.hasWrittenReview === true,
      weeklyNote: typeof fact.observatory?.weeklyNote === 'string' ? fact.observatory.weeklyNote : null,
    },
    chronicle: {
      season: chronicle.season || null,
      newDiscoveries: narrativeNames(chronicle.newDiscoveries),
    },
  }
}

function isAngelNarrativeEligible(letter) {
  return letter?.letter_type === 'daily' || letter?.letter_type === 'weekly'
}

function shouldUseAiBody(letter) {
  return Number(letter?.is_read) !== 1
}

const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-flash'
const DEPRECATED_DEEPSEEK_MODELS = new Set(['deepseek-chat'])

function resolveAngelAiConfig(settings = {}) {
  const provider = ['deepseek', 'openai', 'custom'].includes(settings.api_provider) ? settings.api_provider : 'openai'
  const savedModel = String(settings.model || '').trim()
  // DeepSeek retired the old `deepseek-chat` alias. Resolve it at the request
  // boundary so existing DPAPI-backed key setups recover without requiring a
  // key re-entry or changing the mail lifecycle.
  const model = provider === 'deepseek' && (!savedModel || DEPRECATED_DEEPSEEK_MODELS.has(savedModel))
    ? DEEPSEEK_DEFAULT_MODEL
    : (savedModel || 'gpt-5.6-luna')
  const defaultBaseUrl = provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1'
  // A provider's saved endpoint is only meaningful for the explicit custom
  // option. This prevents a stale custom URL from silently intercepting a
  // later DeepSeek/OpenAI connection test or letter request.
  const baseUrl = provider === 'custom'
    ? String(settings.ai_base_url || settings.proxy_url || '').trim()
    : defaultBaseUrl
  if (!baseUrl) throw new Error('请先填写自定义信使地址')
  return { provider, model, baseUrl: baseUrl.replace(/\/$/, '') }
}

function extractAssistantText(payload) {
  const choice = payload?.choices?.[0]
  const content = choice?.message?.content ?? choice?.text
  if (typeof content === 'string') return content.trim()
  // A few OpenAI-compatible gateways return a list of text parts instead of
  // one string. Accept that shape without ever treating hidden reasoning as
  // the letter body.
  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part === 'string' ? part : String(part?.text || ''))
      .join('')
      .trim()
  }
  return ''
}

async function generateAngelNarrative({ letter, apiKey, settings = {}, prompt, fetchImpl = fetch, timeoutMs = 30000 }) {
  if (!apiKey) return { success: false, status: 'skipped' }
  let fact
  try { fact = buildNarrativeFactEnvelope(letter) } catch (error) { return { success: false, status: 'failed', error: error.message } }
  let config
  try { config = resolveAngelAiConfig(settings) } catch (error) { return { success: false, status: 'failed', error: error.message } }
  const { provider, model, baseUrl } = config
  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: 900, messages: [{ role: 'system', content: `${prompt}\n\n## 当前信件事实\n${JSON.stringify(fact)}` }, { role: 'user', content: '请根据当前事实，以小天使的口吻写一封短信。' }] }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) return response.status === 429 ? { success: false, status: 'quota_exceeded' } : { success: false, status: 'failed', error: json?.error?.message || `HTTP ${response.status}` }
    const text = extractAssistantText(json)
    return text ? { success: true, status: 'success', text, provider, model, fact } : { success: false, status: 'failed', error: 'empty response' }
  } catch (error) { return { success: false, status: 'failed', error: error?.message || 'request failed' } }
}

module.exports = { buildNarrativeFactEnvelope, generateAngelNarrative, isAngelNarrativeEligible, shouldUseAiBody, resolveAngelAiConfig, extractAssistantText }
