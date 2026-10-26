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

## Visual system and planetary viewer

Tailwind 3 tokens live in `tailwind.config.js`; its preflight reset is disabled to preserve the app's existing responsive form and map styling. CSS variables in `src/index.css` provide matching space, glass, glow, focus, and scrollbar tokens. The explorer's three-body Bento viewer uses one React Three Fiber Canvas with manually scissored viewports, so swapping the main planet does not create additional WebGL contexts. Earth is main by default; click a Moon/Mars panel or use the top-bar chips to focus it. Each body keeps its own camera pose. Only the main body has orbit controls and site markers; low-performance devices fall back to local image previews for the smaller panels. The viewer is code-split, caps DPR, and offers the existing flat Earth map and satellite views as alternatives.

The local GLB models used by the viewer are:

- Earth: `public/3d-models/Earth_1_12756.glb`
- Moon: `public/3d-models/Moon_NASA_LRO_15k_Grid_Small.glb`
- Mars: `public/3d-models/24881_Mars_1_6792.glb`

These are local visual assets, not engineering data. Confirm the original source and redistribution terms for each GLB before publishing them. The local visual-only preview maps are:

- Earth: NASA Visible Earth's [Blue Marble land surface, shallow water, and shaded topography](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.png).
- Moon: the two zoom-0 global tiles of NASA Trek's `LRO_WAC_Mosaic_Global_303ppd_v02`.
- Mars: the two zoom-0 global tiles of NASA Trek's `Mars_MGS_MOLA_ClrShade_merge_global_463m`.

The Moon and Mars preview maps are deliberately coarse 512×256 stitched images, not measurement products or DEMs. Their attribution appears in the NASA Trek comparison. The viewer and comparison remain code-split; the production build reports a large Three.js vendor chunk, so run Lighthouse on the intended deployment before claiming a mobile Performance score. No Lighthouse score is asserted here. List reveal and panel motion respect `prefers-reduced-motion`; the optional light-theme toggle and more elaborate magnetic/shared-element/counter motion are not included.

## Stack

- React and Vite, with modern JavaScript modules
- Tailwind CSS design tokens, Framer Motion, and Lucide icons
- React Three Fiber / Drei for lazy-loaded 3D scenes
- Zod runtime data validation
- Vitest unit tests
- ESLint with React, React Hooks, and JSX accessibility rules
- Prettier formatting

## Responsive behavior

The explorer uses a compact SVG 2D map (no WebGL initialization or canvas DPR cost). A `ResizeObserver` tracks the map container. Phones use map/filter/site bottom tabs, tablets can collapse the filter panel, and desktop uses a three-column workspace. Reduced-motion preferences are respected and the layout is capped at ultrawide widths.

`npm test` runs Vitest and Playwright. Playwright runs serially because the 3D pages share the available browser WebGL context budget. It saves viewport screenshots and checks for horizontal overflow at 320, 375, 768, 1024, 1440, 1920, 2560 pixels, and in landscape-phone dimensions; it also checks methodology, mobile panels, tablet collapse behavior, one WebGL context for the Bento viewer, and the Moon-to-main swap. Install Chromium for local browser tests with `npx playwright install chromium`.

### Optional 3D Earth terrain

Use the **2D map / 3D terrain** controls in the explorer. The 3D view is lazy-loaded, uses MapLibre GL JS with Terrarium-encoded AWS Terrain Tiles, a modest terrain exaggeration, location-confidence markers, and map clustering. A `ResizeObserver` resizes the WebGL map; mobile DPR is capped at 1, and browsers without suitable WebGL, or a map that does not initialize promptly, return to the SVG 2D map with an explicit message. Drawing an area and selecting sites remain supported in either view.

Map attribution is shown on the map: © OpenStreetMap contributors and AWS Terrain Tiles. Both tile services are external dependencies without an application-level availability guarantee; follow the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and use a suitable hosted or self-hosted provider before higher-traffic production use. Elevation tiles are from the [AWS Open Data Registry Terrain Tiles](https://registry.opendata.aws/terrain-tiles/). The current Earth terrain is not a lunar or Mars elevation model.

### NASA Trek 3D comparisons

Open **3D terrain comparison** for a site to view its cached Earth patch beside one proposed Moon or Mars region. Target coordinates and analog relevance are proposals derived from the recorded target feature and tags; every target has `confidence: "proposed"` until a scientist verifies it. These proposals are not scientific equivalence claims.

Run `npm run terrain` to pre-download patches for all sites, or `npm run terrain -- --site=1` to fetch one site. The app reads `public/terrain/{siteId}/` first; the optional NASA image refresh is separate and does not replace cached elevation data. Earth texture tiles use Esri World Hillshade (not satellite imagery); Earth elevation uses AWS Terrarium. Attribution is included in each patch's `meta.json` and in the comparison UI.

The verified NASA Trek imagery choices are:

- Moon global/equirectangular: `LRO_WAC_Mosaic_Global_303ppd_v02`, for broad lunar context.
- Moon south-polar stereographic: `LRO_LOLA_ClrShade_SPole875_5mp_v04`, paired with `LRO_LOLA_Gray_SPole875_5mp_v04` for polar imagery. The grayscale product's pixel values are display levels, not documented elevation units, so it is not treated as a metric DEM.
- Mars global/equirectangular: `Mars_MGS_MOLA_ClrShade_merge_global_463m`.
- Mars south-polar stereographic: `Mars_MGS_MOLA_ClrShade_merge_global_463m_sp`. Numeric MOLA samples are fetched from NASA Trek's south-polar ArcGIS ImageServer only where its published extent covers the proposal. The service does not specify vertical units in its metadata; the UI therefore does not claim metric relief for those samples. The attempted north-polar WMTS endpoint returned HTTP 404 during the full cache run; north-polar targets are marked unavailable rather than mapped to a guessed layer.

The NASA layer services and required tile formats were checked through their WMTS capabilities and sample tile requests. WMTS imagery could be requested cross-origin in the checked browser; Mars layer discovery's search endpoint did not pass browser CORS, and the checked north-polar WMTS endpoint returned HTTP 404. Live image refresh uses the Vite development proxy at `/trek-proxy`. Production deployments that enable live refresh should provide an equivalent same-origin reverse proxy for `https://trek.nasa.gov` (or configure a verified CORS-enabled service); cached patches remain usable without it. Do not proxy arbitrary URLs or expose an unrestricted open proxy.

Planetary images are shown in their own comparison view rather than composited onto the Earth map. This avoids implying that lunar or Martian coordinates, especially polar stereographic imagery, are Earth locations.

Both comparison viewports use the same camera and lighting controls. Elevation statistics are shown only where the downloaded source supports them; unknown source units and unreported slopes remain explicitly unverified. The static preview is available if WebGL cannot initialize. All renderings are approximate visualizations from public tiles, not engineering measurements. See [NASA Moon Trek](https://trek.nasa.gov/moon/) and [NASA Mars Trek](https://trek.nasa.gov/mars/).

## Weather and readiness

Site weather is requested from the Open-Meteo Forecast API using the first mapped site location, cached in memory for ten minutes, and includes current conditions plus a seven-day temperature range. Open-Meteo is a live external service; timeouts, retries, and offline/API errors are surfaced in the site panel. Approximate coordinates stay explicitly labeled.

`src/data/readiness-thresholds.json` intentionally contains null values. No mission-approved thresholds or sources were provided, so the field-readiness indicator displays **Not yet verified** rather than guessing. A safety expert must fill all thresholds and source URLs before the indicator can request review; even then it is not a safety guarantee.

Weather data comes from the [Open-Meteo Forecast API](https://open-meteo.com/). It is a live forecast product, may be unavailable offline, and is not a safety guarantee. Requests use the primary mapped location, which can be approximate.

## Reports and proposals

Open **Open report / proposal** from a selected site to view `/report/:siteId`. The report includes the target-profile score, matched and missing tags, site descriptions, weather snapshot, logistics and risk notes, a static SVG location map, and `Verified_Source` citation. Use the print button and the browser's print dialog to save an A4 PDF; no PDF-generation library is used, preserving browser Arabic shaping and RTL layout.

Project Proposal mode starts from deterministic templates populated from validated site, match, field-note, and logistics data. Edit the Markdown draft before printing or exporting it as Markdown or JSON. Unknown details remain labeled as unverified; template activity focus is derived only from matched tags and still needs mission-team review.

## Mission planner

Open **Mission planner** at `/mission` to choose a site, team size, duration, and objectives. Tag-keyed suggestions in `src/data/mission-templates.json` provide equipment/materials to consider, suggested team roles, and rough planning-duration ranges. The generated checklist can be printed or exported as Markdown. These are starting-point suggestions only—not field procedures, verified duration estimates, or safety guidance—and must be reviewed by mission safety experts. Update the JSON template only through an appropriate expert review.
