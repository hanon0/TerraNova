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
