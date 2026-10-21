import { describe, expect, it } from 'vitest'
import { rankAnalogs, scoreAnalog } from './similarity.js'

describe('scoreAnalog', () => {
  it('scores a weighted Jaccard similarity and returns matched and missing tags', () => {
    const result = scoreAnalog(
      { tags: ['anorthosite', 'impact_crater'], targetBodies: 'moon' },
      { anorthosite: 2, polar_permafrost: 3 },
      'moon',
    )
    expect(result.score).toBe(38)
    expect(result.matchedTags).toEqual(['anorthosite'])
    expect(result.missingTags).toEqual(['polar_permafrost'])
    expect(result.explanationEn).toContain('Matches 1 of 2')
  })

  it('adds a small body bonus only when the selected body matches', () => {
    const site = { tags: ['lava_tube', 'impact_crater'], targetBodies: 'mars' }
    expect(scoreAnalog(site, { lava_tube: 1 }, 'mars').score).toBe(55)
    expect(scoreAnalog(site, { lava_tube: 1 }, 'moon').score).toBe(50)
    expect(scoreAnalog(site, { lava_tube: 1 }, 'both').score).toBe(50)
    expect(scoreAnalog({ tags: ['lava_tube', 'impact_crater'], targetBodies: 'both' }, { lava_tube: 1 }, 'both').score).toBe(55)
  })

  it('returns zero when the profile is empty and sorts stable ties by id', () => {
    expect(scoreAnalog({ tags: ['anorthosite'] }, {}, 'moon').score).toBe(0)
    const ranked = rankAnalogs([
      { id: 5, tags: [], targetBodies: 'unknown' },
      { id: 2, tags: [], targetBodies: 'unknown' },
    ], {}, 'both')
    expect(ranked.map(({ site }) => site.id)).toEqual([2, 5])
  })
})
