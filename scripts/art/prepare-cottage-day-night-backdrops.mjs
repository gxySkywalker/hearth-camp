import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const daySource = resolve(process.argv[2] ?? 'C:/Users/葛新宇/Downloads/ChatGPT Image 2026年7月27日 14_23_13.png')
const nightSource = resolve(process.argv[3] ?? 'C:/Users/葛新宇/Downloads/ChatGPT Image 2026年7月27日 14_06_06.png')
const referenceDir = resolve('assets/art/reference')
const environmentDir = resolve('assets/art/environments/cottage')

const variants = [
  { key: 'day', source: daySource, reference: resolve(referenceDir, 'cottage_room_day_source_v1.png'), output: resolve(environmentDir, 'cottage_room_day_512_v1.png') },
  { key: 'night', source: nightSource, reference: resolve(referenceDir, 'cottage_room_night_source_v1.png'), output: resolve(environmentDir, 'cottage_room_night_512_v1.png') },
]

for (const variant of variants) {
  const metadata = await sharp(variant.source).metadata()
  if (metadata.width !== 1672 || metadata.height !== 941) {
    throw new Error(`${variant.key}: expected 1672×941 source, received ${metadata.width}×${metadata.height}`)
  }
  await mkdir(dirname(variant.reference), { recursive: true })
  await mkdir(dirname(variant.output), { recursive: true })
  await copyFile(variant.source, variant.reference)

  // The supplied images are 1px taller than an exact 16:9 frame. Crop only
  // that fractional-ratio remainder and use nearest sampling so Pixi receives
  // one stable 512×288 scene texture with no browser-side interpolation.
  await sharp(variant.source)
    .extract({ left: 0, top: 0, width: 1672, height: 940 })
    .resize(512, 288, { fit: 'fill', kernel: 'nearest' })
    .png()
    .toFile(variant.output)

  const normalized = await sharp(variant.output).metadata()
  if (normalized.width !== 512 || normalized.height !== 288) {
    throw new Error(`${variant.key}: normalization failed`)
  }
}

console.log('Prepared cottage day/night backdrops at 512×288.')
