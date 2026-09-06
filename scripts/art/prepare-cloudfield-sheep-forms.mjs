import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { writeNormalizedWalkAtlas } from './companion-atlas.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sourceDir = resolve(root, 'assets/art/drafts/cloudfield-sheep-forms')
const outputDir = resolve(root, 'assets/art/characters/companions')
const forms = [
  { id: 'stage-0', portrait: 'cloudfield_sheep_stage-0_portrait_source.png', walk: 'cloudfield_sheep_stage-0_walk_source.png' },
  { id: 'stage-1', portrait: 'cloudfield_sheep_stage-1_portrait_source.png', walk: 'cloudfield_sheep_stage-1_walk_source.png' },
  { id: 'morning_breeze', portrait: 'cloudfield_sheep_morning_breeze_portrait_source.png', walk: 'cloudfield_sheep_morning_breeze_walk_source.png' },
]

await mkdir(outputDir, { recursive: true })
for (const form of forms) {
  await sharp(resolve(sourceDir, form.portrait)).ensureAlpha().png().toFile(resolve(outputDir, `cloudfield_sheep_${form.id}_camp_portrait_v1.png`))
  const walk = await sharp(resolve(sourceDir, form.walk)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (const cellSize of [32, 48]) await writeNormalizedWalkAtlas({ data: walk.data, info: walk.info, cellSize, output: resolve(outputDir, `cloudfield_sheep_${form.id}_walk_${cellSize}_v1.png`) })
}

console.log('Prepared 咩咩、咩咩羊与晨风绵羊 production atlases.')
