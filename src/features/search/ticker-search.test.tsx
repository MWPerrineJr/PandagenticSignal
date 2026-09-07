import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { API_URL } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'
import { TickerSearch } from './ticker-search'

function setup(props: Partial<React.ComponentProps<typeof TickerSearch>> = {}) {
  const onSelect = vi.fn()
  const user = userEvent.setup()
  renderWithProviders(<TickerSearch onSelect={onSelect} {...props} />)
  return { onSelect, user, input: screen.getByRole('combobox', { name: /search symbol or company/i }) }
}

describe('TickerSearch', () => {
  it('finds AAPL when typing a company name and selects it on click', async () => {
    const { user, input, onSelect } = setup()
    await user.type(input, 'apple')
    const option = await screen.findByRole('option', { name: /AAPL/ })
    expect(option).toHaveTextContent('Apple Inc.')
    expect(option).toHaveTextContent('NASDAQ')
    await user.click(option)
    expect(onSelect).toHaveBeenCalledWith('AAPL', expect.objectContaining({ symbol: 'AAPL' }))
    expect(input).toHaveValue('')
  })

  it('finds Microsoft when typing a symbol and selects with the keyboard', async () => {
    const { user, input, onSelect } = setup()
    await user.type(input, 'MSFT')
    await screen.findByRole('option', { name: /Microsoft Corporation/ })
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('MSFT', expect.objectContaining({ name: 'Microsoft Corporation' }))
  })

  it('highlights the first result of a new query so Enter selects it after a previous search', async () => {
    const { user, input, onSelect } = setup()
    await user.type(input, 'apple')
    await screen.findByRole('option', { name: /AAPL/ })
    await user.clear(input)
    await user.type(input, 'msft')
    const option = await screen.findByRole('option', { name: /Microsoft/ })
    await waitFor(() => expect(option).toHaveAttribute('aria-selected', 'true'))
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('MSFT', expect.objectContaining({ symbol: 'MSFT' }))
  })

  it('arrow keys move the highlight before Enter', async () => {
    const { user, input, onSelect } = setup()
    await user.type(input, 'apple')
    await screen.findByRole('option', { name: /APC\.DE/ })
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledWith('APC.DE', expect.objectContaining({ symbol: 'APC.DE' }))
  })

  it('shows an empty state and lets Enter use the raw text as a symbol', async () => {
    const { user, input, onSelect } = setup()
    await user.type(input, 'zzzz')
    expect(await screen.findByText(/no matches for “zzzz”/i)).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('ZZZZ', undefined)
  })

  it('shows an error state when the API fails', async () => {
    server.use(http.get(`${API_URL}/search`, () => HttpResponse.json({ detail: 'Yahoo Finance error: boom' }, { status: 502 })))
    const { user, input } = setup()
    await user.type(input, 'apple')
    expect(await screen.findByRole('alert')).toHaveTextContent(/yahoo finance error/i)
  })

  it('debounces requests while typing', async () => {
    let hits = 0
    server.use(
      http.get(`${API_URL}/search`, () => {
        hits += 1
        return HttpResponse.json([])
      }),
    )
    const { user, input } = setup()
    await user.type(input, 'apple')
    await waitFor(() => expect(hits).toBeGreaterThan(0))
    expect(hits).toBe(1)
  })

  it('shows the current ticker in the placeholder and closes on Escape', async () => {
    const { user, input } = setup({ value: 'AAPL' })
    expect(input).toHaveAttribute('placeholder', expect.stringContaining('AAPL'))
    await user.type(input, 'apple')
    await screen.findByRole('option', { name: /AAPL/ })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })
})
