import { useEffect, useState } from 'react'
import thresholdsData from './data/readiness-thresholds.json'
import { evaluateReadiness } from './lib/readiness.js'
import { readinessThresholdSchema } from './lib/dataSchemas.js'
import { getSiteWeather } from './lib/weather.js'
import './WeatherCard.css'

const thresholds = readinessThresholdSchema.parse(thresholdsData)

const WEATHER_COPY = {
  en: {
    title: 'Live weather',
    notVerified: 'Not yet verified',
    noLocation: 'Weather is unavailable until site coordinates are mapped.',
    offline: 'Weather unavailable',
    retry: 'Retry',
    loading: 'Loading current conditions and 7-day forecast',
    current: 'Current conditions',
    feels: 'Feels like',
    humidity: 'Humidity',
    wind: 'Wind',
    gusts: 'Gusts',
    rain: 'Precipitation',
    uv: 'UV index',
    forecast: '7-day temperature range',
    high: 'High',
    low: 'Low',
    celsius: '°C',
    fahrenheit: '°F',
    kmh: 'km/h',
    mph: 'mph',
    readiness: 'Field-readiness indicator',
    noGuarantee: 'Indicator only — not a safety guarantee.',
    waitingThresholds:
      'Not yet verified. Thresholds require approval and references from mission safety experts.',
    review: 'Expert review required',
    noTrigger: 'No configured review threshold exceeded; this does not indicate safe conditions.',
    thresholds: 'Review thresholds',
    heat: 'Heat',
    cold: 'Cold',
    windThreshold: 'Wind / gusts',
    rainThreshold: 'Precipitation',
    uvThreshold: 'UV',
    pending: 'Not yet verified',
    approximate: 'Approximate location',
    verified: 'Verified location',
  },
  ar: {
    title: 'الطقس الحالي',
    notVerified: 'لم يتم التحقق بعد',
    noLocation: 'الطقس غير متاح حتى تحديد إحداثيات الموقع.',
    offline: 'الطقس غير متاح',
    retry: 'إعادة المحاولة',
    loading: 'جارٍ تحميل الظروف الحالية وتوقعات 7 أيام',
    current: 'الظروف الحالية',
    feels: 'المحسوسة',
    humidity: 'الرطوبة',
    wind: 'الرياح',
    gusts: 'الهبات',
    rain: 'الهطول',
    uv: 'مؤشر UV',
    forecast: 'نطاق الحرارة لـ 7 أيام',
    high: 'العظمى',
    low: 'الصغرى',
    celsius: '°م',
    fahrenheit: '°ف',
    kmh: 'كم/س',
    mph: 'ميل/س',
    readiness: 'مؤشر الجاهزية الميدانية',
    noGuarantee: 'مؤشر استرشادي فقط — وليس ضماناً للسلامة.',
    waitingThresholds: 'لم يتم التحقق بعد. تتطلب العتبات اعتماداً ومراجع من خبراء سلامة المهمات.',
    review: 'تتطلب مراجعة خبير',
    noTrigger: 'لم تتجاوز الظروف عتبة مراجعة معتمدة؛ وهذا لا يعني أن الظروف آمنة.',
    thresholds: 'عتبات المراجعة',
    heat: 'الحرارة',
    cold: 'البرودة',
    windThreshold: 'الرياح / الهبات',
    rainThreshold: 'الهطول',
    uvThreshold: 'الأشعة فوق البنفسجية',
    pending: 'لم يتم التحقق بعد',
    approximate: 'موقع تقريبي',
    verified: 'موقع موثق',
  },
}

function primaryWeatherLocation(site) {
  return site.locations.find(
    (location) =>
      location.confidence !== 'missing' && location.lat !== null && location.lon !== null,
  )
}

function fahrenheit(celsius) {
  return (celsius * 9) / 5 + 32
}

function milesPerHour(kmh) {
  return kmh * 0.621371
}

/**
 * @param {{ site: import('./lib/dataSchemas.js').AnalogSite, language: 'en'|'ar' }} props
 */
export default function WeatherCard({ site, language }) {
  const text = WEATHER_COPY[language]
  const location = primaryWeatherLocation(site)
  const [request, setRequest] = useState({ key: '', status: 'loading', weather: null, error: '' })
  const [temperatureUnit, setTemperatureUnit] = useState('c')
  const [windUnit, setWindUnit] = useState('kmh')
  const [retryKey, setRetryKey] = useState(0)
  const requestKey = `${site.id}:${location?.lat ?? 'missing'}:${location?.lon ?? 'missing'}:${retryKey}`
  const currentRequest =
    request.key === requestKey
      ? request
      : { key: requestKey, status: location ? 'loading' : 'missing', weather: null, error: '' }

  useEffect(() => {
    if (!location) return undefined
    let active = true
    getSiteWeather(location)
      .then((data) => {
        if (!active) return
        setRequest({ key: requestKey, status: 'loaded', weather: data, error: '' })
      })
      .catch((requestError) => {
        if (!active) return
        setRequest({
          key: requestKey,
          status: 'error',
          weather: null,
          error: requestError instanceof Error ? requestError.message : String(requestError),
        })
      })
    return () => {
      active = false
    }
  }, [location, requestKey])

  function displayTemperature(value) {
    const temperature = temperatureUnit === 'c' ? value : fahrenheit(value)
    return `${temperature.toFixed(1)}${temperatureUnit === 'c' ? text.celsius : text.fahrenheit}`
  }

  function displayWind(value) {
    const speed = windUnit === 'kmh' ? value : milesPerHour(value)
    return `${speed.toFixed(1)} ${windUnit === 'kmh' ? text.kmh : text.mph}`
  }

  const readiness = currentRequest.weather
    ? evaluateReadiness(currentRequest.weather, thresholds)
    : null
  const thresholdRows = [
    ['heat', thresholds.heat.maxApparentTemperatureC],
    ['cold', thresholds.cold.minApparentTemperatureC],
    ['windThreshold', thresholds.wind.maxWindSpeedKmh],
    ['rainThreshold', thresholds.precipitation.maxPrecipitationMm],
    ['uvThreshold', thresholds.uv.maxUvIndex],
  ]

  return (
    <section className="weather-widget" aria-labelledby={`weather-title-${site.id}`}>
      <div className="weather-heading">
        <div>
          <a
            className="weather-provider eyebrow"
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
          >
            OPEN-METEO
          </a>
          <h3 id={`weather-title-${site.id}`}>{text.title}</h3>
        </div>
        <div className="unit-switches" aria-label="Weather units">
          <div role="group" aria-label="Temperature units">
            <button
              type="button"
              aria-pressed={temperatureUnit === 'c'}
              onClick={() => setTemperatureUnit('c')}
            >
              °C
            </button>
            <button
              type="button"
              aria-pressed={temperatureUnit === 'f'}
              onClick={() => setTemperatureUnit('f')}
            >
              °F
            </button>
          </div>
          <div role="group" aria-label="Wind speed units">
            <button
              type="button"
              aria-pressed={windUnit === 'kmh'}
              onClick={() => setWindUnit('kmh')}
            >
              km/h
            </button>
            <button
              type="button"
              aria-pressed={windUnit === 'mph'}
              onClick={() => setWindUnit('mph')}
            >
              mph
            </button>
          </div>
        </div>
      </div>

      {location && (
        <span className={`weather-location-badge ${location.confidence}`}>
          {location.confidence === 'approximate' ? text.approximate : text.verified}
          {` · ${location.label}`}
        </span>
      )}

      {currentRequest.status === 'loading' && (
        <div className="weather-skeleton" role="status" aria-label={text.loading}>
          <span />
          <span />
          <span />
          <span />
        </div>
      )}

      {currentRequest.status === 'missing' && (
        <div className="weather-state">
          <strong>{text.notVerified}</strong>
          <p>{text.noLocation}</p>
        </div>
      )}

      {currentRequest.status === 'error' && (
        <div className="weather-state error">
          <strong>{text.offline}</strong>
          <p>{currentRequest.error}</p>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)}>
            {text.retry}
          </button>
        </div>
      )}

      {currentRequest.status === 'loaded' && currentRequest.weather && (
        <>
          <p className="weather-subheading">{text.current}</p>
          <div className="weather-current">
            <strong>{displayTemperature(currentRequest.weather.temperatureC)}</strong>
            <span>
              {text.feels}: {displayTemperature(currentRequest.weather.apparentTemperatureC)}
            </span>
          </div>
          <div className="weather-metrics">
            <Metric label={text.humidity} value={`${currentRequest.weather.humidityPercent}%`} />
            <Metric label={text.wind} value={displayWind(currentRequest.weather.windSpeedKmh)} />
            <Metric label={text.gusts} value={displayWind(currentRequest.weather.windGustsKmh)} />
            <Metric
              label={text.rain}
              value={`${currentRequest.weather.precipitationMm.toFixed(1)} mm`}
            />
            <Metric label={text.uv} value={currentRequest.weather.uvIndex.toFixed(1)} />
          </div>
          <p className="weather-subheading">{text.forecast}</p>
          <div className="forecast-days">
            {currentRequest.weather.daily.map((day) => (
              <div className="forecast-day" key={day.date}>
                <span>
                  {new Intl.DateTimeFormat(language, { weekday: 'short' }).format(
                    new Date(`${day.date}T12:00:00`),
                  )}
                </span>
                <strong aria-label={`${text.high} ${displayTemperature(day.maxC)}`}>
                  ↑{displayTemperature(day.maxC)}
                </strong>
                <small aria-label={`${text.low} ${displayTemperature(day.minC)}`}>
                  ↓{displayTemperature(day.minC)}
                </small>
              </div>
            ))}
          </div>
          <div className={`readiness-indicator ${readiness.status}`}>
            <div className="readiness-title">
              <strong>{text.readiness}</strong>
              <span>
                {readiness.status === 'not_verified'
                  ? text.notVerified
                  : readiness.status === 'review_required'
                    ? text.review
                    : text.noTrigger}
              </span>
            </div>
            <p>{text.noGuarantee}</p>
            {readiness.status === 'not_verified' && <p>{text.waitingThresholds}</p>}
            <details>
              <summary>{text.thresholds}</summary>
              <ul>
                {thresholdRows.map(([key, value]) => (
                  <li key={key}>
                    <span>{text[key]}</span>
                    <span>{value === null ? text.pending : value}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </>
      )}
    </section>
  )
}

function Metric({ label, value }) {
  return (
    <div className="weather-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
