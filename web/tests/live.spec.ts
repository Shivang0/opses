import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * OPSES — verifies the dashboard is wired to the LIVE in-house server:
 *  - real captured data renders (employee "Shivang", live org KPIs, not sample)
 *  - the employee drill-down opens real Claude Code sessions + event trail
 *  - the aria-meter-name defect is resolved and the new UI adds no serious a11y issues
 *  - no horizontal overflow at 375px on Developers & Findings
 *
 * Requires the live server on :4319 and the built app previewed on :4173.
 *
 * NOTE on color-contrast: axe reports a pre-existing `color-contrast` (serious)
 * violation on the severity/status pills (e.g. text-ok #16a34a on bg-ok-soft
 * #f0fdf4 = 3.14:1, text-danger on bg-danger-soft = 4.41:1). These come from the
 * `index.css` design tokens — which this task is explicitly instructed NOT to
 * edit — and are present with the sample dataset too. So the a11y assertions
 * below verify the fixed defect (aria-meter-name) and that no NEW serious rule is
 * introduced, while surfacing the pre-existing color-contrast count separately.
 */

async function axeSerious(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
}

test('overview renders LIVE org data, not the sample dataset', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

  // Connection indicator flips to Live once the server responds.
  await expect(page.getByText('Live', { exact: true })).toBeVisible()

  // Live Cost MTD is $111.61 (real). The sample figure was $512.60.
  await expect(page.getByText('$111.61').first()).toBeVisible()
  await expect(page.getByText('$512.60')).toHaveCount(0)

  // Live compliance score (64) drives the overview meter.
  const meter = page.getByRole('meter').first()
  await expect(meter).toHaveAttribute('aria-valuenow', '64')
})

test('developers list shows the real employee "Shivang"', async ({ page }) => {
  await page.goto('/dashboard/developers', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('columnheader', { name: 'Developer' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Shivang' })).toBeVisible()
})

test('drill-down opens real Claude Code sessions + event trail', async ({ page }) => {
  await page.goto('/dashboard/developers', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Shivang' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Explicitly select the Claude Code tab.
  const ccTab = dialog.getByRole('tab', { name: 'Claude Code' })
  await expect(ccTab).toBeVisible()
  await ccTab.click()
  await expect(ccTab).toHaveAttribute('aria-selected', 'true')

  // Real totals (live cost) surface in the tab (also shown in the quick-facts grid).
  await expect(dialog.getByText('$111.61').first()).toBeVisible()

  // A populated, newest-first sessions list (there are ~56).
  const sessionToggles = dialog.locator('button[aria-expanded]')
  expect(await sessionToggles.count()).toBeGreaterThanOrEqual(5)

  // Expanding the newest session reveals its event trail.
  await sessionToggles.first().click()
  await expect(sessionToggles.first()).toHaveAttribute('aria-expanded', 'true')
  await expect(dialog.locator('ol li').first()).toBeVisible()

  // Cursor tab surfaces its "not connected" note.
  await dialog.getByRole('tab', { name: 'Cursor' }).click()
  await expect(dialog.getByText(/Cursor not detected/i)).toBeVisible()
})

test('findings view shows live findings attributed to Shivang', async ({ page }) => {
  await page.goto('/dashboard/findings', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/Showing \d+ of \d+ findings/)).toBeVisible()
  await expect(page.getByText('Shivang').first()).toBeVisible()
  // The real high-severity secret-leak finding.
  await expect(page.getByText(/Secret sent to a cloud model/).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// Accessibility — the fixed defect (aria-meter-name) is gone and no NEW serious
// rule is introduced by the live wiring / drill-down. (Pre-existing token-level
// color-contrast is reported but excluded — see NOTE above; index.css is frozen.)
// ---------------------------------------------------------------------------
for (const r of [
  { path: '/dashboard', name: 'Overview' },
  { path: '/dashboard/developers', name: 'Developers' },
  { path: '/dashboard/findings', name: 'Findings' },
  { path: '/dashboard/compliance', name: 'Compliance' },
]) {
  test(`a11y (live) @ ${r.name}`, async ({ page }) => {
    await page.goto(r.path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()
    await page.waitForTimeout(500) // let live data + charts settle
    const serious = await axeSerious(page)

    // The assigned defect must be resolved.
    const meterName = serious.filter((v) => v.id === 'aria-meter-name')
    expect(meterName, `aria-meter-name must be resolved on ${r.name}`).toEqual([])

    // No serious/critical rule other than the pre-existing token color-contrast.
    const introduced = serious
      .filter((v) => v.id !== 'color-contrast')
      .map((v) => `${v.id} x${v.nodes.length} :: ${v.nodes[0]?.target?.join(' ')}`)
    expect(introduced, `no new serious/critical a11y on ${r.name}`).toEqual([])

    const contrast = serious.find((v) => v.id === 'color-contrast')
    if (contrast) {
      console.log(`[a11y ${r.name}] pre-existing color-contrast nodes: ${contrast.nodes.length}`)
    }
  })
}

// ---------------------------------------------------------------------------
// Responsive — no horizontal overflow at 375px on the wide-table views
// ---------------------------------------------------------------------------
for (const r of [
  { path: '/dashboard/developers', name: 'Developers' },
  { path: '/dashboard/findings', name: 'Findings' },
]) {
  test(`no horizontal overflow @ 375 (live) ${r.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(r.path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()
    await page.waitForTimeout(500)
    const m = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(
      m.scrollWidth,
      `${r.name} @375: scrollWidth ${m.scrollWidth} > innerWidth ${m.innerWidth}`,
    ).toBeLessThanOrEqual(m.innerWidth + 2)
  })
}
