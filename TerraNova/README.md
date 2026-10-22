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
