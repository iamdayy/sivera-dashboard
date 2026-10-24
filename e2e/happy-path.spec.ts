import { test, expect } from '@playwright/test'
import { camera, installApiFixture } from './fixtures/api'

test.beforeEach(async ({ page }) => {
  await installApiFixture(page)
})

test('Landing page exposes the configuration workflow without live claims', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Estimasi sampah dari kamera')
  await expect(page.getByRole('link', { name: 'Buka Dashboard' }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Alur kerja', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Buka Manajemen Kamera' }).first()).toHaveAttribute('href', '/dashboard/cameras')
  await expect(page.getByText('Panel ini menjelaskan urutan konfigurasi, bukan status kamera Anda.', { exact: false })).toBeVisible()

  const tabs = page.getByRole('tablist', { name: 'Langkah konfigurasi' })
  await expect(tabs.getByRole('tab')).toHaveCount(4)
  await tabs.getByRole('tab', { name: 'Referensi tanah' }).click()
  await expect(tabs.getByRole('tab', { name: 'Referensi tanah' })).toHaveAttribute('aria-selected', 'true')
  const panel = page.getByRole('tabpanel')
  await expect(panel).toContainText('Minimal empat pasangan titik gambar dan dunia.')
  await expect(panel.getByRole('link', { name: 'Buka Referensi Tanah' })).toHaveAttribute('href', '/dashboard/ground-references')

  await tabs.getByRole('tab', { name: 'Kamera' }).focus()
  await page.keyboard.press('ArrowDown')
  await expect(tabs.getByRole('tab', { name: 'Kalibrasi' })).toBeFocused()
  await expect(tabs.getByRole('tab', { name: 'Kalibrasi' })).toHaveAttribute('aria-selected', 'true')
})

test('Dashboard navigation performs real actions', async ({ page }) => {
  await installApiFixture(page, true, [camera])
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ringkasan')
  for (const name of ['Total Kamera', 'Kalibrasi Aktif', 'Referensi Tanah', 'Analisis Selesai']) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
  }
  await page.getByRole('link', { name: 'Kelola Kamera', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard\/cameras$/)
  await page.goto('/dashboard')
  await page.getByRole('link', { name: 'Jalankan Prediksi', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard\/predictions$/)
})

test('Settings validates access against the UI fixture', async ({ page }) => {
  await page.goto('/dashboard/settings')
  await page.getByPlaceholder('Masukkan API Key Anda').fill('ui-fixture-not-a-credential')
  await page.getByRole('button', { name: 'Simpan Konfigurasi' }).click()
  await expect(page.getByRole('alert')).toContainText('Akses camera:read terverifikasi. Izin operasi lain belum diperiksa.')
})

test('Cameras table retains its domain columns', async ({ page }) => {
  await installApiFixture(page, true, [camera])
  await page.goto('/dashboard/cameras')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Manajemen Kamera')
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
  { route: 'predictions', title: 'Analisis Sampah', action: 'Jalankan Prediksi Baru', columns: [] },
]) {
  test(`${view.title}: empty camera scope disables creation`, async ({ page }) => {
    await installApiFixture(page, true)
    await page.goto(`/dashboard/${view.route}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(view.title)
    await expect(page.getByRole('combobox').first()).toBeVisible()
    for (const name of view.columns) await expect(page.getByRole('columnheader', { name, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: view.action, exact: true })).toBeDisabled()
  })
}

test('Prediction source options offer RTSP sources', async ({ page }) => {
  await installApiFixture(page, true, [camera])
  await page.goto('/dashboard/predictions')
  for (const name of ['Job ID', 'Sumber', 'Status']) {
    await expect(page.getByRole('columnheader', { name, exact: true })).toBeVisible()
  }
  await expect(page.getByRole('combobox').first()).toHaveValue(camera.id)
  await page.getByRole('button', { name: 'Jalankan Prediksi Baru', exact: true }).click()
  const source = page.locator('#pred-source-type')
  await expect(source.locator('option[value="rtsp_frame"]')).toBeEnabled()
  await expect(source.locator('option[value="latest_rtsp"]')).toBeEnabled()
  await expect(source.locator('option[value="upload"]')).toBeEnabled()
  await page.getByRole('button', { name: 'Batal' }).click()
  await expect(page.getByRole('heading', { name: 'Jalankan Prediksi Baru', exact: true })).not.toBeVisible()
})

test('Mobile navigation opens and navigates', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Buka menu navigasi' }).click()
  const sidebar = page.locator('#sidebar')
  await expect(sidebar).toBeVisible()
  await sidebar.getByRole('link', { name: 'Kamera', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard\/cameras$/)
  await expect(sidebar).toHaveAttribute('aria-hidden', 'true')
})
