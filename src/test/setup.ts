import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from './server'
import { resetSupabaseMock } from './supabase-mock'

// Every test talks to the in-memory Supabase stand-in, signed out unless a test signs in.
vi.mock('@/lib/supabase', () => import('./supabase-mock'))

// jsdom lacks these browser APIs that cmdk relies on.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
Element.prototype.scrollIntoView ??= vi.fn()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetSupabaseMock()
})
afterAll(() => server.close())
