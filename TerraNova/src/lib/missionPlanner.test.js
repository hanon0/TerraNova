import { describe, expect, it } from 'vitest'
import analogData from '../data/analogs.json'
import missionTemplateData from '../data/mission-templates.json'
import { TAGS } from '../data/tag-definitions.js'
import { analogSiteSchema } from './dataSchemas.js'
import { buildMissionPlan, formatMissionPlanMarkdown } from './missionPlanner.js'

const sites = analogSiteSchema.array().parse(analogData)
const templates = missionTemplateData

describe('mission planner', () => {
  it('has a validated rule for each editable site tag', () => {
    expect(Object.keys(templates.tagRules).sort()).toEqual(TAGS.map(([tag]) => tag).sort())
  })

  it('builds tag-based equipment, role, and duration suggestions', () => {
    const plan = buildMissionPlan({
      site: sites[0],
      teamSize: 5,
      durationDays: 2,
      objectiveIds: ['geologic_mapping'],
      templates,
    })

    expect(plan.site.id).toBe(1)
    expect(plan.objectives.map(({ id }) => id)).toEqual(['geologic_mapping'])
    expect(plan.tagRules.map(({ tag }) => tag)).toEqual(sites[0].tags)
    expect(plan.tagRules[0].equipmentEn.length).toBeGreaterThan(0)
    expect(plan.tagRules[0].rolesEn.length).toBeGreaterThan(0)
    expect(plan.tagRules[0].withinRange).toBe(true)
  })

  it('reports tags without a rule instead of dropping them silently', () => {
    const plan = buildMissionPlan({
      site: { ...sites[0], tags: ['unreviewed_tag'] },
      teamSize: 4,
      durationDays: 1,
      objectiveIds: [],
      templates,
    })

    expect(plan.tagRules).toEqual([])
    expect(plan.unmatchedTags).toEqual(['unreviewed_tag'])
  })

  it('rejects invalid team sizes, durations, objectives, and template data', () => {
    const input = {
      site: sites[0],
      teamSize: 4,
      durationDays: 1,
      objectiveIds: [],
      templates,
    }

    expect(() => buildMissionPlan({ ...input, teamSize: 0 })).toThrow(RangeError)
    expect(() => buildMissionPlan({ ...input, durationDays: 31 })).toThrow(RangeError)
    expect(() =>
      buildMissionPlan({ ...input, objectiveIds: ['unknown_objective'] }),
    ).toThrow('Unknown mission objective')
    expect(() => buildMissionPlan({ ...input, templates: {} })).toThrow()
  })

  it('exports a bilingual Markdown plan with checklist entries', () => {
    const plan = buildMissionPlan({
      site: sites[0],
      teamSize: 3,
      durationDays: 2,
      objectiveIds: ['site_characterization'],
      templates,
    })

    expect(formatMissionPlanMarkdown(plan)).toContain('# Starting-Point Mission Plan')
    expect(formatMissionPlanMarkdown(plan)).toContain('- [ ]')
    expect(formatMissionPlanMarkdown(plan, 'ar')).toContain('# خطة ميدانية أولية')
    expect(formatMissionPlanMarkdown(plan, 'ar')).toContain('### المعدات والمواد')
    expect(formatMissionPlanMarkdown(plan, 'ar')).toContain('- [ ]')
  })
})
