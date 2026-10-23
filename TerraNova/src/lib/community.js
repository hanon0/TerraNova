import { z } from 'zod'
import { TAGS } from '../data/tag-definitions.js'
import { analogSiteSchema } from './dataSchemas.js'

export const COMMUNITY_STORAGE_KEY = 'terranova-community-submissions'

const communityTagSchema = z.enum(TAGS.map(([id]) => id))

export const communitySubmissionSchema = z.object({
  id: z.number().int().positive().refine(Number.isSafeInteger, 'ID must be a safe integer.'),
  status: z.enum(['pending', 'approved', 'rejected']),
  nameAr: z.string().trim().min(1),
  nameEn: z.string().trim().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  targetBodies: z.enum(['moon', 'mars', 'both']),
  tags: z.array(communityTagSchema).min(1),
  geology: z.string().trim().min(1),
  environment: z.string().trim().min(1),
  source: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) =>
        z.string().url().safeParse(value).success ||
        /^(?:doi:\s*)?(?:https?:\/\/(?:dx\.)?doi\.org\/)?10\.\d{4,9}\/\S+$/i.test(value),
      'Enter a valid URL or DOI.',
    ),
})

/**
 * @param {Pick<Storage, 'getItem'>} storage
 * @returns {import('./dataSchemas.js').CommunitySubmission[]}
 */
export function loadCommunitySubmissions(storage = globalThis.localStorage) {
  const stored = storage.getItem(COMMUNITY_STORAGE_KEY)
  if (stored === null) return []
  const submissions = z.array(communitySubmissionSchema).parse(JSON.parse(stored))
  const ids = submissions.map(({ id }) => id)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Stored community submissions contain duplicate IDs.')
  }
  return submissions
}

/**
 * @param {import('./dataSchemas.js').CommunitySubmission[]} submissions
 * @param {Pick<Storage, 'setItem'>} storage
 */
export function saveCommunitySubmissions(submissions, storage = globalThis.localStorage) {
  const validated = z.array(communitySubmissionSchema).parse(submissions)
  const ids = validated.map(({ id }) => id)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Community submissions contain duplicate IDs.')
  }
  storage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(validated))
}

/**
 * @param {import('./dataSchemas.js').CommunitySubmission} input
 * @returns {import('./dataSchemas.js').AnalogSite & { isCommunity: true }}
 */
export function toCommunityAnalogSite(input) {
  const submission = communitySubmissionSchema.parse(input)
  const site = analogSiteSchema.parse({
    id: 1_000_000 + submission.id,
    nameAr: submission.nameAr,
    nameEn: submission.nameEn,
    countryRegionAr: 'لم يتم التحقق بعد',
    categoryAr: 'مساهمة مجتمعية',
    geologyAr: submission.geology,
    environmentAr: submission.environment,
    missionAr: 'لم يتم التحقق بعد',
    source: submission.source,
    targetBodies: submission.targetBodies,
    targetFeatureAr: 'Not yet verified',
    tags: submission.tags,
    locations: [
      {
        label: submission.nameEn,
        lat: submission.lat,
        lon: submission.lon,
        confidence: 'approximate',
        note: 'Community-provided location; not independently verified.',
      },
    ],
    dimensionsAr: '',
  })
  return { ...site, isCommunity: true }
}

export function formatGitHubIssue(submission) {
  const validated = communitySubmissionSchema.parse(submission)
  return [
    `## Community site: ${validated.nameEn}`,
    '',
    `- Arabic name: ${validated.nameAr}`,
    `- Coordinates: ${validated.lat}, ${validated.lon}`,
    `- Target body: ${validated.targetBodies}`,
    `- Tags: ${validated.tags.join(', ')}`,
    `- Source: ${validated.source}`,
    '',
    '### Geology',
    validated.geology,
    '',
    '### Environment',
    validated.environment,
    '',
    'Demo submission. Please verify all scientific and location details before inclusion.',
  ].join('\n')
}
