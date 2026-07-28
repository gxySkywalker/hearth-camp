import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const sourcePath = resolve(process.argv[2] ?? 'assets/art/drafts/cottage-architecture-autoclean-v1.png')
const outputRoot = resolve(process.argv[3] ?? 'assets/art/drafts')
const cellSize = 32

async function saveHorizontalAtlas(outputPath, pieces, width, height) {
  const composites = []
  let left = 0
  for (const piece of pieces) {
    composites.push({ input: piece, left, top: 0 })
    left += width
  }
  await mkdir(dirname(outputPath), { recursive: true })
  await sharp({
    create: {
      width: pieces.length * width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ palette: true, colours: 32, dither: 0 })
    .toFile(outputPath)
}

const doorwayPieces = []
for (const column of [0, 1, 2, 3]) {
  doorwayPieces.push(await sharp(sourcePath)
    .extract({ left: column * cellSize, top: 6 * cellSize, width: cellSize, height: cellSize })
    .png()
    .toBuffer())
}
const doorwayPath = resolve(outputRoot, 'cottage-doorway-draft-v1.png')
await saveHorizontalAtlas(doorwayPath, doorwayPieces, cellSize, cellSize)

const cornerPieces = []
for (const column of [0, 2, 4]) {
  cornerPieces.push(await sharp(sourcePath)
    .extract({ left: column * cellSize, top: 4 * cellSize, width: cellSize * 2, height: cellSize })
    .png()
    .toBuffer())
}
const cornerPath = resolve(outputRoot, 'cottage-wall-corners-draft-v1.png')
await saveHorizontalAtlas(cornerPath, cornerPieces, cellSize * 2, cellSize)

const beamPieces = []
for (const column of [0, 1]) {
  const tile = await sharp(sourcePath)
    .extract({ left: column * cellSize, top: 3 * cellSize, width: cellSize, height: cellSize })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const canvas = Buffer.alloc(cellSize * cellSize * 4)
  const stripWidth = 5
  const targetLeft = Math.floor((cellSize - stripWidth) / 2)
  for (let y = 0; y < cellSize; y += 1) {
    for (let x = 0; x < stripWidth; x += 1) {
      const sourceOffset = (y * cellSize + x) * tile.info.channels
      const targetOffset = (y * cellSize + targetLeft + x) * 4
      tile.data.copy(canvas, targetOffset, sourceOffset, sourceOffset + 4)
    }
  }
  beamPieces.push(await sharp(canvas, {
    raw: { width: cellSize, height: cellSize, channels: 4 },
  }).png().toBuffer())
}
const beamPath = resolve(outputRoot, 'cottage-wall-beam-draft-v1.png')
await saveHorizontalAtlas(beamPath, beamPieces, cellSize, cellSize)

console.log(JSON.stringify({
  sourcePath,
  outputs: {
    doorway: { path: doorwayPath, frames: 4, frame: [32, 32] },
    corners: { path: cornerPath, frames: 3, frame: [64, 32] },
    beams: { path: beamPath, frames: 2, frame: [32, 32] },
  },
}, null, 2))
