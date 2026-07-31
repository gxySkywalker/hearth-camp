import sharp from 'sharp'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('Usage: node prepare-player-choice-atlas.mjs <input-sheet.png> <output-atlas.png>')

function isBorderBackground(data, index) {
  const red = data[index]
  const green = data[index + 1]
  const blue = data[index + 2]
  const lightness = Math.max(red, green, blue)
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue)
  // GPT sheets use alternating white / pale-grey squares. Both are neutral,
  // bright and connected to the outer border; character highlights remain
  // protected by their outlined silhouette.
  return lightness >= 220 && chroma <= 18
}

function clearBorderConnectedBackground(data, width, height) {
  const seen = new Uint8Array(width * height)
  const queue = []
  const add = (x, y) => {
    const point = y * width + x
    if (seen[point] || !isBorderBackground(data, point * 4)) return
    seen[point] = 1
    queue.push(point)
  }
  for (let x = 0; x < width; x += 1) { add(x, 0); add(x, height - 1) }
  for (let y = 1; y < height - 1; y += 1) { add(0, y); add(width - 1, y) }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor]
    const x = point % width
    const y = Math.floor(point / width)
    data[point * 4 + 3] = 0
    if (x > 0) add(x - 1, y)
    if (x + 1 < width) add(x + 1, y)
    if (y > 0) add(x, y - 1)
    if (y + 1 < height) add(x, y + 1)
  }
}

function clearRemainingSheetSquares(data) {
  // A checkerboard cell can be completely enclosed by a pose (between an arm
  // and its body, for example), so it is not necessarily reachable from the
  // image border. These very bright, neutral pixels belong to the generated
  // sheet rather than the outlined character. Remove them after the flood
  // pass to prevent pale fringes and white walking-frame artefacts.
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] > 0 && isBorderBackground(data, index)) data[index + 3] = 0
  }
}

function clearSmallBorderArtefacts(data, width, height) {
  // Some generated sheets have a fragment from a neighbouring pose touching a
  // cell edge. It is neither bright nor connected to the checkerboard, but it
  // must not dictate this frame's scale. A real character is a large central
  // component, while these edge fragments are tiny strips.
  const seen = new Uint8Array(width * height)
  const neighbours = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
  for (let start = 0; start < seen.length; start += 1) {
    if (seen[start] || data[start * 4 + 3] === 0) continue
    const queue = [start]
    const points = []
    let touchesEdge = false
    seen[start] = 1
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const point = queue[cursor]
      points.push(point)
      const x = point % width
      const y = Math.floor(point / width)
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true
      for (const [offsetX, offsetY] of neighbours) {
        const nextX = x + offsetX
        const nextY = y + offsetY
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue
        const next = nextY * width + nextX
        if (seen[next] || data[next * 4 + 3] === 0) continue
        seen[next] = 1
        queue.push(next)
      }
    }
    if (touchesEdge && points.length < 1200) {
      for (const point of points) data[point * 4 + 3] = 0
    }
  }
}

function opaqueBounds(data, width, height) {
  let left = width; let top = height; let right = -1; let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y)
    }
  }
  return right < left ? null : { left, top, width: right - left + 1, height: bottom - top + 1 }
}

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const cellWidth = Math.floor(info.width / 4)
const cellHeight = Math.floor(info.height / 4)
const frames = []

for (let row = 0; row < 4; row += 1) {
  for (let column = 0; column < 4; column += 1) {
    const cell = await sharp(data, { raw: info })
      .extract({ left: column * cellWidth, top: row * cellHeight, width: cellWidth, height: cellHeight })
      .raw().toBuffer({ resolveWithObject: true })
    clearBorderConnectedBackground(cell.data, cell.info.width, cell.info.height)
    clearRemainingSheetSquares(cell.data)
    clearSmallBorderArtefacts(cell.data, cell.info.width, cell.info.height)
    const bounds = opaqueBounds(cell.data, cell.info.width, cell.info.height)
    if (!bounds) throw new Error(`Frame ${row + 1}-${column + 1} has no visible player pixels`)
    frames.push({ ...cell, bounds })
  }
}

const composites = []
for (const [index, frame] of frames.entries()) {
  // Each generated pose has a slightly different amount of blank sheet around
  // it. Fit every pose to the same visible 24×46 envelope as the original
  // furnace traveller, rather than letting one unusually wide pose shrink the
  // whole 4×4 sheet.
  const scale = Math.min(24 / frame.bounds.width, 46 / frame.bounds.height)
  const width = Math.max(1, Math.round(frame.bounds.width * scale))
  const height = Math.max(1, Math.round(frame.bounds.height * scale))
  const inputBuffer = await sharp(frame.data, { raw: frame.info }).extract(frame.bounds)
    .resize(width, height, { kernel: sharp.kernel.nearest }).png().toBuffer()
  composites.push({
    input: inputBuffer,
    left: (index % 4) * 32 + Math.floor((32 - width) / 2),
    top: Math.floor(index / 4) * 48 + 47 - height,
  })
}

await sharp({ create: { width: 128, height: 192, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(composites).png().toFile(output)

console.log(`Prepared 4×4 player atlas: ${output}`)
