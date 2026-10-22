import { test, expect } from '@playwright/test'
import { camera, installApiFixture } from './fixtures/api'

test.beforeEach(async ({ page }) => {
  await installApiFixture(page)
})

test('Landing page exposes the supported workflows', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sivera Dashboard')
  await expect(page.getByRole('link', { name: 'Buka Dashboard' })).toBeVisible()
  await expect(page.getByText('Manajemen Kamera', { exact: true })).toBeVisible()
  await expect(page.getByText('Prediksi Volume Sampah', { exact: true })).toBeVisible()
})

test('Dashboard navigation performs real actions', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard')
  for (const name of ['Total Kamera', 'Kalibrasi Aktif', 'Referensi Tanah']) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
  }
  await page.getByRole('button', { name: 'Kelola Kamera' }).click()
  await expect(page).toHaveURL(/\/dashboard\/cameras$/)
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Jalankan Prediksi', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard\/predictions$/)
})

test('Settings validates access against the UI fixture', async ({ page }) => {
  await page.goto('/dashboard/settings')
  await page.getByPlaceholder('Masukkan API Key Anda').fill('ui-fixture-not-a-credential')
  await page.getByRole('button', { name: 'Simpan Konfigurasi' }).click()
  await expect(page.getByRole('alert')).toContainText('Akses camera:read terverifikasi. Izin operasi lain belum diperiksa.')
})

test('Cameras table retains its domain columns', async ({ page }) => {
  await installApiFixture(page, true)
  await page.goto('/dashboard/cameras')
  for (const name of ['Nama', 'Resolusi', 'FPS', 'Lokasi', 'Status Kalibrasi']) {
    await expect(page.getByRole('columnheader', { name, exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Tambah Kamera', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tambah Kamera Baru' })).toBeVisible()
  await page.getByRole('button', { name: 'Batal' }).click()
  await expect(page.getByRole('heading', { name: 'Tambah Kamera Baru' })).not.toBeVisible()
})

for (const view of [
  { route: 'calibrations', title: 'Manajemen Kalibrasi', action: 'Buat Kalibrasi Baru', columns: ['Versi', 'RMS Reprojection', 'Chessboard', 'Status'] },
  { route: 'ground-references', title: 'Referensi Tanah', action: 'Tambah Referensi Baru', columns: ['Versi', 'Jumlah Titik', 'Satuan', 'Status'] },
  { route: 'predictions', title: 'Prediksi Volume Sampah', action: 'Jalankan Prediksi Baru', columns: ['Job ID', 'Sumber', 'Status'] },
]) {
  test(`${view.title}: empty camera scope disables creation`, async ({ page }) => {
    await page.goto(`/dashboard/${view.route}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(view.title)
    await expect(page.getByRole('combobox').first()).toBeVisible()
    for (const name of view.columns) await expect(page.getByRole('columnheader', { name, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: view.action, exact: true })).toBeDisabled()
  })
}

test('Prediction source options do not offer working RTSP', async ({ page }) => {
  await installApiFixture(page, true, [camera])
  await page.goto('/dashboard/predictions')
  await expect(page.getByRole('combobox').first()).toHaveValue(camera.id)
  await page.getByRole('button', { name: 'Jalankan Prediksi Baru', exact: true }).click()
  const source = page.getByRole('combobox').nth(1)
  await expect(source.locator('option[value="rtsp_frame"]')).toBeDisabled()
  await expect(source.locator('option[value="latest_rtsp"]')).toBeDisabled()
  await page.getByRole('button', { name: 'Batal' }).click()
})

test('Mobile navigation opens and navigates', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Buka menu navigasi' }).click()
  const menu = page.locator('#mobile-menu')
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Beranda', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
})
