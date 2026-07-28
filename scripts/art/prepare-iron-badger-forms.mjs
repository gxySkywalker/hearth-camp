import { mkdir, readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { writeNormalizedWalkAtlas } from './companion-atlas.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const draftDir = resolve(root, 'assets/art/drafts/iron-badger-forms')
const outputDir = resolve(root, 'assets/art/characters/companions')

const forms = [
  { id: 'stage-0', portrait: 'iron_badger_stage-0_portrait_source.png', walk: 'iron_badger_stage-0_walk_source.png' },
  { id: 'stage-1', portrait: 'iron_badger_stage-1_portrait_source.png', walk: 'iron_badger_stage-1_walk_source.png' },
  { id: 'armor_king', portrait: 'iron_badger_armor_king_portrait_source.png', walk: 'iron_badger_armor_king_walk_source.png' },
]

function isEdgeBackground(red, green, blue) {
  const brightest = Math.max(red, green, blue)
  const darkest = Math.min(red, green, blue)
  return brightest >= 222 && brightest - darkest <= 8
}

// Only erase neutral white/checker pixels connected to the outer image edge.
// The badger's white face stripes and pale claws therefore remain untouched.
function clearEdgeConnectedBackground(data, width, height) {
  const seen = new Uint8Array(width * height)
  const queue = []
  const visit = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const key = y * width + x
    if (seen[key]) return
    const offset = key * 4
    if (!isEdgeBackground(data[offset], data[offset + 1], data[offset + 2])) return
    seen[key] = 1
    queue.push(key)
  }
  for (let x = 0; x < width; x += 1) { visit(x, 0); visit(x, height - 1) }
  for (let y = 0; y < height; y += 1) { visit(0, y); visit(width - 1, y) }
  for (let index = 0; index < queue.length; index += 1) {
    const key = queue[index]
    const x = key % width
    const y = Math.floor(key / width)
    data[key * 4 + 3] = 0
    visit(x - 1, y); visit(x + 1, y); visit(x, y - 1); visit(x, y + 1)
  }
}

async function transparentRaster(filename) {
  const { data, info } = await sharp(resolve(draftDir, filename)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  clearEdgeConnectedBackground(data, info.width, info.height)
  return { data, info }
}

await mkdir(outputDir, { recursive: true })
for (const form of forms) {
  const portrait = await transparentRaster(form.portrait)
  await sharp(portrait.data, { raw: portrait.info }).png().toFile(resolve(outputDir, `iron_badger_${form.id}_camp_portrait_v1.png`))
  for (const cellSize of [32, 48]) {
    const walk = await transparentRaster(form.walk)
    await writeNormalizedWalkAtlas({ data: walk.data, info: walk.info, cellSize, output: resolve(outputDir, `iron_badger_${form.id}_walk_${cellSize}_v1.png`) })
  }
}

const files = await readdir(outputDir)
console.log(`Prepared ${forms.length} stone-iron badger forms: ${files.filter((name) => /^iron_badger_(stage-0|stage-1|armor_king)_/.test(name)).join(', ')}`)
