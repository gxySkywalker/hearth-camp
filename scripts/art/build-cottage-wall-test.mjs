import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const atlasPath = resolve(process.argv[2] ?? 'assets/art/drafts/cottage-wall-plain-draft-v1.png')
const outputPath = resolve(process.argv[3] ?? 'assets/art/drafts/cottage-wall-seam-test-v1.png')
const cellSize = 32
const sourceRow = 0
const sourceColumns = [0, 1, 2, 3, 4]
const testColumns = 12
const composites = []

for (let column = 0; column < testColumns; column += 1) {
  const sourceColumn = sourceColumns[column % sourceColumns.length]
  const tile = await sharp(atlasPath)
    .extract({
      left: sourceColumn * cellSize,
      top: sourceRow * cellSize,
      width: cellSize,
      height: cellSize,
    })
    .png()
    .toBuffer()
  composites.push({ input: tile, left: column * cellSize, top: 0 })
}

await mkdir(dirname(outputPath), { recursive: true })
await sharp({
  create: {
    width: testColumns * cellSize,
    height: cellSize,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png({ palette: true, colours: 40, dither: 0 })
  .toFile(outputPath)

console.log(JSON.stringify({
  atlasPath,
  outputPath,
  sourceRow,
  sourceColumns,
  testColumns,
  frame: { width: cellSize, height: cellSize },
}, null, 2))
