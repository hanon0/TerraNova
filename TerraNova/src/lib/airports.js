const EARTH_RADIUS_KM = 6371.0088
const KILOMETERS_PER_LATITUDE_DEGREE = 111.195

/**
 * @param {number} lat
 * @param {number} lon
 * @param {number} airportLat
 * @param {number} airportLon
 * @returns {number}
 */
export function haversineKm(lat, lon, airportLat, airportLon) {
  if (
    ![lat, lon, airportLat, airportLon].every((value) => Number.isFinite(value)) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180 ||
    Math.abs(airportLat) > 90 ||
    Math.abs(airportLon) > 180
  ) {
    return Number.POSITIVE_INFINITY
  }

  const radians = Math.PI / 180
  const lat1 = lat * radians
  const lat2 = airportLat * radians
  const latDelta = (airportLat - lat) * radians
  const lonDelta = (((((airportLon - lon) % 360) + 540) % 360) - 180) * radians
  const rawValue =
    Math.sin(latDelta / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) ** 2
  const value = Math.max(0, Math.min(1, rawValue))
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

/**
 * Finds the nearest airport by scanning latitude-indexed rows outward. Latitude
 * distance is a lower bound on great-circle distance, so the scan can stop
 * once all unvisited rows are farther away than the best candidate.
 * @param {import('./dataSchemas.js').AirportIndex} index
 * @param {{ lat: number|null, lon: number|null }} location
 * @returns {({ airport: import('./dataSchemas.js').Airport, distanceKm: number }|null)}
 */
export function findNearestAirport(index, location) {
  if (
    !index ||
    !index.available ||
    !location ||
    location.lat === null ||
    location.lon === null ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lon) ||
    Math.abs(location.lat) > 90 ||
    Math.abs(location.lon) > 180 ||
    index.airports.length === 0
  )
    return null

  const centerRow = Math.max(0, Math.min(179, Math.floor(location.lat + 90)))
  let best = null

  for (let radius = 0; radius <= 179; radius += 1) {
    const rows = radius === 0 ? [centerRow] : [centerRow - radius, centerRow + radius]
    for (const row of rows) {
      if (row < 0 || row > 179) continue
      for (const airportIndex of index.latitudeRows[String(row)] ?? []) {
        const airport = index.airports[airportIndex]
        if (!airport || !Number.isFinite(airport.lat) || !Number.isFinite(airport.lon)) continue
        const distanceKm = haversineKm(location.lat, location.lon, airport.lat, airport.lon)
        if (!best || distanceKm < best.distanceKm) best = { airport, distanceKm }
      }
    }

    if (best) {
      const northRow = centerRow + radius + 1
      const southRow = centerRow - radius - 1
      const northGap =
        northRow <= 179 ? Math.max(0, northRow - 90 - location.lat) : Number.POSITIVE_INFINITY
      const southGap =
        southRow >= 0 ? Math.max(0, location.lat - (southRow - 89)) : Number.POSITIVE_INFINITY
      if (Math.min(northGap, southGap) * KILOMETERS_PER_LATITUDE_DEGREE > best.distanceKm) break
    }
  }

  return best
}
