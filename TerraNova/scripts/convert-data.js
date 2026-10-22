import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { parse } from 'csv-parse/sync'
import { TAG_RULES } from './tag-rules.js'
import { findNearestAirport } from '../src/lib/airports.js'
import {
  analogSiteSchema,
  airportSchema,
  airportsIndexSchema,
  fieldNoteSchema,
  provenanceSchema,
  siteLogisticsSchema,
} from '../src/lib/dataSchemas.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rawPath = path.join(root, 'data-raw', 'planetary_analog_sites_verified.json')
const coordinatePath = path.join(root, 'data-raw', 'coordinates.csv')
const fieldNotesPath = path.join(root, 'data-raw', 'field-notes.csv')
const airportsPath = path.join(root, 'data-raw', 'airports.csv')
const outputPath = path.join(root, 'src', 'data')
const OUR_AIRPORTS_URL = 'https://ourairports.com/data/airports.csv'

const rawSiteSchema = z.object({
  ID: z.number(),
  Site_Name_AR: z.string(),
  Site_Name_EN: z.string(),
  Country_Region: z.string(),
  Coordinates_Dimensions_Elevation: z.string(),
  Target_Planetary_Body_and_Feature: z.string(),
  Analog_Category: z.string(),
  Geology_Mineralogy_Geochemistry: z.string(),
  Environment_Physics_Astrobiology: z.string(),
  Mission_Application_and_Instruments: z.string(),
  Verified_Source: z.string(),
})

const rawSchema = z.object({
  metadata: z.object({
    dataset_title: z.string(),
    total_original_records: z.number(),
    total_verified_records: z.number(),
    total_filtered_out_records: z.number(),
    structural_fixes_applied: z.array(z.string()),
    scientific_corrections_applied: z.array(z.string()),
  }),
  verified_sites: z.array(rawSiteSchema),
  filtered_out_sites: z.array(z.record(z.string(), z.unknown())),
})

function parseRows(text, fileName, requiredHeaders) {
  const rows = parse(text, { columns: true, bom: true, skip_empty_lines: true, trim: true })
  const headers = rows[0] ? Object.keys(rows[0]) : []
  if (!requiredHeaders.every((header) => headers.includes(header))) {
    throw new Error(`${fileName} is missing required columns: ${requiredHeaders.join(', ')}`)
  }
  return rows
}

function parseCsv(text) {
  const rows = parseRows(text, 'coordinates.csv', [
    'siteId',
    'label',
    'lat',
    'lon',
    'confidence',
    'note',
  ])
  return rows.map((row, index) => {
    const parsed = z
      .object({
        siteId: z.coerce.number().int().positive(),
        label: z.string().min(1),
        lat: z.coerce.number().min(-90).max(90),
        lon: z.coerce.number().min(-180).max(180),
        confidence: z.enum(['approximate', 'verified']),
        note: z.string(),
      })
      .safeParse(row)
    if (!parsed.success) {
      throw new Error(`Invalid coordinates.csv row ${index + 2}: ${parsed.error.message}`)
    }
    return parsed.data
  })
}

function parseFieldNotes(text, siteIds) {
  const rows = parseRows(text, 'field-notes.csv', [
    'siteId',
    'permitsNotes',
    'hazards',
    'bestSeason',
    'accessNotes',
    'sourceUrl',
    'lastVerified',
  ])
  const notesById = new Map()
  rows.forEach((row, index) => {
    const siteId = Number(row.siteId)
    if (!siteIds.has(siteId)) {
      throw new Error(`Invalid field-notes.csv row ${index + 2}: unknown site ID ${row.siteId}`)
    }
    if (notesById.has(siteId)) {
      throw new Error(`Duplicate field-notes.csv entry for site ID ${siteId}`)
    }
    const nullable = (value) => (value === '' ? null : value)
    const parsed = fieldNoteSchema.safeParse({
      siteId,
      permitsNotes: nullable(row.permitsNotes),
      hazards: nullable(row.hazards),
      bestSeason: nullable(row.bestSeason),
      accessNotes: nullable(row.accessNotes),
      sourceUrl: nullable(row.sourceUrl),
      lastVerified: nullable(row.lastVerified),
    })
    if (!parsed.success) {
      throw new Error(`Invalid field-notes.csv row ${index + 2}: ${parsed.error.message}`)
    }
    notesById.set(siteId, parsed.data)
  })
  return [...siteIds].map(
    (siteId) =>
      notesById.get(siteId) ?? {
        siteId,
        permitsNotes: null,
        hazards: null,
        bestSeason: null,
        accessNotes: null,
        sourceUrl: null,
        lastVerified: null,
      },
  )
}

async function loadAirportsIndex() {
  try {
    const csv = await readFile(airportsPath, 'utf8')
    const rows = parseRows(csv, 'airports.csv', [
      'id',
      'type',
      'name',
      'latitude_deg',
      'longitude_deg',
      'iso_country',
    ])
    const airports = []
    let skipped = 0
    for (const row of rows) {
      if (!['large_airport', 'medium_airport'].includes(row.type)) continue
      const parsed = airportSchema.safeParse({
        id: Number(row.id),
        name: row.name,
        type: row.type,
        municipality: row.municipality || null,
        isoCountry: row.iso_country,
        lat: Number(row.latitude_deg),
        lon: Number(row.longitude_deg),
      })
      if (!parsed.success) {
        skipped += 1
        continue
      }
      airports.push(parsed.data)
    }
    if (airports.length === 0) {
      throw new Error('airports.csv contains no valid large or medium airport records')
    }
    if (skipped) console.warn(`Skipped ${skipped} invalid large/medium airport rows`)
    const latitudeRows = {}
    airports.forEach((airport, index) => {
      const row = Math.max(0, Math.min(179, Math.floor(airport.lat + 90)))
      ;(latitudeRows[row] ??= []).push(index)
    })
    return airportsIndexSchema.parse({
      available: true,
      source: 'OurAirports',
      datasetUrl: OUR_AIRPORTS_URL,
      airports,
      latitudeRows,
    })
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    console.warn(
      `Airport distances are not yet verified. Download ${OUR_AIRPORTS_URL} as data-raw/airports.csv to enable them.`,
    )
    return airportsIndexSchema.parse({
      available: false,
      source: 'OurAirports',
      datasetUrl: OUR_AIRPORTS_URL,
      airports: [],
      latitudeRows: {},
    })
  }
}

function dmsToDecimal(degrees, minutes, seconds, direction) {
  const value = Number(degrees) + Number(minutes ?? 0) / 60 + Number(seconds ?? 0) / 3600
  return /[SW]/i.test(direction) ? -value : value
}

function parseSourceCoordinates(text) {
  const points = []
  const dms =
    /(\d{1,2})°\s*(\d{1,2})['′]\s*(?:(\d{1,2}(?:\.\d+)?)["″])?\s*([NS])\s+(\d{1,3})°\s*(\d{1,2})['′]\s*(?:(\d{1,2}(?:\.\d+)?)["″])?\s*([EW])/gi
  for (const match of text.matchAll(dms)) {
    points.push({
      lat: dmsToDecimal(match[1], match[2], match[3], match[4]),
      lon: dmsToDecimal(match[5], match[6], match[7], match[8]),
    })
  }
  const decimal = /(\d{1,2}(?:\.\d+)?)°?\s*([NS])\s+(\d{1,3}(?:\.\d+)?)°?\s*([EW])/gi
  for (const match of text.matchAll(decimal)) {
    points.push({
      lat: dmsToDecimal(match[1], undefined, undefined, match[2]),
      lon: dmsToDecimal(match[3], undefined, undefined, match[4]),
    })
  }
  return points
}

function targetBody(value) {
  const moon = /القمر|moon/i.test(value)
  const mars = /المريخ|mars/i.test(value)
  if (moon && mars) return 'both'
  if (moon) return 'moon'
  if (mars) return 'mars'
  return 'unknown'
}

function dimensionsWithoutCoordinates(value) {
  return value
    .replace(
      /\d{1,2}°\s*\d{1,2}['′]\s*(?:\d{1,2}(?:\.\d+)?["″])?\s*[NS]\s+\d{1,3}°\s*\d{1,2}['′]\s*(?:\d{1,2}(?:\.\d+)?["″])?\s*[EW]/gi,
      '',
    )
    .replace(/\d{1,2}(?:\.\d+)?°?\s*[NS]\s+\d{1,3}(?:\.\d+)?°?\s*[EW]/gi, '')
    .replace(/^\s*\|\s*|\s*\|\s*$/g, '')
    .trim()
}

const source = rawSchema.parse(JSON.parse(await readFile(rawPath, 'utf8')))
const csvLocations = parseCsv(await readFile(coordinatePath, 'utf8'))
const csvById = new Map()
for (const location of csvLocations) {
  const rows = csvById.get(location.siteId) ?? []
  rows.push(location)
  csvById.set(location.siteId, rows)
}

const ids = new Set()
const duplicateIds = []
const missingTargets = []
const missingCoordinates = []
const analogs = source.verified_sites.map((record) => {
  if (ids.has(record.ID)) duplicateIds.push(record.ID)
  ids.add(record.ID)

  const rawCoordinates = parseSourceCoordinates(record.Coordinates_Dimensions_Elevation)
  const directLocations = rawCoordinates.map((point, index) => ({
    label:
      record.ID === 7
        ? 'Kilauea volcanic field'
        : rawCoordinates.length > 1
          ? `${record.Site_Name_EN} ${index + 1}`
          : record.Site_Name_EN,
    ...point,
    confidence: 'verified',
    note: 'Parsed from the verified source record',
  }))
  const manualLocations = (csvById.get(record.ID) ?? [])
    .filter(
      (location) =>
        !directLocations.some(
          ({ lat, lon }) =>
            Math.abs(lat - location.lat) < 0.005 && Math.abs(lon - location.lon) < 0.005,
        ),
    )
    .map(({ label, lat, lon, confidence, note }) => ({ label, lat, lon, confidence, note }))
  const locations = [...directLocations, ...manualLocations]
  if (!locations.length) {
    missingCoordinates.push(record.ID)
    locations.push({
      label: record.Site_Name_EN,
      lat: null,
      lon: null,
      confidence: 'missing',
      note: 'No coordinates supplied; shown in the list only',
    })
  }
  const targetBodies = targetBody(record.Target_Planetary_Body_and_Feature)
  if (targetBodies === 'unknown') missingTargets.push(record.ID)
  const textColumns = Object.values(record).join(' ')
  const tags = TAG_RULES.filter((rule) =>
    rule.patterns.some((pattern) => pattern.test(textColumns)),
  ).map(({ id }) => id)
  return analogSiteSchema.parse({
    id: record.ID,
    nameAr: record.Site_Name_AR,
    nameEn: record.Site_Name_EN,
    countryRegionAr: record.Country_Region,
    categoryAr: record.Analog_Category,
    geologyAr: record.Geology_Mineralogy_Geochemistry,
    environmentAr: record.Environment_Physics_Astrobiology,
    missionAr: record.Mission_Application_and_Instruments,
    source: record.Verified_Source,
    targetBodies,
    targetFeatureAr: record.Target_Planetary_Body_and_Feature,
    tags,
    locations,
    dimensionsAr: dimensionsWithoutCoordinates(record.Coordinates_Dimensions_Elevation),
  })
})

const filteredOut = source.filtered_out_sites
const provenance = {
  datasetTitle: source.metadata.dataset_title,
  counts: {
    original: source.metadata.total_original_records,
    verified: source.verified_sites.length,
    filteredOut: filteredOut.length,
  },
  filteredOutSites: filteredOut,
  structuralFixesApplied: source.metadata.structural_fixes_applied,
  scientificCorrectionsApplied: source.metadata.scientific_corrections_applied,
}
provenanceSchema.parse(provenance)
const validatedAnalogs = z.array(analogSiteSchema).parse(analogs)
const fieldNotes = z
  .array(fieldNoteSchema)
  .parse(
    parseFieldNotes(await readFile(fieldNotesPath, 'utf8'), new Set(analogs.map(({ id }) => id))),
  )
const airportsIndex = await loadAirportsIndex()
const siteLogistics = z.array(siteLogisticsSchema).parse(
  analogs.map((site) => {
    const location = site.locations.find(
      ({ lat, lon, confidence }) => lat !== null && lon !== null && confidence !== 'missing',
    )
    const nearest = location ? findNearestAirport(airportsIndex, location) : null
    return {
      siteId: site.id,
      nearestAirport: nearest
        ? {
            ...nearest.airport,
            distanceKm: Math.round(nearest.distanceKm * 10) / 10,
            locationConfidence: location.confidence,
          }
        : null,
    }
  }),
)

const tagCounts = TAG_RULES.map(({ id }) => ({
  tag: id,
  count: analogs.filter(({ tags }) => tags.includes(id)).length,
}))
const noTagRecords = analogs.filter(({ tags }) => tags.length === 0)
const report = [
  '# Planetary analog data report',
  '',
  `- Verified records: ${analogs.length}`,
  `- Filtered-out records: ${filteredOut.length}`,
  `- Missing targets: ${missingTargets.length ? missingTargets.join(', ') : 'none'}`,
  `- Missing coordinates: ${missingCoordinates.length ? missingCoordinates.join(', ') : 'none'}`,
  `- Duplicate IDs: ${duplicateIds.length ? duplicateIds.join(', ') : 'none'}`,
  '',
  '## Tag counts',
  '',
  '| Tag | Records |',
  '| --- | ---: |',
  ...tagCounts.map(({ tag, count }) => `| ${tag} | ${count} |`),
  '',
  '## Records with no tags',
  '',
  ...(noTagRecords.length
    ? noTagRecords.map(({ id, nameEn }) => `- ID ${id}: ${nameEn}`)
    : ['None']),
  '',
  '## Coordinate handling',
  '',
  'Coordinates parsed from source records are marked verified. Entries from `data-raw/coordinates.csv` remain approximate until reviewed; unlocated records remain list-only.',
  '',
  `- Field notes: ${fieldNotes.length} records; blank fields remain unverified.`,
  `- Airport distances: ${airportsIndex.available ? `computed from ${airportsIndex.airports.length} large/medium OurAirports records` : 'not computed; data-raw/airports.csv is missing'}.`,
  '',
]

await mkdir(outputPath, { recursive: true })
await Promise.all([
  writeFile(
    path.join(outputPath, 'analogs.json'),
    `${JSON.stringify(validatedAnalogs, null, 2)}\n`,
    'utf8',
  ),
  writeFile(
    path.join(outputPath, 'provenance.json'),
    `${JSON.stringify(provenance, null, 2)}\n`,
    'utf8',
  ),
  writeFile(
    path.join(outputPath, 'field-notes.json'),
    `${JSON.stringify(fieldNotes, null, 2)}\n`,
    'utf8',
  ),
  writeFile(
    path.join(outputPath, 'airports-index.json'),
    `${JSON.stringify(airportsIndex)}\n`,
    'utf8',
  ),
  writeFile(
    path.join(outputPath, 'site-logistics.json'),
    `${JSON.stringify(siteLogistics, null, 2)}\n`,
    'utf8',
  ),
  writeFile(path.join(root, 'data-report.md'), report.join('\n'), 'utf8'),
])

console.log(`Converted ${analogs.length} verified sites`)
console.log(`Missing targets: ${missingTargets.length ? missingTargets.join(', ') : 'none'}`)
console.log(
  `Missing coordinates: ${missingCoordinates.length ? missingCoordinates.join(', ') : 'none'}`,
)
console.log(`Duplicate IDs: ${duplicateIds.length ? duplicateIds.join(', ') : 'none'}`)
console.log(
  `Records with no tags: ${noTagRecords.length ? noTagRecords.map(({ id }) => id).join(', ') : 'none'}`,
)
