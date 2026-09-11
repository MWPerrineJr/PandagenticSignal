import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { makePortfolioStats, makeSimulation } from '@/test/fixtures'
import { FanChart } from './fan-chart'

const sim = makeSimulation(makePortfolioStats(['AAPL', 'BTC-USD'], [0.6, 0.4]), {
  horizon_years: 10,
  n_sims: 2000,
  initial_value: 10_000,
  monthly_contribution: 100,
})

describe('FanChart', () => {
  it('draws two bands, a median line and axis ticks, with a table alternative', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FanChart sim={sim} />)
    const figure = screen.getByRole('figure', { name: /simulated wealth over 10 years/i })
    const svg = within(figure).getByRole('img', { name: /median and 5th to 95th/i })
    expect(svg.querySelector('polygon[data-band="p5-p95"]')).toBeInTheDocument()
    expect(svg.querySelector('polygon[data-band="p25-p75"]')).toBeInTheDocument()
    const median = svg.querySelector('path[data-series="median"]')!
    expect(median.getAttribute('d')).toMatch(/^M[\d.]+,[\d.]+( L[\d.]+,[\d.]+){10}$/)
    expect(within(figure).getByText('0y')).toBeInTheDocument()
    expect(within(figure).getByText('10y')).toBeInTheDocument()
    expect(within(figure).getByText('2,000 paths', { exact: false })).toBeInTheDocument()

    await user.click(within(figure).getByText('Table view'))
    const rows = within(figure).getAllByRole('row')
    expect(rows.length).toBeGreaterThan(5)
    expect(within(rows[1]!).getAllByText('$10,000.00')).toHaveLength(5) // every band starts at the initial value
  })

  it('handles a one-year horizon and a sparse series', () => {
    const short = makeSimulation(sim.stats, { horizon_years: 1, n_sims: 100, initial_value: 500, monthly_contribution: 0 })
    renderWithProviders(<FanChart sim={short} title="Retirement balance" />)
    expect(screen.getByRole('figure', { name: /retirement balance over 1 year/i })).toBeInTheDocument()
    expect(screen.getByText('1y')).toBeInTheDocument()
  })
})
