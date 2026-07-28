import sharp from 'sharp'

function opaqueBounds(data, width, height) {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  return right < left ? null : { left, top, width: right - left + 1, height: bottom - top + 1 }
}

/**
 * Turns a supplied 4×4 source sheet into a compact in-game atlas without
 * shrinking its empty margins into the sprite. Every frame is trimmed only
 * through already-transparent pixels, scaled with the same ratio, centred,
 * and bottom-aligned to one common baseline.
 */
export async function writeNormalizedWalkAtlas({ data, info, cellSize, output }) {
  const edgesX = Array.from({ length: 5 }, (_, index) => Math.round(index * info.width / 4))
  const edgesY = Array.from({ length: 5 }, (_, index) => Math.round(index * info.height / 4))
  const rawFrames = []
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const extracted = await sharp(data, { raw: info })
        .extract({ left: edgesX[column], top: edgesY[row], width: edgesX[column + 1] - edgesX[column], height: edgesY[row + 1] - edgesY[row] })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const bounds = opaqueBounds(extracted.data, extracted.info.width, extracted.info.height)
      if (!bounds) throw new Error(`Empty companion frame at row ${row}, column ${column}`)
      rawFrames.push({ ...extracted, bounds })
    }
  }

  const largestWidth = Math.max(...rawFrames.map((frame) => frame.bounds.width))
  const largestHeight = Math.max(...rawFrames.map((frame) => frame.bounds.height))
  const contentSize = cellSize - 2
  const scale = Math.min(contentSize / largestWidth, contentSize / largestHeight)
  const images = []
  for (const frame of rawFrames) {
    const width = Math.max(1, Math.round(frame.bounds.width * scale))
    const height = Math.max(1, Math.round(frame.bounds.height * scale))
    const input = await sharp(frame.data, { raw: frame.info })
      .extract(frame.bounds)
      .resize(width, height, { kernel: sharp.kernel.nearest })
      .png()
      .toBuffer()
    images.push({ input, width, height })
  }

  await sharp({ create: { width: cellSize * 4, height: cellSize * 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(images.map((image, index) => ({
      input: image.input,
      left: (index % 4) * cellSize + Math.floor((cellSize - image.width) / 2),
      top: Math.floor(index / 4) * cellSize + cellSize - image.height - 1,
    })))
    .png()
    .toFile(output)
}
