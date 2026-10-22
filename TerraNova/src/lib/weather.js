import { z } from 'zod'
import { weatherSchema } from './dataSchemas.js'

const CACHE_TTL_MS = 10 * 60 * 1000
const REQUEST_TIMEOUT_MS = 10_000
const RETRY_DELAY_MS = 400
const weatherCache = new Map()

const openMeteoSchema = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number().min(0).max(100),
    wind_speed_10m: z.number().nonnegative(),
    wind_gusts_10m: z.number().nonnegative(),
    precipitation: z.number().nonnegative(),
    uv_index: z.number().nonnegative(),
  }),
  daily: z.object({
    time: z.array(z.string()).min(1),
    temperature_2m_min: z.array(z.number()).min(1),
    temperature_2m_max: z.array(z.number()).min(1),
  }),
})

function normalizePayload(payload) {
  const parsed = openMeteoSchema.parse(payload)
  const { current, daily } = parsed
  const days = Math.min(
    daily.time.length,
    daily.temperature_2m_min.length,
    daily.temperature_2m_max.length,
  )
  return weatherSchema.parse({
    time: current.time,
    temperatureC: current.temperature_2m,
    apparentTemperatureC: current.apparent_temperature,
    humidityPercent: current.relative_humidity_2m,
    windSpeedKmh: current.wind_speed_10m,
    windGustsKmh: current.wind_gusts_10m,
    precipitationMm: current.precipitation,
    uvIndex: current.uv_index,
    daily: daily.time.slice(0, days).map((date, index) => ({
      date,
      minC: daily.temperature_2m_min[index],
      maxC: daily.temperature_2m_max[index],
    })),
  })
}

function makeUrl(location) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'wind_speed_10m',
      'wind_gusts_10m',
      'precipitation',
      'uv_index',
    ].join(','),
    daily: 'temperature_2m_min,temperature_2m_max',
    forecast_days: '7',
    timezone: 'auto',
  }).toString()
  return url
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @param {import('./dataSchemas.js').SiteLocation} location
 * @param {{ fetchImpl?: typeof fetch, now?: () => number, timeoutMs?: number, retries?: number, retryDelayMs?: number }} options
 * @returns {Promise<import('./dataSchemas.js').SiteWeather>}
 */
export async function getSiteWeather(location, options = {}) {
  if (
    !location ||
    location.confidence === 'missing' ||
    location.lat === null ||
    location.lon === null
  ) {
    throw new Error('Weather is unavailable because this site has no mapped coordinates.')
  }

  const {
    fetchImpl = fetch,
    now = Date.now,
    timeoutMs = REQUEST_TIMEOUT_MS,
    retries = 1,
    retryDelayMs = RETRY_DELAY_MS,
  } = options
  const key = `${location.lat.toFixed(4)},${location.lon.toFixed(4)}`
  const cached = weatherCache.get(key)
  if (cached && cached.expiresAt > now()) return cached.weather

  const url = makeUrl(location)
  let lastError
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    let timeoutId
    try {
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort()
          reject(new Error(`Weather request timed out after ${timeoutMs} ms.`))
        }, timeoutMs)
      })
      const response = await Promise.race([fetchImpl(url, { signal: controller.signal }), timeout])
      if (!response.ok) {
        throw new Error(`Weather service returned HTTP ${response.status}.`)
      }
      const weather = normalizePayload(await response.json())
      weatherCache.set(key, { expiresAt: now() + CACHE_TTL_MS, weather })
      return weather
    } catch (error) {
      lastError = error
      if (attempt < retries) await pause(retryDelayMs)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`Unable to load weather from Open-Meteo after retrying: ${reason}`, {
    cause: lastError,
  })
}

export function clearWeatherCache() {
  weatherCache.clear()
}

export const weatherCacheDurationMs = CACHE_TTL_MS
