import { describe, expect, it } from 'vitest'
import { findNearestAirport, haversineKm } from './airports.js'

function airport(id, lat, lon, name = `Airport ${id}`) {
  return {
    id,
    name,
    type: 'medium_airport',
    municipality: null,
    isoCountry: 'US',
    lat,
    lon,
  }
}

function makeIndex(airports) {
  const latitudeRows = {}
  airports.forEach((entry, index) => {
    const row = Math.max(0, Math.min(179, Math.floor(entry.lat + 90)))
    if (!latitudeRows[row]) latitudeRows[row] = []
    latitudeRows[row].push(index)
  })
  return {
    available: true,
    source: 'OurAirports',
    datasetUrl: 'https://ourairports.com/data/airports.csv',
    airports,
    latitudeRows,
  }
}

describe('nearest airport lookup', () => {
  it('finds the globally nearest airport using the latitude index', () => {
    const index = makeIndex([airport(1, 0, 90), airport(2, 10, 0, 'Nearest'), airport(3, -30, 0)])

    expect(findNearestAirport(index, { lat: 0, lon: 0 })).toEqual({
      airport: index.airports[1],
      distanceKm: expect.closeTo(1111.95, 0),
    })
  })

  it('handles longitude wraparound and computes haversine distance', () => {
    const index = makeIndex([airport(1, 10, -179, 'Across date line'), airport(2, 12, 179)])

    expect(findNearestAirport(index, { lat: 10, lon: 179 })?.airport.name).toBe('Across date line')
    expect(haversineKm(0, 0, 0, 1)).toBeCloseTo(111.195, 2)
  })

  it('agrees with a brute-force nearest search across varied latitudes', () => {
    let seed = 42
    const next = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    const airports = Array.from({ length: 250 }, (_, index) =>
      airport(index + 1, next() * 180 - 90, next() * 360 - 180),
    )
    const index = makeIndex(airports)
    const locations = [
      { lat: 89.5, lon: 179.8 },
      { lat: -89.5, lon: -179.8 },
      ...Array.from({ length: 20 }, () => ({
        lat: next() * 180 - 90,
        lon: next() * 360 - 180,
      })),
    ]

    for (const location of locations) {
      const expected = airports
        .map((entry) => ({
          airport: entry,
          distanceKm: haversineKm(location.lat, location.lon, entry.lat, entry.lon),
        }))
        .sort((first, second) => first.distanceKm - second.distanceKm)[0]
      const actual = findNearestAirport(index, location)
      expect(actual?.airport.id).toBe(expected.airport.id)
      expect(actual?.distanceKm).toBeCloseTo(expected.distanceKm, 8)
    }
  })

  it('does not report a distance when coordinates or the dataset are unavailable', () => {
    const index = makeIndex([airport(1, 0, 0)])
    expect(findNearestAirport(index, { lat: null, lon: null })).toBeNull()
    expect(findNearestAirport({ ...index, available: false }, { lat: 0, lon: 0 })).toBeNull()
  })

  it('ignores malformed airport coordinates instead of throwing or returning invalid distances', () => {
    const index = makeIndex([
      airport(1, 0, 0),
      { ...airport(2, NaN, 0, 'Broken'), lat: Number.NaN },
      { ...airport(3, 0, Number.NaN, 'Also broken'), lon: Number.NaN },
    ])

    expect(findNearestAirport(index, { lat: 0, lon: 0 })).toEqual({
      airport: index.airports[0],
      distanceKm: 0,
    })
    expect(haversineKm(NaN, 0, 0, 0)).toBe(Number.POSITIVE_INFINITY)
    expect(haversineKm(91, 0, 0, 0)).toBe(Number.POSITIVE_INFINITY)
  })
})
