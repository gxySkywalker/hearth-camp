import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const artRoot = resolve(repoRoot, 'assets', 'art')
const manifestPath = resolve(artRoot, 'manifest.json')
const failures = []

function fail(scope, message) {
  failures.push(`${scope}: ${message}`)
}

function resolveInsideArtRoot(scope, assetPath) {
  const absolutePath = resolve(artRoot, assetPath)
  if (absolutePath !== artRoot && !absolutePath.startsWith(`${artRoot}${sep}`)) {
    fail(scope, `path escapes assets/art: ${assetPath}`)
    return null
  }
  return absolutePath
}

function assertPositiveInteger(scope, value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    fail(scope, `${label} must be a positive integer`)
    return false
  }
  return true
}

function borderIsTransparent(data, width, height, channels) {
  const alphaAt = (x, y) => data[(y * width + x) * channels + 3]
  for (let x = 0; x < width; x += 1) {
    if (alphaAt(x, 0) !== 0 || alphaAt(x, height - 1) !== 0) return false
  }
  for (let y = 0; y < height; y += 1) {
    if (alphaAt(0, y) !== 0 || alphaAt(width - 1, y) !== 0) return false
  }
  return true
}

async function validateRaster(asset, manifest) {
  const scope = asset.id || 'unnamed-asset'
  const absolutePath = resolveInsideArtRoot(scope, asset.path)
  if (!absolutePath || !existsSync(absolutePath)) {
    if (absolutePath) fail(scope, `file does not exist: ${asset.path}`)
    return
  }

  let metadata
  try {
    metadata = await sharp(absolutePath).metadata()
  } catch (error) {
    fail(scope, `cannot read image: ${error.message}`)
    return
  }

  if (metadata.format !== 'png') fail(scope, `production raster must be PNG, got ${metadata.format}`)
  const width = metadata.width
  const height = metadata.height
  if (!assertPositiveInteger(scope, width, 'image width')) return
  if (!assertPositiveInteger(scope, height, 'image height')) return

  if (asset.exactWidth && width !== asset.exactWidth) {
    fail(scope, `width ${width} does not match exactWidth ${asset.exactWidth}`)
  }
  if (asset.exactHeight && height !== asset.exactHeight) {
    fail(scope, `height ${height} does not match exactHeight ${asset.exactHeight}`)
  }

  if (asset.frame) {
    const frameWidthIsValid = assertPositiveInteger(scope, asset.frame.width, 'frame.width')
    const frameHeightIsValid = assertPositiveInteger(scope, asset.frame.height, 'frame.height')
    if (frameWidthIsValid && width % asset.frame.width !== 0) {
      fail(scope, `width ${width} is not divisible by frame width ${asset.frame.width}`)
    }
    if (frameHeightIsValid && height % asset.frame.height !== 0) {
      fail(scope, `height ${height} is not divisible by frame height ${asset.frame.height}`)
    }
    if (asset.columns && width !== asset.frame.width * asset.columns) {
      fail(scope, `width ${width} does not contain ${asset.columns} declared columns`)
    }
    if (asset.rows && height !== asset.frame.height * asset.rows) {
      fail(scope, `height ${height} does not contain ${asset.rows} declared rows`)
    }
  }

  const { data, info } = await sharp(absolutePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const colors = new Set()
  let semiTransparentPixels = 0
  let opaqueChromaKeyPixels = 0

  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const alpha = data[index + 3]
    if (alpha === 0) continue
    colors.add(`${red},${green},${blue}`)
    if (alpha < 255) semiTransparentPixels += 1
    if (red === 255 && green === 0 && blue === 255 && alpha === 255) opaqueChromaKeyPixels += 1
  }

  const maxColors = asset.maxOpaqueColors ?? manifest.palette?.recommendedMax
  if (maxColors && colors.size > maxColors) {
    fail(scope, `uses ${colors.size} opaque colors; allowed maximum is ${maxColors}`)
  }
  if (asset.allowSemiTransparent === false && semiTransparentPixels > 0) {
    fail(scope, `contains ${semiTransparentPixels} semi-transparent pixels`)
  }
  if (opaqueChromaKeyPixels > 0) {
    fail(scope, `contains ${opaqueChromaKeyPixels} opaque #ff00ff chroma-key pixels`)
  }
  if (asset.requireAlpha && metadata.hasAlpha !== true) {
    fail(scope, 'requires an alpha channel')
  }
  if (asset.transparentBorder && !borderIsTransparent(data, info.width, info.height, info.channels)) {
    fail(scope, 'requires a fully transparent one-pixel outer border')
  }
}

async function validateTilesetSpec(entry, manifest) {
  const scope = entry.id || 'unnamed-spec'
  const absolutePath = resolveInsideArtRoot(scope, entry.path)
  if (!absolutePath || !existsSync(absolutePath)) return

  let spec
  try {
    spec = JSON.parse(await readFile(absolutePath, 'utf8'))
  } catch (error) {
    fail(scope, `cannot read spec: ${error.message}`)
    return
  }

  if (spec.schemaVersion !== 1) fail(scope, 'schemaVersion must be 1')
  if (spec.id !== entry.id) fail(scope, `spec id must match manifest id ${entry.id}`)

  const atlas = spec.atlas ?? {}
  const widthIsValid = assertPositiveInteger(scope, atlas.logicalWidth, 'atlas.logicalWidth')
  const heightIsValid = assertPositiveInteger(scope, atlas.logicalHeight, 'atlas.logicalHeight')
  const columnsAreValid = assertPositiveInteger(scope, atlas.columns, 'atlas.columns')
  const rowsAreValid = assertPositiveInteger(scope, atlas.rows, 'atlas.rows')
  const cellWidthIsValid = assertPositiveInteger(scope, atlas.cellWidth, 'atlas.cellWidth')
  const cellHeightIsValid = assertPositiveInteger(scope, atlas.cellHeight, 'atlas.cellHeight')

  if (widthIsValid && columnsAreValid && cellWidthIsValid && atlas.logicalWidth !== atlas.columns * atlas.cellWidth) {
    fail(scope, 'atlas width must equal columns multiplied by cellWidth')
  }
  if (heightIsValid && rowsAreValid && cellHeightIsValid && atlas.logicalHeight !== atlas.rows * atlas.cellHeight) {
    fail(scope, 'atlas height must equal rows multiplied by cellHeight')
  }
  if (cellWidthIsValid && atlas.cellWidth !== manifest.tile?.width) {
    fail(scope, `cellWidth must match manifest tile width ${manifest.tile?.width}`)
  }
  if (cellHeightIsValid && atlas.cellHeight !== manifest.tile?.height) {
    fail(scope, `cellHeight must match manifest tile height ${manifest.tile?.height}`)
  }

  const grid = Array.isArray(spec.grid) ? spec.grid : []
  if (rowsAreValid && grid.length !== atlas.rows) {
    fail(scope, `grid has ${grid.length} rows; expected ${atlas.rows}`)
  }

  const tileIds = new Set()
  for (let rowIndex = 0; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex]
    if (!Array.isArray(row)) {
      fail(scope, `grid row ${rowIndex} must be an array`)
      continue
    }
    if (columnsAreValid && row.length !== atlas.columns) {
      fail(scope, `grid row ${rowIndex} has ${row.length} cells; expected ${atlas.columns}`)
    }
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const tileId = row[columnIndex]
      if (typeof tileId !== 'string' || tileId.length === 0) {
        fail(scope, `grid cell ${columnIndex},${rowIndex} requires a tile id`)
        continue
      }
      if (tileIds.has(tileId)) fail(scope, `duplicate tile id ${tileId}`)
      tileIds.add(tileId)
    }
  }

  const maxColors = spec.rules?.maxOpaqueColors
  if (maxColors !== undefined && (!Number.isInteger(maxColors) || maxColors <= 0)) {
    fail(scope, 'rules.maxOpaqueColors must be a positive integer')
  }
  if (maxColors > manifest.palette?.recommendedMax) {
    fail(scope, `rules.maxOpaqueColors exceeds shared palette maximum ${manifest.palette.recommendedMax}`)
  }
}

let manifest
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
} catch (error) {
  console.error(`ART ERROR manifest: ${error.message}`)
  process.exit(1)
}

if (manifest.schemaVersion !== 1) fail('manifest', 'schemaVersion must be 1')
assertPositiveInteger('manifest', manifest.logicalViewport?.width, 'logicalViewport.width')
assertPositiveInteger('manifest', manifest.logicalViewport?.height, 'logicalViewport.height')
assertPositiveInteger('manifest', manifest.tile?.width, 'tile.width')
assertPositiveInteger('manifest', manifest.tile?.height, 'tile.height')

const references = Array.isArray(manifest.references) ? manifest.references : []
const specs = Array.isArray(manifest.specs) ? manifest.specs : []
const drafts = Array.isArray(manifest.drafts) ? manifest.drafts : []
const assets = Array.isArray(manifest.assets) ? manifest.assets : []
const ids = new Set()

for (const entry of [...references, ...specs, ...drafts, ...assets]) {
  const scope = entry.id || 'unnamed-entry'
  if (!entry.id) fail(scope, 'id is required')
  if (ids.has(entry.id)) fail(scope, 'id must be unique')
  ids.add(entry.id)
  if (!entry.path) {
    fail(scope, 'path is required')
    continue
  }
  const absolutePath = resolveInsideArtRoot(scope, entry.path)
  if (absolutePath && !existsSync(absolutePath)) fail(scope, `file does not exist: ${entry.path}`)
}

for (const spec of specs) await validateTilesetSpec(spec, manifest)
for (const asset of assets) await validateRaster(asset, manifest)

if (failures.length > 0) {
  console.error(`ART VALIDATION FAILED (${failures.length})`)
  for (const problem of failures) console.error(`- ${problem}`)
  process.exit(1)
}

const manifestLabel = relative(repoRoot, manifestPath).replaceAll('\\', '/')
console.log(`ART VALIDATION PASSED: ${manifestLabel}`)
console.log(`References: ${references.length}; specs: ${specs.length}; drafts: ${drafts.length}; production assets: ${assets.length}`)
if (assets.length === 0) console.log('Reference-only stage: no generated image is treated as a production sprite yet.')
