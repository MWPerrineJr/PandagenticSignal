import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { ENDPOINTS, FAQ_SECTIONS } from '@/content/faq'
import { AppRoutes } from '@/app/routes'

describe('FaqPage', () => {
  it('renders every section, its questions, and a table of contents with anchors', async () => {
    renderWithProviders(<AppRoutes />, { route: '/faq' })
    expect(await screen.findByRole('heading', { level: 1, name: 'FAQ' })).toBeInTheDocument()
    const toc = screen.getByRole('navigation', { name: 'FAQ sections' })
    for (const section of FAQ_SECTIONS) {
      expect(within(toc).getByRole('link', { name: section.title })).toHaveAttribute('href', `#${section.id}`)
      expect(screen.getByRole('heading', { level: 2, name: section.title })).toBeInTheDocument()
      for (const entry of section.entries) expect(screen.getByRole('heading', { level: 3, name: entry.q })).toBeInTheDocument()
    }
  })

  it('lists every API endpoint from the generated table with cache and limit notes', async () => {
    renderWithProviders(<AppRoutes />, { route: '/faq' })
    const table = await screen.findByRole('table', { name: 'API endpoints' })
    expect(within(table).getAllByRole('row')).toHaveLength(ENDPOINTS.length + 1)
    const sentiment = within(table).getByTestId('endpoint-/sentiment/{ticker}')
    expect(sentiment).toHaveTextContent('GET')
    expect(sentiment).toHaveTextContent('headlines 15 minutes · sentiment report 1 hour')
    expect(sentiment).toHaveTextContent('10/minute')
    expect(within(table).getByTestId('endpoint-/health')).toHaveTextContent('—')
    expect(ENDPOINTS.some((e) => e.path === '/indicators/catalog')).toBe(true)
  })

  it('shows the indicator catalog from the API and links to the disclaimer', async () => {
    renderWithProviders(<AppRoutes />, { route: '/faq' })
    const catalog = await screen.findByRole('table', { name: 'Indicator definitions' })
    expect(within(catalog).getAllByRole('row')).toHaveLength(21)
    const rsiRow = within(catalog).getByText('RSI', { selector: 'div' }).closest('tr')!
    expect(within(rsiRow).getByText('period 14')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /read the full disclaimer/i })).toHaveAttribute('href', '/disclaimer')
  })

  it('states the delays with numbers taken from the API settings', async () => {
    renderWithProviders(<AppRoutes />, { route: '/faq' })
    await screen.findByRole('heading', { level: 1, name: 'FAQ' })
    expect(screen.getByText(/caches each quote for 1 minute/)).toBeInTheDocument()
    expect(screen.getByText(/refreshed every 5 minutes/)).toBeInTheDocument()
    expect(screen.getByText(/cache them for 1 hour/)).toBeInTheDocument()
  })

  it('is reachable from the nav', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/' })
    const nav = await screen.findByRole('navigation', { name: 'Primary' })
    await user.click(within(nav).getByRole('link', { name: 'FAQ' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'FAQ' })).toBeInTheDocument()
  })
})
