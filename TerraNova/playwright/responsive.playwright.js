import { expect, test } from '@playwright/test'

const viewports = [
  { name: 'phone-320', width: 320, height: 720 },
  { name: 'phone-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-1024', width: 1024, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'wide-2560', width: 2560, height: 1440 },
  { name: 'phone-landscape', width: 844, height: 390 },
]

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/v1/forecast**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        current: {
          time: '2026-01-01T12:00',
          temperature_2m: 18,
          apparent_temperature: 19,
          relative_humidity_2m: 55,
          wind_speed_10m: 12,
          wind_gusts_10m: 18,
          precipitation: 0.2,
          uv_index: 2,
        },
        daily: {
          time: Array.from({ length: 7 }, (_, index) => `2026-01-0${index + 1}`),
          temperature_2m_min: [1, 2, 3, 4, 5, 6, 7],
          temperature_2m_max: [11, 12, 13, 14, 15, 16, 17],
        },
      }),
    }),
  )
})

for (const viewport of viewports) {
  test(`responsive layout: ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/')
    await expect(page.locator('.brand-loader')).toHaveCount(0)
    await expect(page.locator('.topbar')).toBeVisible()
    await expect(page.locator('.hero-static-system')).toBeVisible()
    await expect(page.locator('.hero-canvas-wrap canvas')).toHaveCount(0)
    await expect(page.locator('.map-canvas')).toBeVisible()

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(horizontalOverflow, `horizontal overflow at ${viewport.width}px`).toBe(false)

    const mapBounds = await page.locator('.map-canvas').boundingBox()
    expect(mapBounds).not.toBeNull()
    expect(mapBounds.width).toBeGreaterThan(0)
    expect(mapBounds.width).toBeLessThanOrEqual(viewport.width)

    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}.png`),
      fullPage: false,
      animations: 'disabled',
    })
  })
}

test('planetary hero loads the WebGL scene only on request', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.hero-static-system')).toBeVisible()
  await expect(page.locator('.hero-canvas-wrap canvas')).toHaveCount(0)
  await page.getByRole('button', { name: 'Explore 3D overview' }).click()
  await expect(page.getByRole('button', { name: 'Hide 3D overview' })).toBeVisible()
  await expect(page.locator('.hero-canvas-wrap canvas')).toBeVisible({ timeout: 30_000 })
})

test('phone panel tabs reveal controls and ranked sites', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expect(page.locator('.brand-loader')).toHaveCount(0)

  await page.getByRole('button', { name: 'Filters' }).click()
  await expect(page.locator('.control-panel')).toBeVisible()
  await expect(page.locator('.map-panel')).toBeHidden()

  await page.getByRole('button', { name: 'Sites' }).click()
  await expect(page.locator('.site-list-section')).toBeVisible()
  await expect(page.locator('.site-card').first()).toBeVisible()

  const bottomTabs = await page.locator('.mobile-panel-tabs').boundingBox()
  const sitePanel = await page.locator('.results-layout').boundingBox()
  expect(sitePanel.y + sitePanel.height).toBeLessThanOrEqual(bottomTabs.y + 1)
})

test('tablet side panel can be collapsed and restored', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto('/')
  await expect(page.locator('.brand-loader')).toHaveCount(0)

  const toggle = page.getByRole('button', { name: 'Toggle filters panel' })
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(page.locator('.control-panel')).toBeHidden()
  await toggle.click()
  await expect(page.locator('.control-panel')).toBeVisible()
})

test('weather displays unit conversions and unverified readiness thresholds', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await expect(page.locator('.brand-loader')).toHaveCount(0)
  await expect(page.locator('.weather-current strong')).toHaveText('18.0°C')

  await page.getByRole('button', { name: '°F' }).click()
  await expect(page.locator('.weather-current strong')).toHaveText('64.4°F')
  await page.getByRole('button', { name: 'mph' }).click()
  await expect(page.getByText('7.5 mph')).toBeVisible()
  await expect(page.locator('.readiness-indicator.not_verified')).toBeVisible()

  await page.locator('.readiness-indicator summary').click()
  await expect(page.locator('.readiness-indicator')).toContainText('Not yet verified')
})

test('field notes, airport logistics, and environmental risks remain explicit when unverified', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await expect(page.locator('.brand-loader')).toHaveCount(0)
  await expect(page.locator('.field-notes-panel .unverified')).toHaveCount(4)
  await expect(page.locator('.logistics-panel')).toContainText('data-raw/airports.csv')
  await expect(page.locator('.environment-risk')).toContainText('Manual hazards')
  await expect(page.locator('.environment-risk')).toContainText(
    'Not yet verified, contact local authorities.',
  )

  await page.locator('.language-button').click()
  await expect(page.locator('.app-shell')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('.logistics-panel')).toContainText('لم يتم التحقق بعد')
})

test('methodology page remains responsive', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await expect(page.locator('.brand-loader')).toHaveCount(0)
  await page.getByRole('button', { name: 'Methodology', exact: true }).click()
  await expect(page.locator('.methodology-page')).toBeVisible()

  for (const viewport of [
    { name: 'phone-320', width: 320, height: 720 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'desktop-1440', width: 1440, height: 1000 },
    { name: 'wide-2560', width: 2560, height: 1440 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(horizontalOverflow, `methodology overflow at ${viewport.width}px`).toBe(false)
    await page.screenshot({
      path: testInfo.outputPath(`methodology-${viewport.name}.png`),
      fullPage: false,
      animations: 'disabled',
    })
  }
})

test('report route remains responsive at every required viewport', async ({ page }, testInfo) => {
  const query = new URLSearchParams({
    body: 'moon',
    weights: JSON.stringify({ lava_tube: 2, polar_permafrost: 1 }),
  })
  await page.goto(`/report/5?${query}`)
  await expect(page.locator('.report-map-figure')).toBeVisible()
  await expect(page.locator('.report-header img')).toHaveAttribute(
    'alt',
    'TerraNova planetary analog explorer logo',
  )

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(horizontalOverflow, `report overflow at ${viewport.width}px`).toBe(false)
    await page.screenshot({
      path: testInfo.outputPath(`report-${viewport.name}.png`),
      fullPage: false,
      animations: 'disabled',
    })
  }
})

test('report proposal can be localized, edited, and exported as Markdown and JSON', async ({
  page,
}) => {
  const query = new URLSearchParams({
    body: 'moon',
    weights: JSON.stringify({ lava_tube: 2 }),
  })
  await page.goto(`/report/5?${query}`)
  await page.getByRole('button', { name: 'Project Proposal' }).click()
  const proposal = page.getByRole('textbox', { name: 'Project Proposal' })
  await expect(proposal).toHaveValue(/## Risks/)
  await proposal.fill('# Editable draft')

  const markdownDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Markdown' }).click()
  expect((await markdownDownload).suggestedFilename()).toBe('terranova-proposal-5.md')

  const jsonDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  expect((await jsonDownload).suggestedFilename()).toBe('terranova-proposal-5.json')

  await page.locator('.report-action').first().click()
  await expect(page.locator('.report-page')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('textbox', { name: 'مقترح مشروع' })).toHaveValue(/## المخاطر/)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.report-header img')).toBeVisible()
  await expect(page.locator('.proposal-print-copy')).toBeVisible()
  await expect(page.locator('.report-toolbar')).toBeHidden()
})

test('contribution and hidden review pages stay within phone, tablet, and desktop widths', async ({
  page,
}, testInfo) => {
  for (const route of ['/contribute', '/review']) {
    await page.goto(route)
    await expect(page.locator('.community-page')).toBeVisible()
    for (const viewport of [
      { name: 'phone-320', width: 320, height: 720 },
      { name: 'phone-375', width: 375, height: 812 },
      { name: 'tablet-768', width: 768, height: 1024 },
      { name: 'desktop-1440', width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
      expect(horizontalOverflow, `${route} overflow at ${viewport.width}px`).toBe(false)
      await page.screenshot({
        path: testInfo.outputPath(`${route.slice(1)}-${viewport.name}.png`),
        fullPage: false,
        animations: 'disabled',
      })
    }
  }
})

test('contributions stay pending until hidden reviewer approval and then show a Community badge', async ({
  page,
}) => {
  await page.goto('/contribute')
  await page.getByLabel('Site name (Arabic)').fill('موقع تجريبي')
  await page.getByLabel('Site name (English)').fill('Demo community site')
  await page.locator('.contribution-map').click({ position: { x: 180, y: 90 } })
  await page.getByLabel('Lava tubes').check()
  await page.getByLabel('Geology description').fill('Contributor-supplied geology.')
  await page.getByLabel('Environment description').fill('Contributor-supplied environment.')
  await page.getByLabel('Required source (URL or DOI)').fill('10.1234/example.1')
  await page.getByRole('button', { name: 'Save pending contribution' }).click()
  await expect(page.locator('.community-success')).toBeVisible()
  await expect(page.locator('.community-submissions article')).toContainText('pending')

  const issueDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export GitHub issue text' }).click()
  expect((await issueDownload).suggestedFilename()).toContain('issue')

  await page.goto('/review')
  await expect(page.locator('.review-card')).toContainText('Demo community site')
  await page.getByRole('button', { name: 'Approve' }).click()
  await expect(page.locator('.review-status.approved')).toHaveText('Approved')

  await page.goto('/')
  await expect(page.locator('.brand-loader')).toHaveCount(0)
  const communityCard = page.locator('.site-card').filter({ hasText: 'Demo community site' })
  await expect(communityCard.locator('.community-badge')).toHaveText('Community')
  await communityCard.click()
  await expect(page.locator('.detail-panel .community-badge')).toHaveText('Community')
})

test('mission planner builds and exports a responsive starting-point checklist', async ({
  page,
}, testInfo) => {
  await page.goto('/mission')
  await expect(page.locator('.mission-page')).toBeVisible()
  await expect(page.locator('.mission-disclaimer')).toContainText(
    'must be reviewed by mission safety experts',
  )

  for (const viewport of [
    { name: 'phone-320', width: 320, height: 720 },
    { name: 'phone-375', width: 375, height: 812 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'tablet-1024', width: 1024, height: 900 },
    { name: 'desktop-1440', width: 1440, height: 1000 },
    { name: 'desktop-1920', width: 1920, height: 1080 },
    { name: 'wide-2560', width: 2560, height: 1440 },
    { name: 'phone-landscape', width: 844, height: 390 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(horizontalOverflow, `mission planner overflow at ${viewport.width}px`).toBe(false)
    await page.screenshot({
      path: testInfo.outputPath(`mission-${viewport.name}.png`),
      fullPage: false,
      animations: 'disabled',
    })
  }

  await page.getByLabel('Team size').fill('6')
  await page.getByLabel('Planned duration (days)').fill('6')
  await page.getByLabel('Geologic mapping').check()
  await page.getByRole('button', { name: 'Build starting-point plan' }).click()
  await expect(page.locator('.mission-plan')).toBeVisible()
  await expect(page.locator('.mission-rule').first()).toContainText(
    'Outside this tag’s suggested range',
  )
  await expect(page.locator('.mission-rule input[type="checkbox"]').first()).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Markdown' }).click()
  expect((await download).suggestedFilename()).toBe('terranova-mission-plan-1.md')

  await page.getByRole('button', { name: 'Toggle language' }).click()
  await expect(page.locator('.mission-page')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('.mission-disclaimer')).toContainText('خبراء سلامة المهمات')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.mission-header')).toBeHidden()
  await expect(page.locator('.mission-plan')).toBeVisible()
})

test('3D terrain map stays responsive and falls back explicitly when WebGL is unavailable', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const transparentTile = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5k8AAAAASUVORK5CYII=',
    'base64',
  )
  await page.route('**/tile.openstreetmap.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: transparentTile }),
  )
  await page.route('**/elevation-tiles-prod/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: transparentTile }),
  )
  await page.goto('/')
  await expect(page.locator('.brand-loader')).toHaveCount(0)
  await page.getByRole('button', { name: '3D terrain' }).click()

  await expect
    .poll(
      async () => {
        return (
          (await page.locator('.terrain-map-shell').count()) > 0 ||
          (await page.locator('.terrain-map-notice').count()) > 0
        )
      },
      { timeout: 30000 },
    )
    .toBe(true)

  const mapRendered = (await page.locator('.terrain-map-shell').count()) > 0
  if (mapRendered) {
    await expect(page.locator('.maplibregl-map')).toBeVisible()
    await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap')
    await expect(page.locator('.terrain-companion')).toContainText('LRO WAC / LOLA')
    await expect(page.locator('.terrain-companion')).toContainText('MOLA')
  } else {
    await expect(page.locator('.terrain-map-notice')).toContainText('2D map is shown instead')
    await expect(page.locator('.map-canvas svg')).toBeVisible()
  }

  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (contextType, ...args) {
      if (contextType === 'webgl2' || contextType === 'webgl') return null
      return originalGetContext.call(this, contextType, ...args)
    }
  })

  await page.reload()
  await expect(page.locator('.brand-loader')).toHaveCount(0)
  await page.getByRole('button', { name: '3D terrain' }).click()
  await expect(page.locator('.terrain-map-notice')).toContainText('2D map is shown instead')
  await expect(page.locator('.map-canvas > svg')).toBeVisible()

  for (const viewport of [
    { name: 'phone-320', width: 320, height: 720 },
    { name: 'phone-375', width: 375, height: 812 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'tablet-1024', width: 1024, height: 900 },
    { name: 'desktop-1440', width: 1440, height: 1000 },
    { name: 'desktop-1920', width: 1920, height: 1080 },
    { name: 'wide-2560', width: 2560, height: 1440 },
    { name: 'phone-landscape', width: 844, height: 390 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(horizontalOverflow, `3D map overflow at ${viewport.width}px`).toBe(false)
    const mapWidth = await page.locator('.map-canvas').evaluate((element) => {
      return element.getBoundingClientRect().width
    })
    expect(mapWidth, `map container width at ${viewport.width}px`).toBeGreaterThan(0)
    expect(mapWidth).toBeLessThanOrEqual(viewport.width)
  }
})

test('cached NASA 3D comparison stays responsive and labels proposed targets', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/compare3d/1')

  await expect(page.getByRole('heading', { name: '3D terrain comparison' })).toBeVisible()
  await expect(page.getByText('Earth analog', { exact: true })).toBeVisible()
  await expect(page.locator('.proposal-badge')).toContainText('Proposed')
  await expect(
    page.locator('.compare-viewport:has(.proposal-badge) .compare-attribution'),
  ).toContainText('NASA / NASA Trek')

  await page.getByRole('button', { name: 'Moon / Mars' }).click()
  await expect(
    page.locator('.compare-viewport').filter({ hasText: 'Planetary comparison candidate' }),
  ).toBeVisible()
  await expect(page.locator('.compare-viewports > div').first()).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('cached comparison images provide a static preview without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (contextType, ...args) {
      if (['webgl2', 'webgl', 'experimental-webgl'].includes(contextType)) return null
      return originalGetContext.call(this, contextType, ...args)
    }
  })
  await page.goto('/compare3d/1')

  await expect(page.locator('.compare-static-preview').first()).toBeVisible({ timeout: 30_000 })
})
