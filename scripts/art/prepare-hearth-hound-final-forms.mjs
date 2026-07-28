import { mkdir, readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { writeNormalizedWalkAtlas } from './companion-atlas.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const draftDir = resolve(root, 'assets/art/drafts/companion-final-forms')
const outputDir = resolve(root, 'assets/art/characters/companions')

const forms = [
  { id: 'ember_tail', portrait: 'hearth_hound_ember_tail_portrait_source.png', walk: 'hearth_hound_ember_tail_walk_source.png' },
  { id: 'pine_shadow', portrait: 'hearth_hound_pine_shadow_portrait_source.png', walk: 'hearth_hound_pine_shadow_walk_source.png' },
  { id: 'moon_paw', portrait: 'hearth_hound_moon_paw_portrait_source.png', walk: 'hearth_hound_moon_paw_walk_source.png' },
]

function isCheckerBackground(red, green, blue) {
  const brightest = Math.max(red, green, blue)
  const darkest = Math.min(red, green, blue)
  return brightest >= 222 && brightest - darkest <= 8
}

/** Remove only the white/grey checkerboard connected to each frame edge.
 * It deliberately preserves enclosed cream fur and every character pixel. */
function clearEdgeConnectedCheckerboard(data, width, height) {
  const seen = new Uint8Array(width * height)
  const queue = []
  const visit = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const key = y * width + x
    if (seen[key]) return
    const offset = key * 4
    if (!isCheckerBackground(data[offset], data[offset + 1], data[offset + 2])) return
    seen[key] = 1
    queue.push(key)
  }
  for (let x = 0; x < width; x += 1) { visit(x, 0); visit(x, height - 1) }
  for (let y = 0; y < height; y += 1) { visit(0, y); visit(width - 1, y) }
  for (let index = 0; index < queue.length; index += 1) {
    const key = queue[index]
    const x = key % width
    const y = Math.floor(key / width)
    const offset = key * 4
    data[offset + 3] = 0
    visit(x - 1, y); visit(x + 1, y); visit(x, y - 1); visit(x, y + 1)
  }
}

async function transparentRaster(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  clearEdgeConnectedCheckerboard(data, info.width, info.height)
  return { data, info }
}

async function writePortrait(form) {
  const source = resolve(draftDir, form.portrait)
  const { data, info } = await transparentRaster(source)
  await sharp(data, { raw: info }).png().toFile(resolve(outputDir, `hearth_hound_${form.id}_camp_portrait_v1.png`))
}

async function writeWalkAtlas(form, cellSize) {
  const source = resolve(draftDir, form.walk)
  const { data, info } = await transparentRaster(source)
  await writeNormalizedWalkAtlas({ data, info, cellSize, output: resolve(outputDir, `hearth_hound_${form.id}_walk_${cellSize}_v1.png`) })
}

async function writeStageZeroWalkAtlas(cellSize) {
  const source = resolve(outputDir, 'companion_chestnut_walk_atlas_v1.png')
  const { data, info } = await transparentRaster(source)
  await writeNormalizedWalkAtlas({ data, info, cellSize, output: resolve(outputDir, `hearth_hound_walk_${cellSize}_v1.png`) })
}

async function writeStageOneWalkAtlases() {
  const source = resolve(draftDir, 'hearth_hound_stage-1_walk_source.png')
  const { data, info } = await transparentRaster(source)
  for (const cellSize of [32, 48]) {
    await writeNormalizedWalkAtlas({ data, info, cellSize, output: resolve(outputDir, `hearth_hound_stage-1_walk_${cellSize}_v1.png`) })
  }
}

await mkdir(outputDir, { recursive: true })
await writeStageZeroWalkAtlas(32)
await writeStageZeroWalkAtlas(48)
await writeStageOneWalkAtlases()
for (const form of forms) {
  await writePortrait(form)
  await writeWalkAtlas(form, 32)
  await writeWalkAtlas(form, 48)
}

const files = await readdir(outputDir)
console.log(`Prepared ${forms.length} final forms: ${files.filter((name) => /hearth_hound_(ember_tail|pine_shadow|moon_paw)_/.test(name)).join(', ')}`)
