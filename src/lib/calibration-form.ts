import type { CreateCalibrationPayload } from '@/services/calibrations'

export interface CalibrationForm {
  chessboard_cols: string | number
  chessboard_rows: string | number
  square_m: string | number
  alpha: string | number
  notes: string
}

export function createCalibrationForm(): CalibrationForm {
  return { chessboard_cols: 9, chessboard_rows: 6, square_m: 0.025, alpha: 0, notes: '' }
}

function numericValue(value: string | number, label: string, min: number, max: number, integer = false): number {
  if (typeof value === 'string' && value.trim() === '') throw new Error(`${label} wajib diisi.`)
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
    throw new Error(`${label} harus ${integer ? 'berupa bilangan bulat' : 'bernilai'} antara ${min} dan ${max}.`)
  }
  return number
}

export function calibrationPayload(form: CalibrationForm, files: File[]): CreateCalibrationPayload {
  if (files.length < 10) throw new Error('Minimal 10 gambar chessboard diperlukan. Backend akan memeriksa validitas gambar.')
  return {
    chessboard_cols: numericValue(form.chessboard_cols, 'Chessboard Cols', 3, 50, true),
    chessboard_rows: numericValue(form.chessboard_rows, 'Chessboard Rows', 3, 50, true),
    square_m: numericValue(form.square_m, 'Square Size', 0.001, 1),
    alpha: numericValue(form.alpha, 'Alpha', 0, 1),
    notes: form.notes || undefined,
    files,
  }
}
