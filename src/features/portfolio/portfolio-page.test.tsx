import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { API_URL } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'
import { AppRoutes } from '@/app/routes'
import { usePortfolioStore } from '@/stores/portfolios'

beforeEach(() => {
  localStorage.clear()
  usePortfolioStore.getState().reset()
})

async function addHolding(user: ReturnType<typeof userEvent.setup>, query: string, symbol: string) {
  await user.type(screen.getByRole('combobox', { name: 'Add a holding' }), query)
  await user.click(await screen.findByRole('option', { name: new RegExp(symbol) }, { timeout: 3000 }))
  await screen.findByTestId(`holding-${symbol}`)
}

describe('PortfolioPage', () => {
  it('starts empty, then shows statistics and the correlation matrix once holdings exist', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/portfolio' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Portfolio' })).toBeInTheDocument()
    expect(screen.getByText(/no holdings yet/i)).toBeInTheDocument()
    expect(screen.queryByTestId('stats-cards')).not.toBeInTheDocument()

    await addHolding(user, 'apple', 'AAPL')
    await addHolding(user, 'bitcoin', 'BTC-USD')
    expect(screen.getByText('2/20 holdings')).toBeInTheDocument()
    expect(within(screen.getByTestId('holding-AAPL')).getByText('50.0%')).toBeInTheDocument()

    const cards = await screen.findByTestId('stats-cards')
    // Fixture: AAPL 8% / BTC 10% at 50/50 -> 9.0% return, vol (0.2+0.25)/2*0.8 = 18.0%.
    expect(within(cards).getByText('9.0%')).toBeInTheDocument()
    expect(within(cards).getByText('18.0%')).toBeInTheDocument()
    expect(within(cards).getByText('-25.0%')).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /return correlation/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /correlation matrix for AAPL, BTC-USD/i })).toBeInTheDocument()

    // Edits persist to the local store after the debounce.
    await waitFor(() => expect(usePortfolioStore.getState().portfolios[0]!.holdings).toHaveLength(2), { timeout: 3000 })
  })

  it('reweights, switches to amounts, normalises and removes holdings', async () => {
    const user = userEvent.setup()
    usePortfolioStore.getState().upsert({
      ...usePortfolioStore.getState().portfolios[0]!,
      holdings: [
        { symbol: 'AAPL', value: 30 },
        { symbol: 'MSFT', value: 10 },
      ],
    })
    renderWithProviders(<AppRoutes />, { route: '/portfolio' })
    const aapl = await screen.findByTestId('holding-AAPL')
    expect(within(aapl).getByText('75.0%')).toBeInTheDocument()

    const weight = screen.getByRole('spinbutton', { name: 'Weight for MSFT' })
    await user.clear(weight)
    await user.type(weight, '30')
    expect(within(aapl).getByText('50.0%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /normalise to 100%/i }))
    expect(screen.getByRole('spinbutton', { name: 'Weight for AAPL' })).toHaveValue(50)
    expect(screen.getByRole('button', { name: /normalise to 100%/i })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: /amounts/i }))
    expect(screen.getByRole('spinbutton', { name: 'Amount for AAPL' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /normalise/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove MSFT' }))
    expect(screen.queryByTestId('holding-MSFT')).not.toBeInTheDocument()
    expect(within(aapl).getByText('100.0%')).toBeInTheDocument()
  })

  it('runs a simulation on demand and hides it again when the holdings change', async () => {
    const user = userEvent.setup()
    usePortfolioStore.getState().upsert({ ...usePortfolioStore.getState().portfolios[0]!, holdings: [{ symbol: 'AAPL', value: 1 }] })
    renderWithProviders(<AppRoutes />, { route: '/portfolio' })
    await screen.findByTestId('stats-cards')
    expect(screen.getByText(/run the simulation to see/i)).toBeInTheDocument()

    const horizon = screen.getByRole('spinbutton', { name: /horizon/i })
    await user.clear(horizon)
    await user.type(horizon, '5')
    const contribution = screen.getByRole('spinbutton', { name: /monthly contribution/i })
    await user.clear(contribution)
    await user.type(contribution, '200')
    await user.click(screen.getByRole('button', { name: /run simulation/i }))

    expect(await screen.findByRole('figure', { name: /simulated wealth over 5 years/i })).toBeInTheDocument()
    const terminal = screen.getByTestId('terminal-stats')
    expect(within(terminal).getByText('Median outcome')).toBeInTheDocument()
    expect(within(terminal).getByText('12%')).toBeInTheDocument() // prob_loss fixture
    expect(within(terminal).getByText(/weekly steps/)).toBeInTheDocument()

    await addHolding(user, 'msft', 'MSFT')
    expect(screen.queryByRole('figure', { name: /simulated wealth/i })).not.toBeInTheDocument()
    expect(await screen.findByText(/run the simulation to see/i)).toBeInTheDocument()
  })

  it('creates, renames and deletes portfolios through the picker', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'prompt').mockReturnValueOnce('Retirement').mockReturnValueOnce('Long term')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderWithProviders(<AppRoutes />, { route: '/portfolio' })
    await screen.findByRole('heading', { level: 1, name: 'Portfolio' })

    await user.click(screen.getByRole('button', { name: 'New' }))
    expect(screen.getByRole('combobox', { name: 'Portfolio' })).toHaveDisplayValue('Retirement')
    await user.click(screen.getByRole('button', { name: 'Rename' }))
    expect(screen.getByRole('combobox', { name: 'Portfolio' })).toHaveDisplayValue('Long term')
    expect(usePortfolioStore.getState().portfolios.map((p) => p.name)).toEqual(['My portfolio', 'Long term'])

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(usePortfolioStore.getState().portfolios.map((p) => p.name)).toEqual(['My portfolio'])
    expect(screen.getByText(/saved in this browser/i)).toBeInTheDocument()
  })

  it('explains an unknown symbol and a rate limit', async () => {
    const user = userEvent.setup()
    usePortfolioStore.getState().upsert({
      ...usePortfolioStore.getState().portfolios[0]!,
      holdings: [
        { symbol: 'AAPL', value: 1 },
        { symbol: 'NOPE', value: 1 },
      ],
    })
    renderWithProviders(<AppRoutes />, { route: '/portfolio' })
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent(/unknown ticker: NOPE.*remove the unknown symbol/i)

    await user.click(screen.getByRole('button', { name: 'Remove NOPE' }))
    await screen.findByTestId('stats-cards')
    server.use(http.post(`${API_URL}/portfolio/simulate`, () => HttpResponse.json({ detail: 'Rate limit exceeded' }, { status: 429 })))
    await user.click(screen.getByRole('button', { name: /run simulation/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many simulations/i)
  })
})
