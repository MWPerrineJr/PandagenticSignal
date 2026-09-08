import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { API_URL } from '@/test/handlers'
import { recommendationsFixture } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { AppRoutes } from '@/app/routes'

describe('AnalystsPage', () => {
  it('shows the empty state without a ticker', async () => {
    renderWithProviders(<AppRoutes />, { route: '/analysts' })
    expect(await screen.findByText(/no ticker selected/i)).toBeInTheDocument()
  })

  it('renders consensus, targets, rating bars and the grade table', async () => {
    renderWithProviders(<AppRoutes />, { route: '/analysts?t=AAPL' })
    // (5·6 + 4·18 + 3·13 + 2·3 + 1·3) / 43 = 3.49 → Hold
    expect(await screen.findByTestId('consensus-badge')).toHaveTextContent('Hold')
    expect(screen.getByText('3.5 / 5')).toBeInTheDocument()
    expect(screen.getByText('43 analysts this month')).toBeInTheDocument()
    expect(screen.getAllByText('$225.50').length).toBeGreaterThanOrEqual(2) // KPI card + gauge list
    expect(await screen.findByText(/\+12\.7% vs current/)).toBeInTheDocument()

    const bars = screen.getByRole('figure', { name: /analyst ratings by month/i })
    expect(within(bars).getAllByRole('listitem')).toHaveLength(2)
    expect(within(bars).getAllByRole('img', { name: '6 strong buy' })).toHaveLength(2)
    expect(within(bars).getAllByRole('listitem')[0]).toHaveTextContent('This month')

    const gauge = screen.getByRole('figure', { name: /price targets/i })
    expect(within(gauge).getByRole('img', { name: 'Mean target $225.50' })).toBeInTheDocument()
    expect(within(gauge).getByRole('img', { name: 'Current price $200.00' })).toBeInTheDocument()

    const table = screen.getByRole('table', { name: /rating changes/i })
    expect(within(table).getByText('Morgan Stanley')).toBeInTheDocument()
    expect(within(table).getByText('Reiterated')).toBeInTheDocument()
    expect(within(table).getByText('$370.00')).toBeInTheDocument()
  })

  it('hovering a segment shows its tooltip and the table view lists counts', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/analysts?t=AAPL' })
    const bars = await screen.findByRole('figure', { name: /analyst ratings by month/i })
    await user.hover(within(bars).getAllByRole('img', { name: '13 hold' })[0]!)
    expect(within(bars).getByRole('status')).toHaveTextContent('This month: 13 hold of 43')
    await user.click(within(bars).getByText('Table view'))
    expect(within(bars).getByRole('table')).toHaveTextContent('1 month ago')
  })

  it('shows a no-coverage state for unrated symbols', async () => {
    server.use(
      http.get(`${API_URL}/recommendations/:symbol`, () =>
        HttpResponse.json({ symbol: 'MSFT', summary: [], price_targets: {}, upgrades_downgrades: [] }),
      ),
    )
    renderWithProviders(<AppRoutes />, { route: '/analysts?t=MSFT' })
    expect(await screen.findByText(/no analyst coverage for MSFT/i)).toBeInTheDocument()
  })

  it('handles a 404 and a partial payload', async () => {
    renderWithProviders(<AppRoutes />, { route: '/analysts?t=NOPE' })
    expect(await screen.findByRole('alert')).toHaveTextContent(/no data for NOPE/i)

    server.use(
      http.get(`${API_URL}/recommendations/:symbol`, () =>
        HttpResponse.json({ ...recommendationsFixture, summary: [], price_targets: { mean: 250 } }),
      ),
    )
    renderWithProviders(<AppRoutes />, { route: '/analysts?t=AAPL' })
    expect(await screen.findByText('No ratings')).toBeInTheDocument()
    expect(screen.getByText(/no price-target range published/i)).toBeInTheDocument()
  })
})
