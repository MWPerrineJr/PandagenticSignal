import { expect, test, type Page } from '@playwright/test'

/** The API the deployed frontend talks to; local runs use the uvicorn server Playwright starts. */
const API_URL = process.env.E2E_API_URL ?? (process.env.E2E_BASE_URL ? 'https://stock-tool-api-qg9s.onrender.com' : 'http://localhost:8000')

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

    // Charts: candles render with the default indicators; the picker adds an oscillator pane.
    await page.getByRole('link', { name: 'Charts' }).click()
    await expect(page.getByTestId('price-chart')).toBeVisible()
    await expect(page.getByTestId('chart-legend')).toContainText('EMA 10')
    await expect(page.getByTestId('chart-legend')).toContainText('BB 20/2')
    await page.getByRole('button', { name: /indicators/i }).click()
    const picker = page.getByRole('dialog', { name: 'Indicators' })
    await picker.getByRole('button', { name: 'Remove BB 20/2' }).click()
    await picker.getByRole('combobox', { name: 'Add indicator' }).selectOption('rsi')
    await picker.getByRole('combobox', { name: 'Add indicator' }).selectOption('macd')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('chart-legend')).toContainText('RSI 14')
    await expect(page.getByTestId('chart-legend')).toContainText('MACD 12/26/9')
    await expect(page.getByTestId('chart-legend')).not.toContainText('BB 20/2')
    await expect(page.getByTestId('indicator-count')).toHaveText('7')
    await page.getByRole('radio', { name: '6M' }).click()
    await expect(page).toHaveURL(/period=6mo/)
    await expect(page.getByText(/bars · daily · 7 indicators/)).toBeVisible()

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
    // The same indicator picker works on coins (RSI is computed from Coinbase candles).
    await detail.getByRole('button', { name: /indicators/i }).click()
    await page.getByRole('dialog', { name: 'Indicators' }).getByRole('combobox', { name: 'Add indicator' }).selectOption('rsi')
    await page.keyboard.press('Escape')
    await expect(detail.getByTestId('chart-legend')).toContainText('RSI 14')

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

  test('retirement tab: sliders project instantly, Monte Carlo reports a probability', async ({ page }) => {
    await page.goto('/retirement')
    await expect(page.getByRole('heading', { level: 1, name: 'Retirement' })).toBeVisible()
    await expect(page.getByRole('figure', { name: /projected nest egg by age/i })).toBeVisible()
    const age = page.getByRole('spinbutton', { name: 'Retirement age (number)' })
    await age.fill('62')
    await expect(page.getByText('retire at 62')).toBeVisible()
    await expect(page.getByTestId('deterministic-summary')).toContainText('Nest egg at 62')

    await page.getByRole('button', { name: /run monte carlo/i }).click()
    await expect(page.getByTestId('success-probability')).toHaveText(/^\d{1,3}%$/, { timeout: 60_000 })
    await expect(page.getByRole('figure', { name: /balance in today’s dollars/i })).toBeVisible()
  })

  test('sentiment tab: analyses on demand when the API has a key, stays quiet otherwise', async ({ page }) => {
    await page.goto('/sentiment?t=AAPL')
    await expect(page.getByRole('heading', { level: 1, name: /Sentiment\s*AAPL/ })).toBeVisible()
    const status = await page.request.get(`${API_URL}/sentiment/status`)
    const { enabled } = (await status.json()) as { enabled: boolean }
    if (!enabled) {
      await expect(page.getByTestId('sentiment-disabled')).toBeVisible()
      await expect(page.getByRole('button', { name: /analyse news sentiment/i })).toHaveCount(0)
      return
    }
    await page.getByRole('button', { name: /analyse news sentiment/i }).click()
    await expect(page.getByTestId('sentiment-result')).toBeVisible({ timeout: 90_000 })
    await expect(page.getByTestId('sentiment-footer')).toContainText(/not investment advice/i)
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
