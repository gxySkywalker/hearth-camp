import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error Electron helper is CommonJS and intentionally shared with tests.
import angelAi from '../../electron/angel-ai.cjs'

const { buildNarrativeFactEnvelope, generateAngelNarrative, isAngelNarrativeEligible, shouldUseAiBody, resolveAngelAiConfig } = angelAi
const prompt = '小天使提示词'
const letter = {
  id: 'letter-1', letter_type: 'daily', period_key: '2026-07-20', period_start: 1, period_end: 2,
  timezone_name: 'Asia/Shanghai', timezone_offset_minutes: 480,
  fact_json: JSON.stringify({
    schemaVersion: 3, internalName: 'mail-v3', letterType: 'daily', period: { periodKey: '2026-07-20', timezoneName: 'Asia/Shanghai' },
    stats: { totalActiveSeconds: 1200, sessionCounts: { short: 2, expedition: 1 }, directionBreakdown: [{ id: 'area-1', name: '通用学习', source: 'system_default' }] },
    journey: { mainDirection: '通用学习', mainDirectionNarrative: { name: '通用学习', source: 'system_default' }, completedTasks: [{ id: 'task-1', title: '整理旧笔记' }], discoveries: [{ id: 'node-1', name: '林间旧亭' }] },
    observatory: { hasWrittenReview: true }, chronicle: { season: '夏', newDiscoveries: [{ id: 'node-1', name: '林间旧亭' }] },
    worldState: { locations: { postOffice: { windowPhase: 'intact' } }, flora: {}, visitor: null, activeEvents: [] },
  }),
}

describe('angel AI runtime', () => {
  it('only queues daily and weekly letters for AI narration', () => {
    expect(isAngelNarrativeEligible({ letter_type: 'daily' })).toBe(true)
    expect(isAngelNarrativeEligible({ letter_type: 'weekly' })).toBe(true)
    expect(isAngelNarrativeEligible({ letter_type: 'memorial', period_key: 'welcome:first_visit' })).toBe(false)
    expect(isAngelNarrativeEligible({ letter_type: 'memorial', period_key: 'birthday:2026' })).toBe(false)
    expect(isAngelNarrativeEligible({ letter_type: 'festival' })).toBe(false)
  })

  it('keeps a template body after the player has read it', () => {
    expect(shouldUseAiBody({ is_read: 0 })).toBe(true)
    expect(shouldUseAiBody({ is_read: 1, body_source: 'template' })).toBe(false)
  })

  it('skips without a key and never calls the provider', async () => {
    const fetchImpl = vi.fn()
    await expect(generateAngelNarrative({ letter, apiKey: null, prompt, fetchImpl })).resolves.toMatchObject({ success: false, status: 'skipped' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('upgrades the retired DeepSeek model alias before sending the frozen fact envelope', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '我已经收好。' } }] }) })
    const result = await generateAngelNarrative({ letter, apiKey: 'key', prompt, fetchImpl, settings: { api_provider: 'deepseek', model: 'deepseek-chat' } })
    expect(result).toMatchObject({ success: true, status: 'success', provider: 'deepseek', model: 'deepseek-v4-flash' })
    expect(fetchImpl).toHaveBeenCalledWith('https://api.deepseek.com/v1/chat/completions', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer key' }) }))
    const system = JSON.parse(fetchImpl.mock.calls[0][1].body).messages[0].content
    const request = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(request.max_tokens).toBe(900)
    for (const key of ['period', 'stats', 'journey', 'observatory', 'chronicle']) expect(system).toContain(`\"${key}\"`)
    expect(system).not.toContain('postOfficeDetail')
  })

  it('keeps distinct daily and weekly length guidance in the prompt asset', () => {
    const promptText = readFileSync(resolve(process.cwd(), 'electron/prompts/angel-letter.txt'), 'utf8')
    expect(promptText).toContain('daily：120–180 字')
    expect(promptText).toContain('weekly：200–300 字')
  })

  it('isolates AI narrative facts from database schema and internal direction fields', () => {
    const envelope = buildNarrativeFactEnvelope(letter)
    expect(envelope.journey.direction).toBe('旧书页间的旅途')
    expect(envelope.journey.completedTasks).toEqual(['整理旧笔记'])
    expect(envelope.stats.departures).toBe(3)
    const payload = JSON.stringify(envelope)
    for (const forbidden of ['通用学习', 'system_default', 'schemaVersion', 'internalName', 'area-1', 'task-1', 'node-1', 'timezoneName', '艾达', '窗框']) {
      expect(payload).not.toContain(forbidden)
    }
  })

  it('preserves a user-created direction in the AI narrative facts', () => {
    const customLetter = {
      ...letter,
      fact_json: JSON.stringify({
        letterType: 'daily', period: { periodKey: '2026-07-20' }, stats: { sessionCounts: { short: 1 } },
        journey: { mainDirection: '准备秋招', mainDirectionNarrative: { name: '准备秋招', source: 'user_created' }, completedTasks: [] },
        observatory: {}, chronicle: {}, worldState: {},
      }),
    }
    expect(buildNarrativeFactEnvelope(customLetter).journey.direction).toBe('准备秋招')
  })

  it('passes a frozen weekly observatory note as narrative material', () => {
    const weeklyLetter = {
      ...letter,
      letter_type: 'weekly',
      fact_json: JSON.stringify({
        letterType: 'weekly', period: { periodKey: '2026-07-20' }, stats: { totalActiveSeconds: 5400, sessionCounts: { expedition: 1 } },
        journey: { completedTasks: [] },
        observatory: { hasWrittenReview: true, weeklyNote: '终于看清了河湾的旧路。' },
        chronicle: {}, worldState: {},
      }),
    }
    const envelope = buildNarrativeFactEnvelope(weeklyLetter)
    expect(envelope.observatory).toEqual({ hasWrittenReview: true, weeklyNote: '终于看清了河湾的旧路。' })
    expect(envelope.stats.weeklyTotalActiveSeconds).toBe(5400)
  })

  it('exposes only the curated real expedition details needed for immersive letters', () => {
    const richLetter = {
      ...letter,
      fact_json: JSON.stringify({
        letterType: 'daily', period: { periodKey: '2026-07-20' }, stats: { sessionCounts: { expedition: 1 } },
        journey: { completedTasks: [], expeditionStories: { locations: ['雾谷石阶'], moments: ['你们在树下等候短雨。'], companionsMet: ['灯团'], companionsTravelled: ['栗子'], rareFinds: ['月银罗盘'] } },
        observatory: {}, chronicle: {}, worldState: {},
      }),
    }
    expect(buildNarrativeFactEnvelope(richLetter).journey.expeditionStories).toEqual({
      locations: ['雾谷石阶'], moments: ['你们在树下等候短雨。'], companionsMet: ['灯团'], companionsTravelled: ['栗子'], rareFinds: ['月银罗盘'],
    })
  })

  it('keeps postal user text free of the weekly-report label', () => {
    for (const file of ['electron/domain.cjs', 'src/pages/PostOfficePage.tsx']) {
      expect(readFileSync(resolve(process.cwd(), file), 'utf8')).not.toContain('周报')
    }
  })

  it('uses a saved custom base URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '信。' } }] }) })
    await generateAngelNarrative({ letter, apiKey: 'key', prompt, fetchImpl, settings: { api_provider: 'custom', ai_base_url: 'https://example.test/v1/' } })
    expect(fetchImpl.mock.calls[0][0]).toBe('https://example.test/v1/chat/completions')
  })

  it('uses a provider default URL instead of a stale custom endpoint', () => {
    expect(resolveAngelAiConfig({ api_provider: 'deepseek', model: 'deepseek-chat', ai_base_url: 'https://old-proxy.example/v1' }))
      .toMatchObject({ provider: 'deepseek', model: 'deepseek-v4-flash', baseUrl: 'https://api.deepseek.com/v1' })
  })

  it.each(['daily', 'weekly'])('can polish each eligible %s letter with the configured provider', async (letterType) => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '小天使已经记下这段旅途。' } }] }) })
    const result = await generateAngelNarrative({ letter: { ...letter, letter_type: letterType }, apiKey: 'key', prompt, fetchImpl, settings: { api_provider: 'deepseek', model: 'deepseek-chat' } })
    expect(result).toMatchObject({ success: true, status: 'success', provider: 'deepseek', model: 'deepseek-v4-flash' })
  })

  it('keeps template fallback states for an invalid key, quota limit, and timeout', async () => {
    const failed = await generateAngelNarrative({ letter, apiKey: 'bad', prompt, fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid key' } }) }) })
    expect(failed).toMatchObject({ success: false, status: 'failed' })
    const quota = await generateAngelNarrative({ letter, apiKey: 'key', prompt, fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }) })
    expect(quota).toMatchObject({ success: false, status: 'quota_exceeded' })
    const timeout = await generateAngelNarrative({ letter, apiKey: 'key', prompt, fetchImpl: vi.fn().mockRejectedValue(new Error('The operation was aborted')) })
    expect(timeout).toMatchObject({ success: false, status: 'failed' })
  })
})
