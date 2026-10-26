import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DepthScaleForm from '@/components/depth-scales/DepthScaleForm.vue'
import * as api from '@/services/depthScales'
import { apiErrorFromResponse, setConnection } from '@/services/api'
import { calibration, camera, depthScale, groundModel } from '../../e2e/fixtures/api'

const source = `cameras/${camera.id}/depth-scale-images/${groundModel.id}/fixture/source.image`
let wrapper: VueWrapper

beforeEach(() => {
  setConnection('http://sivera-ui.test', 'ui-fixture-not-a-credential')
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn().mockReturnValue('blob:depth-preview')
    static revokeObjectURL = vi.fn()
  })
  vi.spyOn(api, 'getDepthScaleContext').mockResolvedValue({ calibration, groundModel })
  vi.spyOn(api, 'uploadDepthScaleImage').mockResolvedValue({
    image_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', test_image: source,
    image_url: '/returned-image', width: 1920, height: 1080,
    coordinate_system: 'undistorted_pixels', distance_type: 'camera_axis_z_m',
  })
  vi.spyOn(api, 'fetchDepthScaleImageBlob').mockResolvedValue(new Blob(['preview'], { type: 'image/png' }))
  vi.spyOn(api, 'createDepthScale').mockResolvedValue(depthScale)
  wrapper = mount(DepthScaleForm, { props: { cameraId: camera.id, context: { calibration, groundModel } } })
})
afterEach(() => { wrapper.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function upload() {
  const input = wrapper.get('#depth-image')
  Object.defineProperty(input.element, 'files', { value: [new File(['source'], 'source.png', { type: 'image/png' })], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

async function decoded() {
  const image = wrapper.get('img')
  Object.defineProperty(image.element, 'naturalWidth', { value: 1920, configurable: true })
  Object.defineProperty(image.element, 'naturalHeight', { value: 1080, configurable: true })
  await image.trigger('load')
}

async function points() {
  for (let i = 1; i <= 3; i++) {
    await wrapper.findAll('button').find(button => button.text() === 'Tambah Titik Manual')!.trigger('click')
    await wrapper.get(`[aria-label="X titik ${i} (pixel)"]`).setValue(String(i * 10))
    await wrapper.get(`[aria-label="Y titik ${i} (pixel)"]`).setValue('20')
    await wrapper.get(`[aria-label="Kedalaman Z titik ${i} (m)"]`).setValue(String(i))
  }
}

describe('depth scale workflow (mock services, real form/editor)', () => {
  it('waits for a decoded preview, recovers a decode error, and submits the matching source once', async () => {
    await upload()
    const submit = () => wrapper.get('button[type="submit"]')
    expect(submit().attributes('disabled')).toBeDefined()
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('[role="alert"]').text()).toContain('Preview tidak dapat ditampilkan')
    await wrapper.findAll('button').find(button => button.text() === 'Muat Ulang Preview')!.trigger('click')
    await flushPromises()
    await decoded()
    await points()
    expect(submit().attributes('disabled')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.createDepthScale).toHaveBeenCalledExactlyOnceWith(camera.id, groundModel.id, {
      test_image: source, known_distances: [1, 2, 3].map(i => ({ x: i * 10, y: 20, distance_m: i })),
    }, expect.any(AbortSignal))
    expect(wrapper.emitted('created')?.[0]).toEqual([depthScale])
  })

  it.each([
    [409, 'depth_scale_identity_missing'], [409, 'depth_scale_model_mismatch'],
    [409, 'depth_scale_invalid_saved_fit'], [503, 'depth_model_unavailable'],
  ] as const)('preserves centralized recovery for %s %s', async (status, code) => {
    const error = apiErrorFromResponse(status, { detail: { code } })
    vi.mocked(api.createDepthScale).mockRejectedValue(error)
    await upload(); await decoded(); await points()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain(error.message)
    expect(wrapper.emitted('created')).toBeUndefined()
    expect(wrapper.emitted('uncertain')).toBeUndefined()
  })

  it('treats persistence 503 as uncertain and offers reconciliation without another POST', async () => {
    vi.mocked(api.createDepthScale).mockRejectedValue(apiErrorFromResponse(503, { detail: { code: 'depth_scale_persistence_unavailable' } }))
    await upload(); await decoded(); await points()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Hasil belum dapat dipastikan')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(api.createDepthScale).toHaveBeenCalledTimes(1)
    await wrapper.findAll('button').find(button => button.text() === 'Periksa Hasil')!.trigger('click')
    expect(wrapper.emitted('reconcile')).toHaveLength(1)
  })
})
