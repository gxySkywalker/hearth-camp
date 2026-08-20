import sharp from 'sharp'

const [input, output, frameWidthArg = '32', frameHeightArg = '48', maxWidthArg, maxHeightArg, minDetachedPixelsArg = '32'] = process.argv.slice(2)
if (!input || !output) {
  throw new Error('Usage: node prepare-player-native-atlas.mjs <transparent-4x4-sheet.png> <output-atlas.png> [frame-width] [frame-height] [max-visible-width] [max-visible-height] [min-detached-pixels]')
}

const FRAME_COLUMNS = 4
const FRAME_ROWS = 4
const TARGET_FRAME_WIDTH = Number(frameWidthArg)
const TARGET_FRAME_HEIGHT = Number(frameHeightArg)
const MAX_VISIBLE_WIDTH = Number(maxWidthArg || Math.max(1, TARGET_FRAME_WIDTH - 8))
const MAX_VISIBLE_HEIGHT = Number(maxHeightArg || Math.max(1, TARGET_FRAME_HEIGHT - 2))
const MIN_DETACHED_PIXELS = Number(minDetachedPixelsArg)

if (![TARGET_FRAME_WIDTH, TARGET_FRAME_HEIGHT, MAX_VISIBLE_WIDTH, MAX_VISIBLE_HEIGHT, MIN_DETACHED_PIXELS].every((value) => Number.isInteger(value) && value >= 0) || !TARGET_FRAME_WIDTH || !TARGET_FRAME_HEIGHT || !MAX_VISIBLE_WIDTH || !MAX_VISIBLE_HEIGHT) {
  throw new Error('Frame and visible dimensions must be positive integers')
}

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

function clearTinyDetachedPixels(data, width, height, channels) {
  const visited = new Uint8Array(width * height)
  const neighbours = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
  for (let start = 0; start < visited.length; start += 1) {
    if (visited[start] || data[start * channels + 3] < 128) continue
    const queue = [start]
    const component = []
    visited[start] = 1
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const point = queue[cursor]
      component.push(point)
      const x = point % width
      const y = Math.floor(point / width)
      for (const [dx, dy] of neighbours) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const next = ny * width + nx
        if (visited[next] || data[next * channels + 3] < 128) continue
        visited[next] = 1
        queue.push(next)
      }
    }
    // The source was exported at 4×. A single accidental fringe pixel is a
    // 4×4 block (16 samples); remove only components smaller than two source
    // pixels so bags, fingers and other intentional small shapes remain.
    if (component.length < MIN_DETACHED_PIXELS) {
      for (const point of component) data[point * channels + 3] = 0
    }
  }
}

const sheet = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
if (sheet.info.width % FRAME_COLUMNS !== 0 || sheet.info.height % FRAME_ROWS !== 0) {
  throw new Error(`Expected a 4×4 source sheet, received ${sheet.info.width}×${sheet.info.height}`)
}

const sourceFrameWidth = sheet.info.width / FRAME_COLUMNS
const sourceFrameHeight = sheet.info.height / FRAME_ROWS
const composites = []

for (let row = 0; row < FRAME_ROWS; row += 1) {
  for (let column = 0; column < FRAME_COLUMNS; column += 1) {
    const frame = await sharp(sheet.data, { raw: sheet.info })
      .extract({ left: column * sourceFrameWidth, top: row * sourceFrameHeight, width: sourceFrameWidth, height: sourceFrameHeight })
      .raw()
      .toBuffer({ resolveWithObject: true })
    if (MIN_DETACHED_PIXELS > 0) clearTinyDetachedPixels(frame.data, frame.info.width, frame.info.height, frame.info.channels)
    const bounds = opaqueBounds(frame.data, frame.info.width, frame.info.height, frame.info.channels)
    if (!bounds) throw new Error(`Frame ${row + 1}-${column + 1} has no visible player pixels`)

    const scale = Math.min(MAX_VISIBLE_WIDTH / bounds.width, MAX_VISIBLE_HEIGHT / bounds.height)
    const width = Math.max(1, Math.round(bounds.width * scale))
    const height = Math.max(1, Math.round(bounds.height * scale))
    const sprite = await sharp(frame.data, { raw: frame.info })
      .extract(bounds)
      .resize(width, height, { kernel: sharp.kernel.nearest })
      .png()
      .toBuffer()
    composites.push({
      input: sprite,
      left: column * TARGET_FRAME_WIDTH + Math.floor((TARGET_FRAME_WIDTH - width) / 2),
      top: row * TARGET_FRAME_HEIGHT + TARGET_FRAME_HEIGHT - height,
    })
  }
}

await sharp({
  create: {
    width: TARGET_FRAME_WIDTH * FRAME_COLUMNS,
    height: TARGET_FRAME_HEIGHT * FRAME_ROWS,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
}).composite(composites).png().toFile(output)

console.log(`Prepared native player atlas: ${output}`)
