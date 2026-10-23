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
