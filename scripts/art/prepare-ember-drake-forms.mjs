import { mkdir, readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { writeNormalizedWalkAtlas } from './companion-atlas.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const draftDir = resolve(root, 'assets/art/drafts/ember-drake-forms')
const outputDir = resolve(root, 'assets/art/characters/companions')

const forms = [
  { id: 'stage-0', portrait: 'ember_drake_stage-0_portrait_source.png', walk: 'ember_drake_stage-0_walk_source.png', portraitBackground: 'dark-gradient' },
  { id: 'stage-1', portrait: 'ember_drake_stage-1_portrait_source.png', walk: 'ember_drake_stage-1_walk_source.png' },
  { id: 'ember_drake', portrait: 'ember_drake_ember_drake_portrait_source.png', walk: 'ember_drake_ember_drake_walk_source.png' },
]

function isCheckerBackground(red, green, blue) {
  const brightest = Math.max(red, green, blue)
  const darkest = Math.min(red, green, blue)
  return brightest >= 222 && brightest - darkest <= 8
}

function clearEdgeConnected(data, width, height, acceptsPixel) {
  const seen = new Uint8Array(width * height)
  const queue = []
  const visit = (x, y, parentOffset = -1) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const key = y * width + x
    if (seen[key]) return
    const offset = key * 4
    if (!acceptsPixel(data, offset, parentOffset)) return
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
    visit(x - 1, y, offset); visit(x + 1, y, offset); visit(x, y - 1, offset); visit(x, y + 1, offset)
  }
}

function clearCheckerBackground(data, width, height) {
  clearEdgeConnected(data, width, height, (pixels, offset) => isCheckerBackground(pixels[offset], pixels[offset + 1], pixels[offset + 2]))
}

// The supplied 小火牙 portrait has an opaque, smooth dark backdrop rather
// than a checkerboard. Flood only through small adjacent colour changes from
// the outer edge, preserving the sharp dark dragon outline and warm highlights.
function clearDarkGradientBackground(data, width, height) {
  clearEdgeConnected(data, width, height, (pixels, offset, parentOffset) => {
    if (parentOffset < 0) return true
    const distance = Math.hypot(
      pixels[offset] - pixels[parentOffset],
      pixels[offset + 1] - pixels[parentOffset + 1],
      pixels[offset + 2] - pixels[parentOffset + 2],
    )
    return distance <= 18
  })
}

async function transparentRaster(filename, mode = 'checker') {
  const { data, info } = await sharp(resolve(draftDir, filename)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (mode === 'dark-gradient') clearDarkGradientBackground(data, info.width, info.height)
  else clearCheckerBackground(data, info.width, info.height)
  return { data, info }
}

await mkdir(outputDir, { recursive: true })
for (const form of forms) {
  const portrait = await transparentRaster(form.portrait, form.portraitBackground)
  await sharp(portrait.data, { raw: portrait.info }).png().toFile(resolve(outputDir, `ember_drake_${form.id}_camp_portrait_v1.png`))
  const walk = await transparentRaster(form.walk)
  for (const cellSize of [32, 48]) {
    await writeNormalizedWalkAtlas({ data: walk.data, info: walk.info, cellSize, output: resolve(outputDir, `ember_drake_${form.id}_walk_${cellSize}_v1.png`) })
  }
}

const files = await readdir(outputDir)
console.log(`Prepared ${forms.length} ember drake forms: ${files.filter((name) => /^ember_drake_(stage-0|stage-1|ember_drake)_/.test(name)).join(', ')}`)
