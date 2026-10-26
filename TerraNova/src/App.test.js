import { describe, expect, it } from 'vitest'
import { locationConfidence } from './lib/locationConfidence.js'

describe('locationConfidence', () => {
  it('prefers verified locations over approximate ones when a site has mixed confidence', () => {
    const site = {
      locations: [
        { confidence: 'approximate', lat: 10, lon: 20 },
        { confidence: 'verified', lat: 11, lon: 21 },
      ],
    }

    expect(locationConfidence(site)).toBe('verified')
  })

  it('returns missing when no mapped coordinates are available', () => {
    expect(locationConfidence({ locations: [{ confidence: 'missing' }] })).toBe('missing')
  })
})
