import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient, setConnection } from '@/services/api'
import { activateCalibration, createCalibration, deleteCalibration, getUndistortPreview, listCalibrations } from '@/services/calibrations'
import { calibrationPayload, createCalibrationForm } from '@/lib/calibration-form'
import { calibration, camera } from '../../e2e/fixtures/api'

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
  setConnection('http://sivera-ui.test', 'ui-fixture-not-a-credential')
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('calibration service requests', () => {
  it('posts exact multipart fields, repeated files, Alpha zero and no manual boundary', async () => {
    const files = Array.from({ length: 10 }, (_, index) => new File(['fixture'], `ui-${index}.png`, { type: 'image/png' }))
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: calibration })
    await expect(createCalibration(camera.id, calibrationPayload(createCalibrationForm(), files))).resolves.toEqual(calibration)
    expect(post).toHaveBeenCalledTimes(1)
    const call = post.mock.calls[0]!
    expect(call).toHaveLength(2)
    expect(call[0]).toBe(`/api/v1/cameras/${camera.id}/calibrations`)
    const form = call[1] as FormData
    expect(form).toBeInstanceOf(FormData)
    expect(Array.from(form.keys())).toEqual(['chessboard_cols', 'chessboard_rows', 'square_m', 'alpha', ...files.map(() => 'files')])
    expect(['chessboard_cols', 'chessboard_rows', 'square_m', 'alpha'].map(key => form.get(key))).toEqual(['9', '6', '0.025', '0'])
    expect(form.has('notes')).toBe(false)
    expect(form.getAll('files')).toEqual(files)
  })

  it('sends optional notes unchanged', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: calibration })
    await createCalibration(camera.id, { chessboard_cols: 8, chessboard_rows: 7, square_m: 0.03, alpha: 1, notes: '<b>Catatan UI</b>', files: [] })
    expect((post.mock.calls[0]![1] as FormData).get('notes')).toBe('<b>Catatan UI</b>')
  })

  it('uses UUID paths for listing, activation and deletion without extra payloads', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { items: [calibration], total: 1 } })
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { calibration_id: calibration.id, is_active: true, message: 'Activated' } })
    const remove = vi.spyOn(apiClient, 'delete').mockResolvedValue({ status: 204 })
    await expect(listCalibrations(camera.id)).resolves.toEqual({ items: [calibration], total: 1 })
    await activateCalibration(camera.id, calibration.id)
    await deleteCalibration(camera.id, calibration.id)
    expect(get).toHaveBeenCalledWith(`/api/v1/cameras/${camera.id}/calibrations`)
    expect(post).toHaveBeenCalledWith(`/api/v1/cameras/${camera.id}/calibrations/${calibration.id}/activate`)
    expect(remove).toHaveBeenCalledWith(`/api/v1/cameras/${camera.id}/calibrations/${calibration.id}`)
  })

  it('fetches only the returned trusted preview URL with authentication', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { preview_url: '/files/returned.png' } })
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('image', { headers: { 'Content-Type': 'image/png' } }))
    vi.stubGlobal('fetch', fetch)
    const blob = await getUndistortPreview(camera.id, calibration.id)
    expect(blob.type).toBe('image/png')
    expect(fetch).toHaveBeenCalledWith('http://sivera-ui.test/files/returned.png', expect.objectContaining({ headers: { 'X-API-Key': 'ui-fixture-not-a-credential' }, redirect: 'error', credentials: 'omit' }))
    expect(get).toHaveBeenCalledWith(`/api/v1/cameras/${camera.id}/calibrations/${calibration.id}/undistort-preview`)
  })

  it('rejects external previews before sending a key and rejects non-image responses', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { preview_url: 'https://artifacts.example.test/returned.png' } })
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    await expect(getUndistortPreview(camera.id, calibration.id)).rejects.toMatchObject({ status: null })
    expect(fetch).not.toHaveBeenCalled()
    get.mockResolvedValue({ data: { preview_url: '/files/returned.png' } })
    await expect(getUndistortPreview(camera.id, calibration.id)).rejects.toMatchObject({ message: 'Berkas preview bukan gambar yang didukung.' })
  })

  it('normalizes backend failures for inline feedback', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { detail: 'Only 0 valid images; minimum 10 required' } } })
    await expect(createCalibration(camera.id, { chessboard_cols: 9, chessboard_rows: 6, square_m: 0.025, alpha: 0, files: [] }))
      .rejects.toMatchObject({ status: 400, message: 'Only 0 valid images; minimum 10 required' })
  })
})
