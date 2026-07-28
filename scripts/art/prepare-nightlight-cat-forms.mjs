import { mkdir, readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { writeNormalizedWalkAtlas } from './companion-atlas.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const draftDir = resolve(root, 'assets/art/drafts/nightlight-cat-forms')
const outputDir = resolve(root, 'assets/art/characters/companions')

const forms = [
  { id: 'stage-0', portrait: 'glimmer_cat_stage-0_portrait_source.png', walk: 'glimmer_cat_stage-0_walk_source.png' },
  { id: 'stage-1', portrait: 'glimmer_cat_stage-1_portrait_source.png', walk: 'glimmer_cat_stage-1_walk_source.png' },
  { id: 'night_glass', portrait: 'glimmer_cat_night_glass_portrait_source.png', walk: 'glimmer_cat_night_glass_walk_source.png' },
]

function isEdgeBackground(red, green, blue) {
  const brightest = Math.max(red, green, blue)
  const darkest = Math.min(red, green, blue)
  return brightest >= 222 && brightest - darkest <= 8
}

// Only clear the white/checker field connected to an image edge. Bright tail
// light and cream pixels inside the cat stay untouched.
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

async function transparentRaster(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  clearEdgeConnectedBackground(data, info.width, info.height)
  return { data, info }
}

async function writePortrait(form) {
  const { data, info } = await transparentRaster(resolve(draftDir, form.portrait))
  await sharp(data, { raw: info }).png().toFile(resolve(outputDir, `glimmer_cat_${form.id}_camp_portrait_v1.png`))
}

async function writeWalkAtlas(form, cellSize) {
  const { data, info } = await transparentRaster(resolve(draftDir, form.walk))
  await writeNormalizedWalkAtlas({ data, info, cellSize, output: resolve(outputDir, `glimmer_cat_${form.id}_walk_${cellSize}_v1.png`) })
}

await mkdir(outputDir, { recursive: true })
for (const form of forms) {
  await writePortrait(form)
  await writeWalkAtlas(form, 32)
  await writeWalkAtlas(form, 48)
}

const files = await readdir(outputDir)
console.log(`Prepared ${forms.length} night-light cat forms: ${files.filter((name) => /^glimmer_cat_(stage-0|stage-1|night_glass)_/.test(name)).join(', ')}`)
