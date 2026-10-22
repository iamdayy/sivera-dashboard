import { Blob as NodeBlob } from 'node:buffer'
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AuthenticatedArtifact from '@/components/AuthenticatedArtifact.vue'
import * as artifacts from '@/services/artifacts'
import { setConnection } from '@/services/api'

const create = vi.fn()
const revoke = vi.fn()

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke })
  create.mockReset().mockReturnValue('blob:authenticated-fixture')
  revoke.mockReset()
  setConnection('http://sivera-ui.test', 'ui-fixture-not-a-credential')
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('authenticated artifact component', () => {
  it('shows loading then an authenticated image and downloads only its object URL', async () => {
    let finish!: (blob: Blob) => void
    const fetch = vi.spyOn(artifacts, 'fetchArtifactBlob').mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const wrapper = mount(AuthenticatedArtifact, { props: { path: '/files/returned.png', label: 'overlay' } })
    expect(wrapper.get('[role="status"]').text()).toContain('Memuat overlay')
    expect(wrapper.find('img').exists()).toBe(false)
    finish(new Blob(['image'], { type: 'image/png' }))
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/files/returned.png', expect.objectContaining({ origin: 'http://sivera-ui.test' }), expect.any(AbortSignal))
    expect(wrapper.get('img').attributes('src')).toBe('blob:authenticated-fixture')
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe('blob:authenticated-fixture')
      expect(this.download).toBe('overlay')
    })
    await wrapper.get('button').trigger('click')
    expect(click).toHaveBeenCalledOnce()
    wrapper.unmount()
    expect(revoke).toHaveBeenCalledWith('blob:authenticated-fixture')
  })

  it('does not create a URL on failure, and offers a working explicit retry', async () => {
    const fetch = vi.spyOn(artifacts, 'fetchArtifactBlob').mockRejectedValueOnce({ status: 403, message: 'Akses ditolak.' }).mockResolvedValueOnce(new Blob(['{}'], { type: 'application/json' }))
    const wrapper = mount(AuthenticatedArtifact, { props: { path: '/files/output.json', label: 'instances_json' } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Akses ditolak.')
    expect(create).not.toHaveBeenCalled()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('application/json')
    expect(wrapper.get('button').text()).toBe('Unduh instances_json')
    wrapper.unmount()
  })

  it('aborts replaced requests and ignores their late successful responses', async () => {
    let finish!: (blob: Blob) => void
    const fetch = vi.spyOn(artifacts, 'fetchArtifactBlob').mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce(new Blob(['new'], { type: 'image/jpeg' }))
    const wrapper = mount(AuthenticatedArtifact, { props: { path: '/files/old.png', label: 'preview' } })
    const firstSignal = fetch.mock.calls[0]![2]!
    await wrapper.setProps({ path: '/files/new.png' })
    await flushPromises()
    expect(firstSignal.aborted).toBe(true)
    finish(new Blob(['old'], { type: 'image/png' }))
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(1)
    expect((create.mock.calls[0]![0] as Blob).type).toBe('image/jpeg')
    wrapper.unmount()
  })

  it('clears a preview on connection change and does not resurrect pending content', async () => {
    let finish!: (blob: Blob) => void
    vi.spyOn(artifacts, 'fetchArtifactBlob').mockResolvedValueOnce(new Blob(['image'], { type: 'image/png' })).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const wrapper = mount(AuthenticatedArtifact, { props: { path: '/files/first.png', label: 'preview' } })
    await flushPromises()
    await wrapper.setProps({ path: '/files/second.png' })
    setConnection('http://other-sivera.test', 'replacement-fixture')
    finish(new Blob(['late'], { type: 'image/png' }))
    await flushPromises()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('Koneksi berubah')
    expect(create).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:authenticated-fixture')
    wrapper.unmount()
  })

  it('ignores successful content that arrives after unmount', async () => {
    let finish!: (blob: Blob) => void
    const fetch = vi.spyOn(artifacts, 'fetchArtifactBlob').mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const wrapper = mount(AuthenticatedArtifact, { props: { path: '/files/image.png', label: 'preview' } })
    wrapper.unmount()
    expect(fetch.mock.calls[0]![2]!.aborted).toBe(true)
    finish(new Blob(['late'], { type: 'image/png' }))
    await flushPromises()
    expect(create).not.toHaveBeenCalled()
  })

  it('reports decode errors while retaining the authenticated download fallback', async () => {
    vi.spyOn(artifacts, 'fetchArtifactBlob').mockResolvedValue(new Blob(['invalid image'], { type: 'image/png' }))
    const wrapper = mount(AuthenticatedArtifact, { props: { path: '/files/image.png', label: 'preview' } })
    await flushPromises()
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('[role="alert"]').text()).toContain('tidak dapat ditampilkan')
    expect(wrapper.findAll('button').map(button => button.text())).toEqual(['Coba Lagi', 'Unduh preview'])
    wrapper.unmount()
  })
})
