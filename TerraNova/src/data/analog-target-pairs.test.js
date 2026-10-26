import { describe, expect, it } from 'vitest'
import analogSites from './analogs.json'
import targetPairs from './analog-target-pairs.json'

describe('analog target comparison pairs', () => {
  it('covers every analog and only proposes unverified target regions', () => {
    expect(Object.keys(targetPairs).map(Number).sort((a, b) => a - b)).toEqual(
      analogSites.map(({ id }) => id).sort((a, b) => a - b),
    )

    for (const site of analogSites) {
      const targets = targetPairs[site.id]
      expect(targets.length).toBeGreaterThan(0)
      for (const target of targets) {
        expect(target.confidence).toBe('proposed')
        expect(['moon', 'mars']).toContain(target.body)
        expect(target.lat).toBeGreaterThanOrEqual(-90)
        expect(target.lat).toBeLessThanOrEqual(90)
        expect(target.lon).toBeGreaterThanOrEqual(-180)
        expect(target.lon).toBeLessThanOrEqual(180)
        expect(target.radiusKm).toBeGreaterThan(0)
        expect(['equirectangular', 'south_pole', 'north_pole']).toContain(
          target.projection,
        )
      }
    }
  })
})
