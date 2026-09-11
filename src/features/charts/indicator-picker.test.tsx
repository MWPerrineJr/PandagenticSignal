import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProviders } from '@/app/providers'
import { render } from '@testing-library/react'
import { indicatorCatalogFixture as catalog } from '@/test/fixtures'
import { DEFAULT_TOKENS } from '@/lib/indicators'
import { IndicatorPicker } from './indicator-picker'

function renderPicker(tokens: string[], props: Partial<React.ComponentProps<typeof IndicatorPicker>> = {}) {
  const onChange = vi.fn()
  const utils = render(
    <AppProviders>
      <IndicatorPicker catalog={catalog} tokens={tokens} onChange={onChange} {...props} />
    </AppProviders>,
  )
  return { onChange, ...utils }
}

describe('IndicatorPicker', () => {
  it('opens on click, lists active indicators with parameters, and closes on Escape', async () => {
    const user = userEvent.setup()
    renderPicker([...DEFAULT_TOKENS])
    expect(screen.getByTestId('indicator-count')).toHaveTextContent('6')
    await user.click(screen.getByRole('button', { name: /indicators/i }))
    const dialog = screen.getByRole('dialog', { name: 'Indicators' })
    const list = within(dialog).getByRole('list', { name: 'Active indicators' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    expect(within(list).getByRole('spinbutton', { name: 'BB 20/2 window' })).toHaveValue(20)
    expect(within(list).getByRole('spinbutton', { name: 'BB 20/2 k' })).toHaveValue(2)
    expect(within(list).queryByRole('spinbutton', { name: /S\/R/ })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('adds from the grouped select, removes, and edits a parameter on blur', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker(['ema:10'], { inline: true })
    const select = screen.getByRole('combobox', { name: 'Add indicator' })
    const groups = within(select).getAllByRole('group')
    expect(groups.map((g) => g.getAttribute('label'))).toEqual(['Overlays (on the price chart)', 'Oscillators (own pane)'])
    expect(within(select).getByRole('option', { name: 'Exponential moving average (added)' })).toBeInTheDocument()

    await user.selectOptions(select, 'rsi')
    expect(onChange).toHaveBeenLastCalledWith(['ema:10', 'rsi:14'])

    await user.click(screen.getByRole('button', { name: 'Remove EMA 10' }))
    expect(onChange).toHaveBeenLastCalledWith([])

    const span = screen.getByRole('spinbutton', { name: 'EMA 10 span' })
    await user.clear(span)
    await user.type(span, '21')
    await user.tab()
    expect(onChange).toHaveBeenLastCalledWith(['ema:21'])
  })

  it('ignores out-of-range parameters and duplicate tokens', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker(['rsi:14', 'rsi:21'], { inline: true })
    const period = screen.getByRole('spinbutton', { name: 'RSI 14 period' })
    await user.clear(period)
    await user.type(period, '999')
    await user.tab()
    expect(onChange).not.toHaveBeenCalled()
    await user.clear(period)
    await user.type(period, '21') // would collide with the second RSI
    await user.tab()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables adding at the limit and offers a reset', async () => {
    const user = userEvent.setup()
    const onReset = vi.fn()
    const eight = Array.from({ length: 8 }, (_, i) => `sma:${i + 2}`)
    renderPicker(eight, { inline: true, onReset })
    const select = screen.getByRole('combobox', { name: 'Add indicator' })
    expect(select).toBeDisabled()
    expect(within(select).getByRole('option', { name: /limit of 8/i })).toBeInTheDocument()
    expect(screen.getByText('8/8')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /reset to defaults/i }))
    expect(onReset).toHaveBeenCalled()
  })

  it('shows a loading option until the catalog arrives', () => {
    renderPicker(['ema:10'], { inline: true, catalog: undefined })
    expect(screen.getByRole('combobox', { name: 'Add indicator' })).toBeDisabled()
    expect(screen.getByRole('option', { name: /loading indicators/i })).toBeInTheDocument()
  })
})
