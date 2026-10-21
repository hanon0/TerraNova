export function scoreAnalog(site, profile, body) {
  const weights = profile ?? {}
  const targetTags = Object.keys(weights).filter((tag) => Number(weights[tag]) > 0)
  const siteTags = new Set(site.tags ?? [])
  const targetTagSet = new Set(targetTags)
  const matchedTags = targetTags.filter((tag) => siteTags.has(tag))
  const missingTags = targetTags.filter((tag) => !siteTags.has(tag))
  const targetWeight = targetTags.reduce((sum, tag) => sum + Number(weights[tag]), 0)
  const siteOnlyWeight = [...siteTags].filter((tag) => !targetTagSet.has(tag)).length
  const intersectionWeight = matchedTags.reduce((sum, tag) => sum + Number(weights[tag]), 0)
  const jaccard = targetWeight + siteOnlyWeight > 0
    ? intersectionWeight / (targetWeight + siteOnlyWeight)
    : 0
  const bodyBonus = body && site.targetBodies === body ? 5 : 0
  const score = Math.min(100, Math.round(jaccard * 100 + bodyBonus))
  const explanationEn = matchedTags.length
    ? `Matches ${matchedTags.length} of ${targetTags.length} selected characteristics${bodyBonus ? ' and targets the same planetary body' : ''}.`
    : 'No selected characteristics match this site.'
  const explanationAr = matchedTags.length
    ? `يتطابق مع ${matchedTags.length} من ${targetTags.length} خصائص مختارة${bodyBonus ? ' ويستهدف الجرم الكوكبي نفسه' : ''}.`
    : 'لا تتطابق خصائص الموقع مع الخصائص المختارة.'
  return { score, matchedTags, missingTags, explanationEn, explanationAr }
}

export function rankAnalogs(sites, profile, body) {
  return sites
    .map((site) => ({ site, ...scoreAnalog(site, profile, body) }))
    .sort((a, b) => b.score - a.score || a.site.id - b.site.id)
}
