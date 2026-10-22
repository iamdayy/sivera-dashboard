import { test, expect } from '@playwright/test'

const apiBaseUrl = process.env.SIVERA_API_BASE_URL
const apiKey = process.env.SIVERA_API_KEY

test('live backend accepts the configured key for camera:read', async ({ request }) => {
  test.skip(!apiBaseUrl || !apiKey, 'Set SIVERA_API_BASE_URL and SIVERA_API_KEY to run live verification')
  const origin = new URL(apiBaseUrl!)
  expect(['http:', 'https:']).toContain(origin.protocol)
  expect(origin.pathname).toBe('/')
  expect(origin.username + origin.password + origin.search + origin.hash).toBe('')
  const response = await request.get(`${origin.origin}/api/v1/cameras?page=1&page_size=1`, {
    headers: { 'X-API-Key': apiKey! },
    maxRedirects: 0,
  })
  expect(response.status()).toBe(200)
  const data: unknown = await response.json()
  expect(data).toMatchObject({ items: expect.any(Array), total: expect.any(Number) })
})
