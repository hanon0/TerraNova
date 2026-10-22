import { useEffect, useMemo, useRef, useState } from 'react'
import analogData from './data/analogs.json'
import presetData from './data/presets.json'
import provenanceData from './data/provenance.json'
import { rankAnalogs } from './lib/similarity.js'
import { analogSiteSchema, presetSchema, provenanceSchema } from './lib/dataSchemas.js'
import './App.css'

const analogs = analogSiteSchema.array().parse(analogData)
const presets = presetSchema.array().parse(presetData)
const provenance = provenanceSchema.parse(provenanceData)

const TAGS = [
  ['lava_tube', 'Lava tubes', 'أنابيب الحمم'],
  ['impact_crater', 'Impact craters', 'فوهات تصادمية'],
  ['anorthosite', 'Anorthosite', 'أنورثوزيت'],
  ['basalt_volcanic', 'Basalt & volcanism', 'بازلت وبراكين'],
  ['evaporite_salt', 'Evaporites & salt', 'متبخرات وأملاح'],
  ['aeolian_yardang', 'Aeolian / yardang', 'تعرية ريحية وياردانغ'],
  ['polar_permafrost', 'Polar & permafrost', 'قطبي وتربة صقيعية'],
  ['hydrothermal', 'Hydrothermal', 'حراري مائي'],
  ['paleolake_fluvial', 'Paleolake & fluvial', 'بحيرات وأنظمة نهرية قديمة'],
  ['sand_dunes', 'Sand dunes', 'كثبان رملية'],
  ['cave_karst', 'Caves & karst', 'كهوف وكارست'],
  ['glacial_ice', 'Glacial ice', 'جليد وأنهار جليدية'],
  ['silica_rocks', 'Silica rocks', 'صخور السيليكا'],
  ['hydrogen_sulfide', 'Sulfur & sulfates', 'كبريت وكبريتات'],
  ['high_altitude', 'High altitude', 'ارتفاعات عالية'],
  ['meteorite_analog', 'Meteorites', 'نيازك'],
  ['ancient_terrain', 'Ancient terrain', 'تضاريس قديمة'],
  ['astrobiology', 'Astrobiology', 'أحياء فلكية'],
]

const COPY = {
  en: {
    explorer: 'Explorer',
    methodology: 'Methodology',
    body: 'Target body',
    moon: 'Moon',
    mars: 'Mars',
    both: 'Both',
    preset: 'Start with a profile',
    characteristics: 'Target characteristics',
    filters: 'Filters',
    category: 'Category',
    country: 'Country / region',
    confidence: 'Location confidence',
    all: 'All',
    verified: 'Verified',
    approximate: 'Approximate',
    missing: 'Missing',
    results: 'Matching sites',
    clear: 'Clear profile',
    area: 'Draw an area',
    stopDraw: 'Cancel drawing',
    mapTitle: 'Global analog field sites',
    mapHint: 'Select a marker to inspect a site. Drag on the map to draw an area.',
    approximateBadge: 'Approximate location',
    verifiedBadge: 'Verified location',
    noMap: 'No mapped location',
    match: 'Tag match',
    matched: 'Matched',
    notMatched: 'Missing target tags',
    mission: 'Mission & instruments',
    source: 'Verified source',
    score: 'Match score',
    inside: 'Sites in selected area',
    common: 'Most common tags',
    average: 'Average match score',
    areaHelp: 'Drag across the map to define an area of interest.',
    methodologyTitle: 'Methodology & data quality',
    dataQuality: 'Data quality & corrections',
    verifiedRecords: 'Verified records',
    filteredRecords: 'Filtered out',
    structural: 'Structural fixes',
    scientific: 'Scientific corrections',
    scoring: 'How matching works',
    scoringBody:
      'Scores use a weighted Jaccard similarity between the target profile and each site’s tags. A matching target body adds up to 5 points. No numeric geology or environmental features are invented.',
    locationNote:
      'Only coordinates explicitly present in the source are marked verified. Other mapped points are best-effort estimates from the review CSV; unmapped sites remain in the results list.',
    zeroResults: 'No sites match these filters.',
    tagsSelected: 'selected',
    noTags: 'Choose characteristics or a preset to build a target profile.',
    target: 'Target profile',
    language: 'العربية',
    openSource: 'Open citation',
    locations: 'mapped locations',
    mobileMap: 'Map',
    mobileFilters: 'Filters',
    mobileSites: 'Sites',
    togglePanel: 'Toggle filters panel',
  },
  ar: {
    explorer: 'المستكشف',
    methodology: 'المنهجية',
    body: 'الجرم المستهدف',
    moon: 'القمر',
    mars: 'المريخ',
    both: 'كلاهما',
    preset: 'اختر ملفاً جاهزاً',
    characteristics: 'خصائص الهدف',
    filters: 'عوامل التصفية',
    category: 'الفئة',
    country: 'الدولة / المنطقة',
    confidence: 'موثوقية الموقع',
    all: 'الكل',
    verified: 'موثق',
    approximate: 'تقريبي',
    missing: 'مفقود',
    results: 'المواقع المطابقة',
    clear: 'مسح الملف',
    area: 'ارسم منطقة',
    stopDraw: 'إلغاء الرسم',
    mapTitle: 'مواقع المحاكاة الكوكبية حول العالم',
    mapHint: 'اختر علامة لعرض الموقع. اسحب على الخريطة لرسم منطقة.',
    approximateBadge: 'موقع تقريبي',
    verifiedBadge: 'موقع موثق',
    noMap: 'لا يوجد موقع على الخريطة',
    match: 'تطابق الخصائص',
    matched: 'متطابقة',
    notMatched: 'خصائص الهدف غير المتطابقة',
    mission: 'المهمة والأدوات',
    source: 'المصدر الموثق',
    score: 'درجة التطابق',
    inside: 'المواقع داخل المنطقة',
    common: 'أكثر الخصائص شيوعاً',
    average: 'متوسط درجة التطابق',
    areaHelp: 'اسحب على الخريطة لتحديد منطقة الاهتمام.',
    methodologyTitle: 'المنهجية وجودة البيانات',
    dataQuality: 'جودة البيانات والتصحيحات',
    verifiedRecords: 'السجلات الموثقة',
    filteredRecords: 'المستبعدة',
    structural: 'الإصلاحات البنيوية',
    scientific: 'التصحيحات العلمية',
    scoring: 'آلية المطابقة',
    scoringBody:
      'تستخدم الدرجات تشابهاً موزوناً وفق معامل جاكارد بين ملف الهدف وخصائص كل موقع. يضيف تطابق الجرم المستهدف ما يصل إلى 5 نقاط. لا تُختلق خصائص جيولوجية أو بيئية رقمية.',
    locationNote:
      'تُعد الإحداثيات الموجودة صراحةً في المصدر موثقة فقط. أما المواقع الأخرى المرسومة فهي تقديرات أولية في ملف المراجعة؛ وتبقى المواقع غير المحددة في قائمة النتائج.',
    zeroResults: 'لا توجد مواقع تطابق عوامل التصفية.',
    tagsSelected: 'مختارة',
    noTags: 'اختر خصائص أو ملفاً جاهزاً لبناء ملف الهدف.',
    target: 'ملف الهدف',
    language: 'English',
    openSource: 'عرض المرجع',
    locations: 'مواقع محددة',
    mobileMap: 'الخريطة',
    mobileFilters: 'التصفية',
    mobileSites: 'المواقع',
    togglePanel: 'إظهار عوامل التصفية',
  },
}

function locationConfidence(site) {
  if (site.locations.some(({ confidence }) => confidence === 'approximate')) return 'approximate'
  if (site.locations.some(({ confidence }) => confidence === 'verified')) return 'verified'
  return 'missing'
}

function getCountry(site) {
  return site.countryRegionAr.split(/[—–-]/)[0].trim()
}

function project(location) {
  return {
    x: ((location.lon + 180) / 360) * 900,
    y: ((90 - location.lat) / 180) * 420,
  }
}

function App() {
  const [isInitializing, setIsInitializing] = useState(true)
  const [language, setLanguage] = useState('en')
  const [page, setPage] = useState('explorer')
  const [body, setBody] = useState('moon')
  const [weights, setWeights] = useState(presets[0].weights)
  const [activePreset, setActivePreset] = useState(presets[0].id)
  const [selectedId, setSelectedId] = useState(analogs[0]?.id)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [confidenceFilter, setConfidenceFilter] = useState('all')
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState(null)
  const [drawArea, setDrawArea] = useState(null)
  const [areaSites, setAreaSites] = useState([])
  const [mobilePanel, setMobilePanel] = useState('map')
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true)
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 })
  const mapCanvasRef = useRef(null)
  const t = COPY[language]

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsInitializing(false), 500)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    const element = mapCanvasRef.current
    if (!element) return undefined
    const updateSize = () => {
      const bounds = element.getBoundingClientRect()
      setMapDimensions({ width: Math.round(bounds.width), height: Math.round(bounds.height) })
    }
    updateSize()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [page])

  const ranked = useMemo(() => rankAnalogs(analogs, weights, body), [weights, body])
  const filtered = useMemo(
    () =>
      ranked.filter(
        ({ site }) =>
          (categoryFilter === 'all' || site.categoryAr === categoryFilter) &&
          (countryFilter === 'all' || getCountry(site) === countryFilter) &&
          (confidenceFilter === 'all' ||
            site.locations.some(({ confidence }) => confidence === confidenceFilter)),
      ),
    [ranked, categoryFilter, countryFilter, confidenceFilter],
  )
  const selectedMatch = filtered.find(({ site }) => site.id === selectedId) ?? filtered[0]
  const categories = [...new Set(analogs.map(({ categoryAr }) => categoryAr))].sort()
  const countries = [...new Set(analogs.map(getCountry))].sort()
  const tagNames = new Map(TAGS.map(([id, en, ar]) => [id, language === 'ar' ? ar : en]))
  const selectedSite = selectedMatch?.site

  function applyPreset(presetId) {
    setActivePreset(presetId)
    const preset = presets.find(({ id }) => id === presetId)
    if (!preset) return
    setBody(preset.body)
    setWeights(preset.weights)
  }

  function setWeight(tag, value) {
    const nextWeight = Number(value)
    setWeights((current) => {
      const next = { ...current }
      if (nextWeight === 0) delete next[tag]
      else next[tag] = nextWeight
      return next
    })
    setActivePreset('')
  }

  function eventPoint(event) {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 900,
      y: ((event.clientY - bounds.top) / bounds.height) * 420,
    }
  }

  function beginDrawing(event) {
    if (!isDrawing) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = eventPoint(event)
    setDrawStart(point)
    setDrawArea({ x: point.x, y: point.y, width: 0, height: 0 })
  }

  function updateDrawing(event) {
    if (!drawStart) return
    const point = eventPoint(event)
    const area = {
      x: Math.min(drawStart.x, point.x),
      y: Math.min(drawStart.y, point.y),
      width: Math.abs(point.x - drawStart.x),
      height: Math.abs(point.y - drawStart.y),
    }
    setDrawArea(area)
    const inside = ranked.filter(({ site }) =>
      site.locations.some((location) => {
        if (location.lat === null || location.lon === null) return false
        const projected = project(location)
        return (
          projected.x >= area.x &&
          projected.x <= area.x + area.width &&
          projected.y >= area.y &&
          projected.y <= area.y + area.height
        )
      }),
    )
    setAreaSites(inside)
  }

  function finishDrawing() {
    setDrawStart(null)
  }

  const commonAreaTags = Object.entries(
    areaSites
      .flatMap(({ site }) => site.tags)
      .reduce((counts, tag) => {
        counts[tag] = (counts[tag] ?? 0) + 1
        return counts
      }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const averageAreaScore = areaSites.length
    ? Math.round(areaSites.reduce((total, result) => total + result.score, 0) / areaSites.length)
    : 0

  return (
    <div className="app-shell" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {isInitializing && (
        <div className="brand-loader" role="status" aria-live="polite">
          <img src="/terranovalogo.jpeg" alt="TerraNova planetary analog explorer" />
          <span className="loader-orbit" aria-hidden="true" />
          <p>INITIALIZING FIELD ATLAS</p>
        </div>
      )}
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setPage('explorer')}>
          <img className="brand-logo" src="/terranovalogo.jpeg" alt="TerraNova logo" />
          <span className="brand-wordmark">
            <strong>TerraNova</strong>
            <small>PLANETARY ANALOGS</small>
          </span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={page === 'explorer' ? 'nav-link active' : 'nav-link'}
            onClick={() => setPage('explorer')}
          >
            {t.explorer}
          </button>
          <button
            className={page === 'methodology' ? 'nav-link active' : 'nav-link'}
            onClick={() => setPage('methodology')}
          >
            {t.methodology}
          </button>
        </nav>
        <div className="top-actions">
          <span className="dataset-status">
            <span /> {analogs.length} {t.verifiedRecords.toLowerCase()}
          </span>
          <button
            className="language-button"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            aria-label="Toggle language"
          >
            {t.language}
          </button>
        </div>
      </header>

      {page === 'methodology' ? (
        <main className="methodology-page">
          <div className="page-heading">
            <p className="eyebrow">TERRANOVA / DATA</p>
            <h1>{t.methodologyTitle}</h1>
            <p>{t.locationNote}</p>
          </div>
          <section className="quality-card">
            <div className="quality-stats">
              <div>
                <strong>{provenance.counts.verified}</strong>
                <span>{t.verifiedRecords}</span>
              </div>
              <div>
                <strong>{provenance.counts.filteredOut}</strong>
                <span>{t.filteredRecords}</span>
              </div>
              <div>
                <strong>
                  {provenance.structuralFixesApplied.length +
                    provenance.scientificCorrectionsApplied.length}
                </strong>
                <span>{t.dataQuality}</span>
              </div>
            </div>
            <h2>{t.dataQuality}</h2>
            <p>{provenance.datasetTitle}</p>
            <div className="correction-columns">
              <CorrectionList title={t.structural} rows={provenance.structuralFixesApplied} />
              <CorrectionList title={t.scientific} rows={provenance.scientificCorrectionsApplied} />
            </div>
            <CorrectionList
              title={t.filteredRecords}
              rows={provenance.filteredOutSites.map(
                (site) => `ID ${site.ID}: ${site.Site_Name_AR ?? site.Site_Name_EN ?? ''}`,
              )}
            />
          </section>
          <section className="scoring-card">
            <p className="eyebrow">TAG-BASED SCORING</p>
            <h2>{t.scoring}</h2>
            <p>{t.scoringBody}</p>
            <div className="formula">
              <span>weighted Jaccard</span>
              <b>+</b>
              <span>target-body bonus</span>
              <b>=</b>
              <span>match score</span>
            </div>
          </section>
        </main>
      ) : (
        <>
          <nav className="mobile-panel-tabs" aria-label="Explorer panels">
            <button
              type="button"
              aria-pressed={mobilePanel === 'map'}
              onClick={() => setMobilePanel('map')}
            >
              {t.mobileMap}
            </button>
            <button
              type="button"
              aria-pressed={mobilePanel === 'controls'}
              onClick={() => setMobilePanel('controls')}
            >
              {t.mobileFilters}
            </button>
            <button
              type="button"
              aria-pressed={mobilePanel === 'results'}
              onClick={() => setMobilePanel('results')}
            >
              {t.mobileSites}
            </button>
            <button type="button" onClick={() => setPage('methodology')}>
              {t.methodology}
            </button>
          </nav>
          <main
            className={`workspace mobile-panel-${mobilePanel} ${isSidePanelOpen ? '' : 'sidebar-collapsed'}`}
          >
            <aside className="control-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">MISSION PLANNER</p>
                  <h1>{t.target}</h1>
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    setWeights({})
                    setActivePreset('')
                  }}
                >
                  {t.clear}
                </button>
              </div>

              <section className="control-section">
                <h2>{t.body}</h2>
                <div className="segmented-control">
                  {['moon', 'mars', 'both'].map((value) => (
                    <button
                      key={value}
                      className={body === value ? 'selected' : ''}
                      onClick={() => {
                        setBody(value)
                        setActivePreset('')
                      }}
                    >
                      {t[value]}
                    </button>
                  ))}
                </div>
              </section>

              <section className="control-section">
                <label className="field-label" htmlFor="preset-select">
                  {t.preset}
                </label>
                <select
                  id="preset-select"
                  value={activePreset}
                  onChange={(event) => applyPreset(event.target.value)}
                >
                  <option value="">—</option>
                  {presets.map(({ id, nameEn, nameAr }) => (
                    <option key={id} value={id}>
                      {language === 'ar' ? nameAr : nameEn}
                    </option>
                  ))}
                </select>
              </section>

              <section className="control-section">
                <div className="section-title">
                  <h2>{t.characteristics}</h2>
                  <span className="count-pill">
                    {Object.keys(weights).length} {t.tagsSelected}
                  </span>
                </div>
                {Object.keys(weights).length === 0 && <p className="helper-text">{t.noTags}</p>}
                <div className="tag-controls">
                  {TAGS.map(([id, en, ar]) => {
                    const weight = weights[id] ?? 0
                    return (
                      <div className={`tag-control ${weight ? 'enabled' : ''}`} key={id}>
                        <label htmlFor={`tag-${id}`}>{language === 'ar' ? ar : en}</label>
                        <div className="weight-control">
                          <input
                            id={`tag-${id}`}
                            type="range"
                            min="0"
                            max="3"
                            step="1"
                            value={weight}
                            onChange={(event) => setWeight(id, event.target.value)}
                            aria-label={`${language === 'ar' ? ar : en} weight`}
                          />
                          <span>{weight || '–'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="control-section filters-section">
                <h2>{t.filters}</h2>
                <FilterSelect
                  id="category-filter"
                  label={t.category}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={categories}
                  allLabel={t.all}
                />
                <FilterSelect
                  id="country-filter"
                  label={t.country}
                  value={countryFilter}
                  onChange={setCountryFilter}
                  options={countries}
                  allLabel={t.all}
                />
                <label className="field-label" htmlFor="confidence-filter">
                  {t.confidence}
                </label>
                <select
                  id="confidence-filter"
                  value={confidenceFilter}
                  onChange={(event) => setConfidenceFilter(event.target.value)}
                >
                  <option value="all">{t.all}</option>
                  <option value="verified">{t.verified}</option>
                  <option value="approximate">{t.approximate}</option>
                  <option value="missing">{t.missing}</option>
                </select>
              </section>
            </aside>

            <section className="explorer-main">
              <section className="map-panel">
                <div className="map-heading">
                  <div>
                    <p className="eyebrow">FIELD SITE ATLAS</p>
                    <h2>{t.mapTitle}</h2>
                    <p>{t.mapHint}</p>
                  </div>
                  <div className="map-actions">
                    <button
                      type="button"
                      className="sidebar-toggle"
                      aria-label={t.togglePanel}
                      aria-expanded={isSidePanelOpen}
                      onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
                    >
                      {t.mobileFilters}
                    </button>
                    <button
                      type="button"
                      className={isDrawing ? 'draw-button active' : 'draw-button'}
                      onClick={() => {
                        setIsDrawing(!isDrawing)
                        setDrawArea(null)
                        setAreaSites([])
                      }}
                    >
                      {isDrawing ? (
                        t.stopDraw
                      ) : (
                        <>
                          <DrawIcon /> {t.area}
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="map-legend">
                  <span>
                    <i className="legend-dot verified-dot" />
                    {t.verifiedBadge}
                  </span>
                  <span>
                    <i className="legend-dot approximate-dot" />
                    {t.approximateBadge}
                  </span>
                  <span className="map-count">
                    {
                      filtered.filter(({ site }) => site.locations.some(({ lat }) => lat !== null))
                        .length
                    }{' '}
                    {t.locations}
                  </span>
                </div>
                <div
                  ref={mapCanvasRef}
                  className={`map-canvas ${isDrawing ? 'drawing' : ''}`}
                  data-map-width={mapDimensions.width}
                  data-map-height={mapDimensions.height}
                >
                  <svg
                    viewBox="0 0 900 420"
                    preserveAspectRatio="none"
                    onPointerDown={beginDrawing}
                    onPointerMove={updateDrawing}
                    onPointerUp={finishDrawing}
                    onPointerCancel={finishDrawing}
                    role="img"
                    aria-label={t.mapTitle}
                  >
                    <defs>
                      <pattern id="map-grid" width="75" height="52.5" patternUnits="userSpaceOnUse">
                        <path
                          d="M 75 0 L 0 0 0 52.5"
                          fill="none"
                          stroke="rgba(152,181,175,.12)"
                          strokeWidth="1"
                        />
                      </pattern>
                      <linearGradient id="map-bg" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#10282b" />
                        <stop offset="100%" stopColor="#0c2025" />
                      </linearGradient>
                    </defs>
                    <rect width="900" height="420" fill="url(#map-bg)" />
                    <rect width="900" height="420" fill="url(#map-grid)" />
                    <g className="graticule">
                      {[1, 2, 3, 4, 5].map((line) => (
                        <line key={`h${line}`} x1="0" x2="900" y1={line * 70} y2={line * 70} />
                      ))}
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((line) => (
                        <line key={`v${line}`} y1="0" y2="420" x1={line * 75} x2={line * 75} />
                      ))}
                    </g>
                    <g className="continents">
                      <path d="M72 92 L108 65 167 55 206 73 230 105 218 132 185 143 171 177 139 190 115 163 83 157 65 126Z" />
                      <path d="M214 199 L248 215 264 248 252 284 245 322 224 354 208 319 200 278 188 246Z" />
                      <path d="M402 90 L433 76 462 86 473 107 451 123 430 116Z" />
                      <path d="M449 124 L489 120 523 141 534 183 515 226 495 271 473 258 460 215 441 181 429 149Z" />
                      <path d="M506 83 L556 63 621 69 663 93 712 97 744 123 718 145 672 144 647 166 611 155 583 180 550 155 521 150 488 126Z" />
                      <path d="M648 190 L689 177 731 190 757 223 741 259 705 272 675 250 650 226Z" />
                      <path d="M751 294 L786 280 822 293 838 319 810 339 778 331Z" />
                      <path d="M802 91 L844 87 866 109 847 129 815 125Z" />
                      <path d="M356 48 L376 42 391 55 381 72 361 69Z" />
                    </g>
                    {filtered.flatMap(({ site, score }) =>
                      site.locations
                        .filter(({ lat, lon }) => lat !== null && lon !== null)
                        .map((location, index) => {
                          const point = project(location)
                          const confidence = location.confidence
                          const selected = selectedSite?.id === site.id
                          return (
                            <g
                              className={`site-marker ${selected ? 'selected' : ''} ${confidence}`}
                              key={`${site.id}-${index}`}
                              transform={`translate(${point.x} ${point.y})`}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => setSelectedId(site.id)}
                              tabIndex="0"
                              role="button"
                              aria-label={`${site.nameEn}, ${location.label}`}
                            >
                              <circle className="marker-halo" r={selected ? 12 : 9} />
                              <circle className="marker-core" r={selected ? 5 : 3.5} />
                              <title>
                                {site.nameEn} — {location.label} ({confidence}) · {score}%
                              </title>
                            </g>
                          )
                        }),
                    )}
                    {drawArea && (
                      <rect
                        className="draw-area"
                        x={drawArea.x}
                        y={drawArea.y}
                        width={drawArea.width}
                        height={drawArea.height}
                      />
                    )}
                  </svg>
                  {isDrawing && <div className="drawing-hint">{t.areaHelp}</div>}
                </div>

                {drawArea && (
                  <section className="area-summary">
                    <div>
                      <strong>{areaSites.length}</strong>
                      <span>{t.inside}</span>
                    </div>
                    <div>
                      <strong>{averageAreaScore}%</strong>
                      <span>{t.average}</span>
                    </div>
                    <div className="area-tags">
                      <span>{t.common}</span>
                      <div>
                        {commonAreaTags.map(([tag]) => (
                          <b key={tag}>{tagNames.get(tag) ?? tag}</b>
                        ))}
                      </div>
                    </div>
                    <div className="area-site-list">
                      {areaSites.slice(0, 8).map(({ site, score }) => (
                        <button key={site.id} onClick={() => setSelectedId(site.id)}>
                          {language === 'ar' ? site.nameAr : site.nameEn}
                          <i>{score}%</i>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </section>

              <div className="results-layout">
                <section className="site-list-section">
                  <div className="list-heading">
                    <div>
                      <p className="eyebrow">RANKED RESULTS</p>
                      <h2>{t.results}</h2>
                    </div>
                    <span>
                      {filtered.length} / {analogs.length}
                    </span>
                  </div>
                  <div className="site-list">
                    {filtered.length === 0 && <p className="empty-state">{t.zeroResults}</p>}
                    {filtered.map((result, index) => (
                      <SiteCard
                        key={result.site.id}
                        result={result}
                        rank={index + 1}
                        active={selectedSite?.id === result.site.id}
                        language={language}
                        labels={t}
                        tagNames={tagNames}
                        onClick={() => setSelectedId(result.site.id)}
                      />
                    ))}
                  </div>
                </section>
                {selectedSite && (
                  <section className="detail-panel">
                    <div className="detail-top">
                      <span className="eyebrow">
                        SITE {String(selectedSite.id).padStart(2, '0')}
                      </span>
                      <span className="score-badge">
                        {selectedMatch.score}
                        <small>%</small>
                      </span>
                    </div>
                    <h2>{language === 'ar' ? selectedSite.nameAr : selectedSite.nameEn}</h2>
                    <p className="site-location">{selectedSite.countryRegionAr}</p>
                    {selectedSite.locations.map((location, index) => (
                      <span
                        key={`${location.label}-${index}`}
                        className={`confidence-badge ${location.confidence}`}
                      >
                        {location.confidence === 'verified'
                          ? t.verifiedBadge
                          : location.confidence === 'approximate'
                            ? t.approximateBadge
                            : t.noMap}
                      </span>
                    ))}
                    {selectedSite.dimensionsAr && (
                      <p className="dimensions-text">{selectedSite.dimensionsAr}</p>
                    )}
                    <div className="tag-match-heading">
                      <h3>{t.match}</h3>
                      <span>{selectedMatch.score}%</span>
                    </div>
                    <div className="match-bar">
                      <span style={{ width: `${selectedMatch.score}%` }} />
                    </div>
                    <div className="tag-chart">
                      <p className="chart-label">{t.matched}</p>
                      <div className="chart-tags">
                        {selectedMatch.matchedTags.length ? (
                          selectedMatch.matchedTags.map((tag) => (
                            <span className="matched-tag" key={tag}>
                              <i>✓</i>
                              {tagNames.get(tag) ?? tag}
                            </span>
                          ))
                        ) : (
                          <span className="muted-tag">—</span>
                        )}
                      </div>
                      <p className="chart-label">{t.notMatched}</p>
                      <div className="chart-tags">
                        {selectedMatch.missingTags.length ? (
                          selectedMatch.missingTags.map((tag) => (
                            <span className="missing-tag" key={tag}>
                              <i>×</i>
                              {tagNames.get(tag) ?? tag}
                            </span>
                          ))
                        ) : (
                          <span className="muted-tag">—</span>
                        )}
                      </div>
                    </div>
                    <p className="explanation">
                      {language === 'ar'
                        ? selectedMatch.explanationAr
                        : selectedMatch.explanationEn}
                    </p>
                    <div className="detail-divider" />
                    <h3>{t.mission}</h3>
                    <p className="mission-text">{selectedSite.missionAr}</p>
                    <div className="detail-divider" />
                    <h3>{t.source}</h3>
                    <p className="citation">{selectedSite.source}</p>
                    <a
                      className="source-link"
                      href={`https://www.google.com/search?q=${encodeURIComponent(selectedSite.source)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t.openSource} ↗
                    </a>
                  </section>
                )}
              </div>
            </section>
          </main>
        </>
      )}
      <footer className="app-footer">
        <img src="/terranovalogo.jpeg" alt="TerraNova logo" />
        <span>{t.locationNote}</span>
        <button onClick={() => setPage('methodology')}>{t.methodology} ↗</button>
      </footer>
    </div>
  )
}

function FilterSelect({ id, label, value, onChange, options, allLabel }) {
  return (
    <>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    </>
  )
}

function SiteCard({ result, rank, active, language, labels, tagNames, onClick }) {
  const { site, score } = result
  const confidence = locationConfidence(site)
  return (
    <button className={`site-card ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="rank-number">{String(rank).padStart(2, '0')}</span>
      <span className="card-content">
        <strong>{language === 'ar' ? site.nameAr : site.nameEn}</strong>
        <span>{site.countryRegionAr}</span>
        <span className={`mini-confidence ${confidence}`}>
          {confidence === 'verified'
            ? labels.verifiedBadge
            : confidence === 'approximate'
              ? labels.approximateBadge
              : labels.noMap}
        </span>
        <span className="card-tags">
          {site.tags.slice(0, 3).map((tag) => (
            <i key={tag}>{tagNames.get(tag) ?? tag}</i>
          ))}
        </span>
        <span className="card-citation">
          {labels.source}: {site.source}
        </span>
      </span>
      <span className="card-score">
        {score}
        <small>%</small>
      </span>
    </button>
  )
}

function CorrectionList({ title, rows }) {
  return (
    <div className="correction-list">
      <h3>
        {title} <span>{rows.length}</span>
      </h3>
      {rows.length ? (
        <ul>
          {rows.map((row, index) => (
            <li key={`${title}-${index}`}>{row}</li>
          ))}
        </ul>
      ) : (
        <p>—</p>
      )}
    </div>
  )
}

function DrawIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3 3h12v12H3zM7 3v12M11 3v12M3 7h12M3 11h12" />
    </svg>
  )
}

export default App
