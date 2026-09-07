import { QueryClient } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AppProviders } from '@/app/providers'

export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0, staleTime: 0 },
    },
  })
}

interface Options extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL, e.g. `/charts?t=AAPL`. */
  route?: string
  queryClient?: QueryClient
}

export function renderWithProviders(ui: ReactNode, { route = '/', queryClient, ...options }: Options = {}) {
  const client = queryClient ?? makeTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders queryClient={client}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </AppProviders>
  )
  return { queryClient: client, ...render(ui, { wrapper, ...options }) }
}
