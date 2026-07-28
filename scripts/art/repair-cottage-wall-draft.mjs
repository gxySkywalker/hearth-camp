import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const sourcePath = resolve(process.argv[2] ?? 'assets/art/drafts/cottage-architecture-autoclean-v1.png')
const outputPath = resolve(process.argv[3] ?? 'assets/art/drafts/cottage-wall-plain-draft-v1.png')
const cellSize = 32
const sourceRow = 3
const sourceColumns = [0, 1, 2, 3, 4]
const trim = 4
const tiles = []

function pixelKey(data, offset) {
  return `${data[offset]},${data[offset + 1]},${data[offset + 2]},${data[offset + 3]}`
}

function keyToPixel(key) {
  return key.split(',').map(Number)
}

function modePixel(samples) {
  const counts = new Map()
  for (const sample of samples) counts.set(sample, (counts.get(sample) ?? 0) + 1)
  return keyToPixel([...counts.entries()].sort((a, b) => b[1] - a[1])[0][0])
}

function writePixel(data, offset, pixel) {
  data[offset] = pixel[0]
  data[offset + 1] = pixel[1]
  data[offset + 2] = pixel[2]
  data[offset + 3] = pixel[3]
}

for (const sourceColumn of sourceColumns) {
  const tile = await sharp(sourcePath)
    .extract({
      left: sourceColumn * cellSize + trim,
      top: sourceRow * cellSize,
      width: cellSize - trim * 2,
      height: cellSize,
    })
    .resize(cellSize, cellSize, { fit: 'fill', kernel: 'nearest' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  tiles.push(tile)
}

const verticalSignature = []
for (let y = 0; y < cellSize; y += 1) {
  const samples = []
  for (const tile of tiles) {
    for (let x = 8; x < cellSize - 8; x += 1) {
      samples.push(pixelKey(tile.data, (y * cellSize + x) * tile.info.channels))
    }
  }
  verticalSignature.push(modePixel(samples))
}

for (const tile of tiles) {
  for (let y = 0; y < cellSize; y += 1) {
    for (const x of [0, 1, 2, 3, cellSize - 4, cellSize - 3, cellSize - 2, cellSize - 1]) {
      writePixel(tile.data, (y * cellSize + x) * tile.info.channels, verticalSignature[y])
    }
  }
}

const atlasWidth = tiles.length * cellSize
const atlas = Buffer.alloc(atlasWidth * cellSize * 4)
for (let tileIndex = 0; tileIndex < tiles.length; tileIndex += 1) {
  const tile = tiles[tileIndex]
  for (let y = 0; y < cellSize; y += 1) {
    for (let x = 0; x < cellSize; x += 1) {
      const sourceOffset = (y * cellSize + x) * tile.info.channels
      const targetOffset = (y * atlasWidth + tileIndex * cellSize + x) * 4
      tile.data.copy(atlas, targetOffset, sourceOffset, sourceOffset + 4)
    }
  }
}

await mkdir(dirname(outputPath), { recursive: true })
await sharp(atlas, {
  raw: {
    width: atlasWidth,
    height: cellSize,
    channels: 4,
  },
})
  .png({ palette: true, colours: 32, dither: 0 })
  .toFile(outputPath)

console.log(JSON.stringify({
  sourcePath,
  outputPath,
  sourceRow,
  sourceColumns,
  removedEdgePixels: trim,
  frame: { width: cellSize, height: cellSize },
  variants: tiles.length,
}, null, 2))
