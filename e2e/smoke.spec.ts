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

  test('crypto tab lists coins, opens a coin, and search labels crypto', async ({ page }) => {
    await page.goto('/crypto')
    await expect(page.getByRole('heading', { level: 1, name: 'Crypto' })).toBeVisible()
    const btc = page.getByTestId('row-BTC-USD')
    await expect(btc).toContainText(/\$\d[\d,]*\.\d{2}/)
    await expect(btc).toContainText(/[+-]?\d+\.\d{2}%/)

    // Clicking the coin selects it app-wide and shows the quote card + chart.
    await btc.getByRole('button', { name: /Bitcoin/ }).click()
    await expect(page).toHaveURL(/[?&]t=BTC-USD/)
    const detail = page.getByTestId('coin-detail')
    await expect(detail).toContainText('Crypto · USD')
    await expect(detail.getByTestId('price-chart')).toBeVisible()

    // The header search finds coins and labels them.
    const search = page.getByRole('combobox', { name: 'Search symbol or company' })
    await search.fill('ethereum')
    const option = page.getByRole('option', { name: /^ETH-USD\b/ }).first()
    await expect(option).toContainText('Crypto')
    await option.click()
    await expect(page).toHaveURL(/[?&]t=ETH-USD/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ETH-USD')
  })

  test('portfolio tab: holdings persist, stats render, simulation draws the fan', async ({ page }) => {
    await page.goto('/portfolio')
    await expect(page.getByRole('heading', { level: 1, name: 'Portfolio' })).toBeVisible()
    const add = page.getByRole('combobox', { name: 'Add a holding' })
    await add.fill('apple')
    await page.getByRole('option', { name: /^AAPL\b/ }).first().click()
    await expect(page.getByTestId('holding-AAPL')).toBeVisible()
    await add.fill('bitcoin')
    await page.getByRole('option', { name: /^BTC-USD\b/ }).first().click()
    await expect(page.getByTestId('holding-BTC-USD')).toBeVisible()

    const cards = page.getByTestId('stats-cards')
    await expect(cards).toContainText(/Annual return/)
    await expect(cards.getByText(/^-?\d+\.\d%$/).first()).toBeVisible()
    await expect(page.getByRole('figure', { name: /return correlation/i })).toBeVisible()

    await page.getByRole('button', { name: /run simulation/i }).click()
    await expect(page.getByRole('figure', { name: /simulated wealth over 10 years/i })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('terminal-stats')).toContainText('Median outcome')

    // Holdings survive a reload (browser persistence when signed out).
    await page.waitForTimeout(1500)
    await page.reload()
    await expect(page.getByTestId('holding-AAPL')).toBeVisible()
    await expect(page.getByTestId('holding-BTC-USD')).toBeVisible()
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
