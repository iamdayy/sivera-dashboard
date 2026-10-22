import { expect, test, type Page } from '@playwright/test'
import type { Calibration } from '../src/types'
import { apiOrigin, calibration, camera, installApiFixture } from './fixtures/api'

const inactive: Calibration = { ...calibration, id: '33333333-3333-4333-8333-333333333333', version: 2, is_active: false }
const otherCamera = { ...camera, id: '44444444-4444-4444-8444-444444444444', name: 'Kamera kedua fixture UI' }
const images = (count = 10) => Array.from({ length: count }, (_, index) => ({
  name: `chessboard-fixture-ui-${index}.png`, mimeType: 'image/png', buffer: Buffer.from('ui-fixture-not-a-valid-chessboard'),
}))

function deferred() {
  let finish!: () => void
  const promise = new Promise<void>((resolve) => { finish = resolve })
  return { promise, finish }
}

async function setupCalibrations(page: Page, items: Calibration[] = [calibration, inactive], cameras = [camera]) {
  await installApiFixture(page, true, cameras)
  const state = {
    items: items.map(item => ({ ...item })),
    fail: { camera: false, list: false, create: false, activate: false, preview: false, delete: false },
    hold: undefined as Promise<void> | undefined,
    cameraHold: undefined as Promise<void> | undefined,
    listHolds: {} as Record<string, Promise<void> | undefined>,
    loads: [] as string[],
    calls: [] as { method: string; path: string; key: string | undefined; form?: FormData }[],
  }
  await page.route(new RegExp(`^${apiOrigin}/api/v1/cameras(?:\\?|$)`), async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 })
    if (state.cameraHold) await state.cameraHold
    if (state.fail.camera) return route.fulfill({ status: 503, json: { detail: 'Camera fixture error' } })
    return route.fallback()
  })
  await page.route(new RegExp(`^${apiOrigin}/api/v1/cameras/[^/]+/calibrations(?:/|$)`), async route => {
    const request = route.request()
    const method = request.method()
    if (method === 'OPTIONS') return route.fulfill({ status: 204 })
    const path = new URL(request.url()).pathname
    const cameraId = path.split('/')[4]!
    if (method === 'GET' && path.endsWith('/calibrations')) {
      state.loads.push(cameraId)
      const rows = state.items.filter(item => item.camera_id === cameraId).map(item => ({ ...item }))
      if (state.listHolds[cameraId]) await state.listHolds[cameraId]
      if (state.fail.list) return route.fulfill({ status: 503, json: { detail: 'Calibration fixture error' } })
      return route.fulfill({ json: { items: rows, total: rows.length } })
    }
    const call = { method, path, key: request.headers()['x-api-key'], form: undefined as FormData | undefined }
    if (method === 'POST' && path.endsWith('/calibrations')) {
      call.form = await new Response(request.postDataBuffer(), { headers: { 'Content-Type': request.headers()['content-type']! } }).formData()
    }
    state.calls.push(call)
    if (state.hold) await state.hold
    if (method === 'POST' && path.endsWith('/calibrations')) {
      if (state.fail.create) return route.fulfill({ status: 400, json: { detail: 'Only 0 valid images; minimum 10 required' } })
      const created = { ...calibration, camera_id: cameraId, id: '55555555-5555-4555-8555-555555555555', version: 3, is_active: true }
      state.items = state.items.map(item => item.camera_id === cameraId ? { ...item, is_active: false } : item)
      state.items.push(created)
      return route.fulfill({ status: 201, json: created })
    }
    if (method === 'POST' && path.endsWith('/activate')) {
      if (state.fail.activate) return route.fulfill({ status: 403, json: { detail: 'Activation fixture error' } })
      const id = path.split('/')[6]
      state.items = state.items.map(item => item.camera_id === cameraId ? { ...item, is_active: item.id === id } : item)
      return route.fulfill({ json: { calibration_id: id, is_active: true, message: 'Activated' } })
    }
    if (method === 'GET' && path.endsWith('/undistort-preview')) {
      if (state.fail.preview) return route.fulfill({ status: 404, json: { detail: 'No calibration images available for preview' } })
      return route.fulfill({ json: { preview_url: `${apiOrigin}/files/returned-preview.png`, original_size: [1920, 1080], undistorted_size: [1920, 1080], k_undist: calibration.k_matrix } })
    }
    if (method === 'DELETE') {
      if (state.fail.delete) return route.fulfill({ status: 403, json: { detail: 'Deletion fixture error' } })
      state.items = state.items.filter(item => path !== `/api/v1/cameras/${cameraId}/calibrations/${item.id}`)
      return route.fulfill({ status: 204 })
    }
    return route.fallback()
  })
  return state
}

const row = (page: Page, version: number) => page.getByRole('row').filter({ has: page.getByRole('cell', { name: `v${version}`, exact: true }) })
const createTrigger = (page: Page) => page.getByRole('button', { name: 'Buat Kalibrasi Baru', exact: true })

test('first camera loads exactly once and zero values remain distinct from null', async ({ page }) => {
  const state = await setupCalibrations(page, [
    { ...calibration, square_m: 0 },
    { ...inactive, rms_reproj: null, square_m: null, chessboard_cols: null, chessboard_rows: null },
  ])
  await page.goto('/dashboard/calibrations')
  await expect(row(page, 1)).toBeVisible()
  expect(state.loads).toEqual([camera.id])
  await expect(row(page, 1).getByRole('cell', { name: '0.000 px', exact: true })).toBeVisible()
  await expect(row(page, 1).getByRole('cell', { name: '0 cm', exact: true })).toBeVisible()
  await expect(row(page, 2).getByRole('cell', { name: '-', exact: true })).toHaveCount(2)
  await expect(row(page, 2)).toContainText('-x-')
  await expect(page.getByRole('button', { name: 'Hapus kalibrasi v1', exact: true })).toBeDisabled()
  await expect(row(page, 1)).toContainText('Aktifkan versi lain sebelum menghapus.')
  await expect(page.getByRole('combobox', { name: 'Pilih Kamera' })).toContainText(camera.name)
})

test('camera changes clear old rows; stale responses cannot replace data or end current loading', async ({ page }) => {
  const other = { ...inactive, camera_id: otherCamera.id, version: 7 }
  const state = await setupCalibrations(page, [calibration, other], [camera, otherCamera])
  const first = deferred()
  const second = deferred()
  state.listHolds[camera.id] = first.promise
  state.listHolds[otherCamera.id] = second.promise
  await page.goto('/dashboard/calibrations')
  await expect(page.getByText('Memuat kalibrasi...', { exact: true })).toBeVisible()
  const selector = page.getByRole('combobox', { name: 'Pilih Kamera' })
  await selector.focus()
  await selector.press('Enter')
  await expect(page.getByRole('option', { name: `${camera.name} (1920x1080)`, exact: true })).toBeFocused()
  await page.keyboard.press('End')
  await expect(page.getByRole('option', { name: new RegExp(otherCamera.name) })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(selector).toContainText(otherCamera.name)
  await expect.poll(() => state.loads.length).toBe(2)
  const staleSuccess = page.waitForResponse(response => response.url().endsWith(`/api/v1/cameras/${camera.id}/calibrations`))
  first.finish()
  await (await staleSuccess).finished()
  await expect(page.getByText('Memuat kalibrasi...', { exact: true })).toBeVisible()
  await expect(row(page, 1)).not.toBeVisible()
  second.finish()
  await expect(row(page, 7)).toBeVisible()
  state.listHolds[camera.id] = undefined
  await selector.click()
  await page.getByRole('option', { name: `${camera.name} (1920x1080)`, exact: true }).click()
  await expect(row(page, 1)).toBeVisible()
  await expect(row(page, 7)).not.toBeVisible()
  const late = deferred()
  state.listHolds[otherCamera.id] = late.promise
  state.fail.list = true
  await selector.click()
  await page.getByRole('option', { name: new RegExp(otherCamera.name) }).click()
  await expect(page.getByText('Memuat kalibrasi...', { exact: true })).toBeVisible()
  await expect(row(page, 1)).not.toBeVisible()
  state.fail.list = false
  await selector.click()
  await page.getByRole('option', { name: `${camera.name} (1920x1080)`, exact: true }).click()
  await expect(row(page, 1)).toBeVisible()
  state.fail.list = true
  const staleFailure = page.waitForResponse(response => response.url().endsWith(`/api/v1/cameras/${otherCamera.id}/calibrations`))
  late.finish()
  await (await staleFailure).finished()
  await expect(row(page, 1)).toBeVisible()
  await expect(page.getByRole('alert')).not.toBeVisible()
  expect(state.loads).toEqual([camera.id, otherCamera.id, camera.id, otherCamera.id, camera.id])
})

test('camera selector Escape restores focus without changing scope', async ({ page }) => {
  const state = await setupCalibrations(page, [calibration], [camera, otherCamera])
  await page.goto('/dashboard/calibrations')
  await expect(row(page, 1)).toBeVisible()
  const selector = page.getByRole('combobox', { name: 'Pilih Kamera' })
  await selector.focus()
  await selector.press('Space')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  await expect(selector).toBeFocused()
  await expect(selector).toContainText(camera.name)
  expect(state.loads).toEqual([camera.id])
  expect(await selector.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')
})

test('create preserves native files, multipart fields and Alpha zero while guarding pending submission', async ({ page }) => {
  const state = await setupCalibrations(page)
  await page.goto('/dashboard/calibrations')
  const trigger = createTrigger(page)
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Chessboard Cols')).toBeFocused()
  await dialog.getByLabel('Chessboard Cols').fill('8')
  await dialog.getByLabel('Chessboard Rows').fill('7')
  await dialog.getByLabel('Square Size (meter)').fill('0.03')
  await dialog.getByLabel('Catatan').fill('<b>Catatan fixture UI</b>')
  const upload = dialog.getByLabel('Gambar chessboard', { exact: true })
  await expect(upload).toHaveAttribute('multiple', '')
  await expect(upload).toHaveAttribute('accept', 'image/*')
  await upload.setInputFiles(images())
  await expect(dialog.getByText('10 file terpilih', { exact: true })).toBeVisible()
  const hold = deferred()
  state.hold = hold.promise
  await dialog.getByLabel('Alpha (0-1)').press('Enter')
  await expect(dialog.getByRole('button', { name: 'Membuat kalibrasi...' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Batal' })).toBeDisabled()
  await expect(upload).toBeDisabled()
  await expect(page.getByRole('combobox', { includeHidden: true })).toBeDisabled()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await page.mouse.click(4, 4)
  await expect(dialog).toBeVisible()
  await expect.poll(() => state.calls.length).toBe(1)
  const call = state.calls[0]!
  expect(call).toMatchObject({ method: 'POST', path: `/api/v1/cameras/${camera.id}/calibrations`, key: 'ui-fixture-not-a-credential' })
  expect(['chessboard_cols', 'chessboard_rows', 'square_m', 'alpha', 'notes'].map(key => call.form!.get(key)))
    .toEqual(['8', '7', '0.03', '0', '<b>Catatan fixture UI</b>'])
  expect(call.form!.getAll('files').map(file => typeof file === 'string' ? file : file.name)).toEqual(images().map(file => file.name))
  expect(await upload.evaluate((input: HTMLInputElement) => input.files?.length)).toBe(10)
  hold.finish()
  await expect(dialog).not.toBeVisible()
  await expect(row(page, 3)).toBeVisible()
  await expect(trigger).toBeFocused()
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(1)
})

test('create failure retains values and files; retry refreshes with empty notes omitted', async ({ page }) => {
  const state = await setupCalibrations(page)
  state.fail.create = true
  await page.goto('/dashboard/calibrations')
  await createTrigger(page).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Square Size (meter)').fill('0.04')
  await dialog.getByLabel('Gambar chessboard', { exact: true }).setInputFiles(images())
  await dialog.getByRole('button', { name: 'Buat Kalibrasi', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Only 0 valid images; minimum 10 required')
  await expect(dialog.getByLabel('Square Size (meter)')).toHaveValue('0.04')
  expect(await dialog.getByLabel('Gambar chessboard', { exact: true }).evaluate((input: HTMLInputElement) => input.files?.length)).toBe(10)
  state.fail.create = false
  await dialog.getByRole('button', { name: 'Buat Kalibrasi', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(row(page, 3)).toBeVisible()
  expect(state.calls).toHaveLength(2)
  expect(state.calls[1]!.form!.has('notes')).toBe(false)
})

test('too few files and invalid required numeric inputs never submit', async ({ page }) => {
  const state = await setupCalibrations(page)
  await page.goto('/dashboard/calibrations')
  await createTrigger(page).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Gambar chessboard', { exact: true }).setInputFiles(images(9))
  await dialog.getByRole('button', { name: 'Buat Kalibrasi', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Minimal 10 gambar')
  await dialog.getByLabel('Gambar chessboard', { exact: true }).setInputFiles(images())
  for (const [label, values, valid] of [
    ['Chessboard Cols', ['', '2', '9.5'], '9'],
    ['Square Size (meter)', ['', '0', '1.1'], '0.025'],
    ['Alpha (0-1)', ['', '-0.01', '1.01'], '0'],
  ] as const) {
    const field = dialog.getByLabel(label, { exact: true })
    for (const value of values) {
      await field.fill(value)
      await dialog.getByRole('button', { name: 'Buat Kalibrasi', exact: true }).click()
      await expect(field).toHaveValue(value)
      expect(await field.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false)
    }
    await field.fill(valid)
  }
  expect(state.calls).toHaveLength(0)
})

test('all create dismissal paths clear the draft and files without requests', async ({ page }) => {
  const state = await setupCalibrations(page)
  await page.goto('/dashboard/calibrations')
  const trigger = createTrigger(page)
  for (const close of ['Batal', 'Tutup dialog', 'Escape', 'outside']) {
    await trigger.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Chessboard Cols')).toHaveValue('9')
    await expect(dialog.getByLabel('Catatan')).toHaveValue('')
    expect(await dialog.getByLabel('Gambar chessboard', { exact: true }).evaluate((input: HTMLInputElement) => input.files?.length)).toBe(0)
    await dialog.getByLabel('Catatan').fill('Draf fixture UI')
    await dialog.getByLabel('Gambar chessboard', { exact: true }).setInputFiles(images())
    if (close === 'Escape') await page.keyboard.press('Escape')
    else if (close === 'outside') await page.mouse.click(4, 4)
    else await dialog.getByRole('button', { name: close, exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(trigger).toBeFocused()
  }
  expect(state.calls).toHaveLength(0)
})

test('activation failure is visible; pending retry changes active version exactly once', async ({ page }) => {
  const state = await setupCalibrations(page)
  state.fail.activate = true
  await page.goto('/dashboard/calibrations')
  const activate = page.getByRole('button', { name: 'Aktifkan kalibrasi v2', exact: true })
  await activate.click()
  await expect(page.getByRole('alert')).toContainText('Gagal mengaktifkan kalibrasi v2')
  await expect(row(page, 1)).toContainText('Aktifkan versi lain sebelum menghapus.')
  state.fail.activate = false
  const hold = deferred()
  state.hold = hold.promise
  await activate.click()
  await expect(activate).toContainText('Mengaktifkan...')
  await expect(activate).toBeDisabled()
  await expect(page.getByRole('combobox')).toBeDisabled()
  hold.finish()
  await expect(row(page, 2)).toContainText('Aktifkan versi lain sebelum menghapus.')
  await expect(page.getByRole('button', { name: 'Hapus kalibrasi v2', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Aktifkan kalibrasi v1', exact: true })).toBeEnabled()
  expect(state.calls).toHaveLength(2)
  expect(state.calls[1]).toMatchObject({ method: 'POST', path: `/api/v1/cameras/${camera.id}/calibrations/${inactive.id}/activate` })
})

test('preview failure recovers using only the returned URL and a working fallback link', async ({ page, context }) => {
  const state = await setupCalibrations(page)
  state.fail.preview = true
  await page.route(`${apiOrigin}/files/returned-preview.png`, route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6fkAAAAASUVORK5CYII=', 'base64') }))
  await page.goto('/dashboard/calibrations')
  const preview = page.getByRole('button', { name: 'Preview kalibrasi v1', exact: true })
  await preview.click()
  await expect(page.getByRole('alert')).toContainText('Data tidak ditemukan atau sudah dihapus.')
  await expect(page.getByRole('link', { name: 'Buka Preview v1', exact: true })).not.toBeVisible()
  state.fail.preview = false
  await page.evaluate(() => { window.open = () => null })
  const hold = deferred()
  state.hold = hold.promise
  await preview.click()
  await expect(preview).toBeDisabled()
  await expect(preview).toContainText('Memuat preview...')
  hold.finish()
  const link = page.getByRole('link', { name: 'Buka Preview v1', exact: true })
  await expect(link).toHaveAttribute('href', /^blob:/)
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  const newPage = context.waitForEvent('page')
  await link.click()
  const artifact = await newPage
  await artifact.waitForLoadState()
  expect(artifact.url()).toMatch(/^blob:/)
  await expect.poll(() => artifact.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  await artifact.close()
  expect(state.calls).toHaveLength(2)
  expect(state.calls[1]).toMatchObject({ method: 'GET', path: `/api/v1/cameras/${camera.id}/calibrations/${calibration.id}/undistort-preview` })
})

test('delete names the selected version; cancel/Escape never delete; failure and pending are protected', async ({ page }) => {
  const state = await setupCalibrations(page)
  await page.goto('/dashboard/calibrations')
  const trigger = page.getByRole('button', { name: 'Hapus kalibrasi v2', exact: true })
  const dialog = page.getByRole('alertdialog')
  for (const close of ['Batal', 'Escape']) {
    await trigger.click()
    await expect(dialog).toContainText(`Kalibrasi v2 untuk ${camera.name}`)
    await expect(dialog.getByRole('button', { name: 'Batal' })).toBeFocused()
    if (close === 'Escape') await page.keyboard.press('Escape')
    else await dialog.getByRole('button', { name: 'Batal' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(trigger).toBeFocused()
  }
  expect(state.calls).toHaveLength(0)
  state.fail.delete = true
  await trigger.click()
  await dialog.getByRole('button', { name: 'Hapus Kalibrasi', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('API Key tidak memiliki izin')
  state.fail.delete = false
  const hold = deferred()
  state.hold = hold.promise
  await dialog.getByRole('button', { name: 'Hapus Kalibrasi', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Menghapus kalibrasi...' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Batal' })).toBeDisabled()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  expect(state.calls).toHaveLength(2)
  hold.finish()
  await expect(dialog).not.toBeVisible()
  await expect(row(page, 2)).not.toBeVisible()
  await expect(row(page, 1)).toBeVisible()
  await expect(createTrigger(page)).toBeFocused()
  expect(state.calls[1]).toMatchObject({ method: 'DELETE', path: `/api/v1/cameras/${camera.id}/calibrations/${inactive.id}` })
})

test('camera and calibration load states recover without misreporting errors as empty', async ({ page }) => {
  const state = await setupCalibrations(page)
  const cameraHold = deferred()
  state.cameraHold = cameraHold.promise
  state.fail.camera = true
  await page.goto('/dashboard/calibrations')
  await expect(page.getByText('Memuat data kamera...', { exact: true })).toBeVisible()
  await expect(page.getByText('Belum ada kamera terdaftar.', { exact: false })).not.toBeVisible()
  cameraHold.finish()
  await expect(page.getByRole('alert')).toContainText('Gagal memuat data kamera')
  state.fail.camera = false
  const listHold = deferred()
  state.listHolds[camera.id] = listHold.promise
  state.fail.list = true
  await page.getByRole('button', { name: 'Coba Lagi' }).click()
  await expect(page.getByText('Memuat kalibrasi...', { exact: true })).toBeVisible()
  await expect(page.getByText('Belum ada kalibrasi', { exact: false })).not.toBeVisible()
  listHold.finish()
  await expect(page.getByRole('alert')).toContainText('Gagal memuat kalibrasi')
  await expect(page.getByText('Belum ada kalibrasi', { exact: false })).not.toBeVisible()
  state.fail.list = false
  await page.getByRole('button', { name: 'Coba Lagi' }).click()
  await expect(row(page, 1)).toBeVisible()
})

test('missing key, no cameras and no calibrations have actionable empty states', async ({ page }) => {
  await installApiFixture(page)
  await page.goto('/dashboard/calibrations')
  await expect(page.getByRole('alert')).toContainText('API Key belum diatur')
  await expect(createTrigger(page)).toBeDisabled()
  await page.getByRole('link', { name: 'Buka Pengaturan' }).click()
  await expect(page).toHaveURL(/\/dashboard\/settings$/)
  await setupCalibrations(page, [], [])
  await page.goto('/dashboard/calibrations')
  await expect(page.getByText('Belum ada kamera terdaftar.', { exact: false })).toBeVisible()
  await expect(createTrigger(page)).toBeDisabled()
  await page.getByRole('link', { name: 'Buka Manajemen Kamera' }).click()
  await expect(page).toHaveURL(/\/dashboard\/cameras$/)
  await setupCalibrations(page, [])
  await page.goto('/dashboard/calibrations')
  await expect(page.getByText('Belum ada kalibrasi', { exact: false })).toBeVisible()
  await expect(createTrigger(page)).toBeEnabled()
})

test('dialogs lock/release background scroll and navigation unmount removes the overlay', async ({ page }) => {
  await setupCalibrations(page, Array.from({ length: 24 }, (_, index) => ({ ...inactive, id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`, version: index + 1 })))
  await page.setViewportSize({ width: 390, height: 700 })
  await page.goto('/dashboard/calibrations')
  await expect(page.getByRole('row')).toHaveCount(25)
  const locked = () => page.evaluate(() => [document.body, document.documentElement].some(element => ['hidden', 'clip'].includes(getComputedStyle(element).overflowY)))
  await createTrigger(page).click()
  await expect.poll(locked).toBe(true)
  const before = await page.evaluate(() => scrollY)
  await page.mouse.move(4, 350)
  await page.mouse.wheel(0, 500)
  expect(await page.evaluate(() => scrollY)).toBe(before)
  await page.keyboard.press('Escape')
  await expect.poll(locked).toBe(false)
  await page.getByRole('button', { name: 'Hapus kalibrasi v1', exact: true }).click()
  await expect.poll(locked).toBe(true)
  await page.keyboard.press('Escape')
  await expect.poll(locked).toBe(false)
  await page.mouse.wheel(0, 500)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before)
  await createTrigger(page).click()
  await page.evaluate(() => { history.pushState({}, '', '/dashboard/settings'); dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pengaturan')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect.poll(locked).toBe(false)
})

test('calibration form reflows with 200% text and zoom-equivalent short viewport', async ({ page }) => {
  await setupCalibrations(page)
  await page.setViewportSize({ width: 720, height: 450 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/dashboard/calibrations')
  await expect(row(page, 1)).toBeVisible()
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  await createTrigger(page).click()
  const dialog = page.getByRole('dialog')
  for (const label of ['Chessboard Cols', 'Catatan', 'Gambar chessboard']) {
    await dialog.getByLabel(label, { exact: true }).focus()
    await expect(dialog.getByLabel(label, { exact: true })).toBeInViewport({ ratio: 1 })
  }
  await dialog.getByRole('button', { name: 'Buat Kalibrasi', exact: true }).focus()
  await expect(dialog.getByRole('button', { name: 'Buat Kalibrasi', exact: true })).toBeInViewport({ ratio: 1 })
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/opencode/sivera-calibrations-text-200.png' })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Hapus kalibrasi v2', exact: true }).click()
  await expect(page.getByRole('alertdialog').getByRole('button', { name: 'Batal' })).toBeInViewport({ ratio: 1 })
  await page.keyboard.press('Escape')
})

for (const width of [320, 390, 600, 768, 1024, 1440]) {
  test(`calibration table, selector and overlays fit at ${width}px`, async ({ page }) => {
    await setupCalibrations(page, [calibration, inactive], [camera, otherCamera])
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()) })
    await page.goto('/dashboard/calibrations')
    await expect(row(page, 1)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `/tmp/opencode/sivera-calibrations-${width}.png`, fullPage: true })
    await page.getByRole('combobox').click()
    const listbox = page.getByRole('listbox')
    expect(await listbox.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    for (const option of await page.getByRole('option').all()) expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await page.keyboard.press('Escape')
    await createTrigger(page).click()
    const dialog = page.getByRole('dialog')
    const box = (await dialog.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    expect(box.height).toBeLessThanOrEqual(900)
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: `/tmp/opencode/sivera-calibrations-dialog-${width}.png` })
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
    }
    await dialog.getByLabel('Gambar chessboard', { exact: true }).focus()
    await page.setViewportSize({ width, height: 420 })
    await expect(dialog.getByLabel('Gambar chessboard', { exact: true })).toBeInViewport({ ratio: 1 })
    await dialog.getByRole('button', { name: 'Buat Kalibrasi', exact: true }).focus()
    await expect(dialog.getByRole('button', { name: 'Buat Kalibrasi', exact: true })).toBeInViewport({ ratio: 1 })
    await page.screenshot({ path: `/tmp/opencode/sivera-calibrations-short-${width}.png` })
    await page.keyboard.press('Escape')
    await page.setViewportSize({ width, height: 900 })
    await page.getByRole('button', { name: 'Hapus kalibrasi v2', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.screenshot({ path: `/tmp/opencode/sivera-calibrations-delete-${width}.png` })
    await page.keyboard.press('Escape')
    expect(errors).toEqual([])
  })
}
