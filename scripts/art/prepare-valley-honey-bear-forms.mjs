import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { writeNormalizedWalkAtlas } from './companion-atlas.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sourceDir = resolve(root, 'assets/art/drafts/valley-honey-bear-forms')
const outputDir = resolve(root, 'assets/art/characters/companions')
const forms = [
  { id: 'stage-0', portrait: 'valley_honey_bear_stage-0_portrait_source.png', walk: 'valley_honey_bear_stage-0_walk_source.png' },
  { id: 'stage-1', portrait: 'valley_honey_bear_stage-1_portrait_source.png', walk: 'valley_honey_bear_stage-1_walk_source.png' },
  { id: 'rock_honey_guardian', portrait: 'valley_honey_bear_rock_honey_guardian_portrait_source.png', walk: 'valley_honey_bear_rock_honey_guardian_walk_source.png' },
]

await mkdir(outputDir, { recursive: true })
for (const form of forms) {
  const portrait = await sharp(resolve(sourceDir, form.portrait)).ensureAlpha().png().toBuffer()
  await sharp(portrait).png().toFile(resolve(outputDir, `valley_honey_bear_${form.id}_camp_portrait_v1.png`))
  const walk = await sharp(resolve(sourceDir, form.walk)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (const cellSize of [32, 48]) {
    await writeNormalizedWalkAtlas({ data: walk.data, info: walk.info, cellSize, output: resolve(outputDir, `valley_honey_bear_${form.id}_walk_${cellSize}_v1.png`) })
  }
}

console.log('Prepared 小蜜熊、暖掌熊与岩蜜守熊 production atlases.')
