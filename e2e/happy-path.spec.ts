import { test, expect } from '@playwright/test'

/**
 * E2E Happy Path: Login → Camera → Calibration → Ground Ref → Predict
 *
 * PREREQUISITES (manual setup before running):
 * 1. Backend stack running: `docker-compose up -d` (api, worker, redis, postgres)
 * 2. API Key valid dengan scope camera:write, calibration:write, ground_ref:write, predict:write
 * 3. Minimal 10 gambar chessboard (JPG/PNG) untuk kalibrasi
 * 4. 1 gambar prediksi (JPG/PNG) untuk testing prediksi
 * 5. Model weights tersedia di backend (YOLO seg, depth)
 *
 * To run: `bun test:e2e --project=chromium e2e/happy-path.spec.ts`
 */

const API_KEY = process.env.SIVERA_API_KEY || 'wst_dev_key_12345'

test.describe.configure({ retries: 0 })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
})

test('Landing page: renders and has CTA to dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1:has-text("Sivera Dashboard")')).toBeVisible()
  await expect(page.locator('a:has-text("Buka Dashboard")')).toBeVisible()
  await expect(page.locator('text=Manajemen Kamera').first()).toBeVisible()
  await expect(page.locator('text=Prediksi Volume Sampah').first()).toBeVisible()
})

test('Dashboard: navigate and verify Home.vue sections', async ({ page }) => {
  await page.goto('/dashboard')
  // Dashboard renders Home.vue (default child) with stats cards
  await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 10000 })

  // Check stats cards (from Home.vue)
  await expect(page.locator('text=Total Kamera')).toBeVisible()
  await expect(page.locator('text=Kalibrasi Aktif')).toBeVisible()
  await expect(page.locator('text=Referensi Tanah')).toBeVisible()

  // Quick action buttons (from Home.vue)
  await expect(page.locator('button:has-text("Kelola Kamera")')).toBeVisible()
  await expect(page.locator('button:has-text("Kalibrasi")')).toBeVisible()
  await expect(page.locator('button:has-text("Jalankan Prediksi")')).toBeVisible()

  // Navigation links in header
  await expect(page.locator('nav a:has-text("Dashboard")').first()).toBeVisible()
  await expect(page.locator('nav a:has-text("Beranda")').first()).toBeVisible()
})

test('Settings: set API key and verify connection', async ({ page }) => {
  await page.goto('/dashboard/settings')
  await page.waitForSelector('h1:has-text("Pengaturan")', { timeout: 10000 })

  // Fill API Base URL
  await page.fill('input[placeholder="http://localhost:8000"]', 'http://localhost:8000')
  // Fill API Key
  await page.fill('input[placeholder="Masukkan API Key Anda"]', API_KEY)
  // Click save
  await page.click('button:has-text("Simpan Konfigurasi")')

  // Wait for connection test result (new API key validation)
  await expect(page.locator('text=API Key valid dan memiliki akses').first()).toBeVisible({ timeout: 10000 })
})

test('Cameras: open page and verify structure', async ({ page }) => {
  await page.goto('/dashboard/cameras')
  await page.waitForSelector('h1:has-text("Manajemen Kamera")', { timeout: 10000 })

  // Create button
  await expect(page.locator('button:has-text("Tambah Kamera")')).toBeVisible()

  // Table headers
  await expect(page.locator('th:has-text("Nama")')).toBeVisible()
  await expect(page.locator('th:has-text("Resolusi")')).toBeVisible()
  await expect(page.locator('th:has-text("FPS")')).toBeVisible()
  await expect(page.locator('th:has-text("Lokasi")')).toBeVisible()
  await expect(page.locator('th:has-text("Status Kalibrasi")')).toBeVisible()
})

test('Calibrations: open page and verify structure', async ({ page }) => {
  await page.goto('/dashboard/calibrations')
  await page.waitForSelector('h1:has-text("Manajemen Kalibrasi")', { timeout: 10000 })

  // Camera selector
  await expect(page.locator('select')).toBeVisible()

  // Table headers
  await expect(page.locator('th:has-text("Versi")')).toBeVisible()
  await expect(page.locator('th:has-text("RMS Reprojection")')).toBeVisible()
  await expect(page.locator('th:has-text("Chessboard")')).toBeVisible()
  await expect(page.locator('th:has-text("Status")')).toBeVisible()

  // Create button (disabled until camera selected)
  await expect(page.locator('button:has-text("Buat Kalibrasi Baru")')).toBeDisabled()
})

test('Ground References: open page and verify structure', async ({ page }) => {
  await page.goto('/dashboard/ground-references')
  await page.waitForSelector('h1:has-text("Referensi Tanah")', { timeout: 10000 })

  // Camera selector
  await expect(page.locator('select')).toBeVisible()

  // Table headers
  await expect(page.locator('th:has-text("Versi")')).toBeVisible()
  await expect(page.locator('th:has-text("Jumlah Titik")')).toBeVisible()
  await expect(page.locator('th:has-text("Satuan")')).toBeVisible()
  await expect(page.locator('th:has-text("Status")')).toBeVisible()

  // Create button (disabled until camera selected)
  await expect(page.locator('button:has-text("Tambah Referensi Baru")')).toBeDisabled()
})

test('Predictions: open page and verify structure', async ({ page }) => {
  await page.goto('/dashboard/predictions')
  await page.waitForSelector('h1:has-text("Prediksi Volume Sampah")', { timeout: 10000 })

  // Camera selector
  const cameraSelect = page.locator('select').first()
  await expect(cameraSelect).toBeVisible()

  // Table headers
  await expect(page.locator('th:has-text("Job ID")')).toBeVisible()
  await expect(page.locator('th:has-text("Sumber")')).toBeVisible()
  await expect(page.locator('th:has-text("Status")')).toBeVisible()

  // Create button (disabled until camera selected)
  await expect(page.locator('button:has-text("Jalankan Prediksi Baru")')).toBeDisabled()

  // Check if there are cameras available
  const options = await cameraSelect.locator('option').all()
  if (options.length > 1) {
    // Select first camera
    await cameraSelect.selectOption({ index: 1 })

    // Create button should now be enabled
    await expect(page.locator('button:has-text("Jalankan Prediksi Baru")')).not.toBeDisabled()

    // Open modal to check RTSP options
    await page.click('button:has-text("Jalankan Prediksi Baru")')
    await page.waitForSelector('h2:has-text("Jalankan Prediksi Baru")', { timeout: 5000 })

    // RTSP options should be disabled
    await expect(page.locator('select option[value="rtsp_frame"]')).toHaveAttribute('disabled', '')
    await expect(page.locator('select option[value="latest_rtsp"]')).toHaveAttribute('disabled', '')

    // Close modal
    await page.click('button:has-text("Batal")')
  }
})

test('Mobile navigation works', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard')
  await expect(page.locator('button[aria-label="Buka menu navigasi"]')).toBeVisible()

  // Open mobile menu
  await page.click('button[aria-label="Buka menu navigasi"]')
  // Wait for mobile menu panel to appear (Headless UI Transition)
  await expect(page.locator('#mobile-menu')).toBeVisible({ timeout: 2000 })
  // Menu items should be inside the panel
  await expect(page.locator('#mobile-menu a:has-text("Beranda")')).toBeVisible()
  await expect(page.locator('#mobile-menu a:has-text("Dashboard")')).toBeVisible()
})