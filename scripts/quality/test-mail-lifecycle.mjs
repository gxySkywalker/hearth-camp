// Mail lifecycle acceptance test — creates temp DB, inserts real data, runs generation
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { StudyDatabase } = require('../../electron/database.cjs')

const dir = mkdtempSync(join(tmpdir(), 'growth-arc-mail-test-'))
console.log(`Temp DB: ${dir}`)

try {
  const db = await new StudyDatabase(dir).init()
  const area = db.getStructure().areas[0]

  // ── Setup: player started 2026-07-16 ──
  const mailStart = new Date(2026, 6, 16, 12).getTime()
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mail_started_at_ms', ?)", [String(mailStart)])

  // Set birthday: April 16
  db.setBirthday(4, 16)

  console.log('=== Settings ===')
  console.log(`birthday: ${db.getBirthdaySettings().month}/${db.getBirthdaySettings().day}`)
  console.log(`mail_started_at: ${new Date(mailStart).toISOString()}`)

  // ── Insert focus data for 7/17-7/20 ──
  for (const day of [17, 18, 19, 20]) {
    const s = db.startSession({ taskId: null, areaId: area.id, content: `远征 ${day}日` })
    const start = new Date(2026, 6, day, 8).getTime()
    const end = new Date(2026, 6, day, 10).getTime()
    db.run("INSERT INTO focus_intervals (id, session_id, started_at, ended_at) VALUES (?,?,?,?)",
      [crypto.randomUUID(), s.id, start, end])
    db.run("UPDATE focus_sessions SET status='completed', ended_at=?, active_seconds=7200 WHERE id=?",
      [end, s.id])
  }

  // ── Insert focus data for a full week 7/13-7/19 (for weekly) ──
  for (let d = 13; d <= 19; d++) {
    const s = db.startSession({ taskId: null, areaId: area.id, content: `远征 ${d}日` })
    const start = new Date(2026, 6, d, 10).getTime()
    const end = new Date(2026, 6, d, 12).getTime()
    db.run("INSERT INTO focus_intervals (id, session_id, started_at, ended_at) VALUES (?,?,?,?)",
      [crypto.randomUUID(), s.id, start, end])
    db.run("UPDATE focus_sessions SET status='completed', ended_at=?, active_seconds=7200 WHERE id=?",
      [end, s.id])
  }

  // ── Run generation at 2026-07-21 ──
  const now = new Date(2026, 6, 21, 12).getTime()
  const r = db.ensurePeriodicLetters(now)
  db.ensureEventLetters(now)
  db.ensureBirthdayLetter(now)

  // ── Output ──
  const letters = db.listLetters({ limit: 200 })
  const byType = {}
  for (const l of letters) {
    if (!byType[l.letter_type]) byType[l.letter_type] = []
    byType[l.letter_type].push(l.subject)
  }

  console.log('\n=== Generated letters ===')
  for (const t of ['daily', 'weekly', 'festival', 'birthday']) {
    console.log(`\n${t} (${(byType[t] || []).length}):`)
    for (const subj of (byType[t] || [])) {
      console.log(`  ${subj}`)
    }
  }

  // ── Verify ──
  const dailies = byType['daily'] || []
  const weeklies = byType['weekly'] || []
  const festivals = byType['festival'] || []
  const birthdays = byType['birthday'] || []

  console.log('\n=== Verification ===')

  // Daily: should have 4 letters (7/17-7/20)
  console.log(`daily count: ${dailies.length} (expected >=4)`)
  const oldTemplates = dailies.filter(s => s.includes('炉火旁') || s.includes('归程') || s.includes('整理'))
  console.log(`old templates in daily: ${oldTemplates.length} (expected 0)`)
  for (const s of dailies) {
    if (!/^\d+月\d+日的星页$/.test(s)) console.log(`  BAD FORMAT: ${s}`)
  }

  // Weekly: should have week 7/13-7/19
  console.log(`weekly count: ${weeklies.length} (expected >=1)`)
  for (const s of weeklies) {
    console.log(`  ${s}`)
    if (!/^\d+月\d+日-\d+月\d+日的旅途札记$/.test(s)) console.log(`  BAD FORMAT: ${s}`)
  }

  // Festival: should be 0 at July date
  console.log(`festival at 7/21: ${festivals.length} (expected 0)`)
  if (festivals.length > 0) console.log('  WARNING: festival letters exist outside festival dates!')

  // Birthday: should be 0 (birthday is 4/16, current date is 7/21)
  console.log(`birthday at 7/21: ${birthdays.length} (expected 0)`)

  // ── Now test festival at Nov 7 ──
  console.log('\n=== Festival simulation ===')
  const tests = [
    { label: 'Nov 6', ts: new Date(2026, 10, 6, 12).getTime(), expected2026: 0 },
    { label: 'Nov 7 (Day 1)', ts: new Date(2026, 10, 7, 12).getTime(), expected2026: 1 },
    { label: 'Nov 11 (Day 5)', ts: new Date(2026, 10, 11, 12).getTime(), expected2026: 2 },
    { label: 'Nov 16 (Day 10)', ts: new Date(2026, 10, 16, 12).getTime(), expected2026: 3 },
  ]
  for (const t of tests) {
    db.ensureEventLetters(t.ts)
    const fest = db.listLetters({ letterType: 'festival' })
    const y2026 = fest.filter(l => l.period_key.includes('2026'))
    const status = y2026.length === t.expected2026 ? 'OK' : `FAIL (got ${y2026.length})`
    console.log(`  ${t.label}: ${status}`)
    if (status !== 'OK') for (const l of y2026) console.log(`    ${l.subject}`)
  }

  // ── Test birthday ──
  console.log('\n=== Birthday simulation ===')
  const bdayTs = new Date(2027, 3, 16, 12).getTime()
  db.ensureBirthdayLetter(bdayTs)
  const bdayLetters = db.listLetters({ letterType: 'festival' }).filter(l => l.period_key.includes('birthday'))
  console.log(`birthday 2027-04-16: ${bdayLetters.length} letter(s) (expected >=1)`)
  // Check persistence
  const bdayLetters2 = db.listLetters({ letterType: 'festival' }).filter(l => l.period_key.includes('birthday'))
  console.log(`birthday persistence: ${bdayLetters2.length} (expected same as above)`)

  const diag = db.diagnoseMail()
  console.log('\n=== Final DB state ===')
  console.log(`daily:${diag.letters.daily} weekly:${diag.letters.weekly} festival:${diag.letters.festival} birthday:${diag.letters.birthday} world:${diag.letters.world}`)
  console.log(`orphans: L=${diag.orphanLetters} E=${diag.orphanEvents}  duplicates:${diag.duplicatePeriods}`)

} finally {
  rmSync(dir, { recursive: true, force: true })
}
