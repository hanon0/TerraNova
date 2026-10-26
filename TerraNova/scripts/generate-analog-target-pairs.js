import { writeFile } from 'node:fs/promises'
import analogSites from '../src/data/analogs.json' with { type: 'json' }

const lunarTargets = [
  [
    'polar_permafrost',
    {
      label: 'Lunar south-polar highlands candidate',
      labelAr: 'مرتفعات القطب الجنوبي القمري المقترحة',
      lat: -88.5,
      lon: 0,
      radiusKm: 25,
      projection: 'south_pole',
    },
  ],
  [
    'lava_tube',
    {
      label: 'Marius Hills candidate',
      labelAr: 'تلال ماريوس المقترحة',
      lat: 14,
      lon: -56,
      radiusKm: 30,
      projection: 'equirectangular',
    },
  ],
  [
    'anorthosite',
    {
      label: 'Apollo 16 lunar highlands candidate',
      labelAr: 'مرتفعات أبولو 16 القمرية المقترحة',
      lat: -8.97,
      lon: 15.5,
      radiusKm: 30,
      projection: 'equirectangular',
    },
  ],
  [
    'impact_crater',
    {
      label: 'Tycho crater candidate',
      labelAr: 'فوهة تايكو المقترحة',
      lat: -43.3,
      lon: -11.2,
      radiusKm: 35,
      projection: 'equirectangular',
    },
  ],
  [
    'ancient_terrain',
    {
      label: 'South Pole–Aitken basin candidate',
      labelAr: 'حوض القطب الجنوبي–أيتكن المقترح',
      lat: -53,
      lon: 169,
      radiusKm: 60,
      projection: 'equirectangular',
    },
  ],
  [
    'basalt_volcanic',
    {
      label: 'Marius Hills volcanic province candidate',
      labelAr: 'مقاطعة تلال ماريوس البركانية المقترحة',
      lat: 14,
      lon: -56,
      radiusKm: 35,
      projection: 'equirectangular',
    },
  ],
]

const martianTargets = [
  [
    'paleolake_fluvial',
    {
      label: 'Jezero crater candidate',
      labelAr: 'فوهة جيزيرو المقترحة',
      lat: 18.4,
      lon: 77.7,
      radiusKm: 35,
      projection: 'equirectangular',
    },
  ],
  [
    'hydrothermal',
    {
      label: 'Gale crater candidate',
      labelAr: 'فوهة غيل المقترحة',
      lat: -5.4,
      lon: 137.8,
      radiusKm: 35,
      projection: 'equirectangular',
    },
  ],
  [
    'polar_permafrost',
    {
      label: 'Arcadia Planitia candidate',
      labelAr: 'سهل أركاديا المقترح',
      lat: 46.7,
      lon: -175.7,
      radiusKm: 40,
      projection: 'north_pole',
    },
  ],
  [
    'evaporite_salt',
    {
      label: 'Meridiani Planum candidate',
      labelAr: 'سهل ميريدياني المقترح',
      lat: -2.3,
      lon: 0,
      radiusKm: 35,
      projection: 'equirectangular',
    },
  ],
  [
    'hydrogen_sulfide',
    {
      label: 'Meridiani Planum candidate',
      labelAr: 'سهل ميريدياني المقترح',
      lat: -2.3,
      lon: 0,
      radiusKm: 35,
      projection: 'equirectangular',
    },
  ],
  [
    'aeolian_yardang',
    {
      label: 'Noachis Terra candidate',
      labelAr: 'أرض نوكيس المقترحة',
      lat: -45,
      lon: 20,
      radiusKm: 40,
      projection: 'equirectangular',
    },
  ],
  [
    'ancient_terrain',
    {
      label: 'Noachis Terra candidate',
      labelAr: 'أرض نوكيس المقترحة',
      lat: -45,
      lon: 20,
      radiusKm: 50,
      projection: 'equirectangular',
    },
  ],
  [
    'impact_crater',
    {
      label: 'Gale crater candidate',
      labelAr: 'فوهة غيل المقترحة',
      lat: -5.4,
      lon: 137.8,
      radiusKm: 35,
      projection: 'equirectangular',
    },
  ],
  [
    'basalt_volcanic',
    {
      label: 'Elysium Planitia candidate',
      labelAr: 'سهل إليسيوم المقترح',
      lat: 4.5,
      lon: 135.9,
      radiusKm: 40,
      projection: 'equirectangular',
    },
  ],
]

function proposedTarget(site, body) {
  const targets = body === 'moon' ? lunarTargets : martianTargets
  const match = targets.find(([tag]) => site.tags.includes(tag))
  const fallback =
    body === 'moon'
      ? {
          label: 'Lunar equatorial terrain candidate',
          labelAr: 'تضاريس استوائية قمرية مقترحة',
          lat: 0,
          lon: 0,
          radiusKm: 30,
          projection: 'equirectangular',
        }
      : {
          label: 'Gale crater candidate',
          labelAr: 'فوهة غيل المقترحة',
          lat: -5.4,
          lon: 137.8,
          radiusKm: 35,
          projection: 'equirectangular',
        }
  const [matchedTag, region] = match ?? [null, fallback]

  return {
    body,
    ...region,
    confidence: 'proposed',
    derivedFromTags: site.tags,
    sourceTargetFeature: site.targetFeatureAr,
    rationale: `Candidate region selected from the site's recorded target feature and tags${matchedTag ? `, including ${matchedTag}` : ''}. Location and relevance are proposals for scientist review, not verified analog matches.`,
    rationaleAr: `اختيرت المنطقة المرشحة استناداً إلى خاصية الهدف والوسوم المسجلة${matchedTag ? `، ومنها ${matchedTag}` : ''}. الموقع ومدى ملاءمته مقترحان لمراجعة العلماء وليسا تطابقاً موثقاً.`,
  }
}

const pairs = Object.fromEntries(
  analogSites.map((site) => {
    const bodies =
      site.targetBodies === 'both' || site.targetBodies === 'unknown'
        ? ['moon', 'mars']
        : [site.targetBodies]
    return [site.id, bodies.map((body) => proposedTarget(site, body))]
  }),
)

await writeFile(
  new URL('../src/data/analog-target-pairs.json', import.meta.url),
  `${JSON.stringify(pairs, null, 2)}\n`,
)

console.info(
  `Generated ${Object.values(pairs).reduce((total, targets) => total + targets.length, 0)} proposed target regions for ${Object.keys(pairs).length} analog sites.`,
)
