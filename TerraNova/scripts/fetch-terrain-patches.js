import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { inflateSync } from 'node:zlib'
import { fromArrayBuffer } from 'geotiff'
import analogSites from '../src/data/analogs.json' with { type: 'json' }
import targetPairs from '../src/data/analog-target-pairs.json' with { type: 'json' }

const projectDir = dirname(fileURLToPath(import.meta.url))
const outputRoot = join(projectDir, '..', 'public', 'terrain')
const earthTileZoom = 10
const maxConcurrentSites = 3
const bodyRadiiMeters = { moon: 1_737_400, mars: 3_396_190 }
const sourceCache = new Map()
const execFile = promisify(execFileCallback)
const curlCommand = process.platform === 'win32' ? 'curl.exe' : 'curl'

const layers = {
  moon: {
    equirectangular: {
      texture: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02',
      elevation: null,
    },
    south_pole: {
      texture: 'https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_ClrShade_SPole875_5mp_v04',
      elevation: 'https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_Gray_SPole875_5mp_v04',
    },
  },
  mars: {
    equirectangular: {
      texture: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m',
      elevation: null,
    },
    south_pole: {
      texture: 'https://trek.nasa.gov/tiles/Mars/SP/Mars_MGS_MOLA_ClrShade_merge_global_463m_sp',
      elevation:
        'https://trek.nasa.gov/mars/trekarcgis/rest/services/mola128_mola64_merge_90Nto90S_SimpleC_clon0_SP/ImageServer',
    },
  },
}

const earthSources = {
  texture:
    'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
  elevation: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  attribution: 'World Hillshade © Esri; elevation © AWS Terrain Tiles (Terrarium encoding).',
}

function getPngPixels(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (!buffer.subarray(0, 8).equals(signature)) {
    throw new Error('The terrain image is not a PNG.')
  }

  let width
  let height
  let bitDepth
  let colorType
  const imageData = []
  let offset = 8

  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset)
    const chunkType = buffer.toString('ascii', offset + 4, offset + 8)
    const chunkData = buffer.subarray(offset + 8, offset + 8 + chunkLength)
    if (chunkType === 'IHDR') {
      width = chunkData.readUInt32BE(0)
      height = chunkData.readUInt32BE(4)
      bitDepth = chunkData[8]
      colorType = chunkData[9]
    } else if (chunkType === 'IDAT') {
      imageData.push(chunkData)
    } else if (chunkType === 'IEND') {
      break
    }
    offset += chunkLength + 12
  }

  if (bitDepth !== 8 || ![0, 2, 4, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG pixel format: depth ${bitDepth}, color type ${colorType}.`)
  }

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType]
  const stride = width * channels
  const inflated = inflateSync(Buffer.concat(imageData))
  const pixels = Buffer.alloc(height * stride)

  for (let row = 0; row < height; row += 1) {
    const filter = inflated[row * (stride + 1)]
    const inputStart = row * (stride + 1) + 1
    const outputStart = row * stride
    for (let column = 0; column < stride; column += 1) {
      const raw = inflated[inputStart + column]
      const left = column >= channels ? pixels[outputStart + column - channels] : 0
      const above = row > 0 ? pixels[outputStart + column - stride] : 0
      const upperLeft =
        row > 0 && column >= channels ? pixels[outputStart + column - stride - channels] : 0
      pixels[outputStart + column] = (raw + pngPredictor(filter, left, above, upperLeft)) & 0xff
    }
  }

  return { width, height, channels, pixels }
}

function pngPredictor(filter, left, above, upperLeft) {
  if (filter === 0) return 0
  if (filter === 1) return left
  if (filter === 2) return above
  if (filter === 3) return Math.floor((left + above) / 2)
  if (filter === 4) {
    const base = left + above - upperLeft
    const leftDistance = Math.abs(base - left)
    const aboveDistance = Math.abs(base - above)
    const upperLeftDistance = Math.abs(base - upperLeft)
    if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left
    return aboveDistance <= upperLeftDistance ? above : upperLeft
  }
  throw new Error(`Unsupported PNG filter ${filter}.`)
}

function readTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`))
  return match?.[1]?.trim().replace(/&amp;/g, '&') ?? ''
}

function parseTileMatrices(xml, projection) {
  const layerXml = xml.match(/<Layer>([\s\S]*?)<\/Layer>/)?.[1]
  if (!layerXml) throw new Error('WMTS capabilities contain no layer metadata.')

  const sets = [...xml.matchAll(/<TileMatrixSet>([\s\S]*?)<\/TileMatrixSet>/g)]
    .map(([, setXml]) => {
      const supportedCrs = readTag(setXml, 'ows:SupportedCRS') || readTag(setXml, 'SupportedCRS')
      const matrixSetId = readTag(setXml, 'ows:Identifier') || readTag(setXml, 'Identifier')
      const matrices = [...setXml.matchAll(/<TileMatrix>([\s\S]*?)<\/TileMatrix>/g)].map(
        ([, matrixXml]) => ({
          id: readTag(matrixXml, 'ows:Identifier') || readTag(matrixXml, 'Identifier'),
          scaleDenominator: Number(readTag(matrixXml, 'ScaleDenominator')),
          topLeft: readTag(matrixXml, 'TopLeftCorner').split(/\s+/).map(Number),
          tileWidth: Number(readTag(matrixXml, 'TileWidth')),
          tileHeight: Number(readTag(matrixXml, 'TileHeight')),
          matrixWidth: Number(readTag(matrixXml, 'MatrixWidth')),
          matrixHeight: Number(readTag(matrixXml, 'MatrixHeight')),
        }),
      )
      return { id: matrixSetId, supportedCrs, matrices }
    })
    .filter(({ id, matrices }) => id && matrices.length)

  const preferredSet = sets.find(({ supportedCrs }) =>
    projection === 'equirectangular'
      ? /EPSG|equirectangular/i.test(supportedCrs)
      : /IAU|polar|moon_sp|mars_sp|mars_np/i.test(supportedCrs),
  )
  const matrixSet = preferredSet ?? sets[0]
  if (!matrixSet) throw new Error('WMTS capabilities contain no usable tile matrix set.')

  const styleXml = layerXml.match(/<Style\b[^>]*>([\s\S]*?)<\/Style>/)?.[1] ?? ''
  const style = readTag(styleXml, 'ows:Identifier') || readTag(styleXml, 'Identifier') || 'default'
  const resource = layerXml.match(/<ResourceURL\b[^>]*template="([^"]+)"/)?.[1]
  if (!resource) throw new Error('WMTS capabilities have no REST tile URL template.')

  return {
    layer: readTag(layerXml, 'ows:Identifier') || readTag(layerXml, 'Identifier'),
    style,
    matrixSet,
    resource: resource.replace(/&amp;/g, '&'),
  }
}

function projectPolar(pair, body, pole) {
  const radius = bodyRadiiMeters[body]
  const latitude = (Math.abs(pair.lat) * Math.PI) / 180
  const longitude = ((pair.lon * Math.PI) / 180) % (2 * Math.PI)
  const radialDistance = 2 * radius * Math.tan((Math.PI / 2 - latitude) / 2)
  return {
    x: radialDistance * Math.sin(longitude),
    y: (pole === 'north_pole' ? -1 : 1) * radialDistance * Math.cos(longitude),
  }
}

function selectWmtsTile(capabilities, pair, body) {
  const { matrixSet, resource, style } = capabilities
  const targetWidthMeters = pair.radiusKm * 2_000
  const matrices = matrixSet.matrices.map((matrix) => {
    const resolutionMeters =
      pair.projection === 'equirectangular'
        ? (2 * Math.PI * bodyRadiiMeters[body]) / (matrix.matrixWidth * matrix.tileWidth)
        : matrix.scaleDenominator * 0.00028
    return {
      ...matrix,
      resolutionMeters,
      tileSpanMeters: resolutionMeters * matrix.tileWidth,
    }
  })
  const matrix = matrices.reduce((best, candidate) =>
    Math.abs(Math.log(candidate.tileSpanMeters / targetWidthMeters)) <
    Math.abs(Math.log(best.tileSpanMeters / targetWidthMeters))
      ? candidate
      : best,
  )

  let column
  let row
  if (pair.projection === 'equirectangular') {
    column = Math.floor(((pair.lon + 180) / 360) * matrix.matrixWidth)
    row = Math.floor(((90 - pair.lat) / 180) * matrix.matrixHeight)
  } else {
    const position = projectPolar(pair, body, pair.projection)
    column = Math.floor((position.x - matrix.topLeft[0]) / matrix.tileSpanMeters)
    row = Math.floor((matrix.topLeft[1] - position.y) / matrix.tileSpanMeters)
  }

  if (column < 0 || row < 0 || column >= matrix.matrixWidth || row >= matrix.matrixHeight) {
    throw new Error(`The proposed coordinate is outside WMTS matrix coverage for ${body}.`)
  }

  const url = resource
    .replaceAll('{Style}', style)
    .replaceAll('{TileMatrixSet}', matrixSet.id)
    .replaceAll('{TileMatrix}', matrix.id)
    .replaceAll('{TileRow}', String(row))
    .replaceAll('{TileCol}', String(column))

  return {
    url,
    tile: {
      matrixSet: matrixSet.id,
      matrix: matrix.id,
      row,
      column,
      resolutionMeters: matrix.resolutionMeters,
      tileSizeKm: (matrix.tileSpanMeters * matrix.tileHeight) / matrix.tileWidth / 1_000,
      projection: pair.projection,
    },
  }
}

async function fetchBuffer(url) {
  if (sourceCache.has(url)) return sourceCache.get(url)
  const result = (async () => {
    try {
      const { stdout } = await execFile(
        curlCommand,
        [
          '--location',
          '--fail',
          '--silent',
          '--show-error',
          '--max-time',
          '30',
          '--output',
          '-',
          url,
        ],
        { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 },
      )
      return Buffer.from(stdout)
    } catch (error) {
      const details = error.stderr?.toString().trim() || error.message
      throw new Error(`Unable to download ${url}: ${details}`, { cause: error })
    }
  })()
  sourceCache.set(url, result)
  return result
}

function getEarthTileCoordinates(lat, lon, zoom) {
  const boundedLatitude = Math.max(-85.051129, Math.min(85.051129, lat))
  const scale = 2 ** zoom
  const x = Math.floor(((lon + 180) / 360) * scale)
  const latitudeRadians = (boundedLatitude * Math.PI) / 180
  const y = Math.floor(((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * scale)
  return { x, y, zoom }
}

function getEarthTileBounds(x, y, zoom) {
  const scale = 2 ** zoom
  const latitudeAtTileY = (tileY) =>
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / scale))) * 180) / Math.PI
  return {
    west: (x / scale) * 360 - 180,
    south: latitudeAtTileY(y + 1),
    east: ((x + 1) / scale) * 360 - 180,
    north: latitudeAtTileY(y),
  }
}

function terrariumMeters(pixels, index) {
  return pixels[index] * 256 + pixels[index + 1] + pixels[index + 2] / 256 - 32768
}

function buildHistogram(values, bins = 8) {
  const finiteValues = values.filter(Number.isFinite)
  if (!finiteValues.length) return []
  const min = Math.min(...finiteValues)
  const max = Math.max(...finiteValues)
  const counts = Array(bins).fill(0)
  for (const value of finiteValues) {
    const index =
      max === min ? 0 : Math.min(bins - 1, Math.floor(((value - min) / (max - min)) * bins))
    counts[index] += 1
  }
  return counts
}

function calculateEarthSlope(values, width, height, cellSizeMeters) {
  const slopes = []
  for (let row = 1; row < height - 1; row += 1) {
    for (let column = 1; column < width - 1; column += 1) {
      const index = row * width + column
      const dx = (values[index + 1] - values[index - 1]) / (2 * cellSizeMeters)
      const dy = (values[index + width] - values[index - width]) / (2 * cellSizeMeters)
      if (Number.isFinite(dx) && Number.isFinite(dy)) {
        slopes.push((Math.atan(Math.hypot(dx, dy)) * 180) / Math.PI)
      }
    }
  }
  return slopes.length ? slopes.reduce((total, slope) => total + slope, 0) / slopes.length : null
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function downloadEarthPatch(site) {
  const location = site.locations.find(({ lat, lon }) => lat !== null && lon !== null)
  const directory = join(outputRoot, String(site.id), 'earth')
  if (!location) {
    const meta = {
      status: 'unavailable',
      reason: 'This analog site has no mapped coordinates in the dataset.',
      attribution: earthSources.attribution,
    }
    await writeJson(join(directory, 'meta.json'), meta)
    return meta
  }

  const { x, y, zoom } = getEarthTileCoordinates(location.lat, location.lon, earthTileZoom)
  const replacements = { z: zoom, x, y }
  const textureUrl = earthSources.texture.replace('{z}', zoom).replace('{x}', x).replace('{y}', y)
  const elevationUrl = earthSources.elevation
    .replace('{z}', zoom)
    .replace('{x}', x)
    .replace('{y}', y)
  const [texture, elevation] = await Promise.all([
    fetchBuffer(textureUrl),
    fetchBuffer(elevationUrl),
  ])
  const decoded = getPngPixels(elevation)
  const values = []
  for (let index = 0; index < decoded.pixels.length; index += decoded.channels) {
    if ([2, 4].includes(decoded.channels) && decoded.pixels[index + decoded.channels - 1] === 0) {
      continue
    }
    values.push(terrariumMeters(decoded.pixels, index))
  }

  const resolutionMeters =
    (156543.03392804097 * Math.cos((location.lat * Math.PI) / 180)) / 2 ** zoom
  const minimumElevationM = Math.min(...values)
  const maximumElevationM = Math.max(...values)
  const stats = {
    min: minimumElevationM,
    max: maximumElevationM,
    relief: maximumElevationM - minimumElevationM,
    units: 'm',
    meanSlopeDegrees: calculateEarthSlope(values, decoded.width, decoded.height, resolutionMeters),
    histogram: buildHistogram(values),
    sampleCount: values.length,
  }
  const patchSizeKm = (resolutionMeters * decoded.width) / 1_000
  const meta = {
    status: 'ready',
    body: 'earth',
    name: site.nameEn,
    coordinates: { lat: location.lat, lon: location.lon, confidence: location.confidence },
    radiusKm: patchSizeKm / 2,
    patchSizeKm,
    resolutionMeters,
    bbox: getEarthTileBounds(x, y, zoom),
    tile: replacements,
    files: { texture: 'texture.jpg', elevation: 'elevation.png' },
    elevation: stats,
    layers: {
      texture: 'Esri World Hillshade raster tile',
      elevation: 'AWS Terrarium elevation tile',
    },
    attribution: earthSources.attribution,
    fetchedAt: new Date().toISOString(),
  }

  await mkdir(directory, { recursive: true })
  await Promise.all([
    writeFile(join(directory, 'texture.jpg'), texture),
    writeFile(join(directory, 'elevation.png'), elevation),
    writeJson(join(directory, 'meta.json'), meta),
  ])
  return meta
}

async function fetchWmtsTile(endpoint, pair, body, destinationBase) {
  const capabilitiesUrl = `${endpoint}/1.0.0/WMTSCapabilities.xml`
  const xml = (await fetchBuffer(capabilitiesUrl)).toString('utf8')
  const capabilities = parseTileMatrices(xml, pair.projection)
  const selected = selectWmtsTile(capabilities, pair, body)
  const buffer = await fetchBuffer(selected.url)
  const file = selected.url.toLowerCase().endsWith('.jpg') ? 'texture.jpg' : 'texture.png'
  const destination = `${destinationBase}${file.endsWith('.jpg') ? '.jpg' : '.png'}`
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, buffer)
  return {
    ...selected,
    file,
    capabilitiesUrl,
    layer: capabilities.layer,
    imageType: selected.url.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
  }
}

function projectedBounds(pair, imageService, pole) {
  const spatialReference = imageService.extent?.spatialReference?.wkt ?? ''
  const radiusMatch = spatialReference.match(/SPHEROID\["[^"]+",([\d.]+)/)
  const bodyRadius = radiusMatch ? Number(radiusMatch[1]) : null
  if (!bodyRadius) return null

  const center = projectPolar(pair, pair.body, pole)
  const halfWidthMeters = pair.radiusKm * 1_000
  const extent = imageService.extent
  const bounds = {
    xmin: center.x - halfWidthMeters,
    ymin: center.y - halfWidthMeters,
    xmax: center.x + halfWidthMeters,
    ymax: center.y + halfWidthMeters,
  }
  if (
    bounds.xmin < extent.xmin ||
    bounds.ymin < extent.ymin ||
    bounds.xmax > extent.xmax ||
    bounds.ymax > extent.ymax
  ) {
    return null
  }
  return { bounds, bodyRadius }
}

async function fetchMarsElevation(pair, destination) {
  const pole = pair.projection
  const endpoint = layers.mars[pole]?.elevation
  if (!endpoint) {
    return {
      available: false,
      reason: 'NASA Trek does not publish a numeric MOLA DEM WMTS for this projection.',
    }
  }
  const imageService = await (await fetchBuffer(`${endpoint}?f=pjson`)).toString('utf8')
  const serviceInfo = JSON.parse(imageService)
  const projected = projectedBounds(pair, serviceInfo, pole)
  if (!projected) {
    return {
      available: false,
      reason: 'The proposed region falls outside the verified polar MOLA ImageServer coverage.',
    }
  }

  const { xmin, ymin, xmax, ymax } = projected.bounds
  const params = new URLSearchParams({
    bbox: `${xmin},${ymin},${xmax},${ymax}`,
    size: '256,256',
    format: 'tiff',
    f: 'image',
  })
  const tiffBytes = await fetchBuffer(`${endpoint}/exportImage?${params}`)
  const tiff = await fromArrayBuffer(
    tiffBytes.buffer.slice(tiffBytes.byteOffset, tiffBytes.byteOffset + tiffBytes.byteLength),
  )
  const image = await tiff.getImage()
  const raster = await image.readRasters({ interleave: true })
  const values = Array.from(raster, Number)
  const noData = image.getGDALNoData()
  const validValues = values.filter(
    (value) => Number.isFinite(value) && (noData === null || value !== noData),
  )
  if (!validValues.length)
    throw new Error(`The MOLA TIFF contained no valid raster values: ${endpoint}`)

  const min = Math.min(...validValues)
  const max = Math.max(...validValues)
  const width = image.getWidth()
  const height = image.getHeight()
  const elevationBuffer = Buffer.from(
    Float32Array.from(values, (value) => (Number.isFinite(value) ? value : Number.NaN)).buffer,
  )
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, elevationBuffer)
  return {
    available: true,
    file: 'elevation.f32',
    encoding: 'float32-le',
    units: 'source sample units (not specified by the service metadata)',
    min,
    max,
    relief: max - min,
    meanSlopeDegrees: null,
    histogram: buildHistogram(validValues),
    sampleCount: validValues.length,
    width,
    height,
    resolutionMeters: serviceInfo.pixelSizeX,
    noDataValue: noData,
    source: endpoint,
  }
}

async function downloadTargetPatch(site, pair, pairIndex) {
  const folder = join(outputRoot, String(site.id), `target-${pairIndex + 1}`)
  const layer = layers[pair.body][pair.projection]
  if (!layer) {
    const meta = {
      status: 'unavailable',
      body: pair.body,
      reason: `No verified NASA Trek image layer is configured for ${pair.projection}.`,
      attribution: 'NASA / NASA Trek',
    }
    await writeJson(join(folder, 'meta.json'), meta)
    return meta
  }

  const texturePath = join(folder, 'texture')
  const texture = await fetchWmtsTile(layer.texture, pair, pair.body, texturePath)
  let elevation = {
    available: false,
    reason: 'A numeric elevation layer is not available for this body and projection.',
  }
  let elevationImage
  if (pair.body === 'moon' && layer.elevation) {
    const selected = await fetchWmtsTile(
      layer.elevation,
      pair,
      pair.body,
      join(folder, 'elevation'),
    )
    const image = getPngPixels(await fetchBuffer(selected.url))
    const visualLevels = []
    for (let index = 0; index < image.pixels.length; index += image.channels) {
      if ([2, 4].includes(image.channels) && image.pixels[index + image.channels - 1] === 0) {
        continue
      }
      visualLevels.push(image.pixels[index])
    }
    elevation = {
      available: true,
      file: 'elevation.png',
      encoding: 'normalized grayscale display values',
      units: '0–255 image levels; not elevation units',
      min: Math.min(...visualLevels),
      max: Math.max(...visualLevels),
      relief: Math.max(...visualLevels) - Math.min(...visualLevels),
      meanSlopeDegrees: null,
      histogram: buildHistogram(visualLevels),
      sampleCount: visualLevels.length,
      resolutionMeters: selected.tile.resolutionMeters,
      source: selected.capabilitiesUrl,
    }
    elevationImage = selected
  } else if (pair.body === 'mars' && pair.projection !== 'equirectangular') {
    elevation = await fetchMarsElevation(pair, join(folder, 'elevation.f32'))
  }

  const meta = {
    status: 'ready',
    body: pair.body,
    label: pair.label,
    coordinates: { lat: pair.lat, lon: pair.lon },
    confidence: pair.confidence,
    rationale: pair.rationale,
    radiusKm: pair.radiusKm,
    patchSizeKm: texture.tile.tileSizeKm,
    resolutionMeters: texture.tile.resolutionMeters,
    bbox: texture.tile,
    files: { texture: texture.file, elevation: elevation.available ? elevation.file : null },
    elevation,
    layers: {
      texture: texture.layer,
      elevation: elevation.available ? elevation.source : null,
    },
    liveRefreshUrl: texture.url,
    elevationImage,
    attribution: 'NASA / NASA Trek; layer identifiers and capabilities are recorded in metadata.',
    fetchedAt: new Date().toISOString(),
  }
  await writeJson(join(folder, 'meta.json'), meta)
  if (!elevation.available) {
    console.warn(`Elevation unavailable for site ${site.id} (${pair.body}): ${elevation.reason}`)
  }
  return meta
}

async function runForSite(site) {
  const earth = await downloadEarthPatch(site)
  const targets = targetPairs[site.id] ?? []
  const targetResults = []
  for (const [index, pair] of targets.entries()) {
    targetResults.push(await downloadTargetPatch(site, pair, index))
  }
  return { siteId: site.id, earth, targets: targetResults }
}

async function main() {
  const siteOption = process.argv.find((argument) => argument.startsWith('--site='))
  const requestedSiteId = siteOption ? Number(siteOption.slice('--site='.length)) : null
  const sites = requestedSiteId
    ? analogSites.filter(({ id }) => id === requestedSiteId)
    : analogSites
  if (!sites.length) {
    throw new Error(`No analog site found for --site=${requestedSiteId}.`)
  }
  const results = []
  const errors = []
  for (let index = 0; index < sites.length; index += maxConcurrentSites) {
    const batch = sites.slice(index, index + maxConcurrentSites)
    const settled = await Promise.allSettled(batch.map(runForSite))
    for (const result of settled) {
      if (result.status === 'fulfilled') results.push(result.value)
      else {
        errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
        console.error(`Terrain patch failed: ${errors.at(-1)}`)
      }
    }
  }
  console.info(
    `Terrain patches complete: ${results.length}/${sites.length} sites written; ${errors.length} errors. Cached files are in public/terrain/.`,
  )
  if (errors.length) process.exitCode = 1
}

await main()
