import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { API_URL } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'
import { AppRoutes } from '@/app/routes'
import { useTickerStore } from '@/stores/tickers'

vi.mock('lightweight-charts', () => import('@/test/chart-mock'))

beforeEach(() => {
  useTickerStore.getState().clear()
  localStorage.clear()
})

describe('CryptoPage', () => {
  it('lists the top coins with price, 24h change and small-cap decimals', async () => {
    renderWithProviders(<AppRoutes />, { route: '/crypto' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Crypto' })).toBeInTheDocument()
    const btc = await screen.findByTestId('row-BTC-USD')
    expect(within(btc).getByText('$65,000.00')).toBeInTheDocument()
    expect(within(btc).getByText('+1.50%')).toHaveClass('text-emerald-500')
    expect(within(screen.getByTestId('row-ETH-USD')).getByText('-0.75%')).toHaveClass('text-red-500')
    const doge = screen.getByTestId('row-DOGE-USD')
    expect(within(doge).getByText('$0.1234')).toBeInTheDocument()
    expect(within(doge).getAllByText('—')).toHaveLength(3) // 24h change, volume and supply are null
    expect(within(doge).getByText('4')).toBeInTheDocument() // CoinGecko rank, not the row index
    expect(within(doge).getByTitle(/price from CoinGecko/i)).toBeInTheDocument()
    expect(within(btc).queryByTitle(/price from CoinGecko/i)).not.toBeInTheDocument()
    expect(within(btc).getByRole('presentation', { hidden: true })).toHaveAttribute('src', 'https://img.example/btc.png')
    expect(screen.getByText(/top 3 by market cap/i)).toBeInTheDocument()
    expect(await within(btc).findByRole('img', { name: /BTC-USD one-month trend/ })).toBeInTheDocument()
  })

  it('selects a coin, shows its quote and chart, and keeps it in the URL', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/crypto' })
    await user.click(await screen.findByRole('button', { name: /Bitcoin USD/ }))
    expect(await screen.findByRole('heading', { level: 1, name: /^Crypto\s*BTC-USD/ })).toBeInTheDocument()
    const detail = screen.getByTestId('coin-detail')
    await waitFor(() => expect(within(detail).getByText('$65,000.00')).toBeInTheDocument())
    expect(within(detail).getByText('Crypto · USD')).toBeInTheDocument()
    expect(within(detail).getByText('24h range')).toBeInTheDocument()
    expect(await within(detail).findByTestId('price-chart')).toBeInTheDocument()
    expect(screen.getByTestId('row-BTC-USD')).toHaveClass('bg-muted/40')
  })

  it('opens straight from the URL and tracks a coin', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/crypto?t=ETH-USD' })
    expect(await screen.findByTestId('coin-detail')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Track ETH-USD' }))
    expect(useTickerStore.getState().tickers).toEqual(['ETH-USD'])
    expect(screen.getByRole('button', { name: 'Untrack ETH-USD' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('explains when the header ticker is not a coin', async () => {
    renderWithProviders(<AppRoutes />, { route: '/crypto?t=AAPL' })
    expect(await screen.findByText(/is not a cryptocurrency/i)).toBeInTheDocument()
    expect(screen.queryByTestId('coin-detail')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Crypto$/)
  })

  it('shows an error when the market feed fails', async () => {
    server.use(http.get(`${API_URL}/crypto/top`, () => HttpResponse.json({ detail: 'Yahoo Finance error: boom' }, { status: 502 })))
    renderWithProviders(<AppRoutes />, { route: '/crypto' })
    expect(await screen.findByRole('alert')).toHaveTextContent(/yahoo finance error/i)
  })

  it('labels crypto results in the header search', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/crypto' })
    await user.type(await screen.findByRole('combobox', { name: 'Search symbol or company' }), 'bitcoin')
    const option = await screen.findByRole('option', { name: /BTC-USD/ })
    expect(within(option).getByText('Crypto')).toBeInTheDocument()
    expect(within(screen.getByRole('option', { name: /IBIT/ })).getByText('NASDAQ')).toBeInTheDocument()
    await user.click(option)
    expect(await screen.findByTestId('coin-detail')).toBeInTheDocument()
  })
})
