import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const atlasPath = resolve(process.argv[2] ?? 'assets/art/drafts/cottage-floor-repaired-draft-v1.png')
const outputPath = resolve(process.argv[3] ?? 'assets/art/drafts/cottage-floor-seam-test-v1.png')
const cellSize = 32
const testColumns = 10
const testRows = 6
const floorVariantColumns = [0, 1, 2, 3, 4]
const composites = []

for (let row = 0; row < testRows; row += 1) {
  for (let column = 0; column < testColumns; column += 1) {
    const variant = floorVariantColumns[(column + row * 3) % floorVariantColumns.length]
    const tile = await sharp(atlasPath)
      .extract({
        left: variant * cellSize,
        top: 0,
        width: cellSize,
        height: cellSize,
      })
      .png()
      .toBuffer()
    composites.push({
      input: tile,
      left: column * cellSize,
      top: row * cellSize,
    })
  }
}

await mkdir(dirname(outputPath), { recursive: true })
await sharp({
  create: {
    width: testColumns * cellSize,
    height: testRows * cellSize,
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
  cellSize,
  testColumns,
  testRows,
  testedVariantColumns: floorVariantColumns,
}, null, 2))
