import { test, expect, type Page } from '@playwright/test'
import type { Camera, CameraDetail, CameraList, CreateCameraPayload } from '../src/types'
import { apiOrigin, camera, installApiFixture } from './fixtures/api'

async function setupCameras(page: Page, initial: Camera[] = [camera]) {
  await installApiFixture(page, true, initial)
  const state = {
    items: initial.map((item) => ({ ...item })),
    fail: { POST: false, PATCH: false, DELETE: false, GET: false, detail: false },
    calls: [] as { method: string; path: string; body: unknown; key: string | undefined }[],
    hold: undefined as Promise<void> | undefined,
  }
  await page.route(new RegExp(`^${apiOrigin}/cameras(?:[/?]|$)`), async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    if (method === 'OPTIONS') return route.fulfill({ status: 204 })
    if (method === 'GET') {
      if (path === '/cameras') {
        if (state.hold) await state.hold
        if (state.fail.GET) return route.fulfill({ status: 503, json: { detail: 'Fixture error' } })
        const response: CameraList = {
          items: state.items,
          total: state.items.length,
          page: 1,
          page_size: 20,
          total_pages: state.items.length ? 1 : 0,
        }
        return route.fulfill({ json: response })
      }
      const item = state.items.find((item) => path === `/cameras/${item.id}`)
      if (item) {
        if (state.fail.detail)
          return route.fulfill({ status: 503, json: { detail: 'Fixture error' } })
        const response: CameraDetail = {
          ...item,
          active_calibration_id: null,
          active_calibration_version: null,
          active_calibration_rms: null,
        }
        return route.fulfill({ json: response })
      }
      return route.fallback()
    }
    const body: unknown = method === 'DELETE' ? undefined : request.postDataJSON()
    state.calls.push({ method, path, body, key: request.headers()['x-api-key'] })
    if (state.hold) await state.hold
    if (state.fail[method as 'POST' | 'PATCH' | 'DELETE'])
      return route.fulfill({ status: 403, json: { detail: 'Forbidden' } })
    if (method === 'POST') {
      const payload = body as CreateCameraPayload
      const created: Camera = {
        ...camera,
        ...payload,
        id: '33333333-3333-4333-8333-333333333333',
        rtsp_url: payload.rtsp_url ?? null,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
      }
      state.items.push(created)
      return route.fulfill({ status: 201, json: created })
    }
    if (method === 'PATCH') {
      state.items = state.items.map((item) =>
        path === `/cameras/${item.id}` ? { ...item, ...(body as Partial<Camera>) } : item,
      )
      return route.fulfill({ json: state.items.find((item) => path === `/cameras/${item.id}`) })
    }
    if (method === 'DELETE') {
      state.items = state.items.filter((item) => path !== `/cameras/${item.id}`)
      return route.fulfill({ status: 204 })
    }
    return route.fallback()
  })
  return state
}

test('create submits numeric JSON once and refreshes the table', async ({ page }) => {
  const state = await setupCameras(page)
  await page.goto('/dashboard/cameras')
  const trigger = page.getByRole('button', { name: 'Tambah Kamera', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Nama Kamera')).toBeFocused()
  await dialog.getByLabel('Nama Kamera').fill('Kamera baru fixture UI')
  await dialog.getByLabel('Resolusi W').fill('1280')
  await dialog.getByLabel('FPS', { exact: true }).fill('30')
  await dialog.getByLabel('Latitude').fill('0')
  await dialog.getByLabel('Longitude').fill('110.4215')
  let finish!: () => void
  state.hold = new Promise<void>((resolve) => {
    finish = resolve
  })
  await dialog.getByLabel('Nama Kamera').press('Enter')
  await expect(dialog.getByRole('button', { name: 'Menyimpan kamera...' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Batal' })).toBeDisabled()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  expect(state.calls).toHaveLength(1)
  expect(state.calls[0]).toEqual({
    method: 'POST',
    path: '/cameras',
    key: 'ui-fixture-not-a-credential',
    body: {
      name: 'Kamera baru fixture UI',
      rtsp_url: '',
      resolution_w: 1280,
      resolution_h: 1080,
      fps: 30,
      latitude: 0,
      longitude: 110.4215,
    },
  })
  finish()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('row', { name: /Kamera baru fixture UI/ })).toBeVisible()
  await expect(trigger).toBeFocused()
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(1)
})

test('create failure preserves fields; retry omits empty coordinates', async ({ page }) => {
  const state = await setupCameras(page, [])
  state.fail.POST = true
  await page.goto('/dashboard/cameras')
  await page.getByRole('button', { name: 'Tambah Kamera', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nama Kamera').fill('Kamera gagal fixture UI')
  await dialog.getByRole('button', { name: 'Tambah Kamera', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('API Key tidak memiliki izin')
  await expect(dialog.getByLabel('Nama Kamera')).toHaveValue('Kamera gagal fixture UI')
  await expect(dialog.getByRole('button', { name: 'Tambah Kamera', exact: true })).toBeEnabled()
  state.fail.POST = false
  await dialog.getByRole('button', { name: 'Tambah Kamera', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.calls).toHaveLength(2)
  expect(state.calls[1]?.body).toEqual({
    name: 'Kamera gagal fixture UI',
    rtsp_url: '',
    resolution_w: 1920,
    resolution_h: 1080,
    fps: 15,
  })
  await expect(page.getByRole('row', { name: /Kamera gagal fixture UI/ })).toBeVisible()
})

test('edit failure retains input and PATCH uses the selected UUID', async ({ page }) => {
  const state = await setupCameras(page, [{ ...camera, latitude: 0, longitude: 110.4215 }])
  state.fail.PATCH = true
  await page.goto('/dashboard/cameras')
  const trigger = page.getByRole('button', { name: `Edit ${camera.name}`, exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Latitude')).toHaveValue('0')
  await dialog.getByLabel('Nama Kamera').fill('Kamera edit fixture UI')
  await dialog.getByLabel('Latitude').fill('-6.9271')
  await dialog.getByRole('button', { name: 'Simpan Perubahan' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Gagal menyimpan kamera')
  await expect(dialog.getByLabel('Latitude')).toHaveValue('-6.9271')
  state.fail.PATCH = false
  await dialog.getByRole('button', { name: 'Simpan Perubahan' }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.calls).toHaveLength(2)
  expect(state.calls[1]).toMatchObject({
    method: 'PATCH',
    path: `/cameras/${camera.id}`,
    body: {
      name: 'Kamera edit fixture UI',
      resolution_w: 1920,
      resolution_h: 1080,
      fps: 15,
      latitude: -6.9271,
      longitude: 110.4215,
    },
  })
  await expect(page.getByRole('row', { name: /Kamera edit fixture UI/ })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Edit Kamera edit fixture UI', exact: true }),
  ).toBeFocused()
})

test('cancel, Escape, outside click and close button reset without requests and restore focus', async ({
  page,
}) => {
  const state = await setupCameras(page)
  await page.goto('/dashboard/cameras')
  const edit = page.getByRole('button', { name: `Edit ${camera.name}`, exact: true })
  await edit.click()
  await page.getByRole('dialog').getByLabel('Nama Kamera').fill('Draf fixture UI')
  await page.keyboard.press('Escape')
  await expect(edit).toBeFocused()
  const trigger = page.getByRole('button', { name: 'Tambah Kamera', exact: true })
  for (const close of ['Batal', 'Tutup dialog', 'outside']) {
    await trigger.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Nama Kamera')).toHaveValue('')
    await expect(dialog.getByLabel('Latitude')).toHaveValue('')
    await dialog.getByLabel('Nama Kamera').fill('Draf fixture UI')
    if (close === 'outside') await page.mouse.click(4, 4)
    else await dialog.getByRole('button', { name: close, exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(trigger).toBeFocused()
  }
  expect(state.calls).toHaveLength(0)
})

test('invalid required numeric fields do not submit or silently become zero', async ({ page }) => {
  const state = await setupCameras(page)
  await page.goto('/dashboard/cameras')
  await page.getByRole('button', { name: 'Tambah Kamera', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nama Kamera').fill('Kamera fixture UI')
  for (const value of ['', '0', '1.5']) {
    await dialog.getByLabel('Resolusi W').fill(value)
    await dialog.getByRole('button', { name: 'Tambah Kamera', exact: true }).click()
    await expect(dialog.getByLabel('Resolusi W')).toHaveValue(value)
    expect(
      await dialog
        .getByLabel('Resolusi W')
        .evaluate((input: HTMLInputElement) => input.validity.valid),
    ).toBe(false)
  }
  expect(state.calls).toHaveLength(0)
})

test('delete names the selected camera; cancel and Escape never send DELETE', async ({ page }) => {
  const state = await setupCameras(page)
  await page.goto('/dashboard/cameras')
  const trigger = page.getByRole('button', { name: `Hapus ${camera.name}`, exact: true })
  await trigger.click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText(camera.name)
  await expect(dialog).toContainText('kalibrasi dan job terkait')
  await expect(dialog.getByRole('button', { name: 'Batal' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Batal' }).click()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
  expect(state.calls).toHaveLength(0)
})

test('delete failure stays open; pending retry sends exactly one DELETE', async ({ page }) => {
  const state = await setupCameras(page)
  state.fail.DELETE = true
  await page.goto('/dashboard/cameras')
  await page.getByRole('button', { name: `Hapus ${camera.name}`, exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await dialog.getByRole('button', { name: 'Hapus Kamera', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('API Key tidak memiliki izin')
  await expect(dialog).toContainText(camera.name)
  state.fail.DELETE = false
  let finish!: () => void
  state.hold = new Promise<void>((resolve) => {
    finish = resolve
  })
  await dialog.getByRole('button', { name: 'Hapus Kamera', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Menghapus kamera...' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Batal' })).toBeDisabled()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  expect(state.calls).toHaveLength(2)
  expect(state.calls[1]).toMatchObject({ method: 'DELETE', path: `/cameras/${camera.id}` })
  finish()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('Belum ada kamera terdaftar.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tambah Kamera', exact: true })).toBeFocused()
})

test('loading and load errors are not empty; retry loads real rows', async ({ page }) => {
  const state = await setupCameras(page)
  state.fail.GET = true
  let finish!: () => void
  state.hold = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.goto('/dashboard/cameras')
  await expect(page.getByRole('status')).toContainText('Memuat data kamera...')
  await expect(page.getByText('Belum ada kamera terdaftar.', { exact: false })).not.toBeVisible()
  finish()
  await expect(page.getByRole('alert')).toContainText('Gagal memuat data kamera')
  await expect(page.getByText('Belum ada kamera terdaftar.', { exact: false })).not.toBeVisible()
  state.fail.GET = false
  await page.getByRole('button', { name: 'Coba Lagi' }).click()
  await expect(page.getByRole('row', { name: new RegExp(camera.name) })).toBeVisible()
  await expect(page.getByRole('alert')).not.toBeVisible()
})

test('failed calibration lookup is not reported as uncalibrated', async ({ page }) => {
  const state = await setupCameras(page)
  state.fail.detail = true
  await page.goto('/dashboard/cameras')
  await expect(page.getByText('Gagal diperiksa', { exact: true })).toBeVisible()
  await expect(page.getByText('Belum Dikalibrasi', { exact: true })).not.toBeVisible()
})

test('missing API key explains setup and disables camera creation', async ({ page }) => {
  await installApiFixture(page)
  await page.goto('/dashboard/cameras')
  await expect(page.getByRole('alert')).toContainText('API Key belum diatur')
  await expect(page.getByRole('button', { name: 'Tambah Kamera', exact: true })).toBeDisabled()
  await page.getByRole('link', { name: 'Buka Pengaturan' }).click()
  await expect(page).toHaveURL(/\/dashboard\/settings$/)
})

test('camera dialogs lock page scroll and release it when closed', async ({ page }) => {
  await setupCameras(
    page,
    Array.from({ length: 24 }, (_, index) => ({
      ...camera,
      id: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
      name: `Kamera fixture UI ${index + 1}`,
    })),
  )
  await page.setViewportSize({ width: 390, height: 700 })
  await page.goto('/dashboard/cameras')
  await expect(page.getByRole('row')).toHaveCount(25)
  const scrollLock = () =>
    page.evaluate(() =>
      [document.body, document.documentElement].some((element) =>
        ['hidden', 'clip'].includes(getComputedStyle(element).overflowY),
      ),
    )
  await page.getByRole('button', { name: 'Tambah Kamera', exact: true }).click()
  await expect.poll(scrollLock).toBe(true)
  const before = await page.evaluate(() => scrollY)
  await page.mouse.move(4, 350)
  await page.mouse.wheel(0, 500)
  expect(await page.evaluate(() => scrollY)).toBe(before)
  await page.keyboard.press('Escape')
  await expect.poll(scrollLock).toBe(false)
  await page.getByRole('button', { name: 'Hapus Kamera fixture UI 1', exact: true }).click()
  await expect.poll(scrollLock).toBe(true)
  await page.keyboard.press('Escape')
  await expect.poll(scrollLock).toBe(false)
  await page.mouse.wheel(0, 500)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before)
})

test('camera forms reflow with 200% text size and a zoom-equivalent viewport', async ({ page }) => {
  await setupCameras(page)
  await page.setViewportSize({ width: 720, height: 450 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/dashboard/cameras')
  await expect(page.getByRole('row', { name: new RegExp(camera.name) })).toBeVisible()
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  const trigger = page.getByRole('button', { name: 'Tambah Kamera', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAccessibleName('Tambah Kamera Baru')
  await expect(dialog.getByLabel('Nama Kamera')).toBeInViewport({ ratio: 1 })
  await dialog.getByLabel('Longitude').focus()
  await expect(dialog.getByLabel('Longitude')).toBeInViewport({ ratio: 1 })
  await dialog.getByRole('button', { name: 'Tambah Kamera', exact: true }).focus()
  await expect(dialog.getByRole('button', { name: 'Tambah Kamera', exact: true })).toBeInViewport({
    ratio: 1,
  })
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/opencode/sivera-cameras-text-200.png' })
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await page.getByRole('button', { name: `Hapus ${camera.name}`, exact: true }).click()
  const confirmation = page.getByRole('alertdialog')
  await expect(confirmation.getByRole('button', { name: 'Batal' })).toBeInViewport({ ratio: 1 })
  expect(await confirmation.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  )
  await page.keyboard.press('Escape')
})

for (const width of [320, 390, 600, 768, 1024, 1440]) {
  test(`camera table and overlays fit at ${width}px`, async ({ page }) => {
    await setupCameras(page)
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text())
    })
    await page.goto('/dashboard/cameras')
    await expect(page.getByRole('row', { name: new RegExp(camera.name) })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `/tmp/opencode/sivera-cameras-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Tambah Kamera', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    expect(box!.height).toBeLessThanOrEqual(900)
    await page.screenshot({
      path: `/tmp/opencode/sivera-cameras-dialog-${width}.png`,
      fullPage: true,
    })
    for (let i = 0; i < 13; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
        true,
      )
    }
    await dialog.getByLabel('Longitude').focus()
    await page.setViewportSize({ width, height: 420 })
    await expect(dialog.getByLabel('Longitude')).toBeInViewport({ ratio: 1 })
    await page.setViewportSize({ width, height: 900 })
    await dialog.getByLabel('Nama Kamera').focus()
    await page.setViewportSize({ width, height: 420 })
    await dialog.getByLabel('Longitude').focus()
    await expect(dialog.getByLabel('Longitude')).toBeInViewport({ ratio: 1 })
    await page.screenshot({ path: `/tmp/opencode/sivera-cameras-short-${width}.png` })
    await dialog.getByRole('button', { name: 'Batal' }).click()
    await page.setViewportSize({ width, height: 900 })
    await page.getByRole('button', { name: `Hapus ${camera.name}`, exact: true }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.screenshot({
      path: `/tmp/opencode/sivera-cameras-delete-${width}.png`,
      fullPage: true,
    })
    await page.keyboard.press('Escape')
    expect(errors).toEqual([])
  })
}
