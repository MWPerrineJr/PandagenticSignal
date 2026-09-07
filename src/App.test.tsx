import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { AppRoutes } from '@/app/routes'
import { useTickerStore } from '@/stores/tickers'

beforeEach(() => {
  useTickerStore.getState().clear()
  localStorage.clear()
})

describe('routing', () => {
  it.each([
    ['/', 'Dashboard'],
    ['/charts', 'Charts'],
    ['/watchlist', 'Watchlist'],
    ['/analysts', 'Analysts'],
  ])('renders %s with the %s heading', (route, heading) => {
    renderWithProviders(<AppRoutes />, { route })
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: heading })).toHaveAttribute('aria-current', 'page')
  })

  it('redirects unknown paths to the dashboard', () => {
    renderWithProviders(<AppRoutes />, { route: '/nope' })
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })

  it('applies the dark theme by default and toggles', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />)
    expect(document.documentElement).toHaveClass('dark')
    await user.click(screen.getByRole('button', { name: /switch to light theme/i }))
    expect(document.documentElement).not.toHaveClass('dark')
  })
})

describe('ticker flow', () => {
  it('shows an empty state without a ticker', () => {
    renderWithProviders(<AppRoutes />)
    expect(screen.getByText(/no ticker selected/i)).toBeInTheDocument()
  })

  it('loads the quote card for ?t= and keeps the ticker across tabs', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/?t=aapl' })
    expect(await screen.findByText('$200.00')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Charts' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Charts' })).toBeInTheDocument()
    expect(screen.getByText('AAPL', { selector: 'span' })).toBeInTheDocument()
  })

  it('selecting from search updates the URL-driven quote', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />)
    await user.type(screen.getByRole('combobox', { name: /search symbol/i }), 'msft')
    await user.click(await screen.findByRole('option', { name: /MSFT/ }))
    expect(await screen.findByText('$400.00')).toBeInTheDocument()
  })

  it('shows a friendly 404 message for an unknown ticker', async () => {
    renderWithProviders(<AppRoutes />, { route: '/?t=NOPE' })
    expect(await screen.findByRole('alert')).toHaveTextContent(/no data for NOPE/i)
  })

  it('tracks a ticker and lists it on the watchlist', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/?t=AAPL' })
    await user.click(await screen.findByRole('button', { name: 'Track AAPL' }))
    expect(screen.getByRole('button', { name: 'Untrack AAPL' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Watchlist' }))
    expect(screen.getByText('AAPL', { selector: '[data-slot=badge]' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove AAPL' }))
    expect(screen.getByText(/nothing tracked yet/i)).toBeInTheDocument()
  })
})
