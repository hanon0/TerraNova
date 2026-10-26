/* eslint react/no-unknown-property: "off" */
import { Canvas, events as createPointerEvents, useFrame, useThree } from '@react-three/fiber'
import {
  Clone,
  Html,
  OrbitControls,
  PerformanceMonitor,
  useGLTF,
} from '@react-three/drei'
import { Suspense } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Component,
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Vector3 } from 'three'
import analogTargetPairs from './data/analog-target-pairs.json'
import './PlanetBento.css'

const PLANETS = {
  earth: {
    label: 'Earth',
    model: '/3d-models/Earth_1_12756.glb',
    preview: '/textures/earth-blue-marble.jpg',
    radius: 1.15,
    scale: 0.0023,
  },
  moon: {
    label: 'Moon',
    model: '/3d-models/Moon_NASA_LRO_15k_Grid_Small.glb',
    preview: '/textures/moon-global.jpg',
    radius: 1.18,
    scale: 1.18,
  },
  mars: {
    label: 'Mars',
    model: '/3d-models/24881_Mars_1_6792.glb',
    preview: '/textures/mars-global.jpg',
    radius: 1.15,
    scale: 0.0023,
  },
}

const BODY_ORDER = ['earth', 'moon', 'mars']
const CAMERA_HOME = [0, 0, 4.1]
const CAMERA_TARGET_HOME = [0, 0, 0]

function getSurfacePoint(latitude, longitude, radius) {
  const lat = (latitude * Math.PI) / 180
  const lon = (longitude * Math.PI) / 180
  return new Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  )
}

function buildCandidateMarkers() {
  return Object.entries(analogTargetPairs).flatMap(([siteId, candidates]) =>
    candidates.map((candidate) => ({
      siteId: Number(siteId),
      name: candidate.label,
      latitude: candidate.lat,
      longitude: candidate.lon,
      confidence: candidate.confidence,
      body: candidate.body,
    })),
  )
}

const candidateMarkers = buildCandidateMarkers()

function PlanetModel({
  body,
  isMain,
  bodyGroupRef,
  onModelReady,
  markers,
  onSelectMarker,
  selectedSiteId,
  resetSignal,
  getCameraPose,
  saveCameraPose,
  registerControls,
  resetCamera,
}) {
  const { scene } = useGLTF(PLANETS[body].model)
  const camera = useThree((state) => state.camera)
  const model = useMemo(() => scene.clone(true), [scene])
  const rotatingModel = useRef(null)
  useEffect(() => onModelReady(body), [body, onModelReady])
  useFrame((_, delta) => {
    if (!isMain && rotatingModel.current) rotatingModel.current.rotation.y += delta * 0.09
  })

  useEffect(() => {
    if (!isMain) return
    const saved = getCameraPose(body)
    camera.position.fromArray(saved?.position ?? CAMERA_HOME)
    camera.lookAt(...(saved?.target ?? CAMERA_TARGET_HOME))
    camera.updateProjectionMatrix()
  }, [body, camera, getCameraPose, isMain])

  useEffect(() => {
    if (!isMain || resetSignal === 0) return
    resetCamera(body, camera)
  }, [body, camera, isMain, resetCamera, resetSignal])

  return (
    <>
      <group ref={bodyGroupRef}>
        <ambientLight intensity={isMain ? 0.65 : 0.85} />
        <directionalLight
          position={[-3, 4, 5]}
          intensity={isMain ? 2.1 : 1.1}
          castShadow={isMain}
        />
        <group ref={rotatingModel}>
          <Clone object={model} scale={PLANETS[body].scale} />
        </group>
        {isMain &&
          markers.map((marker, index) => {
            const point = getSurfacePoint(
              marker.latitude,
              marker.longitude,
              PLANETS[body].radius,
            )
            const selected = marker.siteId === selectedSiteId
            return (
              <Marker
                key={`${marker.siteId}-${index}`}
                marker={marker}
                point={point}
                selected={selected}
                onSelectMarker={onSelectMarker}
              />
            )
          })}
      </group>
      {isMain && (
        <OrbitControls
          makeDefault
          ref={(controls) => {
            registerControls(body, controls)
          }}
          enableDamping
          dampingFactor={0.08}
          minDistance={2.5}
          maxDistance={10}
          onChange={(event) => {
            const controls = event?.target
            if (!controls) return
            saveCameraPose(body, {
              position: controls.object.position.toArray(),
              target: controls.target.toArray(),
            })
          }}
        />
      )}
    </>
  )
}

function Marker({ marker, point, selected, onSelectMarker }) {
  const [hovered, setHovered] = useState(false)
  const radius = selected ? 0.047 : 0.032

  return (
    <mesh
      position={point}
      onClick={(event) => {
        event.stopPropagation()
        onSelectMarker(marker.siteId)
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = ''
      }}
    >
      <sphereGeometry args={[radius, 12, 10]} />
      <meshBasicMaterial color={marker.confidence === 'verified' ? '#b8ffe0' : '#ffbd7a'} />
      {(hovered || selected) && (
        <Html distanceFactor={3.5} position={[0, 0.09, 0]} center>
          <span className="planet-marker-tooltip">{marker.name}</span>
        </Html>
      )}
    </mesh>
  )
}

class CanvasErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('Planetary 3D viewer failed; showing static globe previews.', error)
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function MultiViewportRenderer({
  mainBody,
  slotRefs,
  groupRefs,
  cameraPoses,
  controlsByBody,
  isSlow,
}) {
  const { gl, scene, camera } = useThree()

  // Multi-viewport rendering requires updating Three.js renderer, camera, and visibility state per frame.
  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    const canvasRect = gl.domElement.getBoundingClientRect()
    const previousAutoClear = gl.autoClear
    gl.autoClear = false
    gl.setClearColor(0x000000, 0)
    gl.setScissorTest(true)

    for (const body of BODY_ORDER) {
      if (isSlow && body !== mainBody) continue
      const slot = slotRefs[body].current
      const rect = slot?.getBoundingClientRect()
      if (!rect || rect.width <= 0 || rect.height <= 0) continue

      const left = Math.max(0, Math.floor(rect.left - canvasRect.left))
      const right = Math.min(canvasRect.width, Math.ceil(rect.right - canvasRect.left))
      const bottom = Math.max(0, Math.floor(canvasRect.bottom - rect.bottom))
      const top = Math.min(canvasRect.height, Math.ceil(canvasRect.bottom - rect.top))
      const width = right - left
      const height = top - bottom
      if (width <= 0 || height <= 0) continue
      gl.setViewport(left, bottom, width, height)
      gl.setScissor(left, bottom, width, height)
      gl.clear(true, true, true)

      const pose = cameraPoses.current[body] ?? {
        position: CAMERA_HOME,
        target: CAMERA_TARGET_HOME,
      }
      camera.position.fromArray(pose.position)
      camera.up.set(0, 1, 0)
      camera.lookAt(...pose.target)
      camera.aspect = width / height
      camera.updateProjectionMatrix()

      for (const key of BODY_ORDER) {
        if (groupRefs[key].current) groupRefs[key].current.visible = key === body
      }
      gl.render(scene, camera)
    }

    const mainPose = cameraPoses.current[mainBody] ?? {
      position: CAMERA_HOME,
      target: CAMERA_TARGET_HOME,
    }
    camera.position.fromArray(mainPose.position)
    camera.lookAt(...mainPose.target)
    const activeControls = controlsByBody.current[mainBody]
    if (activeControls) activeControls.target.fromArray(mainPose.target)
    camera.aspect = gl.domElement.clientWidth / Math.max(gl.domElement.clientHeight, 1)
    camera.updateProjectionMatrix()

    for (const body of BODY_ORDER) {
      if (groupRefs[body].current) groupRefs[body].current.visible = body === mainBody
    }
    gl.setScissorTest(false)
    gl.autoClear = previousAutoClear
  }, 1)
  /* eslint-enable react-hooks/immutability */

  return null
}

function PlanetBento({ mainBody, onMainBodyChange, markers, selectedSiteId, onSelectSite }) {
  const rootRef = useRef(null)
  const slotRefs = useMemo(() => ({
    earth: createRef(),
    moon: createRef(),
    mars: createRef(),
  }), [])
  const groupRefs = useMemo(() => ({
    earth: createRef(),
    moon: createRef(),
    mars: createRef(),
  }), [])
  const cameraPoses = useRef({})
  const controlsByBody = useRef({})
  const [resetSignal, setResetSignal] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isSlow, setIsSlow] = useState(false)
  const [canvasFailed, setCanvasFailed] = useState(false)
  const [readyBodies, setReadyBodies] = useState([])
  const reduceMotion = useReducedMotion()
  const otherBodies = BODY_ORDER.filter((body) => body !== mainBody)
  const modelsReady = BODY_ORDER.every((body) => readyBodies.includes(body))

  const getCameraPose = useCallback((body) => cameraPoses.current[body], [])
  const saveCameraPose = useCallback((body, pose) => {
    cameraPoses.current[body] = pose
  }, [])
  const registerControls = useCallback((body, controls) => {
    if (controls) controlsByBody.current[body] = controls
    else delete controlsByBody.current[body]
  }, [])
  const resetCamera = useCallback((body, camera) => {
    camera.position.fromArray(CAMERA_HOME)
    camera.lookAt(...CAMERA_TARGET_HOME)
    camera.updateProjectionMatrix()
    controlsByBody.current[body]?.target.set(...CAMERA_TARGET_HOME)
    controlsByBody.current[body]?.update()
    cameraPoses.current[body] = {
      position: [...CAMERA_HOME],
      target: [...CAMERA_TARGET_HOME],
    }
  }, [])
  const onModelReady = useCallback((body) => {
    setReadyBodies((current) => (
      current.includes(body) ? current : [...current, body]
    ))
  }, [])
  const bodyMarkers = useMemo(() => {
    const values = {
      earth: markers.map(({ lat, lon, ...marker }) => ({
        ...marker,
        latitude: lat,
        longitude: lon,
      })),
      moon: [],
      mars: [],
    }
    for (const marker of candidateMarkers) values[marker.body].push(marker)
    return values
  }, [markers])

  const focusBody = (body) => {
    if (body !== mainBody) {
      setIsPaused(false)
      onMainBodyChange(body)
    }
  }

  return (
    <div
      className="planet-bento"
      ref={rootRef}
      data-main-body={mainBody}
      data-models-ready={modelsReady}
    >
      <div className="planet-bento-slots">
        <AnimatePresence initial={false}>
          {[mainBody, ...otherBodies].map((body, index) => {
            const isMain = index === 0
            return (
              <motion.div
                key={body}
                layout
                layoutId={`planet-slot-${body}`}
                ref={slotRefs[body]}
                className={`planet-slot ${isMain ? 'planet-slot-main' : 'planet-slot-small'}`}
                data-body={body}
                data-testid={`planet-slot-${body}`}
                role={isMain ? undefined : 'button'}
                tabIndex={isMain ? undefined : 0}
                aria-label={
                  isMain
                    ? `${PLANETS[body].label} main view`
                    : `Focus ${PLANETS[body].label}`
                }
                onClick={() => focusBody(body)}
                onKeyDown={(event) => {
                  if (!isMain && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault()
                    focusBody(body)
                  }
                }}
                transition={{
                  layout: {
                    duration: reduceMotion ? 0 : 0.38,
                    ease: [0.22, 1, 0.36, 1],
                  },
                }}
              >
                {canvasFailed || !modelsReady || (!isMain && isSlow) ? (
                  <img className="planet-static-preview" src={PLANETS[body].preview} alt="" />
                ) : null}
                <div className="planet-slot-caption">
                  <strong>{PLANETS[body].label}</strong>
                  <span>{bodyMarkers[body].length} markers</span>
                  {!isMain && <small>Click to focus</small>}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
      {!canvasFailed && (
        <CanvasErrorBoundary onError={() => setCanvasFailed(true)}>
          <Suspense fallback={null}>
            <Canvas
              className="planet-bento-canvas"
              data-testid="planet-bento-canvas"
              eventSource={rootRef}
              events={(state) => ({
                ...createPointerEvents(state),
                compute: (event, currentState) => {
                  const rect = slotRefs[mainBody].current?.getBoundingClientRect()
                  if (!rect) return
                  currentState.pointer.set(
                    ((event.clientX - rect.left) / rect.width) * 2 - 1,
                    -((event.clientY - rect.top) / rect.height) * 2 + 1,
                  )
                  currentState.raycaster.setFromCamera(
                    currentState.pointer,
                    currentState.camera,
                  )
                },
              })}
              dpr={[1, Math.min(window.devicePixelRatio || 1, 1.35)]}
              camera={{ position: CAMERA_HOME, fov: 42, near: 0.1, far: 100 }}
              gl={{ antialias: window.innerWidth >= 768, powerPreference: 'low-power' }}
              frameloop={isPaused ? 'demand' : 'always'}
              onCreated={({ gl }) => {
                gl.domElement.dataset.planetaryCanvas = 'true'
              }}
            >
              <PerformanceMonitor
                onDecline={() => setIsSlow(true)}
                onIncline={() => setIsSlow(false)}
              />
              {BODY_ORDER.map((body) => (
                <PlanetModel
                  key={body}
                  body={body}
                  bodyGroupRef={groupRefs[body]}
                  onModelReady={onModelReady}
                  isMain={body === mainBody}
                  markers={bodyMarkers[body]}
                  onSelectMarker={onSelectSite}
                  selectedSiteId={selectedSiteId}
                  resetSignal={resetSignal}
                  getCameraPose={getCameraPose}
                  saveCameraPose={saveCameraPose}
                  registerControls={registerControls}
                  resetCamera={resetCamera}
                />
              ))}
              <MultiViewportRenderer
                mainBody={mainBody}
                slotRefs={slotRefs}
                groupRefs={groupRefs}
                cameraPoses={cameraPoses}
                controlsByBody={controlsByBody}
                isSlow={isSlow}
              />
            </Canvas>
          </Suspense>
        </CanvasErrorBoundary>
      )}
      {!canvasFailed && (
        <div className="planet-main-controls" aria-label="Main planet controls">
          <button type="button" onClick={() => controlsByBody.current[mainBody]?.dollyIn(1.3)}>
            Zoom
          </button>
          <button type="button" onClick={() => setResetSignal((value) => value + 1)}>
            Reset
          </button>
          <button type="button" onClick={() => setIsPaused((paused) => !paused)}>
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      )}
    </div>
  )
}

export default PlanetBento

for (const body of BODY_ORDER) useGLTF.preload(PLANETS[body].model)
