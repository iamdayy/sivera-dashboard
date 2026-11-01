import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePublicWhepPlayer } from '@/composables/usePublicWhepPlayer'
import { closePublicWhepSession, getPublicWhepCapabilities, openPublicWhepSession } from '@/services/publicWhep'
import { camera, calibration } from '../../e2e/fixtures/api'

vi.mock('@/services/publicWhep', () => ({
  closePublicWhepSession: vi.fn(),
  getPublicWhepCapabilities: vi.fn(),
  openPublicWhepSession: vi.fn(),
}))

class Peer extends EventTarget {
  connectionState: RTCPeerConnectionState = 'new'
  createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'v=0\r\n' })
  setLocalDescription = vi.fn().mockResolvedValue(undefined)
  setRemoteDescription = vi.fn().mockResolvedValue(undefined)
  getSenders = () => []
  getReceivers = () => []
  close = vi.fn()
}

const session = { cameraId: camera.id, location: `http://sivera-public.test/api/v1/public/cameras/${camera.id}/stream/whep/${calibration.id}`, etag: '"first"' }
const onError = vi.fn()
let wrapper: ReturnType<typeof mount>

function setup() {
  let player!: ReturnType<typeof usePublicWhepPlayer>
  wrapper = mount(defineComponent({
    setup() {
      player = usePublicWhepPlayer({ cameraId: camera.id, onError })
      return () => h('div')
    },
  }))
  return player
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('RTCPeerConnection', Peer)
  vi.mocked(getPublicWhepCapabilities).mockResolvedValue({ acceptPost: 'application/sdp', acceptPatch: null, iceServers: [] })
  vi.mocked(openPublicWhepSession).mockResolvedValue({ session, answer: 'v=0\r\n', iceServers: [] })
  vi.mocked(closePublicWhepSession).mockResolvedValue({ status: 'deleted' })
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('public WHEP player diagnostics', () => {
  it('preserves a plain-object signaling error through cleanup', async () => {
    const message = 'Respons signaling WHEP tidak valid. Periksa konfigurasi backend dan CORS.'
    vi.mocked(getPublicWhepCapabilities).mockRejectedValue({ status: null, message, sessionMayRemain: false })
    const player = setup()
    await player.connect()
    expect(player.state.value).toMatchObject({ status: 'failed', error: message })
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message }))
    expect(openPublicWhepSession).not.toHaveBeenCalled()
  })

  it('waits for the peer connection before reporting connected and deletes on cleanup', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const player = setup()
    await player.connect()
    expect(player.state.value.status).toBe('connecting')
    expect(log).not.toHaveBeenCalled()
    const peer = player.peer.value as unknown as Peer
    peer.connectionState = 'connected'
    peer.dispatchEvent(new Event('connectionstatechange'))
    expect(player.state.value).toMatchObject({ status: 'connected', connectionState: 'connected' })
    await player.cleanup()
    expect(closePublicWhepSession).toHaveBeenCalledWith(session)
    expect(peer.close).toHaveBeenCalledOnce()
    expect(player.state.value.status).toBe('disconnected')
  })

  it('cleans up a rejected remote answer while retaining the browser error', async () => {
    const peer = new Peer()
    peer.setRemoteDescription.mockRejectedValueOnce(new Error('SDP answer ditolak browser.'))
    vi.stubGlobal('RTCPeerConnection', vi.fn(function () { return peer }))
    const player = setup()
    await player.connect()
    expect(player.state.value).toMatchObject({ status: 'failed', error: 'SDP answer ditolak browser.' })
    expect(closePublicWhepSession).toHaveBeenCalledWith(session)
    expect(peer.close).toHaveBeenCalledOnce()
  })

  it('closes the session when the document leaves, including a full-page navigation', async () => {
    const player = setup()
    await player.connect()
    const peer = player.peer.value as unknown as Peer
    window.dispatchEvent(new Event('pagehide'))
    expect(peer.close).toHaveBeenCalledOnce()
    await flushPromises()
    expect(closePublicWhepSession).toHaveBeenCalledWith(session)
    expect(player.state.value.status).toBe('disconnected')
  })

  it('aborts pending capabilities and prevents a peer or offer after unmount', async () => {
    let finish!: (value: Awaited<ReturnType<typeof getPublicWhepCapabilities>>) => void
    vi.mocked(getPublicWhepCapabilities).mockReturnValue(new Promise(resolve => { finish = resolve }))
    const player = setup()
    const connecting = player.connect()
    wrapper.unmount()
    expect(vi.mocked(getPublicWhepCapabilities).mock.calls[0]![1]?.aborted).toBe(true)
    finish({ acceptPost: 'application/sdp', acceptPatch: null, iceServers: [] })
    await connecting
    expect(player.peer.value).toBeNull()
    expect(openPublicWhepSession).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('deletes a late offer response instead of resurrecting an unmounted player', async () => {
    let finish!: (value: Awaited<ReturnType<typeof openPublicWhepSession>>) => void
    vi.mocked(openPublicWhepSession).mockReturnValue(new Promise(resolve => { finish = resolve }))
    const player = setup()
    const connecting = player.connect()
    await vi.waitFor(() => expect(openPublicWhepSession).toHaveBeenCalledOnce())
    const peer = player.peer.value as unknown as Peer
    wrapper.unmount()
    expect(vi.mocked(openPublicWhepSession).mock.calls[0]![2]?.aborted).toBe(true)
    finish({ session, answer: 'v=0\r\n', iceServers: [] })
    await connecting
    expect(closePublicWhepSession).toHaveBeenCalledWith(session)
    expect(peer.setRemoteDescription).not.toHaveBeenCalled()
    expect(player.session.value).toBeNull()
    expect(onError).not.toHaveBeenCalled()
  })
})
