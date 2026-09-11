import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { DISCLAIMER_SECTIONS, DISCLAIMER_SHORT } from '@/content/disclaimer'
import { AppRoutes } from '@/app/routes'
import { ACK_KEY } from './acknowledgement-bar'

beforeEach(() => localStorage.clear())

describe('DisclaimerPage', () => {
  it('renders every section of the disclosure', async () => {
    renderWithProviders(<AppRoutes />, { route: '/disclaimer' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Disclaimer' })).toBeInTheDocument()
    for (const s of DISCLAIMER_SECTIONS) expect(screen.getByRole('heading', { level: 2, name: s.title })).toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(within(main).getByText(/constitutes investment, financial, legal, tax or accounting advice/)).toBeInTheDocument()
    expect(within(main).getByRole('heading', { level: 2, name: /invest at your own risk/i })).toBeInTheDocument()
  })
})

describe('footer and acknowledgement bar', () => {
  it('every page carries the short disclosure and links to the disclaimer and FAQ', async () => {
    renderWithProviders(<AppRoutes />, { route: '/watchlist' })
    const footer = await screen.findByRole('contentinfo')
    expect(footer).toHaveTextContent(DISCLAIMER_SHORT)
    expect(within(footer).getByRole('link', { name: 'Disclaimer' })).toHaveAttribute('href', '/disclaimer')
    expect(within(footer).getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq')
  })

  it('shows the acknowledgement bar once and remembers "I understand"', async () => {
    const user = userEvent.setup()
    const { unmount } = renderWithProviders(<AppRoutes />, { route: '/' })
    const bar = await screen.findByRole('region', { name: 'Disclaimer notice' })
    expect(within(bar).getByRole('link', { name: /read the disclaimer/i })).toHaveAttribute('href', '/disclaimer')
    await user.click(within(bar).getByRole('button', { name: 'I understand' }))
    expect(screen.queryByRole('region', { name: 'Disclaimer notice' })).not.toBeInTheDocument()
    expect(localStorage.getItem(ACK_KEY)).toBe('1')

    unmount()
    renderWithProviders(<AppRoutes />, { route: '/charts' })
    await screen.findByRole('contentinfo')
    expect(screen.queryByRole('region', { name: 'Disclaimer notice' })).not.toBeInTheDocument()
  })

  it('the sentiment disclaimer links to the disclosure', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/sentiment?t=AAPL' })
    await user.click(await screen.findByRole('button', { name: /analyse news sentiment/i }))
    const footer = await screen.findByTestId('sentiment-footer')
    expect(within(footer).getByRole('link', { name: /not investment advice/i })).toHaveAttribute('href', '/disclaimer')
  })
})
