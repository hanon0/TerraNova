import { readinessThresholdSchema } from './dataSchemas.js'

const REQUIRED_SOURCES = [
  ['heat', 'maxApparentTemperatureC'],
  ['cold', 'minApparentTemperatureC'],
  ['wind', 'maxWindSpeedKmh'],
  ['wind', 'maxWindGustsKmh'],
  ['precipitation', 'maxPrecipitationMm'],
  ['uv', 'maxUvIndex'],
]

/**
 * @param {import('./dataSchemas.js').SiteWeather} weather
 * @param {import('./dataSchemas.js').ReadinessThresholds} thresholds
 * @returns {{ status: 'not_verified'|'review_required'|'no_threshold_reached', triggers: string[] }}
 */
export function evaluateReadiness(weather, thresholdInput) {
  const thresholds = readinessThresholdSchema.parse(thresholdInput)
  const configured = REQUIRED_SOURCES.every(
    ([group, key]) =>
      typeof thresholds[group][key] === 'number' && Boolean(thresholds[group].source),
  )
  if (!configured) return { status: 'not_verified', triggers: [] }

  const triggers = []
  if (weather.apparentTemperatureC >= thresholds.heat.maxApparentTemperatureC) triggers.push('heat')
  if (weather.apparentTemperatureC <= thresholds.cold.minApparentTemperatureC) triggers.push('cold')
  if (
    weather.windSpeedKmh >= thresholds.wind.maxWindSpeedKmh ||
    weather.windGustsKmh >= thresholds.wind.maxWindGustsKmh
  )
    triggers.push('wind')
  if (weather.precipitationMm >= thresholds.precipitation.maxPrecipitationMm)
    triggers.push('precipitation')
  if (weather.uvIndex >= thresholds.uv.maxUvIndex) triggers.push('uv')

  return {
    status: triggers.length ? 'review_required' : 'no_threshold_reached',
    triggers,
  }
}
