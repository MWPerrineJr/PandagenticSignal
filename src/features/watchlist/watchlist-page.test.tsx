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

describe('WatchlistPage', () => {
  it('shows the empty state', async () => {
    renderWithProviders(<AppRoutes />, { route: '/watchlist' })
    expect(await screen.findByText(/nothing tracked yet/i)).toBeInTheDocument()
  })

  it('renders live quote rows, sparklines and a missing-data row', async () => {
    useTickerStore.getState().add('AAPL')
    useTickerStore.getState().add('MSFT')
    useTickerStore.getState().add('NOPE')
    renderWithProviders(<AppRoutes />, { route: '/watchlist' })
    const aapl = await screen.findByTestId('row-AAPL')
    await waitFor(() => expect(within(aapl).getByText('$200.00')).toBeInTheDocument())
    expect(within(aapl).getByText('+10.00 (+5.26%)')).toHaveClass('text-emerald-500')
    expect(within(screen.getByTestId('row-MSFT')).getByText('-4.00 (-0.99%)')).toHaveClass('text-red-500')
    expect(within(screen.getByTestId('row-NOPE')).getByText(/no data for this symbol/i)).toBeInTheDocument()
    expect(await within(aapl).findByRole('img', { name: /AAPL one-month trend/ })).toBeInTheDocument()
    expect(screen.getByText('3/20')).toBeInTheDocument()
  })

  it('adds via search, reorders and removes', async () => {
    const user = userEvent.setup()
    useTickerStore.getState().add('AAPL')
    renderWithProviders(<AppRoutes />, { route: '/watchlist' })
    await user.type(await screen.findByRole('combobox', { name: /add a symbol to the watchlist/i }), 'msft')
    await user.click(await screen.findByRole('option', { name: /MSFT/ }))
    expect(useTickerStore.getState().tickers).toEqual(['AAPL', 'MSFT'])

    await user.click(screen.getByRole('button', { name: 'Move MSFT up' }))
    expect(useTickerStore.getState().tickers).toEqual(['MSFT', 'AAPL'])
    expect(screen.getByRole('button', { name: 'Move MSFT up' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Remove AAPL' }))
    expect(useTickerStore.getState().tickers).toEqual(['MSFT'])
  })

  it('clicking a symbol selects it and opens the chart', async () => {
    const user = userEvent.setup()
    useTickerStore.getState().add('AAPL')
    renderWithProviders(<AppRoutes />, { route: '/watchlist' })
    await user.click(await screen.findByRole('button', { name: 'AAPL' }))
    expect(await screen.findByRole('heading', { level: 1, name: /^Charts\s*AAPL/ })).toBeInTheDocument()
  })

  it('shows an error row when quotes fail', async () => {
    server.use(http.get(`${API_URL}/quotes`, () => HttpResponse.json({ detail: 'Yahoo Finance error: boom' }, { status: 502 })))
    useTickerStore.getState().add('AAPL')
    renderWithProviders(<AppRoutes />, { route: '/watchlist' })
    expect(await screen.findByRole('alert')).toHaveTextContent(/yahoo finance error/i)
  })
})
