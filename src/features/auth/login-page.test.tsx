import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { disclosureRowFor, seedSymbols, seedUser, signInAs, state, symbolsFor } from '@/test/supabase-mock'
import { AppRoutes } from '@/app/routes'
import { useTickerStore } from '@/stores/tickers'

vi.mock('lightweight-charts', () => import('@/test/chart-mock'))

beforeEach(() => {
  useTickerStore.getState().clear()
  localStorage.clear()
})

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, email: string, password: string, button: RegExp) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: button }))
}

describe('auth flow', () => {
  it('header offers Sign in when signed out and the login page signs in and redirects back', async () => {
    const user = userEvent.setup()
    seedUser('a@example.com', 'password123')
    renderWithProviders(<AppRoutes />, { route: '/watchlist' })
    await user.click(await screen.findByRole('link', { name: /sign in/i }))
    expect(await screen.findByRole('form', { name: 'Sign in' })).toBeInTheDocument()
    await fillAndSubmit(user, 'a@example.com', 'password123', /^sign in$/i)
    expect(await screen.findByRole('heading', { level: 1, name: /^Watchlist/ })).toBeInTheDocument()
    expect(screen.getByText('a@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('shows the error for a wrong password', async () => {
    const user = userEvent.setup()
    seedUser('a@example.com', 'password123')
    renderWithProviders(<AppRoutes />, { route: '/login' })
    await fillAndSubmit(user, 'a@example.com', 'wrongwrong', /^sign in$/i)
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid login credentials/i)
  })

  it('creates an account after the disclosure is confirmed and records the acceptance', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/login' })
    await user.click(screen.getByRole('button', { name: /create one/i }))
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()
    await user.click(screen.getByLabelText(/i have read and accept the disclaimer/i))
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('new@example.com')).toBeInTheDocument()
    const id = state.users.get('new@example.com')!.id
    await waitFor(() => expect(disclosureRowFor(id)?.disclosure_accepted_at).toBeTruthy())
  })

  it('asks a signed-in account that never accepted to confirm before the dashboard opens', async () => {
    const user = userEvent.setup()
    const { id } = seedUser('g@example.com', 'password123', { disclosureAccepted: false })
    signInAs('g@example.com')
    renderWithProviders(<AppRoutes />, { route: '/dashboard' })
    expect(await screen.findByRole('heading', { name: /confirm the disclosure/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /i have read and accept the disclaimer/i }))
    await waitFor(() => expect(disclosureRowFor(id)?.disclosure_accepted_at).toBeTruthy())
  })

  it('starts Google sign-in with the page the visitor came from', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/login' })
    await user.click(screen.getByRole('button', { name: /continue with google/i }))
    await waitFor(() => expect(state.lastOAuth?.provider).toBe('google'))
    expect(state.lastOAuth?.options?.redirectTo).toBe(`${window.location.origin}/dashboard`)
  })

  it('sends a magic link', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppRoutes />, { route: '/login' })
    await user.type(screen.getByLabelText('Email'), 'a@example.com')
    await user.click(screen.getByRole('button', { name: /magic link/i }))
    expect(await screen.findByRole('status')).toHaveTextContent(/magic link sent to a@example.com/i)
  })

  it('signed-in watchlist page shows the cloud list and sign-out returns to local', async () => {
    const user = userEvent.setup()
    const { id } = seedUser('a@example.com')
    seedSymbols(id, ['MSFT'])
    signInAs('a@example.com')
    useTickerStore.getState().add('AAPL')
    renderWithProviders(<AppRoutes />, { route: '/watchlist' })
    expect(await screen.findByTestId('row-MSFT')).toBeInTheDocument()
    expect(screen.queryByTestId('row-AAPL')).not.toBeInTheDocument()
    expect(screen.getByText(/synced to your account/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove MSFT' }))
    await waitFor(() => expect(symbolsFor(id)).toEqual([]))

    await user.click(screen.getByRole('button', { name: /sign out/i }))
    expect(await screen.findByTestId('row-AAPL')).toBeInTheDocument()
    expect(screen.getByText(/saved in this browser/i)).toBeInTheDocument()
  })

  it('redirects an already signed-in visitor away from /login', async () => {
    seedUser('a@example.com')
    signInAs('a@example.com')
    renderWithProviders(<AppRoutes />, { route: '/login' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })
})
