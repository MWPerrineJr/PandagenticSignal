import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { usePortfolioStore } from '@/stores/portfolios'
import { makePortfolio } from '@/lib/portfolio'
import { PortfolioWidget, PortfolioWidgetSettings } from './portfolio-widget'

beforeEach(() => {
  localStorage.clear()
  usePortfolioStore.getState().reset()
})

describe('PortfolioWidget', () => {
  it('links to the tab when the active portfolio is empty', async () => {
    renderWithProviders(<PortfolioWidget config={{ portfolioId: null }} activeTicker={null} editing={false} />)
    expect(await screen.findByText(/has no holdings yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open the portfolio tab/i })).toHaveAttribute('href', '/portfolio')
  })

  it('shows holdings by weight and the return/vol/Sharpe of the chosen portfolio', async () => {
    const store = usePortfolioStore.getState()
    const growth = makePortfolio('Growth', [
      { symbol: 'AAPL', value: 1 },
      { symbol: 'BTC-USD', value: 3 },
    ])
    store.upsert(growth)
    renderWithProviders(<PortfolioWidget config={{ portfolioId: growth.id }} activeTicker={null} editing={false} />)
    expect(await screen.findByText('Growth')).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]!).getByText('BTC-USD')).toBeInTheDocument() // largest first
    expect(within(rows[0]!).getByText('75%')).toBeInTheDocument()
    const stats = screen.getByTestId('portfolio-widget-stats')
    // AAPL 8% + BTC 10% at 25/75 -> 9.5%
    expect(await within(stats).findByText('9.5%')).toBeInTheDocument()
    expect(within(stats).getByText('Sharpe')).toBeInTheDocument()
  })

  it('settings list the portfolios and default to the active one', async () => {
    const user = userEvent.setup()
    const store = usePortfolioStore.getState()
    const other = makePortfolio('Other', [{ symbol: 'MSFT', value: 1 }])
    store.upsert(other)
    const onChange = vi.fn()
    renderWithProviders(<PortfolioWidgetSettings config={{ portfolioId: null }} onChange={onChange} />)
    const select = screen.getByRole('combobox', { name: 'Portfolio to show' })
    expect(select).toHaveDisplayValue('Active portfolio')
    await user.selectOptions(select, other.id)
    expect(onChange).toHaveBeenCalledWith({ portfolioId: other.id })
  })
})
