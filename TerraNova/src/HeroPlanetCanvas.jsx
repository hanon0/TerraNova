/* eslint react/no-unknown-property: "off" */
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, Stars } from '@react-three/drei'
import { SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import { Component, useEffect, useRef, useState } from 'react'

const TEXTURE_URLS = [
  '/textures/earth-blue-marble.jpg',
  '/textures/moon-global.jpg',
  '/textures/mars-global.jpg',
]

class HeroCanvasErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Planetary hero WebGL scene failed to initialize.', error)
  }

  render() {
    if (this.state.hasError) {
      return <p className="hero-canvas-error" role="alert">3D unavailable; use the static planetary preview.</p>
    }
    return this.props.children
  }
}

function Planet({ texture, position, radius, color, rotationSpeed }) {
  const group = useRef(null)

  useFrame((_, delta) => {
    if (group.current && rotationSpeed) group.current.rotation.y += delta * rotationSpeed
  })

  return (
    <group ref={group} position={position}>
      <mesh>
        <sphereGeometry args={[radius, 40, 28]} />
        <meshStandardMaterial map={texture} color={color} roughness={1} />
      </mesh>
      <mesh scale={1.04}>
        <sphereGeometry args={[radius, 32, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} />
      </mesh>
    </group>
  )
}

function PlanetarySystem({ textures, reduceMotion, isMobile }) {
  const group = useRef(null)
  const points = [
    new Vector3(-3.2, -0.15, 0),
    new Vector3(-2.3, 0.7, -0.15),
    new Vector3(-1.3, 0.8, -0.3),
    new Vector3(0.3, 0.1, -0.5),
    new Vector3(1.7, -0.4, -0.2),
    new Vector3(3.1, -0.1, 0),
  ]

  useFrame(({ pointer }, delta) => {
    if (!group.current || reduceMotion) return
    group.current.rotation.y += delta * 0.018
    group.current.rotation.x += (pointer.y * 0.045 - group.current.rotation.x) * 0.025
    group.current.rotation.z += (pointer.x * -0.035 - group.current.rotation.z) * 0.025
  })

  return (
    <group ref={group}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[-3, 4, 5]} intensity={2} />
      <Stars radius={45} depth={24} count={isMobile ? 70 : 230} factor={2} fade speed={0.15} />
      <Line points={points} color="#70b8d4" transparent opacity={0.46} lineWidth={1} />
      <Planet texture={textures[0]} position={[-2.65, 0, 0]} radius={1.22} color="#ffffff" rotationSpeed={0.08} />
      <Planet texture={textures[1]} position={[0, -0.3, 0]} radius={0.46} color="#ffffff" rotationSpeed={0.035} />
      <Planet texture={textures[2]} position={[2.55, 0.04, 0]} radius={0.83} color="#ffffff" rotationSpeed={0.06} />
    </group>
  )
}

function HeroPlanetCanvas({ reduceMotion }) {
  const [textures, setTextures] = useState(null)
  const [textureError, setTextureError] = useState('')
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)')
    const updateMobile = () => setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', updateMobile)
    return () => mediaQuery.removeEventListener('change', updateMobile)
  }, [])

  useEffect(() => {
    let active = true
    const loader = new TextureLoader()
    const loaded = []

    Promise.all(
      TEXTURE_URLS.map(async (url) => {
        try {
          const texture = await loader.loadAsync(url)
          texture.colorSpace = SRGBColorSpace
          loaded.push(texture)
          return texture
        } catch (error) {
          throw new Error(`Could not load local planetary image ${url}: ${error.message}`)
        }
      }),
    )
      .then((result) => {
        if (active) setTextures(result)
      })
      .catch((error) => {
        if (active) setTextureError(error.message)
        loaded.forEach((texture) => texture.dispose())
      })

    return () => {
      active = false
      loaded.forEach((texture) => texture.dispose())
    }
  }, [])

  if (textureError) {
    return <p className="hero-canvas-error" role="alert">{textureError}</p>
  }
  if (!textures) return <div className="hero-canvas-loading" role="status">Loading local planetary textures…</div>

  return (
    <HeroCanvasErrorBoundary>
      <Canvas
        aria-label="Textured Earth, Moon, and Mars connected by a trajectory"
        dpr={[1, isMobile ? 1 : 1.2]}
        camera={{ position: [0, 0, 8.7], fov: 36 }}
        gl={{ antialias: !isMobile, powerPreference: 'low-power' }}
      >
        <PlanetarySystem textures={textures} reduceMotion={reduceMotion} isMobile={isMobile} />
      </Canvas>
    </HeroCanvasErrorBoundary>
  )
}

export default HeroPlanetCanvas
