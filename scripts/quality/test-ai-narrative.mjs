// AI narrative integration test. It intentionally uses a temporary database
// and a deterministic mock provider: quality checks must never read or write a
// player's DPAPI key or production save.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strict as assert } from 'node:assert'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { StudyDatabase } = require('../../electron/database.cjs')
const { generateAngelNarrative } = require('../../electron/angel-ai.cjs')

const dir = mkdtempSync(join(tmpdir(), 'hearth-camp-ai-test-'))

try {
  const db = await new StudyDatabase(dir).init()
  const now = Date.now()
  const letter = db.createLetter({
    id: 'test-ai-narrative',
    letterType: 'daily',
    periodKey: '2026-08-06',
    periodStart: now - 86400000,
    periodEnd: now,
    timezoneOffsetMinutes: 480,
    timezoneName: 'Asia/Shanghai',
    subject: '8月6日的星页',
    fact: {
      schemaVersion: 2,
      letterType: 'daily',
      period: { periodKey: '2026-08-06', timezoneName: 'Asia/Shanghai' },
      stats: { totalActiveSeconds: 3600, sessionCounts: { brief: 0, short: 0, expedition: 1, deep: 0 } },
      journey: { completedTasks: [{ title: '整理炉火营地问题' }], mainDirection: '炉火营地问题修复' },
      observatory: { hasWrittenReview: false },
      chronicle: { season: '夏' },
    },
    templateBody: '这一页先由小天使安静收好。',
  })

  let sentBody = null
  const aiText = '今天你一共踏上了1次出征，来路都落在地图上。今天的旅途主要朝着炉火营地问题修复延伸。整理炉火营地问题的路标已经收好。'
  const result = await generateAngelNarrative({
    letter,
    apiKey: 'integration-test-key',
    settings: { api_provider: 'deepseek', model: 'deepseek-v4-flash' },
    prompt: '只依据当前信件事实写信。',
    fetchImpl: async (_url, options) => {
      sentBody = JSON.parse(options.body)
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: aiText } }] }) }
    },
  })

  assert.equal(result.success, true)
  assert.match(sentBody.messages[0].content, /炉火营地问题修复/)
  db.run("UPDATE letters SET ai_body = ?, body_source = 'ai', ai_status = 'success', ai_provider = ?, ai_model = ? WHERE id = ?", [result.text, result.provider, result.model, letter.id])
  const stored = db.getLetterById(letter.id)
  const visibleBody = stored.body_source === 'ai' && stored.ai_body ? stored.ai_body : stored.template_body
  assert.equal(visibleBody, aiText)
  assert.equal(stored.ai_provider, 'deepseek')
  console.log('AI NARRATIVE INTEGRATION PASSED: facts → provider request → AI body → visible letter')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
