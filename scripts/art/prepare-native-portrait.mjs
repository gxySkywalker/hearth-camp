import sharp from 'sharp'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('Usage: node prepare-native-portrait.mjs <transparent-4x-source.png> <output-portrait.png>')

function opaqueBounds(data, width, height, channels) {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * channels + 3] < 128) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  return right < left ? null : { left, top, width: right - left + 1, height: bottom - top + 1 }
}

const image = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const bounds = opaqueBounds(image.data, image.info.width, image.info.height, image.info.channels)
if (!bounds) throw new Error('Source portrait has no visible pixels')

// Source portraits are exported at 4×. Return them to native pixels with
// nearest-neighbour sampling, then keep a one-pixel transparent breathing room.
const width = Math.max(1, Math.round(bounds.width / 4))
const height = Math.max(1, Math.round(bounds.height / 4))
const portrait = await sharp(image.data, { raw: image.info })
  .extract(bounds)
  .resize(width, height, { kernel: sharp.kernel.nearest })
  .png()
  .toBuffer()

await sharp({
  create: { width: width + 2, height: height + 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).composite([{ input: portrait, left: 1, top: 1 }]).png().toFile(output)

console.log(`Prepared native portrait: ${output}`)
