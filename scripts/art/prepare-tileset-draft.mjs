import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const inputPath = resolve(process.argv[2] ?? 'assets/art/drafts/cottage-architecture-source-v1.png')
const outputPath = resolve(process.argv[3] ?? 'assets/art/drafts/cottage-architecture-autoclean-v1.png')
const expectedColumns = 8
const expectedRows = 8
const targetCellSize = 32

function isMagentaBackground(red, green, blue) {
  const brightMagenta = red > 120
    && blue > 120
    && red > green * 1.45
    && blue > green * 1.45
    && Math.abs(red - blue) < 90
  const darkMagentaFringe = red > 50
    && blue > 25
    && red > green * 1.8
    && blue > green * 1.5
    && Math.abs(red - blue) < 80
  return brightMagenta || darkMagentaFringe
}

function findSegments(occupied) {
  const segments = []
  let start = -1
  for (let index = 0; index <= occupied.length; index += 1) {
    if (index < occupied.length && occupied[index] && start < 0) start = index
    if ((index === occupied.length || !occupied[index]) && start >= 0) {
      segments.push({ start, length: index - start })
      start = -1
    }
  }
  return segments
}

const source = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const occupiedColumns = new Array(source.info.width).fill(false)
const occupiedRows = new Array(source.info.height).fill(false)

for (let y = 0; y < source.info.height; y += 1) {
  for (let x = 0; x < source.info.width; x += 1) {
    const offset = (y * source.info.width + x) * source.info.channels
    if (!isMagentaBackground(source.data[offset], source.data[offset + 1], source.data[offset + 2])) {
      occupiedColumns[x] = true
      occupiedRows[y] = true
    }
  }
}

const columnSegments = findSegments(occupiedColumns)
const rowSegments = findSegments(occupiedRows)
if (columnSegments.length !== expectedColumns || rowSegments.length !== expectedRows) {
  throw new Error(`Expected an ${expectedColumns}x${expectedRows} source grid; detected ${columnSegments.length}x${rowSegments.length}`)
}

const targetWidth = expectedColumns * targetCellSize
const targetHeight = expectedRows * targetCellSize
const atlas = Buffer.alloc(targetWidth * targetHeight * 4)

for (let row = 0; row < expectedRows; row += 1) {
  for (let column = 0; column < expectedColumns; column += 1) {
    const sourceColumn = columnSegments[column]
    const sourceRow = rowSegments[row]
    const tile = await sharp(inputPath)
      .extract({
        left: sourceColumn.start,
        top: sourceRow.start,
        width: sourceColumn.length,
        height: sourceRow.length,
      })
      .resize(targetCellSize, targetCellSize, { fit: 'fill', kernel: 'nearest' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    for (let y = 0; y < targetCellSize; y += 1) {
      for (let x = 0; x < targetCellSize; x += 1) {
        const sourceOffset = (y * targetCellSize + x) * tile.info.channels
        const targetOffset = ((row * targetCellSize + y) * targetWidth + column * targetCellSize + x) * 4
        const red = tile.data[sourceOffset]
        const green = tile.data[sourceOffset + 1]
        const blue = tile.data[sourceOffset + 2]
        const transparent = isMagentaBackground(red, green, blue)
        atlas[targetOffset] = transparent ? 0 : red
        atlas[targetOffset + 1] = transparent ? 0 : green
        atlas[targetOffset + 2] = transparent ? 0 : blue
        atlas[targetOffset + 3] = transparent ? 0 : 255
      }
    }
  }
}

await mkdir(dirname(outputPath), { recursive: true })
await sharp(atlas, {
  raw: {
    width: targetWidth,
    height: targetHeight,
    channels: 4,
  },
})
  .png({ palette: true, colours: 40, dither: 0 })
  .toFile(outputPath)

const prepared = await sharp(outputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const colors = new Set()
let opaquePixels = 0
let transparentPixels = 0
let semiTransparentPixels = 0

for (let offset = 0; offset < prepared.data.length; offset += prepared.info.channels) {
  const alpha = prepared.data[offset + 3]
  if (alpha === 0) {
    transparentPixels += 1
    continue
  }
  if (alpha < 255) semiTransparentPixels += 1
  opaquePixels += 1
  colors.add(`${prepared.data[offset]},${prepared.data[offset + 1]},${prepared.data[offset + 2]}`)
}

console.log(JSON.stringify({
  inputPath,
  outputPath,
  detectedGrid: {
    columns: columnSegments,
    rows: rowSegments,
  },
  output: {
    width: prepared.info.width,
    height: prepared.info.height,
    opaqueColors: colors.size,
    opaquePixels,
    transparentPixels,
    semiTransparentPixels,
  },
}, null, 2))
