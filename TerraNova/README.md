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
- Editable tag rules: `scripts/tag-rules.js`
- Generator: `scripts/convert-data.js`
- Outputs: `src/data/analogs.json`, `src/data/provenance.json`, and `data-report.md`

Source coordinates are marked verified only when parsed from the source record. Review CSV coordinates remain approximate until confirmed. Empty or unverified fields are not represented as facts.

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
