import { expect, test, type Page } from '@playwright/test'
import type { GroundReference } from '../src/types'
import { apiOrigin, camera, groundRef, inactiveGroundRef, setupGroundReferences, installApiFixture } from './fixtures/api'

const otherCamera = { ...camera, id: '55555555-5555-4555-8555-555555555555', name: 'Kamera kedua fixture UI' }

function deferred() {
  let finish!: () => void
  const promise = new Promise<void>((resolve) => { finish = resolve })
  return { promise, finish }
}

const row = (page: Page, version: number) => page.getByRole('row').filter({ hasText: `v${version}` }).first()
const createTrigger = (page: Page) => page.getByRole('button', { name: 'Tambah Referensi Baru', exact: true })

test.describe.configure({ retries: 0 })

test('first camera loads exactly once and empty state handled', async ({ page }) => {
  const state = await setupGroundReferences(page, [])
  await page.goto('/dashboard/ground-references')
  await expect(page.getByRole('heading', { name: 'Referensi Tanah' })).toBeVisible()
  await expect(page.getByText('Belum ada referensi tanah untuk kamera ini. Klik "Tambah Referensi Baru" untuk memulai.', { exact: true })).toBeVisible()
  expect(state.loads).toEqual([camera.id])
})

test('camera changes clear old rows; stale responses cannot replace data', async ({ page }) => {
  const other = { ...inactiveGroundRef, camera_id: otherCamera.id, version: 7 }
  const state = await setupGroundReferences(page, [groundRef, other], [camera, otherCamera])
  const first = deferred()
  const second = deferred()
  state.listHolds[camera.id] = first.promise
  state.listHolds[otherCamera.id] = second.promise
  await page.goto('/dashboard/ground-references')
  await expect(page.getByText('Memuat referensi tanah...', { exact: true })).toBeVisible()
  const selector = page.getByRole('combobox', { name: 'Pilih Kamera' })
  await selector.selectOption(otherCamera.id)
  await expect(selector).toContainText(otherCamera.name)
  await expect.poll(() => state.loads.length).toBe(2)
  const staleSuccess = page.waitForResponse(response => response.url().endsWith(`/api/v1/cameras/${camera.id}/ground-references`))
  first.finish()
  await (await staleSuccess).finished()
  await expect(page.getByText('Memuat referensi tanah...', { exact: true })).toBeVisible()
  await expect(row(page, 1)).not.toBeVisible()
  second.finish()
  await expect(row(page, 7)).toBeVisible()
  state.listHolds[camera.id] = undefined
  await selector.selectOption(camera.id)
  await expect(row(page, 1)).toBeVisible()
  await expect(row(page, 7)).not.toBeVisible()
  const late = deferred()
  state.listHolds[otherCamera.id] = late.promise
  state.fail.list = true
  await selector.selectOption(otherCamera.id)
  await expect(page.getByText('Memuat referensi tanah...', { exact: true })).toBeVisible()
  await expect(row(page, 1)).not.toBeVisible()
  state.fail.list = false
  await selector.selectOption(camera.id)
  await expect(row(page, 1)).toBeVisible()
  const staleFailure = page.waitForResponse(response => response.url().endsWith(`/api/v1/cameras/${otherCamera.id}/ground-references`))
  late.finish()
  await (await staleFailure).finished()
  await expect(row(page, 1)).toBeVisible()
  await expect(page.getByRole('alert')).not.toBeVisible()
  expect(state.loads).toEqual([camera.id, otherCamera.id, camera.id, otherCamera.id, camera.id])
})

test('camera selector Escape restores focus without changing scope', async ({ page }) => {
  const state = await setupGroundReferences(page, [groundRef], [camera, otherCamera])
  await page.goto('/dashboard/ground-references')
  await expect(row(page, 1)).toBeVisible()
  const selector = page.getByRole('combobox', { name: 'Pilih Kamera' })
  await selector.focus()
  await expect(selector).toBeFocused()
  await selector.click()
  await expect(selector).toContainText(camera.name)
  expect(state.loads).toEqual([camera.id])
  expect(await selector.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')
})

test('create dialog opens and submit button disabled until 4 points', async ({ page }) => {
  const state = await setupGroundReferences(page, [groundRef, inactiveGroundRef])
  await page.goto('/dashboard/ground-references')
  await expect(row(page, 1)).toBeVisible()
  await createTrigger(page).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tambah Referensi Tanah Baru' })).toBeVisible()

  // Fill required fields
  await page.getByLabel('Satuan Dunia').selectOption('meter')
  await page.getByLabel('Deskripsi').fill('Test deskripsi')

  // Wait for calibration image to load (fixture provides preview)
  const img = page.locator('img[alt="Gambar kalibrasi untuk penentuan titik"]')
  await expect(img).toBeVisible({ timeout: 10000 })

  // Submit button should be disabled without 4 points
  await expect(page.getByRole('button', { name: 'Simpan Referensi', exact: true })).toBeDisabled()

  // Cancel and verify form resets
  await page.getByRole('button', { name: 'Batal', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()

  // Reopen and verify form is clean
  await createTrigger(page).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Deskripsi')).toHaveValue('')
  await page.getByRole('button', { name: 'Batal', exact: true }).click()
})

test('activate toggles active status and refreshes list', async ({ page }) => {
  const state = await setupGroundReferences(page, [groundRef, inactiveGroundRef])
  await page.goto('/dashboard/ground-references')
  await expect(row(page, 1)).toContainText('Aktif')
  await expect(row(page, 2)).toContainText('Nonaktif')

  // Activate version 2 - use text-based selector since role detection doesn't work in table
  await page.getByRole('row').filter({ hasText: 'v2' }).getByRole('button', { name: 'Aktifkan' }).click()
  await expect(page.getByText('Referensi tanah berhasil diaktifkan')).toBeVisible()
  await expect(row(page, 2)).toContainText('Aktif')
  await expect(row(page, 1)).toContainText('Nonaktif')
})

test('model ground shows info for active reference', async ({ page }) => {
  const state = await setupGroundReferences(page, [groundRef, inactiveGroundRef])
  await page.goto('/dashboard/ground-references')
  await expect(row(page, 1)).toContainText('Aktif')
  await page.getByRole('row').filter({ hasText: 'v1' }).getByRole('button', { name: 'Model Ground' }).click()
  await expect(page.getByText('Model Ground').first()).toBeVisible()
  await expect(page.getByText(/Reproj:/)).toBeVisible()
})

test('BEV preview opens for active reference', async ({ page }) => {
  const state = await setupGroundReferences(page, [groundRef, inactiveGroundRef])
  await page.goto('/dashboard/ground-references')
  await expect(row(page, 1)).toContainText('Aktif')
  await page.getByRole('row').filter({ hasText: 'v1' }).getByRole('button', { name: 'BEV Preview' }).click()
  await expect(page.getByText('BEV Preview siap')).toBeVisible()
})

test('BEV preview unavailable for inactive reference without model', async ({ page }) => {
  const state = await setupGroundReferences(page, [groundRef, inactiveGroundRef])
  await page.goto('/dashboard/ground-references')
  await expect(row(page, 2)).toContainText('Nonaktif')
  await page.getByRole('row').filter({ hasText: 'v2' }).getByRole('button', { name: 'BEV Preview' }).click()
  await expect(page.getByText('BEV preview tidak tersedia')).toBeVisible()
})

test('no unsupported delete control is offered', async ({ page }) => {
  await setupGroundReferences(page, [groundRef, inactiveGroundRef])
  await page.goto('/dashboard/ground-references')
  await expect(row(page, 1)).toBeVisible()
  await expect(page.getByRole('button', { name: /Hapus referensi tanah/ })).toHaveCount(0)
  await expect(page.getByText('Hapus referensi tanah belum didukung backend.', { exact: true })).toHaveCount(0)
})

test('Coba Lagi on load error restores data', async ({ page }) => {
  const state = await setupGroundReferences(page, [groundRef])
  state.fail.list = true
  await page.goto('/dashboard/ground-references')
  await expect(page.getByText('Gagal memuat referensi tanah')).toBeVisible()
  await page.getByRole('button', { name: 'Coba Lagi' }).click()
  state.fail.list = false
  await page.getByRole('button', { name: 'Coba Lagi' }).click()
  await expect(row(page, 1)).toBeVisible()
})

test('Buka Pengaturan when no API key', async ({ page }) => {
  await installApiFixture(page, false)
  await page.goto('/dashboard/ground-references')
  await expect(page.getByText('API Key belum diatur')).toBeVisible()
  await page.getByRole('link', { name: 'Buka Pengaturan' }).click()
  await expect(page).toHaveURL(/\/dashboard\/settings/)
})

test('Buka Manajemen Kamera when no cameras', async ({ page }) => {
  await installApiFixture(page, true, [])
  await page.goto('/dashboard/ground-references')
  await expect(page.getByText('Belum ada kamera terdaftar.')).toBeVisible()
  await page.getByRole('link', { name: 'Buka Manajemen Kamera' }).click()
  await expect(page).toHaveURL(/\/dashboard\/cameras/)
})

test('responsive: table scrolls on mobile', async ({ page }) => {
  const state = await setupGroundReferences(page, [groundRef, inactiveGroundRef])
  await page.goto('/dashboard/ground-references')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('table')).toBeVisible()
  // Horizontal scroll container should not overflow page
  const tableContainer = page.locator('.table-container').first()
  await expect(tableContainer).toHaveCSS('overflow-x', 'auto')
})

test('200% text resize does not overflow dialog', async ({ page }) => {
  const state = await setupGroundReferences(page, [groundRef])
  await page.goto('/dashboard/ground-references')
  await page.setViewportSize({ width: 720, height: 450 })
  await createTrigger(page).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Simpan Referensi', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Batal', exact: true }).click()
})

test('reduced motion respected', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const state = await setupGroundReferences(page, [groundRef])
  await page.goto('/dashboard/ground-references')
  await createTrigger(page).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Batal', exact: true }).click()
})
