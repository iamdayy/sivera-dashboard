import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import VolumeChart from '@/components/dashboard/VolumeChart.vue'

function point(jobId: string, day: number, volumeM3: number, method = 'grid') {
  return {
    jobId,
    createdAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00Z`,
    method,
    volumeM3,
    volumeLiter: volumeM3 * 1000,
  }
}

describe('VolumeChart', () => {
  it('renders SVG paths as strings and spreads chronological points across the plot', () => {
    const data = [point('newer', 23, 2), point('older', 22, 0)]
    const wrapper = mount(VolumeChart, { props: { data } })

    expect(wrapper.get('path[fill="none"]').attributes('d')).toBe('M 10,90 L 90,10')
    expect(wrapper.get('path[fill="url(#area-gradient)"]').attributes('d')).toBe('M 10,90 L 10,90 L 90,10 L 90,90 Z')
    expect(wrapper.findAll('circle').slice(0, 2).map(dot => dot.attributes('cx'))).toEqual(['10', '90'])
    expect(data.map(item => item.jobId)).toEqual(['newer', 'older'])
  })

  it('keeps a measured zero and handles a single latest point without an undefined coordinate', () => {
    const wrapper = mount(VolumeChart, { props: { data: [point('zero', 23, 0)] } })

    expect(wrapper.text()).not.toContain('Belum ada data volume')
    expect(wrapper.get('.latest-point').attributes()).toMatchObject({ cx: '50', cy: '50' })
    expect(wrapper.get('path[fill="none"]').attributes('d')).toBe('M 50,50')
  })

  it('renders an empty state without a latest point when the selected method has no data', () => {
    const wrapper = mount(VolumeChart, {
      props: { data: [point('grid-only', 23, 1)], selectedMethod: 'convex_hull' },
    })

    expect(wrapper.text()).toContain('Belum ada data volume')
    expect(wrapper.find('svg.chart-svg').exists()).toBe(false)
    expect(wrapper.find('.latest-point').exists()).toBe(false)
  })

  it('limits the series to the latest points of the selected method and responds to unit changes', async () => {
    const wrapper = mount(VolumeChart, {
      props: {
        data: [point('old', 20, 1), point('middle', 21, 2), point('new', 22, 3), point('hull', 23, 10, 'convex_hull')],
        maxPoints: 2,
        cameraName: 'Kamera uji',
      },
    })

    expect(wrapper.attributes('aria-label')).toContain('2 analisis terbaru')
    expect(wrapper.findAll('.axis-labels')[0]?.text()).toContain('3.000')
    await wrapper.setProps({ unit: 'liter' })
    expect(wrapper.attributes('aria-label')).toContain('(L)')
    expect(wrapper.findAll('.axis-labels')[0]?.text()).toContain('3000')
    await wrapper.setProps({ selectedMethod: 'convex_hull' })
    expect(wrapper.attributes('aria-label')).toContain('1 analisis terbaru')
  })
})
