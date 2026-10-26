import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PredictionResultSummary from '@/components/PredictionResultSummary.vue'
import { volumeEstimate } from './fixtures/prediction'

describe('PredictionResultSummary', () => {
  it('keeps methods separate, exposes their different geometry, and uses API units independently', () => {
    const wrapper = mount(PredictionResultSummary, { props: { volumes: [
      volumeEstimate({ volume_liter: 124 }),
      volumeEstimate({ id: 'hull-fixture', method: 'convex_hull', volume_m3: 0.18, volume_liter: 180, cell_m: null, n_cells: null }),
    ] } })
    expect(wrapper.text()).toContain('0,125')
    expect(wrapper.text()).toContain('124')
    expect(wrapper.text()).toContain('0,180')
    expect(wrapper.text()).toContain('180')
    expect(wrapper.text()).not.toContain('0,305')
    expect(wrapper.text()).toContain('akurasi fisik belum diverifikasi')
    expect(wrapper.text()).toContain('sel batas tetap memakai luas sel penuh')
    expect(wrapper.text()).toContain('bukan volume convex hull 3D')
    expect(wrapper.findAll('summary').map(item => item.text())).toEqual(['Rincian Grid/Voxel', 'Rincian Convex Hull 2D'])
  })

  it('handles missing diagnostics, zero, invalid numbers and unavailable records without a crash', () => {
    const wrapper = mount(PredictionResultSummary, { props: { volumes: [
      volumeEstimate({ volume_m3: 0, volume_liter: 0, height_mean_m: null, n_points: null }),
      volumeEstimate({ id: 'invalid-fixture', method: 'unknown-method', volume_m3: NaN, volume_liter: Infinity }),
    ] } })
    expect(wrapper.text()).toContain('0,000')
    expect(wrapper.text()).not.toMatch(/NaN|Infinity/)
    expect(wrapper.text()).toContain('definisinya belum tersedia')
    expect(wrapper.findAll('dd').filter(item => item.text() === '-')).toHaveLength(4)
    const empty = mount(PredictionResultSummary, { props: { volumes: [] } })
    expect(empty.get('[role="status"]').text()).toContain('Rincian volume belum tersedia')
    expect(empty.findAll('dd')).toHaveLength(0)
  })
})
