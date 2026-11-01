import { test, expect } from '@playwright/test'

const apiBaseUrl = process.env.SIVERA_API_BASE_URL
const cameraId = process.env.SIVERA_CAMERA_ID

interface SignalingResponse {
  method: string
  status: number
  contentType: string | null
  acceptPost: string | null
  trustedLocation: boolean
  readableEtag: boolean
}

test('live public WHEP decodes video, exposes signaling headers, and deletes on navigation', async ({ page }) => {
  test.skip(!apiBaseUrl || !cameraId, 'Set SIVERA_API_BASE_URL and SIVERA_CAMERA_ID for a live public camera; VITE_API_BASE_URL must use that backend')
  test.setTimeout(60_000)
  const origin = new URL(apiBaseUrl!).origin
  const path = `/api/v1/public/cameras/${cameraId}/stream/whep`
  const signaling: SignalingResponse[] = []
  const authenticatedRequests: string[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (request.url().startsWith(`${origin}${path}`) && request.headers()['x-api-key']) authenticatedRequests.push(request.method())
  })
  await page.exposeFunction('recordPublicWhep', (response: SignalingResponse) => { signaling.push(response) })
  await page.addInitScript(({ origin, path }) => {
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      if (response.url.startsWith(`${origin}${path}`)) {
        const location = response.headers.get('Location')
        const target = location ? new URL(location, response.url) : null
        const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
        await (window as unknown as { recordPublicWhep: (data: SignalingResponse) => Promise<void> }).recordPublicWhep({
          method: args[1]?.method ?? 'GET', status: response.status,
          contentType: response.headers.get('Content-Type'), acceptPost: response.headers.get('Accept-Post'),
          trustedLocation: !!target && target.origin === origin && target.pathname.startsWith(`${path}/`) && uuid.test(target.pathname.slice(path.length + 1)) && !target.search && !target.hash,
          readableEtag: response.headers.get('ETag') !== null,
        })
      }
      return response
    }
  }, { origin, path })

  let disposed = false
  try {
    await page.goto(`/public/cameras/${cameraId}`)
    const video = page.locator('video')
    await expect(video).toBeVisible({ timeout: 15_000 })
    await expect.poll(() => video.evaluate(video => video.getVideoPlaybackQuality().totalVideoFrames), { timeout: 35_000 }).toBeGreaterThan(4)
    const dimensions = await video.evaluate(video => ({ width: video.videoWidth, height: video.videoHeight, paused: video.paused }))
    expect(dimensions.width).toBeGreaterThan(0)
    expect(dimensions.height).toBeGreaterThan(0)
    expect(dimensions.paused).toBe(false)
    expect(signaling).toEqual([
      expect.objectContaining({ method: 'OPTIONS', status: 204, acceptPost: 'application/sdp' }),
      expect.objectContaining({ method: 'POST', status: 201, contentType: 'application/sdp', trustedLocation: true, readableEtag: true }),
    ])
    const deletion = page.waitForResponse(response => response.url().startsWith(`${origin}${path}/`) && response.request().method() === 'DELETE')
    await page.evaluate(async () => {
      const root = document.querySelector('#app') as Element & {
        __vue_app__: { config: { globalProperties: { $router: { push: (path: string) => Promise<unknown> } } } }
      }
      await root.__vue_app__.config.globalProperties.$router.push('/')
    })
    disposed = true
    expect((await deletion).status()).toBe(204)
    await expect(video).toHaveCount(0)
    expect(authenticatedRequests).toEqual([])
    expect(errors).toEqual([])
  } finally {
    if (!disposed) await page.goto('/')
  }
})
