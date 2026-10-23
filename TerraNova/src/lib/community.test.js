import { describe, expect, it } from 'vitest'
import {
  COMMUNITY_STORAGE_KEY,
  communitySubmissionSchema,
  formatGitHubIssue,
  loadCommunitySubmissions,
  saveCommunitySubmissions,
  toCommunityAnalogSite,
} from './community.js'

const submission = {
  id: 12345,
  status: 'pending',
  nameAr: 'موقع تجريبي',
  nameEn: 'Demo site',
  lat: -12.5,
  lon: 45.25,
  targetBodies: 'mars',
  tags: ['lava_tube'],
  geology: 'Contributor-supplied geology description.',
  environment: 'Contributor-supplied environment description.',
  source: '10.1234/example.1',
}

function createStorage() {
  const items = new Map()
  return {
    getItem(key) {
      return items.get(key) ?? null
    },
    setItem(key, value) {
      items.set(key, value)
    },
  }
}

describe('community submissions', () => {
  it('requires a source and accepts URL or DOI references', () => {
    expect(communitySubmissionSchema.safeParse(submission).success).toBe(true)
    expect(communitySubmissionSchema.safeParse({ ...submission, source: '' }).success).toBe(false)
    expect(
      communitySubmissionSchema.safeParse({ ...submission, source: 'not a source' }).success,
    ).toBe(false)
  })

  it('round-trips validated pending submissions through local storage', () => {
    const storage = createStorage()
    saveCommunitySubmissions([submission], storage)

    expect(storage.getItem(COMMUNITY_STORAGE_KEY)).toContain('"status":"pending"')
    expect(loadCommunitySubmissions(storage)).toEqual([submission])
  })

  it('marks approved community sites as unverified approximate locations', () => {
    const site = toCommunityAnalogSite({ ...submission, status: 'approved' })

    expect(site.isCommunity).toBe(true)
    expect(site.locations[0]).toMatchObject({
      lat: submission.lat,
      lon: submission.lon,
      confidence: 'approximate',
    })
    expect(site.source).toBe(submission.source)
  })

  it('formats a reviewable GitHub issue body from the submitted record', () => {
    expect(formatGitHubIssue(submission)).toContain('Community site: Demo site')
    expect(formatGitHubIssue(submission)).toContain('Source: 10.1234/example.1')
  })
})
