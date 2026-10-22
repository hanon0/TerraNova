import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearWeatherCache, getSiteWeather, weatherCacheDurationMs } from './weather.js'

const location = {
  label: 'Test location',
  lat: 10,
  lon: 20,
  confidence: 'approximate',
  note: 'Test fixture',
}

function responsePayload() {
  const dates = Array.from({ length: 7 }, (_, index) => `2026-01-0${index + 1}`)
  return {
    current: {
      time: '2026-01-01T12:00',
      temperature_2m: 18,
      apparent_temperature: 19,
      relative_humidity_2m: 55,
      wind_speed_10m: 12,
      wind_gusts_10m: 18,
      precipitation: 0.2,
      uv_index: 2,
    },
    daily: {
      time: dates,
      temperature_2m_min: [1, 2, 3, 4, 5, 6, 7],
      temperature_2m_max: [11, 12, 13, 14, 15, 16, 17],
    },
  }
}

function okResponse(payload = responsePayload()) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  }
}

describe('getSiteWeather', () => {
  beforeEach(() => clearWeatherCache())

  it('normalizes current conditions and seven forecast days, then caches for ten minutes', async () => {
    const fetchImpl = vi.fn(async () => okResponse())
    const options = { fetchImpl, now: () => 100, timeoutMs: 100 }

    const first = await getSiteWeather(location, options)
    const second = await getSiteWeather(location, options)

    expect(first.temperatureC).toBe(18)
    expect(first.apparentTemperatureC).toBe(19)
    expect(first.daily).toHaveLength(7)
    expect(first.daily[6]).toEqual({ date: '2026-01-07', minC: 7, maxC: 17 })
    expect(second).toBe(first)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(weatherCacheDurationMs).toBe(600_000)
  })

  it('retries a service error and makes the failed attempt visible if retry fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(okResponse())

    const weather = await getSiteWeather(location, {
      fetchImpl,
      timeoutMs: 100,
      retries: 1,
      retryDelayMs: 0,
    })
    expect(weather.temperatureC).toBe(18)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('rejects missing coordinates and times out requests that do not resolve', async () => {
    await expect(getSiteWeather({ ...location, lat: null, confidence: 'missing' })).rejects.toThrow(
      'no mapped coordinates',
    )

    await expect(
      getSiteWeather(location, {
        fetchImpl: () => new Promise(() => {}),
        timeoutMs: 10,
        retries: 0,
      }),
    ).rejects.toThrow('after retrying')
  })
})
