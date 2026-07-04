import {
  test,
  expect,
  type Page,
  type Locator,
  type ConsoleMessage,
  type Request as PWRequest,
  type Response as PWResponse,
} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * OPSES — adversarial QA of the running (built + previewed) app.
 * Covers a11y (axe), clickability, data/connection integrity, and responsiveness.
 */

interface RouteDef {
  path: string
  name: string
  /** A stable, visible locator that proves the view has rendered. */
  ready: (page: Page) => Locator
}

const ROUTES: RouteDef[] = [
  {
    path: '/',
    name: 'Landing (/)',
    ready: (p) => p.getByRole('heading', { name: /Governance for agentic AI/i }),
  },
  {
    path: '/dashboard',
    name: 'Overview (/dashboard)',
    ready: (p) => p.getByText('Active developers', { exact: true }),
  },
  {
    path: '/dashboard/developers',
    name: 'Developers',
    // Data-agnostic readiness signal (works for live or sample data).
    ready: (p) => p.getByRole('columnheader', { name: 'Developer' }),
  },
  {
    path: '/dashboard/findings',
    name: 'Findings',
    ready: (p) => p.getByText(/Showing \d+ of \d+ findings/),
  },
  {
    path: '/dashboard/compliance',
    name: 'Compliance',
    ready: (p) => p.getByText('Overall compliance score'),
  },
]

interface Diagnostics {
  consoleErrors: string[]
  consoleWarnings: string[]
  pageErrors: string[]
  badResponses: string[] // same-origin HTTP >= 400
  failedRequests: string[] // same-origin request failures / missing assets
  external: string[] // cross-origin failures (e.g. font CDNs) — reported, not fatal
}

const SAME_ORIGIN = 'localhost:4173'

function attachDiagnostics(page: Page): Diagnostics {
  const d: Diagnostics = {
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    badResponses: [],
    failedRequests: [],
    external: [],
  }
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') d.consoleErrors.push(msg.text())
    else if (msg.type() === 'warning') d.consoleWarnings.push(msg.text())
  })
  page.on('pageerror', (err: Error) => d.pageErrors.push(`${err.name}: ${err.message}`))
  page.on('requestfailed', (req: PWRequest) => {
    const line = `${req.method()} ${req.url()} — ${req.failure()?.errorText ?? 'failed'}`
    if (req.url().includes(SAME_ORIGIN)) d.failedRequests.push(line)
    else d.external.push(line)
  })
  page.on('response', (res: PWResponse) => {
    if (res.status() >= 400) {
      const line = `${res.status()} ${res.request().method()} ${res.url()}`
      if (res.url().includes(SAME_ORIGIN)) d.badResponses.push(line)
      else d.external.push(line)
    }
  })
  return d
}

/** Fatal-clean assertion: no crashes, no console.error, no same-origin network failures. */
function expectClean(d: Diagnostics, ctx: string) {
  expect(d.pageErrors, `${ctx}: uncaught page errors`).toEqual([])
  expect(d.consoleErrors, `${ctx}: console.error output`).toEqual([])
  expect(d.badResponses, `${ctx}: same-origin HTTP >= 400`).toEqual([])
  expect(d.failedRequests, `${ctx}: same-origin failed/missing requests`).toEqual([])
}

async function gotoRoute(page: Page, r: RouteDef) {
  await page.goto(r.path, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('main')).toBeVisible()
  await expect(r.ready(page).first()).toBeVisible()
}

// ---------------------------------------------------------------------------
// 1. ACCESSIBILITY — fail on any critical/serious axe violation
// ---------------------------------------------------------------------------
for (const r of ROUTES) {
  test(`a11y @ ${r.name}`, async ({ page }) => {
    const d = attachDiagnostics(page)
    await gotoRoute(page, r)
    // Let charts/async UI settle before scanning.
    await page.waitForTimeout(400)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const bad = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )
    const summary = bad.map(
      (v) =>
        `${v.id} [${v.impact}] x${v.nodes.length} — ${v.help} :: ${v.nodes[0]?.target?.join(' ')}`,
    )
    expect(summary, `axe critical/serious violations on ${r.name}`).toEqual([])
    expectClean(d, `a11y ${r.name}`)
  })
}

// ---------------------------------------------------------------------------
// 2. CLICKABILITY — every visible interactive element is usable & named
// ---------------------------------------------------------------------------
for (const r of ROUTES) {
  test(`clickability sweep @ ${r.name}`, async ({ page }) => {
    const d = attachDiagnostics(page)
    await gotoRoute(page, r)
    await page.waitForTimeout(300)

    const offenders = await page.evaluate(() => {
      function isVisible(el: Element): boolean {
        const s = getComputedStyle(el as HTMLElement)
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false
        const rect = (el as HTMLElement).getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      }
      const out: { issue: string; name: string; html: string }[] = []
      const els = Array.from(document.querySelectorAll('a[href], button'))
      for (const el of els) {
        if (el.closest('[inert]') || el.closest('[aria-hidden="true"]')) continue
        if (!isVisible(el)) continue
        const name = (
          el.getAttribute('aria-label') ||
          el.textContent ||
          el.getAttribute('title') ||
          ''
        )
          .replace(/\s+/g, ' ')
          .trim()
        const disabled = (el as HTMLButtonElement).matches(':disabled')
        const html = el.outerHTML.replace(/\s+/g, ' ').slice(0, 140)
        if (!name) out.push({ issue: 'no-accessible-name', name: '', html })
        else if (disabled) out.push({ issue: 'unexpectedly-disabled', name, html })
      }
      return out
    })

    expect(offenders, `unusable/unnamed interactive elements on ${r.name}`).toEqual([])

    // Every visible link/button count should be non-zero on content pages.
    const count = await page.locator('a[href]:visible, button:visible').count()
    expect(count, `${r.name} should expose interactive controls`).toBeGreaterThan(0)

    expectClean(d, `clickability ${r.name}`)
  })
}

// ---------------------------------------------------------------------------
// 3. NAVIGATION — links change route and render target content
// ---------------------------------------------------------------------------
test('landing CTA routes to the dashboard', async ({ page }) => {
  const d = attachDiagnostics(page)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: /View the CISO console/i }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText('Active developers')).toBeVisible()
  expectClean(d, 'landing CTA')
})

test('sidebar nav navigates and renders each view', async ({ page }) => {
  const d = attachDiagnostics(page)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  const nav = page.getByRole('navigation', { name: 'Primary' })
  await expect(nav).toBeVisible()

  const steps: { label: string; url: RegExp; assert: () => Promise<void> }[] = [
    {
      label: 'Developers',
      url: /\/dashboard\/developers$/,
      assert: async () => expect(page.getByRole('button', { name: 'Alice Nguyen' })).toBeVisible(),
    },
    {
      label: 'Findings',
      url: /\/dashboard\/findings$/,
      assert: async () => expect(page.getByText(/Showing 6 of 6 findings/)).toBeVisible(),
    },
    {
      label: 'Compliance',
      url: /\/dashboard\/compliance$/,
      assert: async () => expect(page.getByText('Overall compliance score')).toBeVisible(),
    },
    {
      label: 'Overview',
      url: /\/dashboard$/,
      assert: async () => expect(page.getByText('Active developers')).toBeVisible(),
    },
  ]

  for (const s of steps) {
    await nav.getByRole('link', { name: s.label }).click()
    await expect(page).toHaveURL(s.url)
    await s.assert()
    // Active link exposes aria-current=page
    await expect(nav.getByRole('link', { name: s.label })).toHaveAttribute('aria-current', 'page')
  }
  expectClean(d, 'sidebar nav')
})

test('overview cross-links reach findings and compliance', async ({ page }) => {
  const d = attachDiagnostics(page)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: /View all/i }).click()
  await expect(page).toHaveURL(/\/dashboard\/findings/)
  await page.goBack()
  await expect(page.getByText('Compliance posture')).toBeVisible()
  await page.getByRole('link', { name: 'Details' }).click()
  await expect(page).toHaveURL(/\/dashboard\/compliance$/)
  expectClean(d, 'overview cross-links')
})

// ---------------------------------------------------------------------------
// 4. CONNECTION / DATA — KPIs, charts, and tables render real sample data
// ---------------------------------------------------------------------------
test('overview KPIs and charts render populated data', async ({ page }) => {
  const d = attachDiagnostics(page)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

  // KPI tiles (exact to avoid matching prose like "Highest-severity open findings")
  await expect(page.getByText('Active developers', { exact: true })).toBeVisible()
  await expect(page.getByText('Open findings', { exact: true })).toBeVisible()
  await expect(page.getByText('Compliance score', { exact: true })).toBeVisible()
  await expect(page.getByText('Cost MTD', { exact: true })).toBeVisible()
  // Computed values from sample data
  await expect(page.getByText('$512.60')).toBeVisible() // sum of dev costs
  await expect(page.getByText('/100').first()).toBeVisible()

  // Recharts surfaces present and non-empty
  const surfaces = page.locator('svg.recharts-surface')
  await expect(surfaces.first()).toBeVisible()
  expect(await surfaces.count(), 'both charts render an SVG surface').toBeGreaterThanOrEqual(2)

  // Activity chart: area path with real geometry
  const areaPath = page.locator('.recharts-area-area').first()
  await expect(areaPath).toBeVisible()
  const dAttr = await areaPath.getAttribute('d')
  expect((dAttr ?? '').length, 'area chart path should have geometry').toBeGreaterThan(50)

  // Tool-split donut: exactly two sectors, plus legend percentages
  const sectors = page.locator('path.recharts-sector')
  expect(await sectors.count(), 'donut renders two tool-split sectors').toBe(2)
  await expect(page.getByText('Claude Code', { exact: true })).toBeVisible()
  await expect(page.getByText('Cursor', { exact: true })).toBeVisible()
  await expect(page.getByText(/2 · 50%/).first()).toBeVisible()
  await expect(page.getByText('developers', { exact: true }).first()).toBeVisible()

  // Top risks list has entries; compliance meter reflects score
  await expect(page.getByText('Hook exfiltrates AWS credentials')).toBeVisible()
  const meter = page.getByRole('meter').first()
  await expect(meter).toHaveAttribute('aria-valuenow', '72')

  expectClean(d, 'overview data')
})

test('developers table is populated with per-engineer data', async ({ page }) => {
  const d = attachDiagnostics(page)
  await page.goto('/dashboard/developers', { waitUntil: 'domcontentloaded' })
  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(4)
  for (const name of ['Alice Nguyen', 'Ben Okoro', 'Carol Meyer', 'Dan Rossi']) {
    await expect(page.getByRole('button', { name })).toBeVisible()
  }
  await expect(page.getByText('$214.50')).toBeVisible() // Alice cost
  // Risk meters expose ARIA values
  const meters = page.getByRole('meter')
  expect(await meters.count()).toBeGreaterThanOrEqual(4)
  expectClean(d, 'developers data')
})

test('findings table and severity filter compute correctly', async ({ page }) => {
  const d = attachDiagnostics(page)
  await page.goto('/dashboard/findings', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('tbody tr')).toHaveCount(6)
  await expect(page.getByText('Showing 6 of 6 findings')).toBeVisible()

  const group = page.getByRole('group', { name: /Filter findings by severity/i })
  await group.getByRole('button', { name: /^High/ }).click()
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await expect(page.getByText('Showing 2 of 6 findings')).toBeVisible()

  await group.getByRole('button', { name: /^Medium/ }).click()
  await expect(page.locator('tbody tr')).toHaveCount(2)

  await group.getByRole('button', { name: /^Low/ }).click()
  await expect(page.locator('tbody tr')).toHaveCount(2)

  await group.getByRole('button', { name: /^All/ }).click()
  await expect(page.locator('tbody tr')).toHaveCount(6)
  expectClean(d, 'findings filter')
})

test('compliance renders posture summary and control cards', async ({ page }) => {
  const d = attachDiagnostics(page)
  await page.goto('/dashboard/compliance', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Overall compliance score')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Data governance & management' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Third-party & supply-chain' })).toBeVisible()
  // At-risk controls deep-link into findings
  await expect(page.getByRole('link', { name: /open finding/i }).first()).toBeVisible()
  expectClean(d, 'compliance data')
})

// ---------------------------------------------------------------------------
// 5. SLIDE-OVER — open, focus, keyboard, deep-link, cross-navigation, close
// ---------------------------------------------------------------------------
test('developer slide-over: open, focus, Esc restores focus', async ({ page }) => {
  const d = attachDiagnostics(page)
  await page.goto('/dashboard/developers', { waitUntil: 'domcontentloaded' })

  const trigger = page.getByRole('button', { name: 'Alice Nguyen' })
  await trigger.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(dialog.getByText('Staff Engineer')).toBeVisible()
  await expect(dialog.getByText(/High risk · 88/)).toBeVisible()
  await expect(dialog.getByText('Sessions')).toBeVisible()

  // Focus should land on the close button
  await expect(page.getByRole('button', { name: 'Close panel' })).toBeFocused()

  // Esc closes and restores focus to the trigger
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()

  expectClean(d, 'developer slide-over')
})

test('developer slide-over closes via backdrop and close button', async ({ page }) => {
  const d = attachDiagnostics(page)
  await page.goto('/dashboard/developers', { waitUntil: 'domcontentloaded' })

  // Close via the X button
  await page.getByRole('button', { name: 'Ben Okoro' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close panel' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  // Close via backdrop click (top-left corner, away from the panel)
  await page.getByRole('button', { name: 'Carol Meyer' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.mouse.click(20, 400)
  await expect(page.getByRole('dialog')).toBeHidden()

  expectClean(d, 'developer slide-over close paths')
})

test('finding slide-over: detail, evidence, and cross-nav to developer', async ({ page }) => {
  const d = attachDiagnostics(page)
  await page.goto('/dashboard/findings', { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: /Customer PII sent to a cloud model/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(/customer SSN and a live API key/)).toBeVisible()
  await expect(dialog.locator('pre')).toBeVisible() // evidence block
  await expect(dialog.getByText('EU AI Act Art. 10')).toBeVisible()

  // Footer cross-navigation opens the developer slide-over
  await dialog.getByRole('button', { name: /View developer/i }).click()
  await expect(page).toHaveURL(/\/dashboard\/developers\?dev=alice/)
  await expect(page.getByRole('dialog').getByText('Staff Engineer')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  expectClean(d, 'finding slide-over')
})

test('deep links auto-open the correct slide-over', async ({ page }) => {
  const d = attachDiagnostics(page)

  await page.goto('/dashboard/findings?finding=f2', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Hook exfiltrates AWS credentials')).toBeVisible()

  await page.goto('/dashboard/developers?dev=carol', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Carol Meyer' })).toBeVisible()

  expectClean(d, 'deep links')
})

// ---------------------------------------------------------------------------
// 6. RESPONSIVE — no horizontal overflow; nav adapts at mobile vs desktop
// ---------------------------------------------------------------------------
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

for (const vp of VIEWPORTS) {
  for (const r of ROUTES) {
    test(`no horizontal overflow @ ${vp.name} ${r.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await gotoRoute(page, r)
      await page.waitForTimeout(400) // allow responsive charts to measure

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      expect(
        metrics.scrollWidth,
        `${r.name} @ ${vp.name}: scrollWidth ${metrics.scrollWidth} > innerWidth ${metrics.innerWidth}`,
      ).toBeLessThanOrEqual(metrics.innerWidth + 2)
    })
  }
}

test('mobile: sidebar collapses to a drawer that opens and closes', async ({ page }) => {
  const d = attachDiagnostics(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

  // Desktop rail hidden; hamburger visible
  const menuBtn = page.getByRole('button', { name: 'Open navigation' })
  await expect(menuBtn).toBeVisible()

  // Open drawer -> nav dialog appears
  await menuBtn.click()
  const drawer = page.getByRole('dialog', { name: 'Navigation' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Findings' })).toBeVisible()

  // Esc closes the drawer
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()

  // Reopen and navigate via a link -> drawer auto-closes and route changes
  await menuBtn.click()
  await page.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: 'Findings' }).click()
  await expect(page).toHaveURL(/\/dashboard\/findings$/)
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden()

  expectClean(d, 'mobile drawer')
})

test('desktop: persistent sidebar is visible and hamburger is hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden()
})
