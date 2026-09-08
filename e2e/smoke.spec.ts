import { expect, test, type Page } from '@playwright/test'

/** Search by company name and pick the first exchange listing. */
async function pickSymbol(page: Page, query: string, symbol: string) {
  const search = page.getByRole('combobox', { name: 'Search symbol or company' })
  await search.fill(query)
  await page.getByRole('option', { name: new RegExp(`^${symbol}\\b`) }).first().click()
  await expect(page).toHaveURL(new RegExp(`[?&]t=${symbol}`))
}

test.describe('smoke (live data, signed out)', () => {
  test('search → dashboard quote → chart overlays → watchlist → analysts', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()

    // Search "apple" and select AAPL; the dashboard quote widget fills in.
    await pickSymbol(page, 'apple', 'AAPL')
    const quote = page.getByRole('region', { name: 'Quote' })
    await expect(quote).toContainText('AAPL')
    await expect(quote.getByText(/^\$\d[\d,]*\.\d{2}$/).first()).toBeVisible()

    // Charts: candles render, overlays toggle and persist in the URL.
    await page.getByRole('link', { name: 'Charts' }).click()
    await expect(page.getByTestId('price-chart')).toBeVisible()
    await expect(page.getByTestId('chart-legend')).toContainText('EMA 10')
    const bollinger = page.getByRole('button', { name: /Bollinger/ })
    await expect(bollinger).toHaveAttribute('aria-pressed', 'true')
    await bollinger.click()
    await expect(bollinger).toHaveAttribute('aria-pressed', 'false')
    await expect(page).toHaveURL(/ov=/)
    await page.getByRole('radio', { name: '6M' }).click()
    await expect(page).toHaveURL(/period=6mo/)
    await expect(page.getByText(/bars · daily/)).toBeVisible()

    // Watchlist: track AAPL from the dashboard, add MSFT by search, remove it again.
    await page.getByRole('link', { name: 'Dashboard' }).click()
    await page.getByRole('button', { name: 'Track AAPL' }).click()
    await expect(page.getByRole('button', { name: 'Untrack AAPL' })).toBeVisible()
    await page.getByRole('link', { name: 'Watchlist' }).click()
    await expect(page.getByTestId('row-AAPL')).toBeVisible()
    const add = page.getByRole('combobox', { name: 'Add a symbol to the watchlist' })
    await add.fill('microsoft')
    await page.getByRole('option', { name: /^MSFT\b/ }).first().click()
    await expect(page.getByTestId('row-MSFT')).toContainText(/\$\d/)
    await expect(page.getByText(/saved in this browser/i)).toBeVisible()
    await page.getByRole('button', { name: 'Remove MSFT' }).click()
    await expect(page.getByTestId('row-MSFT')).toHaveCount(0)

    // Analysts: coverage renders for AAPL.
    await page.getByRole('link', { name: 'Analysts' }).click()
    await expect(page.getByTestId('consensus-badge')).toBeVisible()
    await expect(page.getByRole('figure', { name: /analyst ratings by month/i })).toBeVisible()
    await expect(page.getByRole('table', { name: /rating changes/i })).toBeVisible()
  })

  test('unknown symbol shows a friendly error, not a crash', async ({ page }) => {
    await page.goto('/?t=ZZZZNOTREAL')
    await expect(page.getByRole('alert').filter({ hasText: /no data for ZZZZNOTREAL/i })).toBeVisible()
    await page.getByRole('link', { name: 'Charts' }).click()
    await expect(page.getByRole('alert').filter({ hasText: /no price history/i })).toBeVisible()
  })

  test('login page renders and rejects bad credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('nobody@example.com')
    await page.getByLabel('Password').fill('definitely-wrong-password')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByRole('alert')).toContainText(/invalid|credentials|error/i)
  })
})
