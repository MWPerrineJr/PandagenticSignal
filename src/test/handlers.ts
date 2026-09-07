import { http, HttpResponse } from 'msw'

export const API_URL = 'http://localhost:8000'

/** Default MSW handlers shared by all tests. Override per test with server.use(...). */
export const handlers = [
  http.get(`${API_URL}/health`, () => HttpResponse.json({ status: 'ok' })),
]
