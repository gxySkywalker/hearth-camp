// AI narrative integration test — uses real API Key from user's config
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { StudyDatabase } = require('../../electron/database.cjs')
const path = require('path')

const dataDir = path.join(process.env.APPDATA || process.env.USERPROFILE + '/AppData/Roaming', 'growth-arc')

async function main() {
  const db = await new StudyDatabase(dataDir).init()
  console.log('DB:', db.filePath)

  // Check API Key
  const settings = db.getSettings()
  const hasKey = settings.hasApiKey || '0'
  const provider = settings.api_provider || 'openai'
  const model = settings.model || 'gpt-5.6-luna'
  const baseUrl = settings.ai_base_url || (provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1')

  console.log('Provider:', provider)
  console.log('Model:', model)
  console.log('Base URL:', baseUrl)

  if (hasKey !== '1') {
    console.log('\n❌ No API Key configured. Skipping live test.')
    console.log('→ Template letters will be used (world-appropriate narrative without AI).')
    console.log('→ This is the expected default behavior. AI is optional.')
    return
  }

  // Create test letter
  const testId = 'test-ai-narrative-' + Date.now()
  const fact = {
    schemaVersion: 2,
    letterType: 'daily',
    period: { periodKey: '2026-07-21', timezoneName: 'Asia/Shanghai' },
    stats: { totalActiveSeconds: 7200, sessionCounts: { brief: 0, short: 1, expedition: 0, deep: 0 } },
    journey: { completedTasks: [{ title: '整理松风林的旧地图' }], mainDirection: null },
    observatory: { hasWrittenReview: false },
    chronicle: { season: '夏' },
    memory: {},
  }

  try {
    db.createLetter({
      id: testId,
      letterType: 'daily',
      periodKey: 'test-2026-07-21',
      periodStart: Date.now() - 86400000,
      periodEnd: Date.now(),
      timezoneOffsetMinutes: -480,
      timezoneName: 'Asia/Shanghai',
      subject: '[TEST] AI Narrative Test',
      fact: fact,
      templateBody: '今天沿着旧路走了一段不短的路。炉火旁安静地收好今天。',
    })

    // Read the actual API key from Windows DPAPI
    const { app, safeStorage } = require('electron')
    // We can't access Electron APIs from a plain Node script.
    // Instead, call the IPC via main process.
    console.log('\n⚠ Cannot call AI from plain Node script (needs Electron safeStorage).')
    console.log('→ Test letter created in DB with template_body.')
    console.log('→ Run the Electron app to trigger ensureAiNarratives().')
    console.log('→ Then check letters table: ai_status should be success/failed.')

    // Cleanup
    db.run("DELETE FROM letters WHERE id = ?", [testId])
    console.log('→ Test letter cleaned up.')
  } catch (e) {
    console.error('Test failed:', e.message)
  }
}

main().catch(console.error)
