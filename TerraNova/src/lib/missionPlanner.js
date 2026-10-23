import { missionTemplatesSchema } from './dataSchemas.js'

/**
 * @param {{
 *   site: import('./dataSchemas.js').AnalogSite,
 *   teamSize: number,
 *   durationDays: number,
 *   objectiveIds: string[],
 *   templates: unknown
 * }} input
 * @returns {import('./dataSchemas.js').MissionPlan}
 */
export function buildMissionPlan({ site, teamSize, durationDays, objectiveIds, templates }) {
  const data = missionTemplatesSchema.parse(templates)
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 100) {
    throw new RangeError('Team size must be an integer between 1 and 100.')
  }
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 30) {
    throw new RangeError('Duration must be an integer between 1 and 30 days.')
  }
  const validObjectiveIds = new Set(data.objectives.map(({ id }) => id))
  const invalidObjectiveIds = objectiveIds.filter((id) => !validObjectiveIds.has(id))
  if (invalidObjectiveIds.length) {
    throw new RangeError(`Unknown mission objective: ${invalidObjectiveIds.join(', ')}`)
  }

  const tagRules = []
  const unmatchedTags = []
  for (const tag of site.tags) {
    const rule = data.tagRules[tag]
    if (!rule) {
      unmatchedTags.push(tag)
      continue
    }
    tagRules.push({
      tag,
      ...rule,
      withinRange:
        durationDays >= rule.durationDays.min && durationDays <= rule.durationDays.max,
    })
  }

  return {
    site,
    teamSize,
    durationDays,
    objectives: data.objectives.filter(({ id }) => objectiveIds.includes(id)),
    tagRules,
    unmatchedTags,
  }
}

/**
 * @param {import('./dataSchemas.js').MissionPlan} plan
 * @param {'en'|'ar'} language
 */
export function formatMissionPlanMarkdown(plan, language = 'en') {
  const isArabic = language === 'ar'
  const text = isArabic
    ? {
        title: 'خطة ميدانية أولية',
        site: 'الموقع',
        team: 'حجم الفريق',
        duration: 'المدة المختارة',
        days: 'أيام',
        objectives: 'الأهداف المختارة',
        suggestions: 'اقتراحات حسب الخصائص',
        equipment: 'المعدات والمواد',
        roles: 'الأدوار المقترحة',
        range: 'نطاق مدة التخطيط الأولي',
        checklist: 'قائمة التحقق',
      }
    : {
        title: 'Starting-Point Mission Plan',
        site: 'Site',
        team: 'Team size',
        duration: 'Selected duration',
        days: 'days',
        objectives: 'Selected objectives',
        suggestions: 'Tag-based suggestions',
        equipment: 'Equipment and materials',
        roles: 'Suggested roles',
        range: 'Starting-point duration range',
        checklist: 'Checklist',
      }
  const lines = [
    `# ${text.title}: ${plan.site.nameEn}`,
    '',
    `- ${text.site}: ${plan.site.nameEn} / ${plan.site.nameAr}`,
    `- ${text.team}: ${plan.teamSize}`,
    `- ${text.duration}: ${plan.durationDays} ${text.days}`,
    '',
    `## ${text.objectives}`,
    ...plan.objectives.map(({ labelEn, labelAr }) => `- ${isArabic ? labelAr : labelEn}`),
  ]

  for (const rule of plan.tagRules) {
    lines.push(
      '',
      `## ${text.suggestions}: ${isArabic ? rule.labelAr : rule.labelEn}`,
      `### ${text.equipment}`,
      ...(isArabic ? rule.equipmentAr : rule.equipmentEn).map((item) => `- [ ] ${item}`),
      `### ${text.roles}`,
      ...(isArabic ? rule.rolesAr : rule.rolesEn).map((item) => `- [ ] ${item}`),
      `- ${text.range}: ${rule.durationDays.min}–${rule.durationDays.max} ${text.days}`,
    )
  }
  return lines.join('\n')
}
