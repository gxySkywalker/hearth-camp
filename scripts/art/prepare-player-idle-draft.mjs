import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const sourcePath = resolve(process.argv[2] ?? 'assets/art/reference/protagonist-style-key-v1.png')
const outputPath = resolve(process.argv[3] ?? 'assets/art/drafts/player-idle-front-draft-v1.png')
const source = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const cleaned = Buffer.alloc(source.info.width * source.info.height * 4)
let minX = source.info.width
let minY = source.info.height
let maxX = -1
let maxY = -1

function isMagentaBackground(red, green, blue) {
  const brightMagenta = red > 120
    && blue > 120
    && red > green * 1.4
    && blue > green * 1.4
    && Math.abs(red - blue) < 100
  const darkMagentaFringe = red > 45
    && blue > 25
    && red > green * 1.7
    && blue > green * 1.45
    && Math.abs(red - blue) < 90
  return brightMagenta || darkMagentaFringe
}

for (let y = 0; y < source.info.height; y += 1) {
  for (let x = 0; x < source.info.width; x += 1) {
    const sourceOffset = (y * source.info.width + x) * source.info.channels
    const targetOffset = (y * source.info.width + x) * 4
    const red = source.data[sourceOffset]
    const green = source.data[sourceOffset + 1]
    const blue = source.data[sourceOffset + 2]
    if (isMagentaBackground(red, green, blue)) continue
    cleaned[targetOffset] = red
    cleaned[targetOffset + 1] = green
    cleaned[targetOffset + 2] = blue
    cleaned[targetOffset + 3] = 255
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
}

if (maxX < minX || maxY < minY) throw new Error('Could not find the protagonist against the chroma background')

const cropped = await sharp(cleaned, {
  raw: {
    width: source.info.width,
    height: source.info.height,
    channels: 4,
  },
})
  .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
  .resize(28, 44, {
    fit: 'contain',
    kernel: 'nearest',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .extend({
    top: 2,
    bottom: 2,
    left: 2,
    right: 2,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ palette: true, colours: 32, dither: 0 })
  .toBuffer()

await mkdir(dirname(outputPath), { recursive: true })
await sharp(cropped).toFile(outputPath)

const result = await sharp(outputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const colors = new Set()
let transparentPixels = 0
let semiTransparentPixels = 0
for (let offset = 0; offset < result.data.length; offset += result.info.channels) {
  const alpha = result.data[offset + 3]
  if (alpha === 0) {
    transparentPixels += 1
    continue
  }
  if (alpha < 255) semiTransparentPixels += 1
  colors.add(`${result.data[offset]},${result.data[offset + 1]},${result.data[offset + 2]}`)
}

console.log(JSON.stringify({
  sourcePath,
  outputPath,
  sourceBounds: { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 },
  output: {
    width: result.info.width,
    height: result.info.height,
    opaqueColors: colors.size,
    transparentPixels,
    semiTransparentPixels,
  },
}, null, 2))
