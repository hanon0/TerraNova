/**
 * @param {{
 *  site: import('./dataSchemas.js').AnalogSite,
 *  match: { score: number, matchedTags: string[], missingTags: string[], explanationEn: string, explanationAr: string },
 *  fieldNotes: import('./dataSchemas.js').FieldNote,
 *  logistics: import('./dataSchemas.js').SiteLogistics,
 *  language: 'en'|'ar'
 * }} input
 */
export function buildProposalSections({ site, match, fieldNotes, logistics, language }) {
  const isArabic = language === 'ar'
  const notVerified = isArabic
    ? 'لم يتم التحقق بعد، يرجى التواصل مع السلطات المحلية.'
    : 'Not yet verified, contact local authorities.'
  const matched = match.matchedTags.length ? match.matchedTags.join(', ') : '—'
  const missing = match.missingTags.length ? match.missingTags.join(', ') : '—'
  const explanation = isArabic ? match.explanationAr : match.explanationEn
  const target = site.targetBodies
  const targetLabel =
    target === 'moon'
      ? isArabic
        ? 'القمر'
        : 'Moon'
      : target === 'mars'
        ? isArabic
          ? 'المريخ'
          : 'Mars'
        : target === 'both'
          ? isArabic
            ? 'القمر والمريخ'
            : 'Moon and Mars'
          : notVerified

  return {
    title: isArabic ? `مقترح مشروع: ${site.nameAr}` : `Project Proposal: ${site.nameEn}`,
    sections: [
      {
        heading: isArabic ? 'الخلفية' : 'Background',
        body: [
          site.categoryAr,
          site.geologyAr,
          site.environmentAr,
          `${isArabic ? 'الجرم المستهدف في السجل' : 'Target body recorded'}: ${targetLabel}`,
        ].join('\n\n'),
      },
      {
        heading: isArabic ? 'مبررات اختيار الموقع' : 'Site justification',
        body: `${explanation} (${match.score}%).`,
      },
      {
        heading: isArabic ? 'صلة الموقع بالمحاكاة' : 'Analog relevance',
        body: [
          `${isArabic ? 'الوسوم المتطابقة' : 'Matched tags'}: ${matched}`,
          `${isArabic ? 'وسوم الهدف غير المتطابقة' : 'Unmatched target tags'}: ${missing}`,
        ].join('\n'),
      },
      {
        heading: isArabic ? 'الأنشطة المقترحة' : 'Proposed activities',
        body: match.matchedTags.length
          ? isArabic
            ? `مجالات تركيز أولية مستمدة من وسوم البيانات المتطابقة: ${matched}. على فريق المهمة تحديد الأنشطة ومراجعتها.`
            : `Starting focus areas derived from matched data tags: ${matched}. The mission team must define and review activities.`
          : isArabic
            ? 'لم تُحدد أنشطة؛ أضفها بعد مراجعة بيانات الموقع من فريق المهمة.'
            : 'No activities specified; add them after the mission team reviews the site data.',
      },
      {
        heading: isArabic ? 'المخاطر' : 'Risks',
        body: [
          `${isArabic ? 'ملاحظات المخاطر اليدوية' : 'Manual hazards'}: ${fieldNotes.hazards ?? notVerified}`,
          isArabic
            ? 'عتبات مراجعة الطقس لم يتم التحقق منها بعد؛ هذا ليس تقييماً للسلامة.'
            : 'Weather review thresholds are not yet verified; this is not a safety assessment.',
        ].join('\n'),
      },
      {
        heading: isArabic ? 'اللوجستيات' : 'Logistics',
        body: logistics.nearestAirport
          ? `${logistics.nearestAirport.name} — ${logistics.nearestAirport.distanceKm} km${logistics.nearestAirport.locationConfidence === 'approximate' ? (isArabic ? ' (موقع تقريبي)' : ' (approximate site location)') : ''}`
          : notVerified,
      },
      {
        heading: isArabic ? 'المراجع' : 'References',
        body: site.source,
      },
    ],
  }
}

export function formatProposalMarkdown(proposal) {
  return [
    `# ${proposal.title}`,
    '',
    ...proposal.sections.flatMap(({ heading, body }) => [`## ${heading}`, '', body, '']),
  ].join('\n')
}
