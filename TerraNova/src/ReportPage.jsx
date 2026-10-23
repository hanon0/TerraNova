import { useEffect, useMemo, useState } from 'react'
import analogData from './data/analogs.json'
import fieldNotesData from './data/field-notes.json'
import readinessThresholdsData from './data/readiness-thresholds.json'
import siteLogisticsData from './data/site-logistics.json'
import { evaluateReadiness } from './lib/readiness.js'
import { getSiteWeather } from './lib/weather.js'
import { rankAnalogs } from './lib/similarity.js'
import { buildProposalSections, formatProposalMarkdown } from './lib/reports.js'
import {
  analogSiteSchema,
  fieldNoteSchema,
  presetSchema,
  readinessThresholdSchema,
  siteLogisticsSchema,
  targetProfileSchema,
} from './lib/dataSchemas.js'
import presetData from './data/presets.json'
import './ReportPage.css'

const analogs = analogSiteSchema.array().parse(analogData)
const fieldNotes = fieldNoteSchema.array().parse(fieldNotesData)
const readinessThresholds = readinessThresholdSchema.parse(readinessThresholdsData)
const siteLogistics = siteLogisticsSchema.array().parse(siteLogisticsData)
const presets = presetSchema.array().parse(presetData)

const TEXT = {
  en: {
    report: 'Site report',
    language: 'العربية',
    print: 'Print / Save as PDF',
    proposal: 'Project Proposal',
    editHelp: 'Edit this deterministic draft before printing or exporting.',
    exportMarkdown: 'Export Markdown',
    exportJson: 'Export JSON',
    reset: 'Reset from template',
    siteSummary: 'Site summary',
    region: 'Country / region',
    category: 'Analog category',
    targetFeature: 'Target feature',
    target: 'Target profile',
    score: 'Tag match score',
    matched: 'Matched tags',
    missing: 'Missing target tags',
    explanation: 'Match explanation',
    geology: 'Geology',
    environment: 'Environment',
    mission: 'Mission & instruments',
    weather: 'Weather snapshot',
    loading: 'Loading weather snapshot…',
    noLocation: 'Not yet verified: no mapped coordinates for weather.',
    weatherError: 'Weather snapshot unavailable',
    feels: 'Feels like',
    humidity: 'Humidity',
    wind: 'Wind',
    precipitation: 'Precipitation',
    uv: 'UV',
    forecast: '7-day forecast',
    readiness: 'Field-readiness indicator',
    notVerified: 'Not yet verified',
    reviewRequired: 'Expert review required',
    noThresholdReached: 'No configured review threshold reached',
    noSafety: 'Indicator only — not a safety guarantee.',
    logistics: 'Logistics',
    nearestAirport: 'Nearest large / medium airport',
    noAirport: 'Not yet verified; OurAirports data is not installed.',
    approximate: 'Approximate site location',
    risks: 'Environmental risk summary',
    hazards: 'Manual hazards',
    contact: 'Not yet verified, contact local authorities.',
    map: 'Static site map',
    mapNoCoordinates: 'Not yet verified: this site has no mapped coordinates.',
    sources: 'References',
    fieldNotes: 'Field notes',
    permits: 'Permits',
    bestSeason: 'Best season',
    access: 'Access notes',
    source: 'Source',
    lastVerified: 'Last verified',
    unverified: 'Not yet verified',
    notFound: 'Site not found in the verified dataset.',
    invalidProfile: 'The target profile in this report URL is invalid.',
    listOnly: 'List-only site',
  },
  ar: {
    report: 'تقرير الموقع',
    language: 'English',
    print: 'طباعة / حفظ PDF',
    proposal: 'مقترح مشروع',
    editHelp: 'حرر هذه المسودة المحددة القالب قبل الطباعة أو التصدير.',
    exportMarkdown: 'تصدير Markdown',
    exportJson: 'تصدير JSON',
    reset: 'استعادة القالب',
    siteSummary: 'ملخص الموقع',
    region: 'الدولة / المنطقة',
    category: 'فئة المحاكاة',
    targetFeature: 'ميزة الهدف',
    target: 'ملف الهدف',
    score: 'درجة تطابق الوسوم',
    matched: 'الوسوم المتطابقة',
    missing: 'وسوم الهدف غير المتطابقة',
    explanation: 'شرح المطابقة',
    geology: 'الجيولوجيا',
    environment: 'البيئة',
    mission: 'المهمة والأدوات',
    weather: 'ملخص الطقس',
    loading: 'جارٍ تحميل ملخص الطقس…',
    noLocation: 'لم يتم التحقق بعد: لا توجد إحداثيات محددة للطقس.',
    weatherError: 'ملخص الطقس غير متاح',
    feels: 'المحسوسة',
    humidity: 'الرطوبة',
    wind: 'الرياح',
    precipitation: 'الهطول',
    uv: 'مؤشر UV',
    forecast: 'توقعات 7 أيام',
    readiness: 'مؤشر الجاهزية الميدانية',
    notVerified: 'لم يتم التحقق بعد',
    reviewRequired: 'تتطلب مراجعة خبير',
    noThresholdReached: 'لم تتجاوز عتبات المراجعة المحددة',
    noSafety: 'مؤشر استرشادي فقط — وليس ضماناً للسلامة.',
    logistics: 'اللوجستيات',
    nearestAirport: 'أقرب مطار كبير أو متوسط',
    noAirport: 'لم يتم التحقق بعد؛ بيانات OurAirports غير مثبتة.',
    approximate: 'موقع تقريبي',
    risks: 'ملخص المخاطر البيئية',
    hazards: 'المخاطر اليدوية',
    contact: 'لم يتم التحقق بعد، يرجى التواصل مع السلطات المحلية.',
    map: 'خريطة الموقع الثابتة',
    mapNoCoordinates: 'لم يتم التحقق بعد: لا توجد إحداثيات محددة لهذا الموقع.',
    sources: 'المراجع',
    fieldNotes: 'ملاحظات ميدانية',
    permits: 'التصاريح',
    bestSeason: 'أفضل موسم',
    access: 'ملاحظات الوصول',
    source: 'المصدر',
    lastVerified: 'آخر تحقق',
    unverified: 'لم يتم التحقق بعد',
    notFound: 'الموقع غير موجود في مجموعة البيانات الموثقة.',
    invalidProfile: 'ملف الهدف في رابط التقرير غير صالح.',
    listOnly: 'موقع مدرج دون خريطة',
  },
}

function readProfile(search) {
  const params = new URLSearchParams(search)
  const preset = presets[0]
  let weights = preset.weights
  if (params.has('weights')) {
    try {
      weights = JSON.parse(params.get('weights'))
    } catch {
      return { error: true }
    }
  }
  const parsed = targetProfileSchema.safeParse({
    body: params.get('body') ?? preset.body,
    weights,
  })
  return parsed.success ? { profile: parsed.data } : { error: true }
}

function primaryLocation(site) {
  return site.locations.find(
    ({ lat, lon, confidence }) => lat !== null && lon !== null && confidence !== 'missing',
  )
}

function downloadFile(filename, content, mimeType) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function ReportPage({ siteId }) {
  const site = analogs.find(({ id }) => id === Number(siteId))
  const [language, setLanguage] = useState('en')
  const [proposalMode, setProposalMode] = useState(false)
  const [proposalDrafts, setProposalDrafts] = useState({ en: null, ar: null })
  const profileResult = readProfile(window.location.search)
  const profile = profileResult.profile
  const text = TEXT[language]
  const match =
    site && profile
      ? rankAnalogs(analogs, profile.weights, profile.body).find(
          ({ site: rankedSite }) => rankedSite.id === site.id,
        )
      : null
  const notes = fieldNotes.find(({ siteId: noteSiteId }) => noteSiteId === site?.id)
  const logistics = siteLogistics.find(({ siteId: logisticSiteId }) => logisticSiteId === site?.id)
  const location = site ? primaryLocation(site) : null
  const [weatherState, setWeatherState] = useState({
    status: location ? 'loading' : 'missing',
    weather: null,
    error: '',
  })

  useEffect(() => {
    if (!location) return undefined
    let active = true
    getSiteWeather(location)
      .then((weather) => {
        if (active) setWeatherState({ status: 'loaded', weather, error: '' })
      })
      .catch((error) => {
        if (active)
          setWeatherState({
            status: 'error',
            weather: null,
            error: error instanceof Error ? error.message : String(error),
          })
      })
    return () => {
      active = false
    }
  }, [location])

  const readiness = weatherState.weather
    ? evaluateReadiness(weatherState.weather, readinessThresholds)
    : null
  const proposal = useMemo(
    () =>
      site && match && notes && logistics
        ? buildProposalSections({ site, match, fieldNotes: notes, logistics, language })
        : null,
    [site, match, notes, logistics, language],
  )
  const templateMarkdown = proposal ? formatProposalMarkdown(proposal) : ''
  const proposalMarkdown = proposalDrafts[language] ?? templateMarkdown
  const bodyLabel = {
    moon: language === 'ar' ? 'القمر' : 'Moon',
    mars: language === 'ar' ? 'المريخ' : 'Mars',
    both: language === 'ar' ? 'كلاهما' : 'Both',
    unknown: text.notVerified,
  }[profile?.body ?? 'unknown']

  if (!site) {
    return <main className="report-error">{TEXT[language].notFound}</main>
  }
  if (!profile) {
    return <main className="report-error">{TEXT[language].invalidProfile}</main>
  }

  function setDraft(value) {
    setProposalDrafts((current) => ({ ...current, [language]: value }))
  }

  function saveMarkdown() {
    downloadFile(
      `terranova-proposal-${site.id}.md`,
      proposalMarkdown,
      'text/markdown;charset=utf-8',
    )
  }

  function saveJson() {
    downloadFile(
      `terranova-proposal-${site.id}.json`,
      JSON.stringify(
        {
          siteId: site.id,
          targetProfile: profile,
          score: match.score,
          proposalMarkdown,
          references: [site.source],
        },
        null,
        2,
      ),
      'application/json;charset=utf-8',
    )
  }

  return (
    <main
      className={`report-page ${proposalMode ? 'proposal-mode' : ''}`}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="report-toolbar">
        <a className="report-back" href="/">
          TerraNova
        </a>
        <div className="report-actions">
          <button
            type="button"
            className="report-action"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          >
            {text.language}
          </button>
          <button
            type="button"
            className="report-action"
            onClick={() => setProposalMode(!proposalMode)}
          >
            {proposalMode ? text.report : text.proposal}
          </button>
          {proposalMode ? (
            <>
              <button
                type="button"
                className="report-action"
                onClick={() => setDraft(templateMarkdown)}
              >
                {text.reset}
              </button>
              <button type="button" className="report-action" onClick={saveMarkdown}>
                {text.exportMarkdown}
              </button>
              <button type="button" className="report-action" onClick={saveJson}>
                {text.exportJson}
              </button>
            </>
          ) : (
            <button type="button" className="report-action primary" onClick={() => window.print()}>
              {text.print}
            </button>
          )}
        </div>
      </div>

      <header className="report-header">
        <img src="/terranovalogo.jpeg" alt="TerraNova planetary analog explorer logo" />
        <div>
          <p className="eyebrow">TERRANOVA / FIELD REPORT</p>
          <h1>{language === 'ar' ? site.nameAr : site.nameEn}</h1>
          <p>{site.countryRegionAr}</p>
        </div>
        <span className="report-score">{match.score}%</span>
      </header>

      {proposalMode ? (
        <section className="proposal-editor">
          <p className="eyebrow">TERRANOVA / PROJECT PROPOSAL</p>
          <h2>{text.proposal}</h2>
          <p>{text.editHelp}</p>
          <textarea
            aria-label={text.proposal}
            value={proposalMarkdown}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck="false"
          />
          <pre className="proposal-print-copy">{proposalMarkdown}</pre>
        </section>
      ) : (
        <div className="report-content">
          <ReportSection title={text.siteSummary}>
            <p>
              {text.region}: {site.countryRegionAr}
            </p>
            <p>
              {text.category}: {site.categoryAr}
            </p>
            <p>
              {text.targetFeature}: {site.targetFeatureAr || text.notVerified}
            </p>
          </ReportSection>
          <ReportSection title={text.target}>
            <p>
              {bodyLabel} ·{' '}
              {Object.entries(profile.weights)
                .map(([tag, weight]) => `${tag} × ${weight}`)
                .join(', ') || '—'}
            </p>
            <h3>
              {text.score}: {match.score}%
            </h3>
            <p>{language === 'ar' ? match.explanationAr : match.explanationEn}</p>
            <TagList title={text.matched} tags={match.matchedTags} />
            <TagList title={text.missing} tags={match.missingTags} />
          </ReportSection>

          <ReportSection title={text.geology}>
            <p>{site.geologyAr || text.notVerified}</p>
          </ReportSection>
          <ReportSection title={text.environment}>
            <p>{site.environmentAr || text.notVerified}</p>
          </ReportSection>
          <ReportSection title={text.mission}>
            <p>{site.missionAr || text.notVerified}</p>
          </ReportSection>

          <ReportSection title={text.weather}>
            {weatherState.status === 'loading' && <p>{text.loading}</p>}
            {weatherState.status === 'missing' && <p>{text.noLocation}</p>}
            {weatherState.status === 'error' && (
              <p className="report-unverified">
                {text.weatherError}: {weatherState.error}
              </p>
            )}
            {weatherState.weather && (
              <>
                {location?.confidence === 'approximate' && (
                  <p className="report-unverified">{text.approximate}</p>
                )}
                <p>
                  {weatherState.weather.time} · {weatherState.weather.temperatureC}°C
                  {' · '}
                  {text.readiness}:{' '}
                  {readiness?.status === 'review_required'
                    ? text.reviewRequired
                    : readiness?.status === 'no_threshold_reached'
                      ? text.noThresholdReached
                      : text.notVerified}
                </p>
                <p>
                  {text.feels} {weatherState.weather.apparentTemperatureC}°C ·{' '}
                  {weatherState.weather.humidityPercent}% {text.humidity} ·{' '}
                  {weatherState.weather.windSpeedKmh} km/h {text.wind} ·{' '}
                  {weatherState.weather.precipitationMm} mm {text.precipitation} · {text.uv}{' '}
                  {weatherState.weather.uvIndex}
                </p>
                <p>
                  {text.forecast}:{' '}
                  {weatherState.weather.daily
                    .map(({ date, minC, maxC }) => `${date}: ${minC}–${maxC}°C`)
                    .join(' · ')}
                </p>
              </>
            )}
            <p className="report-caveat">{text.noSafety}</p>
          </ReportSection>

          <ReportSection title={text.logistics}>
            <p>{text.nearestAirport}</p>
            {logistics?.nearestAirport ? (
              <p>
                {logistics.nearestAirport.name} · {logistics.nearestAirport.distanceKm} km
                {logistics.nearestAirport.locationConfidence === 'approximate' && (
                  <span className="report-unverified"> · {text.approximate}</span>
                )}
              </p>
            ) : (
              <p className="report-unverified">{text.noAirport}</p>
            )}
            <p>
              {text.permits}: {notes?.permitsNotes ?? text.unverified}
            </p>
            <p>
              {text.bestSeason}: {notes?.bestSeason ?? text.unverified}
            </p>
            <p>
              {text.access}: {notes?.accessNotes ?? text.unverified}
            </p>
            {notes?.sourceUrl && (
              <p>
                {text.source}: {notes.sourceUrl}
              </p>
            )}
            {notes?.lastVerified && (
              <p>
                {text.lastVerified}: {notes.lastVerified}
              </p>
            )}
          </ReportSection>

          <ReportSection title={text.risks}>
            <p>
              {text.hazards}: {notes?.hazards ?? text.contact}
            </p>
            <p>
              {text.readiness}:{' '}
              {readiness?.status === 'review_required'
                ? text.reviewRequired
                : readiness?.status === 'no_threshold_reached'
                  ? text.noThresholdReached
                  : text.notVerified}
            </p>
            <p className="report-caveat">{text.noSafety}</p>
          </ReportSection>

          <ReportSection title={text.map}>
            <StaticSiteMap site={site} language={language} />
            {!location && <p className="report-unverified">{text.mapNoCoordinates}</p>}
            {location?.confidence === 'approximate' && (
              <p className="report-unverified">{text.approximate}</p>
            )}
          </ReportSection>

          <ReportSection title={text.sources}>
            <ol>
              <li>{site.source}</li>
            </ol>
          </ReportSection>
        </div>
      )}
    </main>
  )
}

function ReportSection({ title, children }) {
  return (
    <section className="report-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function TagList({ title, tags }) {
  return (
    <div className="report-tag-group">
      <h3>{title}</h3>
      <p>{tags.length ? tags.join(', ') : '—'}</p>
    </div>
  )
}

function StaticSiteMap({ site, language }) {
  const locations = site.locations.filter(({ lat, lon }) => lat !== null && lon !== null)
  return (
    <figure className="report-map-figure">
      <svg
        viewBox="0 0 720 320"
        role="img"
        aria-label={`${language === 'ar' ? 'خريطة ثابتة لـ' : 'Static map of '}${site.nameEn}`}
      >
        <rect width="720" height="320" fill="#e8eee9" />
        {[1, 2, 3, 4, 5].map((line) => (
          <line key={`h${line}`} x1="0" x2="720" y1={line * 53.3} y2={line * 53.3} />
        ))}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((line) => (
          <line key={`v${line}`} y1="0" y2="320" x1={line * 60} x2={line * 60} />
        ))}
        <g className="report-land">
          <path d="M52 68 85 46 135 42 171 58 190 86 171 106 145 112 134 136 105 143 88 124 63 118Z" />
          <path d="m168 157 31 13 13 30-9 33-12 38-15-30-6-38-14-22Z" />
          <path d="m339 73 29-17 25 12-7 21-29 8Z" />
          <path d="m374 103 42-3 31 18 9 35-20 38-16 41-21-12-10-39-21-33-9-29Z" />
          <path d="m437 63 52-21 60 7 41 20 42 2 30 23-24 20-38 1-24 19-32-11-20 21-36-18-32-3-28-20Z" />
          <path d="m562 155 38-11 38 11 23 26-14 29-33 10-27-18-25-22Z" />
        </g>
        {locations.map(({ lat, lon, label }, index) => (
          <g key={`${label}-${index}`}>
            <circle cx={((lon + 180) / 360) * 720} cy={((90 - lat) / 180) * 320} r="8" />
            <title>{label}</title>
          </g>
        ))}
      </svg>
      <figcaption>
        {locations.length ? locations.map(({ label }) => label).join(' · ') : '—'}
      </figcaption>
    </figure>
  )
}
