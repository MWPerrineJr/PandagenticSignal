import { seedPortfolio, seedUser, signInAs, state, supabase } from '@/test/supabase-mock'
import { makePortfolio } from './portfolio'
import { deletePortfolio, listPortfolios, savePortfolio } from './portfolio-repo'
import type { SupabaseClient } from '@supabase/supabase-js'

const client = supabase as unknown as SupabaseClient

describe('portfolio repo', () => {
  it('lists, saves (upsert) and deletes rows', async () => {
    const { id } = seedUser('a@example.com')
    signInAs('a@example.com')
    seedPortfolio(id, { id: 'P1', name: 'Old', holdings: [{ symbol: 'aapl', weight: 1 }], updated_at: '2026-01-01' })
    seedPortfolio('someone-else', { id: 'P9', name: 'Theirs', holdings: [] })

    const listed = await listPortfolios(client, id)
    expect(listed).toEqual([{ id: 'P1', name: 'Old', mode: 'weight', holdings: [{ symbol: 'AAPL', value: 1 }], updatedAt: '2026-01-01' }])

    const saved = await savePortfolio(client, id, makePortfolio('New', [{ symbol: 'BTC-USD', value: 300 }], 'amount'))
    expect(saved.mode).toBe('amount')
    expect(saved.holdings).toEqual([{ symbol: 'BTC-USD', value: 300 }])
    expect(state.tables.portfolios!.find((r) => r.id === saved.id)).toMatchObject({
      user_id: id,
      holdings: [{ symbol: 'BTC-USD', amount: 300 }],
    })

    const renamed = await savePortfolio(client, id, { ...saved, name: 'Renamed' })
    expect(renamed.id).toBe(saved.id)
    expect((await listPortfolios(client, id)).map((p) => p.name).sort()).toEqual(['Old', 'Renamed'])

    await deletePortfolio(client, 'P1')
    expect((await listPortfolios(client, id)).map((p) => p.id)).toEqual([saved.id])
  })

  it('tolerates unreadable stored holdings', async () => {
    const { id } = seedUser('a@example.com')
    signInAs('a@example.com')
    seedPortfolio(id, { id: 'P2', name: 'Broken', holdings: { nope: true } })
    const [p] = await listPortfolios(client, id)
    expect(p?.holdings).toEqual([])
  })
})
