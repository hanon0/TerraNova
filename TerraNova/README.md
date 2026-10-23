# TerraNova

TerraNova explores verified Earth analog sites for lunar and Mars mission planning. The interface supports English and Arabic, including right-to-left layout.

## Development

```sh
npm install
npm run data
npm run dev
```

Before committing, run:

```sh
npm run build
npm test
npm run lint
```

## Data pipeline

- Source records: `data-raw/planetary_analog_sites_verified.json`
- Location review list: `data-raw/coordinates.csv`
- Field notes review template: `data-raw/field-notes.csv`
- Optional airport source: `data-raw/airports.csv`
- Editable tag rules: `scripts/tag-rules.js`
- Generator: `scripts/convert-data.js`
- Outputs: validated analog, provenance, field-note, airport-index, and site-logistics JSON files in `src/data/`, plus `data-report.md`

Source coordinates are marked verified only when parsed from the source record. Review CSV coordinates remain approximate until confirmed. Empty or unverified fields are not represented as facts.

### Field notes

`data-raw/field-notes.csv` has one row per verified site. Fill `permitsNotes`, `hazards`, `bestSeason`, `accessNotes`, `sourceUrl`, and `lastVerified` only from reviewed sources. Quote CSV values containing commas. `sourceUrl` must be a URL and `lastVerified` an ISO date (`YYYY-MM-DD`); invalid entries stop the pipeline with a row-specific error. Missing values remain `null` and the interface says **Not yet verified, contact local authorities**. A completed note displays its source URL and verification date.

### Airport distances

Nearest large/medium airport distances use coordinates from the OurAirports data file. The dataset is currently not present, so distances intentionally display **Not yet verified**. Download the current [OurAirports airports.csv](https://ourairports.com/data/airports.csv) and save it as `data-raw/airports.csv`, then run `npm run data`. The pipeline keeps only valid large and medium airport rows and builds a latitude-bucket spatial index. Distance is great-circle distance in kilometers to the nearest listed airport, not a route or travel-time estimate; when a site location is approximate, its airport distance is labeled approximate too. OurAirports is the source; consult its [data page](https://ourairports.com/data/) for dataset details and attribution.

The environmental risk summary presents both the weather-threshold review and the manually supplied hazards field. Missing hazard notes and unapproved weather thresholds remain explicitly unverified; neither is a safety determination.

## Branding

The logo at `public/terranovalogo.jpeg` supplies the browser favicon, Apple touch icon, social preview image, navigation mark, loader, and footer mark. The dark navy, sky blue, sea green, and terracotta design tokens are sampled from the logo.

## Stack

- React and Vite, with modern JavaScript modules
- Zod runtime data validation
- Vitest unit tests
- ESLint with React, React Hooks, and JSX accessibility rules
- Prettier formatting

## Responsive behavior

The explorer uses a compact SVG 2D map (no WebGL initialization or canvas DPR cost). A `ResizeObserver` tracks the map container. Phones use map/filter/site bottom tabs, tablets can collapse the filter panel, and desktop uses a three-column workspace. Reduced-motion preferences are respected and the layout is capped at ultrawide widths.

`npm test` runs Vitest and Playwright. Playwright saves viewport screenshots and checks for horizontal overflow at 320, 375, 768, 1024, 1440, 1920, 2560 pixels, and in landscape-phone dimensions; it also checks methodology, mobile panels, and tablet collapse behavior. Install Chromium for local browser tests with `npx playwright install chromium`.

## Weather and readiness

Site weather is requested from the Open-Meteo Forecast API using the first mapped site location, cached in memory for ten minutes, and includes current conditions plus a seven-day temperature range. Open-Meteo is a live external service; timeouts, retries, and offline/API errors are surfaced in the site panel. Approximate coordinates stay explicitly labeled.

`src/data/readiness-thresholds.json` intentionally contains null values. No mission-approved thresholds or sources were provided, so the field-readiness indicator displays **Not yet verified** rather than guessing. A safety expert must fill all thresholds and source URLs before the indicator can request review; even then it is not a safety guarantee.

Weather data comes from the [Open-Meteo Forecast API](https://open-meteo.com/). It is a live forecast product, may be unavailable offline, and is not a safety guarantee. Requests use the primary mapped location, which can be approximate.

## Reports and proposals

Open **Open report / proposal** from a selected site to view `/report/:siteId`. The report includes the target-profile score, matched and missing tags, site descriptions, weather snapshot, logistics and risk notes, a static SVG location map, and `Verified_Source` citation. Use the print button and the browser's print dialog to save an A4 PDF; no PDF-generation library is used, preserving browser Arabic shaping and RTL layout.

Project Proposal mode starts from deterministic templates populated from validated site, match, field-note, and logistics data. Edit the Markdown draft before printing or exporting it as Markdown or JSON. Unknown details remain labeled as unverified; template activity focus is derived only from matched tags and still needs mission-team review.

## Mission planner

Open **Mission planner** at `/mission` to choose a site, team size, duration, and objectives. Tag-keyed suggestions in `src/data/mission-templates.json` provide equipment/materials to consider, suggested team roles, and rough planning-duration ranges. The generated checklist can be printed or exported as Markdown. These are starting-point suggestions only—not field procedures, verified duration estimates, or safety guidance—and must be reviewed by mission safety experts. Update the JSON template only through an appropriate expert review.
