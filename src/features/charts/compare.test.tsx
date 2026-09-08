import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { charts, resetCharts } from '@/test/chart-mock'
import { renderWithProviders } from '@/test/render'
import { AppRoutes } from '@/app/routes'
import { useTickerStore } from '@/stores/tickers'

vi.mock('lightweight-charts', () => import('@/test/chart-mock'))

beforeEach(() => {
  resetCharts()
  useTickerStore.getState().clear()
  localStorage.clear()
})

describe('compare mode', () => {
  it('renders one line per symbol with a legend and hides overlays', async () => {
    renderWithProviders(<AppRoutes />, { route: '/charts?t=AAPL&cmp=MSFT' })
    await screen.findByTestId('compare-chart')
    await waitFor(() => expect(charts.at(-1)!.live('Line')).toHaveLength(2))
    const legend = screen.getByTestId('compare-legend')
    expect(legend).toHaveTextContent('AAPL')
    expect(legend).toHaveTextContent('MSFT')
    expect(screen.getByRole('button', { name: /EMA 10/ })).toBeDisabled()
    expect(screen.queryByTestId('price-chart')).not.toBeInTheDocument()
  })

  it('chips toggle tracked symbols in and out of the comparison', async () => {
    const user = userEvent.setup()
    useTickerStore.getState().add('MSFT')
    renderWithProviders(<AppRoutes />, { route: '/charts?t=AAPL' })
    await screen.findByTestId('price-chart')
    const chip = screen.getByRole('button', { name: 'MSFT' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    await user.click(chip)
    await screen.findByTestId('compare-chart')
    expect(screen.getByRole('button', { name: 'MSFT' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /clear/i }))
    await screen.findByTestId('price-chart')
  })

  it('reports a symbol whose history failed without dropping the others', async () => {
    renderWithProviders(<AppRoutes />, { route: '/charts?t=AAPL&cmp=NOPE' })
    await screen.findByTestId('compare-chart')
    expect(await screen.findByRole('alert')).toHaveTextContent(/no price history for NOPE/i)
    await waitFor(() => expect(charts.at(-1)!.live('Line')).toHaveLength(1))
  })
})
