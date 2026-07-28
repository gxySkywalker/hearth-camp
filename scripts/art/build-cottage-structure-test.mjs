import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const wallPath = resolve(process.argv[2] ?? 'assets/art/environments/cottage/cottage_wall_plain_v1.png')
const beamPath = resolve(process.argv[3] ?? 'assets/art/drafts/cottage-wall-beam-draft-v1.png')
const outputPath = resolve(process.argv[4] ?? 'assets/art/drafts/cottage-wall-structure-test-v1.png')
const cellSize = 32
const columns = 12
const composites = []

for (let column = 0; column < columns; column += 1) {
  const variant = column % 5
  composites.push({
    input: await sharp(wallPath)
      .extract({ left: variant * cellSize, top: 0, width: cellSize, height: cellSize })
      .png()
      .toBuffer(),
    left: column * cellSize,
    top: 0,
  })
}

for (const boundary of [4, 8]) {
  const variant = (boundary / 4 - 1) % 2
  composites.push({
    input: await sharp(beamPath)
      .extract({ left: variant * cellSize, top: 0, width: cellSize, height: cellSize })
      .png()
      .toBuffer(),
    left: boundary * cellSize - cellSize / 2,
    top: 0,
  })
}

await mkdir(dirname(outputPath), { recursive: true })
await sharp({
  create: {
    width: columns * cellSize,
    height: cellSize,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png({ palette: true, colours: 32, dither: 0 })
  .toFile(outputPath)

console.log(JSON.stringify({ wallPath, beamPath, outputPath, beamBoundaries: [4, 8] }, null, 2))
