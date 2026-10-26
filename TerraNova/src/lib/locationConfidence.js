export function locationConfidence(site) {
  if (site.locations.some(({ confidence }) => confidence === 'verified')) return 'verified'
  if (site.locations.some(({ confidence }) => confidence === 'approximate')) return 'approximate'
  return 'missing'
}
