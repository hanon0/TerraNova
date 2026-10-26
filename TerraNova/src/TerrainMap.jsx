import { useEffect, useRef } from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'

const EMPTY_FEATURES = { type: 'FeatureCollection', features: [] }
setWorkerUrl(workerUrl)

/**
 * @param {{
 *   markers: Array<{ siteId: number, name: string, label: string, lat: number, lon: number, confidence: string, score: number }>,
 *   selectedSiteId: number,
 *   isDrawing: boolean,
 *   language: 'en'|'ar',
 *   onSelectSite: (siteId: number) => void,
 *   onDrawArea: (bounds: { west: number, south: number, east: number, north: number }) => void,
 *   onFallback: (reason: string) => void,
 *   onMapError: () => void
 * }} props
 */
export default function TerrainMap({
  markers,
  selectedSiteId,
  isDrawing,
  language,
  isSatellite,
  onSelectSite,
  onDrawArea,
  onFallback,
  onMapError,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const callbacksRef = useRef({ onSelectSite, onDrawArea, onFallback, onMapError })
  const markersRef = useRef(markers)
  const selectedSiteIdRef = useRef(selectedSiteId)
  const drawingRef = useRef(isDrawing)

  useEffect(() => {
    callbacksRef.current = { onSelectSite, onDrawArea, onFallback, onMapError }
    markersRef.current = markers
    selectedSiteIdRef.current = selectedSiteId
    drawingRef.current = isDrawing
  }, [onSelectSite, onDrawArea, onFallback, onMapError, markers, selectedSiteId, isDrawing])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const capabilityCanvas = document.createElement('canvas')
    const capabilityContext =
      capabilityCanvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ??
      capabilityCanvas.getContext('webgl', { failIfMajorPerformanceCaveat: true })
    if (!capabilityContext) {
      callbacksRef.current.onFallback('unsupported')
      return undefined
    }
    capabilityContext.getExtension('WEBGL_lose_context')?.loseContext()

    let map
    let loadTimeout
    try {
      map = new MapLibreMap({
        container,
        style: {
          version: 8,
          sources: {
            'earth-base-map': isSatellite
              ? {
                  type: 'raster',
                  tiles: [
                    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                  ],
                  tileSize: 256,
                  attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
                }
              : {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
                },
          },
          layers: [
            {
              id: 'earth-base-map-raster',
              type: 'raster',
              source: 'earth-base-map',
              paint: { 'raster-opacity': 0.94 },
            },
          ],
        },
        center: [0, 18],
        zoom: 1.35,
        pitch: 0,
        maxPitch: 0,
        minZoom: 1,
        maxZoom: 14,
        pixelRatio: Math.min(
          window.devicePixelRatio || 1,
          window.matchMedia('(max-width: 760px)').matches ? 1 : 1.5,
        ),
        attributionControl: true,
        canvasContextAttributes: { failIfMajorPerformanceCaveat: true },
      })
    } catch {
      callbacksRef.current.onFallback('initialization')
      return undefined
    }

    mapRef.current = map
    map.addControl(new NavigationControl({ showCompass: true }), 'top-right')
    const handleLoad = () => {
      window.clearTimeout(loadTimeout)
      map.addSource('site-locations', {
        type: 'geojson',
        data: createFeatures(markersRef.current, selectedSiteIdRef.current),
        cluster: true,
        clusterRadius: 38,
        clusterMaxZoom: 8,
      })
      map.addLayer({
        id: 'site-clusters',
        type: 'circle',
        source: 'site-locations',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#8ed6bb',
          'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 30, 24],
          'circle-stroke-color': '#08201e',
          'circle-stroke-width': 2,
        },
      })
      map.addLayer({
        id: 'site-cluster-count',
        type: 'symbol',
        source: 'site-locations',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 11,
        },
        paint: { 'text-color': '#071412' },
      })
      map.addLayer({
        id: 'site-points',
        type: 'circle',
        source: 'site-locations',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'confidence'],
            'verified',
            '#b8ffe0',
            'approximate',
            '#f3bd7c',
            '#d4e4df',
          ],
          'circle-radius': [
            'case',
            ['get', 'selected'],
            8,
            5,
          ],
          'circle-stroke-color': '#0a1b20',
          'circle-stroke-width': 2,
        },
      })
      map.addSource('drawn-area', { type: 'geojson', data: EMPTY_FEATURES })
      map.addLayer({
        id: 'drawn-area-fill',
        type: 'fill',
        source: 'drawn-area',
        paint: { 'fill-color': '#8ed6bb', 'fill-opacity': 0.14 },
      })
      map.addLayer({
        id: 'drawn-area-outline',
        type: 'line',
        source: 'drawn-area',
        paint: { 'line-color': '#b8ffe0', 'line-width': 2, 'line-dasharray': [2, 1] },
      })

      map.on('click', 'site-points', (event) => {
        if (drawingRef.current) return
        const feature = event.features?.[0]
        if (feature) callbacksRef.current.onSelectSite(Number(feature.properties.siteId))
      })
      map.on('click', 'site-clusters', (event) => {
        if (drawingRef.current) return
        const feature = event.features?.[0]
        if (!feature) return
        const clusterId = Number(feature.properties.cluster_id)
        const source = map.getSource('site-locations')
        source.getClusterExpansionZoom(clusterId, (error, zoom) => {
          if (error) {
            callbacksRef.current.onMapError()
            return
          }
          const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          if (reducedMotion) map.jumpTo({ center: feature.geometry.coordinates, zoom })
          else map.easeTo({ center: feature.geometry.coordinates, zoom })
        })
      })
      map.on('mouseenter', 'site-points', () => {
        map.getCanvas().style.cursor = drawingRef.current ? 'crosshair' : 'pointer'
      })
      map.on('mouseleave', 'site-points', () => {
        map.getCanvas().style.cursor = drawingRef.current ? 'crosshair' : ''
      })
      map.on('mouseenter', 'site-clusters', () => {
        map.getCanvas().style.cursor = drawingRef.current ? 'crosshair' : 'pointer'
      })
      map.on('mouseleave', 'site-clusters', () => {
        map.getCanvas().style.cursor = drawingRef.current ? 'crosshair' : ''
      })
    }

    loadTimeout = window.setTimeout(() => {
      callbacksRef.current.onFallback('slow')
    }, 15000)
    map.once('load', handleLoad)
    map.on('error', (event) => {
      if (/worker|webgl/i.test(event.error?.message ?? '')) {
        callbacksRef.current.onFallback('initialization')
      } else {
        callbacksRef.current.onMapError()
      }
    })
    map.on('webglcontextlost', () => callbacksRef.current.onFallback('unsupported'))

    return () => {
      window.clearTimeout(loadTimeout)
      map.remove()
      mapRef.current = null
    }
  }, [isSatellite])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || !map.getSource('site-locations')) return
    map.getSource('site-locations').setData(createFeatures(markers, selectedSiteId))
  }, [markers, selectedSiteId])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return undefined
    const canvas = map.getCanvas()
    const start = { current: null }
    let lastPosition = null
    const areaSource = () => map.getSource('drawn-area')
    const setArea = (west, south, east, north) => {
      const source = areaSource()
      if (!source) return
      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [west, south],
                  [east, south],
                  [east, north],
                  [west, north],
                  [west, south],
                ],
              ],
            },
          },
        ],
      })
    }
    const pointerDown = (event) => {
      if (!isDrawing || (event.pointerType !== 'touch' && event.button !== 0)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      canvas.setPointerCapture(event.pointerId)
      start.current = [event.clientX, event.clientY]
      lastPosition = start.current
      map.dragPan.disable()
    }
    const pointerMove = (event) => {
      if (!isDrawing || !start.current) return
      event.preventDefault()
      event.stopImmediatePropagation()
      lastPosition = [event.clientX, event.clientY]
      const rect = canvas.getBoundingClientRect()
      const first = map.unproject([start.current[0] - rect.left, start.current[1] - rect.top])
      const last = map.unproject([lastPosition[0] - rect.left, lastPosition[1] - rect.top])
      setArea(
        Math.min(first.lng, last.lng),
        Math.min(first.lat, last.lat),
        Math.max(first.lng, last.lng),
        Math.max(first.lat, last.lat),
      )
    }
    const pointerUp = (event) => {
      if (!start.current) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const initial = start.current
      start.current = null
      map.dragPan.enable()
      if (!lastPosition || Math.hypot(lastPosition[0] - initial[0], lastPosition[1] - initial[1]) < 8) {
        return
      }
      const rect = canvas.getBoundingClientRect()
      const first = map.unproject([initial[0] - rect.left, initial[1] - rect.top])
      const last = map.unproject([lastPosition[0] - rect.left, lastPosition[1] - rect.top])
      const bounds = {
        west: Math.min(first.lng, last.lng),
        south: Math.min(first.lat, last.lat),
        east: Math.max(first.lng, last.lng),
        north: Math.max(first.lat, last.lat),
      }
      setArea(bounds.west, bounds.south, bounds.east, bounds.north)
      callbacksRef.current.onDrawArea(bounds)
    }

    canvas.style.touchAction = isDrawing ? 'none' : 'auto'
    map.getCanvas().style.cursor = isDrawing ? 'crosshair' : ''
    if (isDrawing) areaSource()?.setData(EMPTY_FEATURES)
    if (isDrawing) map.dragPan.disable()
    else map.dragPan.enable()
    canvas.addEventListener('pointerdown', pointerDown, true)
    canvas.addEventListener('pointermove', pointerMove, true)
    canvas.addEventListener('pointerup', pointerUp, true)
    canvas.addEventListener('pointercancel', pointerUp, true)
    return () => {
      canvas.removeEventListener('pointerdown', pointerDown, true)
      canvas.removeEventListener('pointermove', pointerMove, true)
      canvas.removeEventListener('pointerup', pointerUp, true)
      canvas.removeEventListener('pointercancel', pointerUp, true)
      canvas.style.touchAction = 'auto'
      map.dragPan.enable()
    }
  }, [isDrawing])

  return (
    <div
      ref={containerRef}
      className="terrain-map-shell"
      role="img"
      aria-label={language === 'ar' ? 'خريطة تضاريس ثلاثية الأبعاد' : '3D Earth terrain map'}
    />
  )
}

function createFeatures(markers, selectedSiteId) {
  return {
    type: 'FeatureCollection',
    features: markers.map((marker) => ({
      type: 'Feature',
      properties: {
        siteId: marker.siteId,
        name: marker.name,
        label: marker.label,
        confidence: marker.confidence,
        score: marker.score,
        selected: marker.siteId === selectedSiteId,
      },
      geometry: {
        type: 'Point',
        coordinates: [marker.lon, marker.lat],
      },
    })),
  }
}
