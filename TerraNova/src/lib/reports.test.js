import { describe, expect, it } from 'vitest'
import { buildProposalSections, formatProposalMarkdown } from './reports.js'

const site = {
  id: 5,
  nameAr: 'أنبوب بركاني',
  nameEn: 'Lava Tube',
  source: 'Verified Source (2024)',
  categoryAr: 'Volcanic feature',
  geologyAr: 'Basaltic lava tube',
  environmentAr: 'Arid environment',
  targetBodies: 'moon',
}

const match = {
  score: 75,
  matchedTags: ['lava_tube'],
  missingTags: ['polar_permafrost'],
  explanationEn: 'Matches one characteristic.',
  explanationAr: 'يتطابق مع خاصية واحدة.',
}

const fieldNotes = { hazards: null }
const logistics = { nearestAirport: null }

describe('project proposal templates', () => {
  it('produces deterministic sections with explicit unknowns and verified references', () => {
    const proposal = buildProposalSections({
      site,
      match,
      fieldNotes,
      logistics,
      language: 'en',
    })
    const markdown = formatProposalMarkdown(proposal)

    expect(proposal.sections.map(({ heading }) => heading)).toEqual([
      'Background',
      'Site justification',
      'Analog relevance',
      'Proposed activities',
      'Risks',
      'Logistics',
      'References',
    ])
    expect(markdown).toContain('Not yet verified, contact local authorities.')
    expect(markdown).toContain('Verified Source (2024)')
    expect(markdown).toContain('lava_tube')
  })

  it('supports Arabic proposal text', () => {
    const proposal = buildProposalSections({
      site,
      match,
      fieldNotes,
      logistics,
      language: 'ar',
    })
    expect(formatProposalMarkdown(proposal)).toContain('# مقترح مشروع: أنبوب بركاني')
    expect(proposal.sections[1].body).toContain('يتطابق')
  })
})
