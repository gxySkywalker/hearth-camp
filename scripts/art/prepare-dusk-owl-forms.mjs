import { mkdir, readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { writeNormalizedWalkAtlas } from './companion-atlas.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const draftDir = resolve(root, 'assets/art/drafts/dusk-owl-forms')
const outputDir = resolve(root, 'assets/art/characters/companions')

const forms = [
  { id: 'stage-0', portrait: 'moon_owl_stage-0_portrait_source.png', walk: 'moon_owl_stage-0_walk_source.png' },
  { id: 'stage-1', portrait: 'moon_owl_stage-1_portrait_source.png', walk: 'moon_owl_stage-1_walk_source.png' },
  { id: 'dusk_owl', portrait: 'moon_owl_dusk_owl_portrait_source.png', walk: 'moon_owl_dusk_owl_walk_source.png' },
]

function isEdgeBackground(red, green, blue) {
  const brightest = Math.max(red, green, blue)
  const darkest = Math.min(red, green, blue)
  return brightest >= 222 && brightest - darkest <= 8
}

// Remove only pale checkerboard pixels connected to an outer image edge. This
// retains the owl's old-paper face feathers and every pale feather highlight.
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
  await sharp(portrait.data, { raw: portrait.info }).png().toFile(resolve(outputDir, `moon_owl_${form.id}_camp_portrait_v1.png`))
  const walk = await transparentRaster(form.walk)
  for (const cellSize of [32, 48]) {
    await writeNormalizedWalkAtlas({ data: walk.data, info: walk.info, cellSize, output: resolve(outputDir, `moon_owl_${form.id}_walk_${cellSize}_v1.png`) })
  }
}

const files = await readdir(outputDir)
console.log(`Prepared ${forms.length} moon owl forms: ${files.filter((name) => /^moon_owl_(stage-0|stage-1|dusk_owl)_/.test(name)).join(', ')}`)
