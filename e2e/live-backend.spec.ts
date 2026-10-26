import { test, expect } from '@playwright/test'
import type { PredictionJob, PredictionOutput, VolumeEstimate } from '../src/types'

const apiBaseUrl = process.env.SIVERA_API_BASE_URL
const apiKey = process.env.SIVERA_API_KEY
const cameraId = process.env.SIVERA_CAMERA_ID
const resultJobId = process.env.SIVERA_RESULT_JOB_ID

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

test('live saved result shows method values and its historical configuration', async ({ page, request }) => {
  test.skip(!apiBaseUrl || !apiKey || !cameraId || !resultJobId,
    'Set SIVERA_API_BASE_URL, SIVERA_API_KEY, SIVERA_CAMERA_ID, and SIVERA_RESULT_JOB_ID for an existing completed job with saved volume')
  const origin = new URL(apiBaseUrl!).origin
  const path = `${origin}/api/v1/cameras/${encodeURIComponent(cameraId!)}/predict/${encodeURIComponent(resultJobId!)}`
  const options = { headers: { 'X-API-Key': apiKey! }, maxRedirects: 0 }
  const [jobResponse, volumeResponse, outputResponse] = await Promise.all([
    request.get(path, options), request.get(`${path}/volumes`, options), request.get(`${path}/outputs`, options),
  ])
  for (const response of [jobResponse, volumeResponse, outputResponse]) expect(response.status()).toBe(200)
  const job = await jobResponse.json() as PredictionJob
  const volumes = await volumeResponse.json() as VolumeEstimate[]
  const { outputs } = await outputResponse.json() as { outputs: PredictionOutput[] }
  expect(job).toMatchObject({ id: resultJobId, camera_id: cameraId, status: 'done' })
  expect(volumes.length).toBeGreaterThan(0)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(({ origin, key }) => {
    localStorage.setItem('api_base_url', origin)
    localStorage.setItem('api_key', key)
  }, { origin, key: apiKey! })
  await page.goto(`/dashboard/predictions?camera=${encodeURIComponent(cameraId!)}&job=${encodeURIComponent(resultJobId!)}`)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Estimasi volume', exact: true })).toBeVisible()
  await expect(dialog).not.toContainText('hasil volume belum lengkap')
  for (const volume of volumes) {
    const name = volume.method === 'grid' ? 'Grid/Voxel' : volume.method === 'convex_hull' ? 'Convex Hull 2D' : volume.method
    const method = dialog.getByRole('region', { name: 'Estimasi volume' }).locator(':scope > div').filter({ has: page.getByRole('heading', { name, exact: true }) })
    for (const [label, amount, digits] of [['Volume (m³)', volume.volume_m3, 3], ['Volume (L)', volume.volume_liter, 0]] as const) {
      expect(Number.isFinite(amount) && amount >= 0).toBe(true)
      const threshold = 10 ** -digits
      const displayed = new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount > 0 && amount < threshold ? threshold : amount)
      const expected = amount > 0 && amount < threshold ? `< ${displayed}` : displayed
      await expect(method.locator('dl > div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd')).toHaveText(expected)
    }
  }
  await dialog.locator('summary').filter({ hasText: 'Konfigurasi job tersimpan' }).click()
  for (const id of [job.calibration_id, job.ground_model_id, job.depth_scale_id]) await expect(dialog).toContainText(id)
  const images = dialog.locator('img')
  await expect(images).toHaveCount(outputs.filter(output => output.mime_type?.startsWith('image/')).length)
  for (const image of await images.all()) {
    await expect(image).toHaveAttribute('src', /^blob:/)
    await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect(errors).toEqual([])
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
