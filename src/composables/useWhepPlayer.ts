import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { ConnectionContext } from '@/services/api'
import type { WhepCapabilities, WhepSession } from '@/services/whep'
import { closeWhepSession, getWhepCapabilities, openWhepSession, patchWhepSession } from '@/services/whep'

export interface UseWhepPlayerOptions {
  cameraId: string
  whepPath: string
  context: ConnectionContext
  onStateChange?: (state: UseWhepPlayerState) => void
  onError?: (error: Error) => void
  onTrack?: (track: MediaStreamTrack) => void
}

export interface UseWhepPlayerState {
  status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed'
  error: string | null
  iceConnectionState: RTCIceConnectionState | null
  iceGatheringState: RTCIceGatheringState | null
  connectionState: RTCPeerConnectionState | null
}

export function useWhepPlayer(options: UseWhepPlayerOptions) {
  const { cameraId, whepPath, context, onStateChange, onError, onTrack } = options

  const state = ref<UseWhepPlayerState>({
    status: 'idle',
    error: null,
    iceConnectionState: null,
    iceGatheringState: null,
    connectionState: null,
  })

  const peer = shallowRef<RTCPeerConnection | null>(null)
  const session = shallowRef<WhepSession | null>(null)
  const capabilities = shallowRef<WhepCapabilities | null>(null)
  const candidateBuffer: RTCIceCandidateInit[] = []
  let isClosing = false

  function updateState(partial: Partial<UseWhepPlayerState>) {
    state.value = { ...state.value, ...partial }
    onStateChange?.(state.value)
  }

  function handleError(message: string, originalError?: Error) {
    if (isClosing) return
    const error = new Error(message)
    updateState({ status: 'failed', error: message })
    onError?.(error)
  }

  function createPeer(iceServers: RTCIceServer[]): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers })
    pc.addEventListener('iceconnectionstatechange', () => {
      updateState({ iceConnectionState: pc.iceConnectionState })
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        if (!isClosing) handleError(`Koneksi ICE ${pc.iceConnectionState}.`)
      }
    })
    pc.addEventListener('icegatheringstatechange', () => {
      updateState({ iceGatheringState: pc.iceGatheringState })
    })
    pc.addEventListener('connectionstatechange', () => {
      updateState({ connectionState: pc.connectionState })
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        if (!isClosing) handleError(`Koneksi peer ${pc.connectionState}.`)
      }
    })
    pc.addEventListener('track', (event) => {
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
        console.warn('[WHEP] Gagal menambahkan candidate tertunda:', error)
      }
    }
  }

  async function connect() {
    if (peer.value || isClosing) return
    updateState({ status: 'connecting', error: null })

    try {
      const caps = await getWhepCapabilities(cameraId, whepPath, context)
      capabilities.value = caps

      const pc = createPeer(caps.iceServers)
      peer.value = pc

      const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: false })
      await pc.setLocalDescription(offer)

      const { session: newSession, answer, iceServers } = await openWhepSession(
        cameraId,
        whepPath,
        offer.sdp!,
        context
      )
      session.value = newSession

      if (iceServers.length > 0 && caps.iceServers.length === 0) {
        pc.setConfiguration({ iceServers })
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: answer } as RTCSessionDescriptionInit)
      await flushCandidateBuffer(pc)

      updateState({ status: 'connected' })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      handleError(error instanceof Error ? error.message : 'Gagal menghubungkan ke stream WHEP.', error instanceof Error ? error : undefined)
      await cleanup()
    }
  }

  async function reconnect() {
    await cleanup()
    if (!isClosing) await connect()
  }

  async function cleanup() {
    isClosing = true
    candidateBuffer.length = 0

    if (session.value) {
      await closeWhepSession(session.value)
      session.value = null
    }

    if (peer.value) {
      peer.value.getSenders().forEach(sender => sender.track?.stop())
      peer.value.getReceivers().forEach(receiver => receiver.track?.stop())
      peer.value.close()
      peer.value = null
    }

    updateState({
      status: 'disconnected',
      iceConnectionState: null,
      iceGatheringState: null,
      connectionState: null,
    })
    isClosing = false
  }

  watch(
    () => context.generation,
    () => {
      if (peer.value) {
        cleanup()
        if (!isClosing) connect()
      }
    },
  )

  onBeforeUnmount(cleanup)

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