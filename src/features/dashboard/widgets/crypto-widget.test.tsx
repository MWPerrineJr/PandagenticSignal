import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { API_URL } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'
import { parseWidgetConfig } from '@/lib/dashboard-layout'
import { CryptoWidget, CryptoWidgetSettings } from './crypto-widget'

function UrlProbe() {
  const { search } = useLocation()
  return <output data-testid="url">{search}</output>
}

describe('CryptoWidget', () => {
  it('renders the configured number of coins and selects one on click', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <>
        <CryptoWidget config={{ limit: 2 }} activeTicker={null} editing={false} />
        <UrlProbe />
      </>,
    )
    const btc = await screen.findByTestId('crypto-row-BTC-USD')
    expect(within(btc).getByText('$65,000.00')).toBeInTheDocument()
    expect(within(btc).getByText('+1.50%')).toHaveClass('text-emerald-500')
    expect(screen.getByTestId('crypto-row-ETH-USD')).toBeInTheDocument()
    expect(screen.queryByTestId('crypto-row-DOGE-USD')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /crypto tab/i })).toHaveAttribute('href', '/crypto')

    await user.click(within(btc).getByRole('button'))
    expect(screen.getByTestId('url')).toHaveTextContent('?t=BTC-USD')
  })

  it('defaults to five coins and clamps the settings input', async () => {
    const user = userEvent.setup()
    expect(parseWidgetConfig('crypto', {})).toEqual({ limit: 5 })
    expect(parseWidgetConfig('crypto', { limit: 99 })).toEqual({ limit: 5 })
    const onChange = vi.fn()
    renderWithProviders(<CryptoWidgetSettings config={{ limit: 5 }} onChange={onChange} />)
    const input = screen.getByRole('spinbutton', { name: 'Coins to show' })
    await user.clear(input)
    await user.type(input, '50')
    expect(onChange).toHaveBeenLastCalledWith({ limit: 20 })
  })

  it('shows the API error', async () => {
    server.use(http.get(`${API_URL}/crypto/top`, () => HttpResponse.json({ detail: 'Yahoo Finance error: boom' }, { status: 502 })))
    renderWithProviders(<CryptoWidget config={{ limit: 5 }} activeTicker={null} editing={false} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/yahoo finance error/i)
  })
})
