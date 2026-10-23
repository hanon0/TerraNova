import { useState } from 'react'
import analogData from './data/analogs.json'
import missionTemplateData from './data/mission-templates.json'
import {
  analogSiteSchema,
  missionTemplatesSchema,
} from './lib/dataSchemas.js'
import { buildMissionPlan, formatMissionPlanMarkdown } from './lib/missionPlanner.js'
import './MissionPlanner.css'

const sites = analogSiteSchema.array().parse(analogData)
const templates = missionTemplatesSchema.parse(missionTemplateData)

const COPY = {
  en: {
    title: 'Mission planner',
    intro: 'Build a draft field-mission checklist from a verified site’s descriptive tags.',
    back: 'Explorer',
    language: 'العربية',
    site: 'Site',
    team: 'Team size',
    duration: 'Planned duration (days)',
    objectives: 'Mission objectives',
    generate: 'Build starting-point plan',
    selectObjective: 'Choose at least one objective.',
    error: 'Could not build the plan',
    plan: 'Starting-point mission plan',
    teamSummary: 'Team size',
    durationSummary: 'Selected duration',
    tagSuggestions: 'Suggestions from site tags',
    equipment: 'Equipment and materials to consider',
    roles: 'Suggested roles',
    durationRange: 'Starting-point duration range',
    within: 'Within this tag’s suggested range',
    outside: 'Outside this tag’s suggested range; review with the team',
    unmatched: 'No template is defined for these site tags',
    print: 'Print',
    markdown: 'Export Markdown',
    checklist: 'Check items during planning',
    one: 'day',
    many: 'days',
  },
  ar: {
    title: 'مخطط المهمة',
    intro: 'أنشئ قائمة ميدانية أولية بالاستناد إلى خصائص موقع موثق.',
    back: 'المستكشف',
    language: 'English',
    site: 'الموقع',
    team: 'حجم الفريق',
    duration: 'المدة المخططة (أيام)',
    objectives: 'أهداف المهمة',
    generate: 'إنشاء خطة أولية',
    selectObjective: 'اختر هدفاً واحداً على الأقل.',
    error: 'تعذر إنشاء الخطة',
    plan: 'خطة مهمة أولية',
    teamSummary: 'حجم الفريق',
    durationSummary: 'المدة المختارة',
    tagSuggestions: 'اقتراحات مستمدة من خصائص الموقع',
    equipment: 'معدات ومواد للنظر فيها',
    roles: 'أدوار مقترحة',
    durationRange: 'نطاق مدة تخطيط أولي',
    within: 'ضمن النطاق المقترح لهذه الخاصية',
    outside: 'خارج النطاق المقترح لهذه الخاصية؛ راجع الفريق',
    unmatched: 'لا توجد قوالب لهذه الخصائص',
    print: 'طباعة',
    markdown: 'تصدير Markdown',
    checklist: 'ضع علامة على البنود أثناء التخطيط',
    one: 'يوم',
    many: 'أيام',
  },
}

function downloadMarkdown(plan, language) {
  const url = URL.createObjectURL(
    new Blob([formatMissionPlanMarkdown(plan, language)], {
      type: 'text/markdown;charset=utf-8',
    }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `terranova-mission-plan-${plan.site.id}.md`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function MissionPlanner() {
  const [language, setLanguage] = useState('en')
  const [siteId, setSiteId] = useState(String(sites[0].id))
  const [teamSize, setTeamSize] = useState('4')
  const [durationDays, setDurationDays] = useState(
    String(templates.defaultDurationDays.min),
  )
  const [objectiveIds, setObjectiveIds] = useState([templates.objectives[0].id])
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const [checkedItems, setCheckedItems] = useState({})
  const text = COPY[language]
  const isArabic = language === 'ar'

  function toggleObjective(id) {
    setObjectiveIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
    setPlan(null)
  }

  function generatePlan(event) {
    event.preventDefault()
    if (!objectiveIds.length) {
      setError(text.selectObjective)
      setPlan(null)
      return
    }

    try {
      const selectedSite = sites.find(({ id }) => id === Number(siteId))
      if (!selectedSite) throw new RangeError('Select a valid site.')
      const nextPlan = buildMissionPlan({
        site: selectedSite,
        teamSize: Number(teamSize),
        durationDays: Number(durationDays),
        objectiveIds,
        templates,
      })
      setPlan(nextPlan)
      setCheckedItems({})
      setError('')
    } catch (cause) {
      setPlan(null)
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  function toggleChecklistItem(id) {
    setCheckedItems((current) => ({ ...current, [id]: !current[id] }))
  }

  return (
    <main className="mission-page" dir={isArabic ? 'rtl' : 'ltr'}>
      <header className="mission-header">
        <a href="/" className="mission-brand">
          <img src="/terranovalogo.jpeg" alt="TerraNova logo" />
          <span>TerraNova</span>
        </a>
        <div className="mission-header-actions">
          <a className="mission-header-link" href="/">
            {text.back}
          </a>
          <button
            type="button"
            className="mission-header-link"
            onClick={() => setLanguage(isArabic ? 'en' : 'ar')}
            aria-label="Toggle language"
          >
            {text.language}
          </button>
        </div>
      </header>

      <div className="mission-content">
        <p className="eyebrow">TERRANOVA / FIELD PLANNING</p>
        <h1>{text.title}</h1>
        <p className="mission-intro">{text.intro}</p>
        <p className="mission-disclaimer" role="note">
          {isArabic ? templates.disclaimerAr : templates.disclaimerEn}
        </p>

        <form className="mission-form" onSubmit={generatePlan}>
          <label>
            {text.site}
            <select value={siteId} onChange={(event) => setSiteId(event.target.value)}>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.nameEn} — {site.nameAr}
                </option>
              ))}
            </select>
          </label>
          <label>
            {text.team}
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              required
              value={teamSize}
              onChange={(event) => setTeamSize(event.target.value)}
            />
          </label>
          <label>
            {text.duration}
            <input
              type="number"
              min="1"
              max="30"
              step="1"
              required
              value={durationDays}
              onChange={(event) => setDurationDays(event.target.value)}
            />
          </label>
          <fieldset className="mission-objectives">
            <legend>{text.objectives}</legend>
            {templates.objectives.map((objective) => (
              <label key={objective.id}>
                <input
                  type="checkbox"
                  checked={objectiveIds.includes(objective.id)}
                  onChange={() => toggleObjective(objective.id)}
                />
                <span>{isArabic ? objective.labelAr : objective.labelEn}</span>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="mission-primary">
            {text.generate}
          </button>
        </form>

        {error && (
          <p className="mission-error" role="alert">
            {text.error}: {error}
          </p>
        )}

        {plan && (
          <section className="mission-plan" aria-labelledby="mission-plan-title">
            <div className="mission-plan-heading">
              <div>
                <p className="eyebrow">{text.tagSuggestions}</p>
                <h2 id="mission-plan-title">
                  {text.plan}: {isArabic ? plan.site.nameAr : plan.site.nameEn}
                </h2>
              </div>
              <div className="mission-plan-actions">
                <button type="button" onClick={() => window.print()}>
                  {text.print}
                </button>
                <button type="button" onClick={() => downloadMarkdown(plan, language)}>
                  {text.markdown}
                </button>
              </div>
            </div>

            <dl className="mission-summary">
              <div>
                <dt>{text.teamSummary}</dt>
                <dd>{plan.teamSize}</dd>
              </div>
              <div>
                <dt>{text.durationSummary}</dt>
                <dd>
                  {plan.durationDays} {plan.durationDays === 1 ? text.one : text.many}
                </dd>
              </div>
            </dl>

            <section className="mission-objective-summary">
              <h3>{text.objectives}</h3>
              {plan.objectives.map((objective) => (
                <article key={objective.id}>
                  <h4>{isArabic ? objective.labelAr : objective.labelEn}</h4>
                  <p>{isArabic ? objective.suggestionAr : objective.suggestionEn}</p>
                </article>
              ))}
            </section>

            <p className="mission-checklist-note">{text.checklist}</p>
            <div className="mission-rule-list">
              {plan.tagRules.map((rule) => (
                <article className="mission-rule" key={rule.tag}>
                  <h3>{isArabic ? rule.labelAr : rule.labelEn}</h3>
                  <p className="mission-range">
                    {text.durationRange}: {rule.durationDays.min}–{rule.durationDays.max}{' '}
                    {text.many}
                  </p>
                  <p className="mission-range-status">
                    {rule.withinRange ? text.within : text.outside}
                  </p>
                  <h4>{text.equipment}</h4>
                  <ul>
                    {(isArabic ? rule.equipmentAr : rule.equipmentEn).map((item, index) => {
                      const id = `${rule.tag}-equipment-${index}`
                      return (
                        <li key={id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={Boolean(checkedItems[id])}
                              onChange={() => toggleChecklistItem(id)}
                            />
                            <span>{item}</span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                  <h4>{text.roles}</h4>
                  <ul>
                    {(isArabic ? rule.rolesAr : rule.rolesEn).map((role) => (
                      <li key={role}>{role}</li>
                    ))}
                  </ul>
                </article>
              ))}
              {plan.unmatchedTags.length > 0 && (
                <p className="mission-unmatched">
                  {text.unmatched}: {plan.unmatchedTags.join(', ')}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
