import { describe, expect, it } from 'vitest'
import { calibrationPayload, createCalibrationForm, type CalibrationForm } from '@/lib/calibration-form'

const files = Array.from({ length: 10 }, (_, index) =>
  new File(['ui-fixture'], `chessboard-ui-${index}.png`, { type: 'image/png' }),
)

describe('calibration form payload', () => {
  it('preserves defaults, Alpha zero and the original File objects; omits empty notes', () => {
    const payload = calibrationPayload(createCalibrationForm(), files)
    expect(payload).toEqual({ chessboard_cols: 9, chessboard_rows: 6, square_m: 0.025, alpha: 0, notes: undefined, files })
    expect(payload.files).toBe(files)
  })

  it('converts numeric input strings without changing units or notes', () => {
    expect(calibrationPayload({ chessboard_cols: '8', chessboard_rows: '7', square_m: '0.03', alpha: '0.5', notes: 'Catatan fixture UI' }, files))
      .toEqual({ chessboard_cols: 8, chessboard_rows: 7, square_m: 0.03, alpha: 0.5, notes: 'Catatan fixture UI', files })
  })

  it('requires at least ten selected files without claiming they are valid chessboards', () => {
    expect(() => calibrationPayload(createCalibrationForm(), files.slice(0, 9))).toThrow('Minimal 10 gambar')
  })

  it.each(['chessboard_cols', 'chessboard_rows', 'square_m', 'alpha'] as const)('rejects an empty %s instead of converting it to zero', (field) => {
    expect(() => calibrationPayload({ ...createCalibrationForm(), [field]: '' }, files)).toThrow('wajib diisi')
    expect(() => calibrationPayload({ ...createCalibrationForm(), [field]: '  ' }, files)).toThrow('wajib diisi')
  })

  it.each<[keyof CalibrationForm, string | number]>([
    ['chessboard_cols', 2], ['chessboard_cols', 51], ['chessboard_cols', 9.5],
    ['chessboard_rows', 0], ['chessboard_rows', 51], ['chessboard_rows', 'invalid'],
    ['square_m', 0], ['square_m', 1.1], ['square_m', NaN],
    ['alpha', -0.01], ['alpha', 1.01], ['alpha', Infinity],
  ])('rejects invalid %s=%s', (field, value) => {
    expect(() => calibrationPayload({ ...createCalibrationForm(), [field]: value }, files)).toThrow('harus')
  })
})
