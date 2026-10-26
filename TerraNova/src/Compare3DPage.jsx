/* eslint react/no-unknown-property: "off" */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars } from '@react-three/drei/core/Stars.js'
import { OrbitControls as ThreeOrbitControls } from 'three/addons/controls/OrbitControls.js'
import { PlaneGeometry, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import { Component, useEffect, useMemo, useRef, useState } from 'react'
import analogSites from './data/analogs.json'
import targetPairs from './data/analog-target-pairs.json'
import './Compare3DPage.css'

const UP_AXIS = new Vector3(0, 1, 0)

class CanvasErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('3D comparison renderer failed; showing the cached image preview.', error)
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

const COPY = {
  en: {
    back: 'Back to explorer',
    title: '3D terrain comparison',
    missingSite: 'This analog site could not be found.',
    earth: 'Earth analog',
    target: 'Planetary comparison candidate',
    proposed: 'Proposed · needs scientist review',
    verified: 'Verified',
    patchLoading: 'Loading cached terrain patches…',
    patchMissing: 'No cached patch. Run `npm run terrain` to prepare offline terrain data.',
    patchError: 'Could not load cached terrain metadata',
    textureMissing: 'Cached texture unavailable',
    radius: 'Patch radius',
    size: 'Tile size',
    resolution: 'Resolution',
    elevation: 'Elevation range',
    relief: 'Relief',
    meanSlope: 'Mean slope',
    histogram: 'Hypsometric histogram',
    noElevation: 'No unit-verified DEM is available; imagery is shown on a flat surface.',
    relativeElevation: 'Display grayscale levels only; not elevation units.',
    sourceUnits: 'Source pixel values; units are not specified by NASA Trek metadata.',
    notReported: 'Not reported',
    controls: 'Comparison controls',
    exaggeration: 'Vertical exaggeration',
    azimuth: 'Sun azimuth',
    sunElevation: 'Sun elevation',
    wireframe: 'Wireframe',
    autoFlyover: 'Auto flyover',
    reset: 'Reset view',
    sync: 'Sync cameras',
    earthTab: 'Earth',
    targetTab: 'Moon / Mars',
    compare: 'Comparison',
    disclaimer:
      'Approximate visualization from public tiles; not for engineering measurements. Target regions are proposals derived from the analog dataset and remain unverified.',
    refresh: 'Refresh image from NASA Trek',
    refreshing: 'Refreshing…',
    refreshError: 'Live image refresh failed',
    viewData: 'Terrain data',
    attribution: 'Data source and attribution',
    earthConfidence: 'Earth location confidence',
  },
  ar: {
    back: 'العودة إلى المستكشف',
    title: 'مقارنة التضاريس ثلاثية الأبعاد',
    missingSite: 'تعذر العثور على هذا الموقع النظير.',
    earth: 'الموقع النظير على الأرض',
    target: 'منطقة مقارنة كوكبية مقترحة',
    proposed: 'مقترح · يحتاج إلى مراجعة علمية',
    verified: 'موثق',
    patchLoading: 'جارٍ تحميل رقع التضاريس المخزنة…',
    patchMissing: 'لا توجد رقعة مخزنة. شغّل `npm run terrain` لإعداد بيانات التضاريس دون اتصال.',
    patchError: 'تعذر تحميل بيانات التضاريس المخزنة',
    textureMissing: 'الصورة المخزنة غير متاحة',
    radius: 'نصف قطر الرقعة',
    size: 'حجم البلاطة',
    resolution: 'الدقة',
    elevation: 'نطاق الارتفاع',
    relief: 'التضرس',
    meanSlope: 'متوسط الانحدار',
    histogram: 'مدرج الارتفاعات',
    noElevation: 'لا تتوفر بيانات DEM موثقة الوحدات؛ تُعرض الصورة على سطح مستوٍ.',
    relativeElevation: 'مستويات الرمادي المرئية فقط؛ ليست وحدات ارتفاع.',
    sourceUnits: 'قيم بكسل المصدر؛ لا تحدد بيانات NASA Trek وحداتها.',
    notReported: 'غير متاح',
    controls: 'عناصر التحكم بالمقارنة',
    exaggeration: 'المبالغة الرأسية',
    azimuth: 'سمت الشمس',
    sunElevation: 'ارتفاع الشمس',
    wireframe: 'شبكة سلكية',
    autoFlyover: 'تحليق تلقائي',
    reset: 'إعادة ضبط العرض',
    sync: 'مزامنة الكاميرتين',
    earthTab: 'الأرض',
    targetTab: 'القمر / المريخ',
    compare: 'المقارنة',
    disclaimer:
      'تصور تقريبي من بلاطات عامة؛ لا يستخدم للقياسات الهندسية. مناطق الهدف مقترحة من بيانات المواقع النظيرة ولم يتم التحقق منها.',
    refresh: 'تحديث الصورة من NASA Trek',
    refreshing: 'جارٍ التحديث…',
    refreshError: 'فشل تحديث الصورة المباشرة',
    viewData: 'بيانات التضاريس',
    attribution: 'مصدر البيانات والإسناد',
    earthConfidence: 'موثوقية موقع الأرض',
  },
}

function readPatchMeta(siteId, directory) {
  return fetch(`/terrain/${siteId}/${directory}/meta.json`).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  })
}

function formatCoordinate(value, axis) {
  const hemisphere = axis === 'lat' ? (value < 0 ? 'S' : 'N') : value < 0 ? 'W' : 'E'
  return Number.isFinite(value) ? `${Math.abs(value).toFixed(3)}° ${hemisphere}` : '—'
}

function formatDistance(value, language) {
  if (!Number.isFinite(Number(value))) return '—'
  return `${Number(value).toLocaleString(language === 'ar' ? 'ar' : 'en', {
    maximumFractionDigits: 1,
  })} km`
}

function useTerrainSamples(meta, url) {
  const key = `${url ?? ''}:${meta?.elevation?.encoding ?? ''}`
  const [result, setResult] = useState({ key: '', samples: null, error: '' })

  useEffect(() => {
    let active = true
    if (!meta?.files?.elevation || !url) return undefined

    async function loadSamples() {
      try {
        if (meta.elevation.encoding === 'float32-le') {
          const response = await fetch(url)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const buffer = await response.arrayBuffer()
          const values = new Float32Array(buffer)
          if (active) {
            setResult({
              key,
              samples: {
                values,
                width: meta.elevation.width,
                height: meta.elevation.height,
              },
              error: '',
            })
          }
          return
        }

        const image = new Image()
        image.src = url
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('Could not read the cached elevation image.')
        context.drawImage(image, 0, 0)
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
        const values = new Float32Array(canvas.width * canvas.height)
        for (let index = 0; index < values.length; index += 1) {
          const pixel = index * 4
          if (meta.elevation.encoding === 'terrarium') {
            values[index] = data[pixel] * 256 + data[pixel + 1] + data[pixel + 2] / 256 - 32768
          } else {
            values[index] = data[pixel + 3] === 0 ? Number.NaN : data[pixel]
          }
        }
        if (active) {
          setResult({
            key,
            samples: { values, width: canvas.width, height: canvas.height },
            error: '',
          })
        }
      } catch (loadError) {
        if (active) {
          setResult({
            key,
            samples: null,
            error: loadError instanceof Error ? loadError.message : String(loadError),
          })
        }
      }
    }

    loadSamples()
    return () => {
      active = false
    }
  }, [key, meta, url])

  return result.key === key ? result : { key, samples: null, error: '' }
}

function useCachedTexture(url) {
  const [result, setResult] = useState({ url: '', texture: null, error: '' })

  useEffect(() => {
    let active = true
    if (!url) return undefined

    const loader = new TextureLoader()
    const loadedTexture = loader.load(
      url,
      (imageTexture) => {
        imageTexture.colorSpace = SRGBColorSpace
        if (active) setResult({ url, texture: imageTexture, error: '' })
        else imageTexture.dispose()
      },
      undefined,
      () => {
        if (active) setResult({ url, texture: null, error: 'Cached image could not be decoded.' })
      },
    )

    return () => {
      active = false
      loadedTexture.dispose()
    }
  }, [url])

  return result.url === url ? result : { url, texture: null, error: '' }
}

function sampleAt(samples, u, v) {
  if (!samples) return 0
  const x = Math.min(samples.width - 1, Math.max(0, Math.floor(u * samples.width)))
  const y = Math.min(samples.height - 1, Math.max(0, Math.floor(v * samples.height)))
  const value = samples.values[y * samples.width + x]
  return Number.isFinite(value) ? value : Number.NaN
}

function TerrainSurface({ meta, texture, textureError, exaggeration, wireframe }) {
  const elevationUrl = meta?.files?.elevation
    ? `/terrain/${meta.siteId}/${meta.patchDirectory}/${meta.files.elevation}`
    : null
  const { samples } = useTerrainSamples(meta, elevationUrl)
  const widthKm = meta?.patchSizeKm ?? 40
  const geometry = useMemo(() => {
    const segments = 64
    const plane = new PlaneGeometry(widthKm, widthKm, segments, segments)
    if (samples) {
      const positions = plane.attributes.position
      const min = Number(meta.elevation.min)
      const max = Number(meta.elevation.max)
      const range = max - min
      const usesMeters = meta.elevation.units === 'm'
      for (let index = 0; index < positions.count; index += 1) {
        const u = (positions.getX(index) + widthKm / 2) / widthKm
        const v = 1 - (positions.getY(index) + widthKm / 2) / widthKm
        const value = sampleAt(samples, u, v)
        if (!Number.isFinite(value)) continue
        const heightKm = usesMeters && range > 0 ? (value - min) / 1_000 : 0
        positions.setZ(index, heightKm * exaggeration)
      }
      positions.needsUpdate = true
      plane.computeVertexNormals()
    }
    return plane
  }, [widthKm, samples, meta, exaggeration])

  useEffect(() => () => geometry.dispose(), [geometry])

  if (!texture || textureError) return null
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
      <meshStandardMaterial
        map={texture}
        wireframe={wireframe}
        roughness={1}
        metalness={0}
        side={2}
      />
    </mesh>
  )
}

function CameraControls({ syncState, onCameraChange, resetSignal, autoFlyover }) {
  const { camera, gl } = useThree()
  const controls = useMemo(() => {
    const instance = new ThreeOrbitControls(camera, gl.domElement)
    instance.enableDamping = true
    instance.dampingFactor = 0.08
    instance.minDistance = 8
    instance.maxDistance = 160
    return instance
  }, [camera, gl])
  const applyingSync = useRef(false)

  useEffect(() => () => controls.dispose(), [controls])

  useEffect(() => {
    if (!syncState) return
    applyingSync.current = true
    camera.position.set(...syncState.position)
    controls.target.set(...syncState.target)
    controls.update()
    const frame = requestAnimationFrame(() => {
      applyingSync.current = false
    })
    return () => cancelAnimationFrame(frame)
  }, [camera, controls, syncState])

  useEffect(() => {
    camera.position.set(0, 18, 42)
    controls.target.set(0, 0, 0)
    controls.update()
  }, [camera, controls, resetSignal])

  useEffect(() => {
    const handleChange = () => {
      if (applyingSync.current) return
      onCameraChange({
        position: camera.position.toArray(),
        target: controls.target.toArray(),
      })
    }
    controls.addEventListener('change', handleChange)
    return () => controls.removeEventListener('change', handleChange)
  }, [camera, controls, onCameraChange])

  useFrame((_, delta) => {
    if (autoFlyover) camera.position.applyAxisAngle(UP_AXIS, delta * 0.12)
    controls.update()
  })

  return null
}

function Sun({ azimuth, elevation }) {
  const azimuthRadians = (azimuth * Math.PI) / 180
  const elevationRadians = (elevation * Math.PI) / 180
  const distance = 100
  return (
    <directionalLight
      position={[
        Math.sin(azimuthRadians) * Math.cos(elevationRadians) * distance,
        Math.sin(elevationRadians) * distance,
        Math.cos(azimuthRadians) * Math.cos(elevationRadians) * distance,
      ]}
      intensity={2.2}
      castShadow
    />
  )
}

function TerrainViewport({
  meta,
  textureUrl,
  title,
  language,
  exaggeration,
  sunAzimuth,
  sunElevation,
  wireframe,
  autoFlyover,
  syncState,
  onCameraChange,
  resetSignal,
  labels,
}) {
  const textureAvailable = Boolean(textureUrl)
  const elevationAvailable = Boolean(meta?.files?.elevation)
  const { texture, error: textureError } = useCachedTexture(textureUrl)
  return (
    <section className="compare-viewport" aria-label={title}>
      <div className="compare-canvas-wrap">
        {textureAvailable ? (
          <>
            <CanvasErrorBoundary
              key={textureUrl}
              fallback={<img className="compare-static-preview" src={textureUrl} alt={title} />}
            >
              <Canvas
                camera={{ position: [0, 18, 42], fov: 42 }}
                dpr={[1, Math.min(window.devicePixelRatio || 1, 1.5)]}
                shadows
                gl={{ antialias: true, powerPreference: 'low-power' }}
              >
                <color attach="background" args={['#071316']} />
                <ambientLight intensity={0.65} />
                <Sun azimuth={sunAzimuth} elevation={sunElevation} />
                <Stars
                  radius={120}
                  depth={45}
                  count={500}
                  factor={2}
                  saturation={0}
                  fade
                  speed={0}
                />
                <TerrainSurface
                  meta={meta}
                  texture={texture}
                  textureError={textureError}
                  exaggeration={exaggeration}
                  wireframe={wireframe}
                />
                <CameraControls
                  syncState={syncState}
                  onCameraChange={onCameraChange}
                  resetSignal={resetSignal}
                  autoFlyover={autoFlyover}
                />
              </Canvas>
            </CanvasErrorBoundary>
            {textureError && (
              <div className="compare-error compare-texture-error" role="alert">
                {labels.textureMissing}: {textureError}
              </div>
            )}
          </>
        ) : (
          <div className="compare-preview-missing">
            <span aria-hidden="true">◌</span>
            <p>{meta?.status === 'unavailable' ? meta.reason : labels.textureMissing}</p>
          </div>
        )}
        {textureAvailable && !elevationAvailable && (
          <span className="compare-flat-badge">{labels.noElevation}</span>
        )}
      </div>
      {meta && <TerrainStats meta={meta} title={title} language={language} labels={labels} />}
    </section>
  )
}

function TerrainStats({ meta, title, language, labels }) {
  const values = meta.elevation
  const histogram = values?.histogram ?? []
  const maxBar = Math.max(1, ...histogram)
  const units = values?.units ?? ''
  const elevationHasUnits = Boolean(units && units !== '0–255 image levels; not elevation units')
  const elevationRange =
    values?.available === false || values?.min === undefined
      ? labels.notReported
      : `${values.min.toLocaleString(language === 'ar' ? 'ar' : 'en', { maximumFractionDigits: 1 })}–${values.max.toLocaleString(language === 'ar' ? 'ar' : 'en', { maximumFractionDigits: 1 })}${elevationHasUnits ? ` ${units}` : ''}`

  return (
    <div className="compare-stats">
      <div className="compare-stats-heading">
        <h2>{title}</h2>
        {meta.confidence === 'proposed' && (
          <span className="proposal-badge">{labels.proposed}</span>
        )}
      </div>
      {meta.rationale && <p className="compare-rationale">{meta.rationale}</p>}
      <dl className="compare-stat-grid">
        <div>
          <dt>{labels.size}</dt>
          <dd>{formatDistance(meta.patchSizeKm, language)}</dd>
        </div>
        <div>
          <dt>{labels.resolution}</dt>
          <dd>{meta.resolutionMeters ? `${meta.resolutionMeters.toFixed(1)} m/px` : '—'}</dd>
        </div>
        <div>
          <dt>{labels.elevation}</dt>
          <dd>{elevationRange}</dd>
        </div>
        <div>
          <dt>{labels.relief}</dt>
          <dd>
            {values?.relief === undefined
              ? labels.notReported
              : `${values.relief.toLocaleString(language === 'ar' ? 'ar' : 'en', { maximumFractionDigits: 1 })}${elevationHasUnits ? ` ${units}` : ''}`}
          </dd>
        </div>
        <div>
          <dt>{labels.meanSlope}</dt>
          <dd>
            {values?.meanSlopeDegrees === null || values?.meanSlopeDegrees === undefined
              ? labels.notReported
              : `${values.meanSlopeDegrees.toFixed(1)}°`}
          </dd>
        </div>
        {meta.body === 'earth' && (
          <div>
            <dt>{labels.earthConfidence}</dt>
            <dd>
              {meta.coordinates?.confidence === 'verified' ? labels.verified : labels.proposed}
            </dd>
          </div>
        )}
      </dl>
      {histogram.length > 0 && (
        <div className="compare-histogram">
          <h3>{labels.histogram}</h3>
          <div role="img" aria-label={labels.histogram} className="histogram-bars">
            {histogram.map((count, index) => (
              <span
                key={index}
                title={`${count}`}
                style={{ height: `${Math.max(3, (count / maxBar) * 100)}%` }}
              />
            ))}
          </div>
          {values?.units?.includes('image levels') && <small>{labels.relativeElevation}</small>}
          {values?.units?.includes('not specified') && <small>{labels.sourceUnits}</small>}
        </div>
      )}
      <p className="compare-attribution">
        <strong>{labels.attribution}:</strong> {meta.attribution}
      </p>
    </div>
  )
}

function localizedTarget(pair, language) {
  return language === 'ar' ? pair.labelAr : pair.label
}

export default function Compare3DPage({ siteId, language = 'en' }) {
  const labels = COPY[language] ?? COPY.en
  const site = analogSites.find((record) => record.id === siteId)
  const pairs = targetPairs[siteId] ?? []
  const [pairIndex, setPairIndex] = useState(0)
  const [patchResult, setPatchResult] = useState({
    key: '',
    status: 'loading',
    earthMeta: null,
    targetMeta: null,
    error: '',
  })
  const [languageView, setLanguageView] = useState('earth')
  const [exaggeration, setExaggeration] = useState(1)
  const [sunAzimuth, setSunAzimuth] = useState(315)
  const [sunElevation, setSunElevation] = useState(40)
  const [wireframe, setWireframe] = useState(false)
  const [autoFlyover, setAutoFlyover] = useState(false)
  const [syncCameras, setSyncCameras] = useState(false)
  const [cameraStates, setCameraStates] = useState({ earth: null, target: null })
  const [resetSignal, setResetSignal] = useState(0)
  const [refreshImage, setRefreshImage] = useState('')
  const [refreshState, setRefreshState] = useState('')
  const currentPair = pairs[pairIndex]
  const targetDirectory = `target-${pairIndex + 1}`
  const patchKey = `${siteId}:${targetDirectory}`
  const currentPatch = patchResult.key === patchKey ? patchResult : null
  const earthMeta = currentPatch?.earthMeta ?? null
  const targetMeta = currentPatch?.targetMeta ?? null
  const loadState = currentPatch?.status ?? 'loading'
  const loadError = currentPatch?.error ?? ''
  const earthTextureUrl = earthMeta?.files?.texture
    ? `/terrain/${siteId}/earth/${earthMeta.files.texture}`
    : null
  const targetTextureUrl =
    refreshImage && languageView === 'target'
      ? refreshImage
      : targetMeta?.files?.texture
        ? `/terrain/${siteId}/${targetDirectory}/${targetMeta.files.texture}`
        : null

  useEffect(() => {
    if (!site || !currentPair) return undefined
    let active = true
    Promise.all([readPatchMeta(siteId, 'earth'), readPatchMeta(siteId, targetDirectory)])
      .then(([earth, target]) => {
        if (!active) return
        setPatchResult({
          key: patchKey,
          status: 'loaded',
          earthMeta: { ...earth, siteId, patchDirectory: 'earth' },
          targetMeta: {
            ...target,
            siteId,
            targetIndex: pairIndex + 1,
            patchDirectory: targetDirectory,
            label: localizedTarget(currentPair, language),
            coordinates: { lat: currentPair.lat, lon: currentPair.lon },
            confidence: currentPair.confidence,
            radiusKm: currentPair.radiusKm,
            rationale: language === 'ar' ? currentPair.rationaleAr : currentPair.rationale,
          },
          error: '',
        })
      })
      .catch((error) => {
        if (!active) return
        setPatchResult({
          key: patchKey,
          status: 'error',
          earthMeta: null,
          targetMeta: null,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    return () => {
      active = false
    }
  }, [site, siteId, currentPair, pairIndex, targetDirectory, language, patchKey])

  useEffect(
    () => () => {
      if (refreshImage) URL.revokeObjectURL(refreshImage)
    },
    [refreshImage],
  )

  if (!site) {
    return (
      <main className="compare-page">
        <a href="/">{labels.back}</a>
        <p role="alert">{labels.missingSite}</p>
      </main>
    )
  }

  async function refreshTargetImage() {
    const url = targetMeta?.liveRefreshUrl
    if (!url) return
    setRefreshState('loading')
    try {
      const trekUrl = new URL(url)
      if (trekUrl.hostname !== 'trek.nasa.gov') {
        throw new Error('Unexpected live image host.')
      }
      const response = await fetch(`/trek-proxy${trekUrl.pathname}${trekUrl.search}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const nextImage = URL.createObjectURL(await response.blob())
      setRefreshImage((previous) => {
        if (previous) URL.revokeObjectURL(previous)
        return nextImage
      })
      setRefreshState('')
    } catch (error) {
      setRefreshState(
        `${labels.refreshError}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const earthLocation = site.locations.find(({ lat, lon }) => lat !== null && lon !== null)
  const targetName = localizedTarget(currentPair, language)

  return (
    <main className="compare-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="compare-header">
        <a href="/" className="compare-back">
          ← {labels.back}
        </a>
        <p className="eyebrow">TERRANOVA / TERRAIN LAB</p>
        <h1>{labels.title}</h1>
        <p>{language === 'ar' ? site.nameAr : site.nameEn}</p>
      </header>

      <section className="compare-controls" aria-labelledby="compare-controls-title">
        <h2 id="compare-controls-title">{labels.controls}</h2>
        <div className="compare-control-grid">
          {pairs.length > 1 && (
            <label>
              {labels.compare}
              <select
                value={pairIndex}
                onChange={(event) => setPairIndex(Number(event.target.value))}
              >
                {pairs.map((pair, index) => (
                  <option key={`${pair.body}-${index}`} value={index}>
                    {`${pair.body === 'moon' ? labels.earthTab : labels.targetTab} — ${localizedTarget(pair, language)}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {labels.exaggeration} ({exaggeration.toFixed(1)}×)
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={exaggeration}
              onChange={(event) => setExaggeration(Number(event.target.value))}
            />
          </label>
          <label>
            {labels.azimuth} ({sunAzimuth}°)
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={sunAzimuth}
              onChange={(event) => setSunAzimuth(Number(event.target.value))}
            />
          </label>
          <label>
            {labels.sunElevation} ({sunElevation}°)
            <input
              type="range"
              min="5"
              max="85"
              step="1"
              value={sunElevation}
              onChange={(event) => setSunElevation(Number(event.target.value))}
            />
          </label>
          <label className="compare-checkbox">
            <input
              type="checkbox"
              checked={wireframe}
              onChange={(event) => setWireframe(event.target.checked)}
            />
            {labels.wireframe}
          </label>
          <label className="compare-checkbox">
            <input
              type="checkbox"
              checked={autoFlyover}
              onChange={(event) => setAutoFlyover(event.target.checked)}
            />
            {labels.autoFlyover}
          </label>
          <label className="compare-checkbox">
            <input
              type="checkbox"
              checked={syncCameras}
              onChange={(event) => setSyncCameras(event.target.checked)}
            />
            {labels.sync}
          </label>
          <button type="button" onClick={() => setResetSignal((value) => value + 1)}>
            {labels.reset}
          </button>
          {targetMeta?.liveRefreshUrl && (
            <button
              type="button"
              onClick={refreshTargetImage}
              disabled={refreshState === 'loading'}
            >
              {refreshState === 'loading' ? labels.refreshing : labels.refresh}
            </button>
          )}
        </div>
        {refreshState && refreshState !== 'loading' && (
          <p className="compare-error" role="alert">
            {refreshState}
          </p>
        )}
      </section>

      {pairs.length > 0 && (
        <nav className="compare-mobile-tabs" aria-label={labels.compare}>
          <button
            type="button"
            aria-pressed={languageView === 'earth'}
            onClick={() => setLanguageView('earth')}
          >
            {labels.earthTab}
          </button>
          <button
            type="button"
            aria-pressed={languageView === 'target'}
            onClick={() => setLanguageView('target')}
          >
            {labels.targetTab}
          </button>
        </nav>
      )}

      {loadState === 'loading' && (
        <p className="compare-load-state" role="status">
          {labels.patchLoading}
        </p>
      )}
      {loadState === 'error' && (
        <p className="compare-error" role="alert">
          {labels.patchMissing} ({labels.patchError}: {loadError})
        </p>
      )}
      {loadState === 'loaded' && (
        <section className="compare-viewports">
          <div className={languageView === 'earth' ? '' : 'mobile-hidden'}>
            <TerrainViewport
              meta={earthMeta}
              textureUrl={earthTextureUrl}
              title={labels.earth}
              language={language}
              exaggeration={exaggeration}
              sunAzimuth={sunAzimuth}
              sunElevation={sunElevation}
              wireframe={wireframe}
              autoFlyover={autoFlyover}
              syncState={syncCameras ? cameraStates.target : null}
              onCameraChange={(state) =>
                setCameraStates((current) => ({ ...current, earth: state }))
              }
              resetSignal={resetSignal}
              labels={labels}
            />
          </div>
          <div className={languageView === 'target' ? '' : 'mobile-hidden'}>
            <TerrainViewport
              meta={targetMeta}
              textureUrl={targetTextureUrl}
              title={`${labels.target}: ${targetName}`}
              language={language}
              exaggeration={exaggeration}
              sunAzimuth={sunAzimuth}
              sunElevation={sunElevation}
              wireframe={wireframe}
              autoFlyover={autoFlyover}
              syncState={syncCameras ? cameraStates.earth : null}
              onCameraChange={(state) =>
                setCameraStates((current) => ({ ...current, target: state }))
              }
              resetSignal={resetSignal}
              labels={labels}
            />
          </div>
        </section>
      )}

      {earthLocation && (
        <p className="compare-coordinate-note">
          {labels.earth}: {formatCoordinate(earthLocation.lat, 'lat')}{' '}
          {formatCoordinate(earthLocation.lon, 'lon')} ·{' '}
          {earthLocation.confidence === 'verified' ? labels.verified : labels.proposed}
          {currentPair && (
            <>
              {' '}
              | {targetName}: {formatCoordinate(currentPair.lat, 'lat')}{' '}
              {formatCoordinate(currentPair.lon, 'lon')} · {labels.proposed}
            </>
          )}
        </p>
      )}
      <p className="compare-disclaimer">{labels.disclaimer}</p>
    </main>
  )
}
