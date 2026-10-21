import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/services/api'
import { activateCalibration, createCalibration, deleteCalibration, getUndistortPreview, listCalibrations } from '@/services/calibrations'
import { calibrationPayload, createCalibrationForm } from '@/lib/calibration-form'
import { calibration, camera } from '../../e2e/fixtures/api'

afterEach(() => vi.restoreAllMocks())

describe('calibration service requests', () => {
  it('posts exact multipart fields, repeated files, Alpha zero and no manual boundary', async () => {
    const files = Array.from({ length: 10 }, (_, index) => new File(['fixture'], `ui-${index}.png`, { type: 'image/png' }))
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: calibration })
    await expect(createCalibration(camera.id, calibrationPayload(createCalibrationForm(), files))).resolves.toEqual(calibration)
    expect(post).toHaveBeenCalledTimes(1)
    const call = post.mock.calls[0]!
    expect(call).toHaveLength(2)
    expect(call[0]).toBe(`/cameras/${camera.id}/calibrations`)
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
    expect(get).toHaveBeenCalledWith(`/cameras/${camera.id}/calibrations`)
    expect(post).toHaveBeenCalledWith(`/cameras/${camera.id}/calibrations/${calibration.id}/activate`)
    expect(remove).toHaveBeenCalledWith(`/cameras/${camera.id}/calibrations/${calibration.id}`)
  })

  it('uses only the returned preview URL through the existing resolver', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { preview_url: 'https://artifacts.example.test/returned.png' } })
    await expect(getUndistortPreview(camera.id, calibration.id)).resolves.toBe('https://artifacts.example.test/returned.png')
    expect(get).toHaveBeenCalledWith(`/cameras/${camera.id}/calibrations/${calibration.id}/undistort-preview`)
  })

  it('normalizes backend failures for inline feedback', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { detail: 'Only 0 valid images; minimum 10 required' } } })
    await expect(createCalibration(camera.id, { chessboard_cols: 9, chessboard_rows: 6, square_m: 0.025, alpha: 0, files: [] }))
      .rejects.toMatchObject({ status: 400, message: 'Only 0 valid images; minimum 10 required' })
  })
})
