import { test, expect } from '@playwright/test'

const apiBaseUrl = process.env.SIVERA_API_BASE_URL
const apiKey = process.env.SIVERA_API_KEY
const cameraId = process.env.SIVERA_CAMERA_ID

test('live backend publishes the depth-scale readiness contract', async ({ request }) => {
  test.skip(!apiBaseUrl, 'Set SIVERA_API_BASE_URL to inspect the live public contract')
  const response = await request.get(`${new URL(apiBaseUrl!).origin}/openapi.json`, {
    maxRedirects: 0,
  })
  expect(response.status()).toBe(200)
  const contract: unknown = await response.json()
  expect(contract).toMatchObject({
    paths: {
      '/api/v1/cameras/{camera_id}/calibrations/active': { get: expect.any(Object) },
      '/api/v1/cameras/{camera_id}/ground-references/active': { get: expect.any(Object) },
      '/api/v1/cameras/{camera_id}/ground-models/active': { get: expect.any(Object) },
      '/api/v1/cameras/{camera_id}/ground-models/{ground_model_id}/depth-scales/active': {
        get: {
          responses: {
            '200': {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DepthScaleResponse' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        DepthScaleResponse: {
          required: expect.arrayContaining(['id', 'camera_id', 'ground_model_id', 'depth_model', 'is_active']),
        },
      },
    },
  })
})

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

test('live configured camera passes the frontend readiness check without inference', async ({ page }) => {
  test.skip(!apiBaseUrl || !apiKey || !cameraId,
    'Set SIVERA_API_BASE_URL, SIVERA_API_KEY, and SIVERA_CAMERA_ID for a compatible configured camera')
  await page.addInitScript(({ origin, key }) => {
    localStorage.setItem('api_base_url', origin)
    localStorage.setItem('api_key', key)
  }, { origin: new URL(apiBaseUrl!).origin, key: apiKey! })
  await page.goto(`/dashboard/predictions?camera=${encodeURIComponent(cameraId!)}`)
  await expect(page.getByLabel('Pilih Kamera', { exact: true })).toHaveValue(cameraId!)
  await expect(page.getByText('Model cocok dengan kalibrasi dan referensi tanah aktif.')).toBeVisible()
  await expect(page.getByText('Skala aktif tersedia untuk model ground ini.')).toBeVisible()
  await expect(page.getByText('Konfigurasi belum siap untuk prediksi')).not.toBeVisible()
  await page.getByRole('button', { name: 'Jalankan Prediksi Baru', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Jalankan Prediksi', exact: true })).toBeDisabled()
  await expect(dialog.getByText('Pilih gambar untuk diunggah.')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})
