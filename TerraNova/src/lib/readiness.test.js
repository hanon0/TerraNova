import { describe, expect, it } from 'vitest'
import { evaluateReadiness } from './readiness.js'

const weather = {
  time: '2026-01-01T12:00',
  temperatureC: 20,
  apparentTemperatureC: 20,
  humidityPercent: 50,
  windSpeedKmh: 10,
  windGustsKmh: 15,
  precipitationMm: 0,
  uvIndex: 1,
  daily: [],
}

const approvedThresholds = {
  heat: { maxApparentTemperatureC: 40, source: 'https://example.test/heat' },
  cold: { minApparentTemperatureC: 0, source: 'https://example.test/cold' },
  wind: {
    maxWindSpeedKmh: 60,
    maxWindGustsKmh: 70,
    source: 'https://example.test/wind',
  },
  precipitation: { maxPrecipitationMm: 20, source: 'https://example.test/precipitation' },
  uv: { maxUvIndex: 8, source: 'https://example.test/uv' },
}

const unverifiedThresholds = {
  heat: { maxApparentTemperatureC: null, source: null },
  cold: { minApparentTemperatureC: null, source: null },
  wind: { maxWindSpeedKmh: null, maxWindGustsKmh: null, source: null },
  precipitation: { maxPrecipitationMm: null, source: null },
  uv: { maxUvIndex: null, source: null },
}

describe('evaluateReadiness', () => {
  it('never classifies readiness before every threshold and reference is verified', () => {
    expect(evaluateReadiness(weather, unverifiedThresholds)).toEqual({
      status: 'not_verified',
      triggers: [],
    })
  })

  it('returns a review request instead of a safety verdict when a threshold is reached', () => {
    expect(evaluateReadiness({ ...weather, apparentTemperatureC: 40 }, approvedThresholds)).toEqual(
      {
        status: 'review_required',
        triggers: ['heat'],
      },
    )
  })

  it('does not call conditions safe when no review threshold is reached', () => {
    expect(evaluateReadiness(weather, approvedThresholds)).toEqual({
      status: 'no_threshold_reached',
      triggers: [],
    })
  })
})
