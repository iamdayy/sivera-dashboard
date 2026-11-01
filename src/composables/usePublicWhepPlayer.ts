import type { PublicWhepCapabilities, PublicWhepSession } from '@/services/publicWhep'
import { normalizeApiError } from '@/services/api'
import {
  closePublicWhepSession,
  getPublicWhepCapabilities,
  openPublicWhepSession,
} from '@/services/publicWhep'
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

export interface UsePublicWhepPlayerOptions {
  cameraId: string
  onStateChange?: (state: UsePublicWhepPlayerState) => void
  onError?: (error: Error) => void
  onTrack?: (track: MediaStreamTrack) => void
}

export interface UsePublicWhepPlayerState {
  status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed'
  error: string | null
  iceConnectionState: RTCIceConnectionState | null
  iceGatheringState: RTCIceGatheringState | null
  connectionState: RTCPeerConnectionState | null
}

export function usePublicWhepPlayer(options: UsePublicWhepPlayerOptions) {
  const { cameraId, onStateChange, onError, onTrack } = options

  const state = ref<UsePublicWhepPlayerState>({
    status: 'idle',
    error: null,
    iceConnectionState: null,
    iceGatheringState: null,
    connectionState: null,
  })

  const peer = shallowRef<RTCPeerConnection | null>(null)
  const session = shallowRef<PublicWhepSession | null>(null)
  const capabilities = shallowRef<PublicWhepCapabilities | null>(null)
  const candidateBuffer: RTCIceCandidateInit[] = []
  let connectionController: AbortController | null = null
  let isClosing = false
  let disposed = false

  function updateState(partial: Partial<UsePublicWhepPlayerState>) {
    state.value = { ...state.value, ...partial }
    onStateChange?.(state.value)
  }

  function handleError(message: string) {
    if (isClosing || disposed) return
    const error = new Error(message)
    updateState({ status: 'failed', error: message })
    onError?.(error)
  }

  function createPeer(iceServers: RTCIceServer[]): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers })
    pc.addEventListener('iceconnectionstatechange', () => {
      if (peer.value !== pc) return
      updateState({ iceConnectionState: pc.iceConnectionState })
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        if (!isClosing) handleError(`Koneksi ICE ${pc.iceConnectionState}.`)
      }
    })
    pc.addEventListener('icegatheringstatechange', () => {
      if (peer.value !== pc) return
      updateState({ iceGatheringState: pc.iceGatheringState })
    })
    pc.addEventListener('connectionstatechange', () => {
      if (peer.value !== pc) return
      updateState({ connectionState: pc.connectionState })
      if (pc.connectionState === 'connected' && !isClosing) {
        updateState({ status: 'connected', error: null })
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        if (!isClosing) handleError(`Koneksi peer ${pc.connectionState}.`)
      }
    })
    pc.addEventListener('track', (event) => {
      if (peer.value !== pc) return
      if (event.track.kind === 'video') {
        onTrack?.(event.track)
      }
    })
    return pc
  }

  async function flushCandidateBuffer(pc: RTCPeerConnection) {
    while (candidateBuffer.length > 0 && pc.remoteDescription) {
      const candidate = candidateBuffer.shift()!
      try {
        await pc.addIceCandidate(candidate)
      } catch (error) {
        console.warn('[Public WHEP] Gagal menambahkan candidate tertunda:', error)
      }
    }
  }

  async function connect() {
    if (peer.value || connectionController || isClosing || disposed) return
    const controller = new AbortController()
    connectionController = controller
    updateState({ status: 'connecting', error: null })

    try {
      const caps = await getPublicWhepCapabilities(cameraId, controller.signal)
      controller.signal.throwIfAborted()
      capabilities.value = caps

      const pc = createPeer(caps.iceServers)
      peer.value = pc

      const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: false })
      controller.signal.throwIfAborted()
      await pc.setLocalDescription(offer)
      controller.signal.throwIfAborted()

      const {
        session: newSession,
        answer,
        iceServers,
      } = await openPublicWhepSession(cameraId, offer.sdp!, controller.signal)
      if (controller.signal.aborted) {
        await closePublicWhepSession(newSession)
        return
      }
      session.value = newSession

      if (iceServers.length > 0 && caps.iceServers.length === 0) {
        pc.setConfiguration({ iceServers })
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: answer } as RTCSessionDescriptionInit)
      await flushCandidateBuffer(pc)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof Error && error.name === 'AbortError') return
      const normalized = normalizeApiError(error)
      if (normalized.cancelled) return
      const message = error instanceof Error ? error.message : normalized.message
      await cleanup()
      handleError(message)
    } finally {
      if (connectionController === controller) connectionController = null
    }
  }

  async function reconnect() {
    await cleanup()
    if (!isClosing) await connect()
  }

  async function cleanup() {
    isClosing = true
    connectionController?.abort()
    connectionController = null
    candidateBuffer.length = 0

    const closingSession = session.value
    session.value = null

    const closingPeer = peer.value
    peer.value = null
    if (closingPeer) {
      closingPeer.getSenders().forEach((sender) => sender.track?.stop())
      closingPeer.getReceivers().forEach((receiver) => receiver.track?.stop())
      closingPeer.close()
    }

    if (closingSession) await closePublicWhepSession(closingSession)

    updateState({
      status: 'disconnected',
      iceConnectionState: null,
      iceGatheringState: null,
      connectionState: null,
    })
    isClosing = false
  }

  function onPageHide() { void cleanup() }

  onMounted(() => window.addEventListener('pagehide', onPageHide))
  onBeforeUnmount(() => {
    disposed = true
    window.removeEventListener('pagehide', onPageHide)
    void cleanup()
  })

  return {
    state,
    peer,
    session,
    capabilities,
    connect,
    reconnect,
    cleanup,
  }
}
