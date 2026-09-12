import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { AppRoutes } from '@/app/routes'
import { useTickerStore } from '@/stores/tickers'

vi.mock('lightweight-charts', () => import('@/test/chart-mock'))

beforeEach(() => {
  useTickerStore.getState().clear()
  localStorage.clear()
})

describe('routing', () => {
  it.each([
    ['/dashboard', 'Dashboard'],
    ['/charts', 'Charts'],
    ['/watchlist', /^Watchlist/],
    ['/analysts', 'Analysts'],
  ])('renders %s with the %s heading', async (route, heading) => {
    renderWithProviders(<AppRoutes />, { route })
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    const linkName = typeof heading === 'string' ? heading : 'Watchlist'
    expect(screen.getByRole('link', { name: linkName })).toHaveAttribute('aria-current', 'page')
  })

  it('redirects unknown paths to the login page', async () => {
    renderWithProviders(<AppRoutes />, { route: '/nope' })
    expect(await screen.findByRole('form', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('always applies the dark brand theme', async () => {
    renderWithProviders(<AppRoutes />)
    expect(document.documentElement).toHaveClass('dark')
    expect(screen.queryByRole('button', { name: /switch to light theme/i })).not.toBeInTheDocument()
  })
})

describe('ticker flow', () => {
  it('shows an empty state without a ticker', () => {
    renderWithProviders(<AppRoutes />, { route: '/dashboard' })
    expect(screen.getAllByText(/no ticker selected/i).length).toBeGreaterThan(0)
  })

  it('loads the quote card for ?t= and keeps the ticker across tabs', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/dashboard?t=aapl' })
    expect(await screen.findByText('$200.00')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Charts' }))
    expect(await screen.findByRole('heading', { level: 1, name: /^Charts\s*AAPL/ })).toBeInTheDocument()
    expect(await screen.findByTestId('price-chart')).toBeInTheDocument()
  })

  it('selecting from search updates the URL-driven quote', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/dashboard' })
    await user.type(screen.getByRole('combobox', { name: /search symbol/i }), 'msft')
    await user.click(await screen.findByRole('option', { name: /MSFT/ }))
    expect(await screen.findByText('$400.00')).toBeInTheDocument()
  })

  it('shows a friendly 404 message for an unknown ticker', async () => {
    renderWithProviders(<AppRoutes />, { route: '/dashboard?t=NOPE' })
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some((a) => /no data for NOPE/i.test(a.textContent ?? ''))).toBe(true)
  })

  it('tracks a ticker and lists it on the watchlist', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/dashboard?t=AAPL' })
    await user.click(await screen.findByRole('button', { name: 'Track AAPL' }))
    expect(screen.getByRole('button', { name: 'Untrack AAPL' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Watchlist' }))
    expect(await screen.findByTestId('row-AAPL')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove AAPL' }))
    expect(screen.getByText(/nothing tracked yet/i)).toBeInTheDocument()
  })
})
