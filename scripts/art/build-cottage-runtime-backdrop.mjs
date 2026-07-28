import { mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const sourcePath = resolve(process.argv[2] ?? 'assets/art/reference/cottage-style-key-v1.png')
const outputPath = resolve(process.argv[3] ?? 'assets/art/environments/cottage/cottage_room_backdrop_provisional_v1.png')
const companionOutputPath = resolve(process.argv[4] ?? 'assets/art/characters/companions/hearth_hound_idle_provisional_v1.png')
const sourceBuffer = await readFile(sourcePath)
const metadata = await sharp(sourceBuffer).metadata()

if (metadata.width !== 1672 || metadata.height !== 941) {
  throw new Error(`Unexpected cottage reference size ${metadata.width}x${metadata.height}`)
}

// The approved composition contains baked-in characters. Clone adjacent clear
// floor areas over them, while preserving a masked starter-hound sprite as an
// independent provisional layer. This is reversible and does not mutate the
// approved reference.
const cleanFloorPatch = await sharp(sourceBuffer)
  .extract({ left: 820, top: 332, width: 150, height: 238 })
  .png()
  .toBuffer()

const cleanedSource = await sharp(sourceBuffer)
  .composite([{ input: cleanFloorPatch, left: 530, top: 332 }])
  .png()
  .toBuffer()

const sceneWithDog = await sharp(cleanedSource)
  .resize(320, 180, { fit: 'fill', kernel: 'nearest' })
  .png({ palette: true, colours: 40, dither: 0 })
  .toBuffer()

const dogCrop = await sharp(sceneWithDog)
  .extract({ left: 118, top: 68, width: 42, height: 46 })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const dogPixels = Buffer.from(dogCrop.data)

function dogSpan(y) {
  if (y < 8 || y > 36) return null
  if (y <= 10) return [14, 23]
  if (y <= 13) return [10, 28]
  if (y <= 18) return [9, 30]
  if (y <= 21) return [11, 29]
  if (y <= 24) return [13, 32]
  if (y <= 28) return [13, 35]
  if (y <= 32) return [14, 32]
  return [16, 28]
}

for (let y = 0; y < dogCrop.info.height; y += 1) {
  const span = dogSpan(y)
  for (let x = 0; x < dogCrop.info.width; x += 1) {
    const offset = (y * dogCrop.info.width + x) * dogCrop.info.channels
    dogPixels[offset + 3] = span && x >= span[0] && x <= span[1] ? 255 : 0
  }
}

const companionSprite = await sharp(dogPixels, {
  raw: { width: dogCrop.info.width, height: dogCrop.info.height, channels: 4 },
})
  .extract({ left: 8, top: 7, width: 29, height: 31 })
  .resize(28, 28, { fit: 'contain', kernel: 'nearest', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 2, bottom: 2, left: 2, right: 2, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ palette: true, colours: 24, dither: 0 })
  .toBuffer()

const scenePixels = await sharp(sceneWithDog).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const characterFreePixels = Buffer.from(scenePixels.data)
for (let y = 0; y < dogCrop.info.height; y += 1) {
  const span = dogSpan(y)
  if (!span) continue
  for (let x = span[0]; x <= span[1]; x += 1) {
    const targetX = 118 + x
    const targetY = 68 + y
    const sourceX = targetX + 35
    const targetOffset = (targetY * scenePixels.info.width + targetX) * scenePixels.info.channels
    const sourceOffset = (targetY * scenePixels.info.width + sourceX) * scenePixels.info.channels
    for (let channel = 0; channel < scenePixels.info.channels; channel += 1) {
      characterFreePixels[targetOffset + channel] = scenePixels.data[sourceOffset + channel]
    }
  }
}
const runtimeScene = await sharp(characterFreePixels, {
  raw: { width: scenePixels.info.width, height: scenePixels.info.height, channels: scenePixels.info.channels },
})
  .png({ palette: true, colours: 40, dither: 0 })
  .toBuffer()

await mkdir(dirname(outputPath), { recursive: true })
await mkdir(dirname(companionOutputPath), { recursive: true })
await sharp(runtimeScene).toFile(outputPath)
await sharp(companionSprite).toFile(companionOutputPath)

const result = await sharp(outputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const colors = new Set()
let semiTransparentPixels = 0
for (let offset = 0; offset < result.data.length; offset += result.info.channels) {
  const alpha = result.data[offset + 3]
  if (alpha > 0) colors.add(`${result.data[offset]},${result.data[offset + 1]},${result.data[offset + 2]}`)
  if (alpha > 0 && alpha < 255) semiTransparentPixels += 1
}

console.log(JSON.stringify({
  sourcePath,
  outputPath,
  removedBakedPlayer: { left: 530, top: 332, width: 150, height: 238 },
  removedBakedDog: { targetCrop: { left: 118, top: 68, width: 42, height: 46 }, floorSampleOffsetX: 35 },
  companionOutputPath,
  retained: ['fireplace', 'desk', 'bed', 'bookshelf', 'chest', 'rugs', 'bottom-exit'],
  output: {
    width: result.info.width,
    height: result.info.height,
    opaqueColors: colors.size,
    semiTransparentPixels,
  },
}, null, 2))
