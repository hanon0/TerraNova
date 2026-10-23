import { z } from 'zod'

/** @typedef {'verified'|'approximate'|'missing'} LocationConfidence */
/** @typedef {{ label: string, lat: number|null, lon: number|null, confidence: LocationConfidence, note: string }} SiteLocation */
/** @typedef {{ id: number, nameAr: string, nameEn: string, countryRegionAr: string, categoryAr: string, geologyAr: string, environmentAr: string, missionAr: string, source: string, targetBodies: 'moon'|'mars'|'both'|'unknown', targetFeatureAr: string, tags: string[], locations: SiteLocation[], dimensionsAr: string }} AnalogSite */
/** @typedef {{ body: 'moon'|'mars'|'both'|'unknown', weights: Record<string, number> }} TargetProfile */
/** @typedef {{ time: string, temperatureC: number, apparentTemperatureC: number, humidityPercent: number, windSpeedKmh: number, windGustsKmh: number, precipitationMm: number, uvIndex: number, daily: Array<{ date: string, minC: number, maxC: number }> }} SiteWeather */
/** @typedef {{ heat: { maxApparentTemperatureC: number|null, source: string|null }, cold: { minApparentTemperatureC: number|null, source: string|null }, wind: { maxWindSpeedKmh: number|null, maxWindGustsKmh: number|null, source: string|null }, precipitation: { maxPrecipitationMm: number|null, source: string|null }, uv: { maxUvIndex: number|null, source: string|null } }} ReadinessThresholds */
/** @typedef {{ siteId: number, permitsNotes: string|null, hazards: string|null, bestSeason: string|null, accessNotes: string|null, sourceUrl: string|null, lastVerified: string|null }} FieldNote */
/** @typedef {{ id: number, name: string, type: 'large_airport'|'medium_airport', municipality: string|null, isoCountry: string, lat: number, lon: number }} Airport */
/** @typedef {{ available: boolean, source: 'OurAirports', datasetUrl: string, airports: Airport[], latitudeRows: Record<string, number[]> }} AirportIndex */
/** @typedef {{ siteId: number, nearestAirport: (Airport & { distanceKm: number, locationConfidence: 'verified'|'approximate' })|null }} SiteLogistics */

export const siteLocationSchema = z.object({
  label: z.string().min(1),
  lat: z.number().min(-90).max(90).nullable(),
  lon: z.number().min(-180).max(180).nullable(),
  confidence: z.enum(['verified', 'approximate', 'missing']),
  note: z.string(),
})

export const analogSiteSchema = z.object({
  id: z.number().int().positive(),
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  countryRegionAr: z.string().min(1),
  categoryAr: z.string().min(1),
  geologyAr: z.string(),
  environmentAr: z.string(),
  missionAr: z.string(),
  source: z.string().min(1),
  targetBodies: z.enum(['moon', 'mars', 'both', 'unknown']),
  targetFeatureAr: z.string(),
  tags: z.array(z.string()),
  locations: z.array(siteLocationSchema).min(1),
  dimensionsAr: z.string(),
})

export const targetProfileSchema = z.object({
  body: z.enum(['moon', 'mars', 'both', 'unknown']),
  weights: z.record(z.string(), z.number().min(0).max(3)),
})

export const weatherSchema = z.object({
  time: z.string(),
  temperatureC: z.number(),
  apparentTemperatureC: z.number(),
  humidityPercent: z.number().min(0).max(100),
  windSpeedKmh: z.number().nonnegative(),
  windGustsKmh: z.number().nonnegative(),
  precipitationMm: z.number().nonnegative(),
  uvIndex: z.number().nonnegative(),
  daily: z.array(
    z.object({
      date: z.string(),
      minC: z.number(),
      maxC: z.number(),
    }),
  ),
})

export const readinessThresholdSchema = z.object({
  heat: z.object({
    maxApparentTemperatureC: z.number().nullable(),
    source: z.string().url().nullable(),
  }),
  cold: z.object({
    minApparentTemperatureC: z.number().nullable(),
    source: z.string().url().nullable(),
  }),
  wind: z.object({
    maxWindSpeedKmh: z.number().nonnegative().nullable(),
    maxWindGustsKmh: z.number().nonnegative().nullable(),
    source: z.string().url().nullable(),
  }),
  precipitation: z.object({
    maxPrecipitationMm: z.number().nonnegative().nullable(),
    source: z.string().url().nullable(),
  }),
  uv: z.object({
    maxUvIndex: z.number().nonnegative().nullable(),
    source: z.string().url().nullable(),
  }),
})

export const presetSchema = z.object({
  id: z.string().min(1),
  nameEn: z.string().min(1),
  nameAr: z.string().min(1),
  body: targetProfileSchema.shape.body,
  weights: targetProfileSchema.shape.weights,
})

export const provenanceSchema = z.object({
  datasetTitle: z.string(),
  counts: z.object({
    original: z.number().int().nonnegative(),
    verified: z.number().int().nonnegative(),
    filteredOut: z.number().int().nonnegative(),
  }),
  filteredOutSites: z.array(z.record(z.string(), z.unknown())),
  structuralFixesApplied: z.array(z.string()),
  scientificCorrectionsApplied: z.array(z.string()),
})

export const fieldNoteSchema = z.object({
  siteId: z.number().int().positive(),
  permitsNotes: z.string().nullable(),
  hazards: z.string().nullable(),
  bestSeason: z.string().nullable(),
  accessNotes: z.string().nullable(),
  sourceUrl: z.string().url().nullable(),
  lastVerified: z.iso.date().nullable(),
})

export const airportSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  type: z.enum(['large_airport', 'medium_airport']),
  municipality: z.string().nullable(),
  isoCountry: z.string().length(2),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
})

export const airportsIndexSchema = z.object({
  available: z.boolean(),
  source: z.literal('OurAirports'),
  datasetUrl: z.string().url(),
  airports: z.array(airportSchema),
  latitudeRows: z.record(z.string(), z.array(z.number().int().nonnegative())),
})

export const siteLogisticsSchema = z.object({
  siteId: z.number().int().positive(),
  nearestAirport: z
    .object({
      id: z.number().int().positive(),
      name: z.string().min(1),
      type: z.enum(['large_airport', 'medium_airport']),
      municipality: z.string().nullable(),
      isoCountry: z.string().length(2),
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      distanceKm: z.number().nonnegative(),
      locationConfidence: z.enum(['verified', 'approximate']),
    })
    .nullable(),
})
