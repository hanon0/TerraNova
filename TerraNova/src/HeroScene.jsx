import { lazy, Suspense, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Globe2, Moon, Orbit } from 'lucide-react'
import './HeroScene.css'

const HeroPlanetCanvas = lazy(() => import('./HeroPlanetCanvas.jsx'))

function HeroScene() {
  const reduceMotion = useReducedMotion()
  const [show3D, setShow3D] = useState(false)

  return (
    <motion.section
      className="hero-scene"
      aria-label="Earth, Moon, and Mars"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.65 }}
    >
      <div className="hero-copy">
        <p className="eyebrow">EARTH · MOON · MARS</p>
        <h1>Explore worlds through their analogs.</h1>
        <p>
          Compare reviewed field sites with proposed planetary environments. Candidate
          regions remain clearly marked until scientifically verified.
        </p>
        <div className="hero-planet-labels" aria-label="Planets shown">
          <span><Globe2 aria-hidden="true" size={14} />Earth</span>
          <span><Moon aria-hidden="true" size={14} />Moon</span>
          <span><Orbit aria-hidden="true" size={14} />Mars</span>
        </div>
        <button
          className="hero-3d-button"
          type="button"
          aria-pressed={show3D}
          onClick={() => setShow3D((active) => !active)}
        >
          {show3D ? 'Hide 3D overview' : 'Explore 3D overview'}
        </button>
        <small className="hero-attribution">
          NASA Visible Earth Blue Marble · NASA / NASA Trek LRO WAC and MOLA
        </small>
      </div>
      <div className={show3D ? 'hero-canvas-wrap is-active' : 'hero-canvas-wrap'}>
        {show3D ? (
          <Suspense fallback={<div className="hero-canvas-loading" role="status">Loading 3D overview…</div>}>
            <HeroPlanetCanvas reduceMotion={reduceMotion} />
          </Suspense>
        ) : (
          <div className="hero-static-system" aria-hidden="true">
            <img className="hero-static-planet hero-static-earth" src="/textures/earth-blue-marble.jpg" alt="" />
            <img className="hero-static-planet hero-static-moon" src="/textures/moon-global.jpg" alt="" />
            <img className="hero-static-planet hero-static-mars" src="/textures/mars-global.jpg" alt="" />
            <span className="hero-orbit-path" />
          </div>
        )}
      </div>
    </motion.section>
  )
}

export default HeroScene
