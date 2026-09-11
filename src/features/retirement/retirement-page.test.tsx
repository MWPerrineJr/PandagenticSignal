import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { API_URL } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'
import { AppRoutes } from '@/app/routes'
import { useRetirementStore } from '@/stores/retirement'
import { usePortfolioStore } from '@/stores/portfolios'
import { makePortfolio } from '@/lib/portfolio'
import { projectDeterministic } from '@/lib/retirement'
import { formatPrice } from '@/lib/format'

beforeEach(() => {
  localStorage.clear()
  useRetirementStore.getState().reset()
  usePortfolioStore.getState().reset()
})

describe('RetirementPage', () => {
  it('projects instantly from the sliders and persists the inputs', async () => {
    renderWithProviders(<AppRoutes />, { route: '/retirement' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Retirement' })).toBeInTheDocument()
    const inputs = useRetirementStore.getState().inputs
    const expected = projectDeterministic(inputs)
    const summary = screen.getByTestId('deterministic-summary')
    expect(within(summary).getByText(formatPrice(expected.find((p) => p.age === inputs.retirement_age)!.balance_nominal))).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /projected nest egg by age/i })).toBeInTheDocument()
    const svg = screen.getByTestId('nest-egg-chart')
    expect(svg.querySelector('path[data-series="nominal"]')).toBeInTheDocument()
    expect(svg.querySelector('path[data-series="real"]')).toBeInTheDocument()
    expect(within(svg).getByText(`retire at ${inputs.retirement_age}`)).toBeInTheDocument()

    fireEvent.change(screen.getByRole('slider', { name: 'Retirement age' }), { target: { value: '60' } })
    expect(useRetirementStore.getState().inputs.retirement_age).toBe(60)
    expect(within(svg).getByText('retire at 60')).toBeInTheDocument()
    const updated = projectDeterministic(useRetirementStore.getState().inputs)
    expect(within(summary).getByText(formatPrice(updated.find((p) => p.age === 60)!.balance_nominal))).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('stock-tool.retirement')!).state.inputs.retirement_age).toBe(60)
  })

  it('flags impossible ages and runs the Monte Carlo on demand', async () => {
    const user = userEvent.setup()
    useRetirementStore.getState().set({ current_savings: 600_000 }) // a plan that lasts: fixture reports 82%
    renderWithProviders(<AppRoutes />, { route: '/retirement' })
    await screen.findByRole('heading', { level: 1, name: 'Retirement' })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Current age (number)' }), { target: { value: '70' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/ages must increase/i)
    expect(screen.queryByRole('button', { name: /run monte carlo/i })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Current age (number)' }), { target: { value: '35' } })

    await user.click(screen.getByRole('button', { name: /run monte carlo/i }))
    const card = await screen.findByTestId('success-card')
    expect(within(card).getByTestId('success-probability')).toHaveTextContent('82%')
    expect(within(card).getByText(/6\.0% \/ 12%/)).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /balance in today’s dollars over 55 years/i })).toBeInTheDocument()
    expect(screen.getByText('2,000 paths, yearly steps', { exact: false })).toBeInTheDocument()
    expect(within(screen.getByRole('img', { name: /median and 5th/i })).getByText('35')).toBeInTheDocument() // age axis label

    // Changing an input hides the stale run until it is re-run.
    fireEvent.change(screen.getByRole('slider', { name: 'Inflation' }), { target: { value: '3' } })
    expect(screen.queryByTestId('success-card')).not.toBeInTheDocument()
    expect(screen.getByText(/draws 2,000 random return sequences/i)).toBeInTheDocument()
  })

  it('derives assumptions from a saved portfolio', async () => {
    const user = userEvent.setup()
    const growth = makePortfolio('Growth', [
      { symbol: 'AAPL', value: 1 },
      { symbol: 'BTC-USD', value: 1 },
    ])
    usePortfolioStore.getState().upsert(growth)
    renderWithProviders(<AppRoutes />, { route: '/retirement' })
    await screen.findByRole('heading', { level: 1, name: 'Retirement' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Assumptions source' }), growth.id)
    expect(screen.getByRole('slider', { name: 'Expected annual return' })).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Inflation' })).toBeEnabled()
    expect(screen.getByTestId('derived-assumptions')).toHaveTextContent(/run monte carlo to derive/i)

    await user.click(screen.getByRole('button', { name: /run monte carlo/i }))
    const card = await screen.findByTestId('success-card')
    expect(within(card).getByText(/from AAPL, BTC-USD/)).toBeInTheDocument()
    expect(within(card).getByText(/7\.0% \/ 18%/)).toBeInTheDocument()
    expect(screen.getByTestId('derived-assumptions')).toHaveTextContent(/From AAPL, BTC-USD: 7\.0% expected return, 18% volatility/)
    expect(useRetirementStore.getState().source).toEqual({ kind: 'portfolio', portfolioId: growth.id })
  })

  it('shows API errors', async () => {
    const user = userEvent.setup()
    server.use(http.post(`${API_URL}/retirement/project`, () => HttpResponse.json({ detail: 'Rate limit exceeded' }, { status: 429 })))
    renderWithProviders(<AppRoutes />, { route: '/retirement' })
    await screen.findByRole('heading', { level: 1, name: 'Retirement' })
    await user.click(screen.getByRole('button', { name: /run monte carlo/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many projections/i)
  })
})
