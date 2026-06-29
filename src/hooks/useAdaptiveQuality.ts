import { useEffect, useRef, useState, useCallback } from 'react'

export type ConnectionQuality = 'good' | 'fair' | 'poor'

const MAX_VIDEO_BITRATE = 1_500_000
const MIN_VIDEO_BITRATE = 500_000
const MAX_VIDEO_FPS = 24
const MIN_VIDEO_FPS = 12
const MAX_SCALE = 2
const MIN_SCALE = 1

export function useAdaptiveQuality(pcRef: React.RefObject<RTCPeerConnection | null>) {
  const [quality, setQuality] = useState<ConnectionQuality>('good')
  const bitrateRef = useRef(MAX_VIDEO_BITRATE)
  const fpsRef = useRef(MAX_VIDEO_FPS)
  const scaleRef = useRef(1.0)
  const stablePollsRef = useRef(0)
  const prevPacketsLostRef = useRef(0)
  const prevPacketsSentRef = useRef(0)

  const applyToSenders = useCallback((pc: RTCPeerConnection) => {
    pc.getSenders().forEach((sender) => {
      if (sender.track?.kind !== 'video') return
      try {
        const params = sender.getParameters()
        if (!params.encodings?.length) params.encodings = [{}]
        params.degradationPreference = 'maintain-framerate'
        params.encodings[0].maxBitrate = bitrateRef.current
        params.encodings[0].maxFramerate = fpsRef.current
        params.encodings[0].scaleResolutionDownBy = scaleRef.current
        void sender.setParameters(params).catch(() => {})
      } catch { /* ignore */ }
    })
  }, [])

  useEffect(() => {
    const interval = setInterval(async () => {
      const pc = pcRef.current
      if (!pc || pc.connectionState !== 'connected') return

      try {
        const stats = await pc.getStats()
        let packetsLost = 0
        let packetsSent = 0
        let jitter = 0
        let rtt = 0

        stats.forEach((report) => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            packetsSent += report.packetsSent ?? 0
          }
          if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
            packetsLost += report.packetsLost ?? 0
            jitter = Math.max(jitter, report.jitter ?? 0)
            rtt = Math.max(rtt, (report.roundTripTime ?? 0) * 1000)
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = Math.max(rtt, (report.currentRoundTripTime ?? 0) * 1000)
          }
        })

        const deltaLost = packetsLost - prevPacketsLostRef.current
        const deltaSent = packetsSent - prevPacketsSentRef.current
        prevPacketsLostRef.current = packetsLost
        prevPacketsSentRef.current = packetsSent

        const lossRate = deltaSent > 0 ? deltaLost / deltaSent : 0
        const congested = lossRate > 0.03 || jitter > 0.03 || rtt > 300
        const stable = lossRate < 0.01 && jitter < 0.015 && rtt < 200

        if (congested) {
          stablePollsRef.current = 0
          bitrateRef.current = Math.max(MIN_VIDEO_BITRATE, Math.round(bitrateRef.current * 0.75))
          fpsRef.current = Math.max(MIN_VIDEO_FPS, fpsRef.current - 3)
          scaleRef.current = Math.min(MAX_SCALE, scaleRef.current + 0.5)
          setQuality(lossRate > 0.08 ? 'poor' : 'fair')
        } else if (stable) {
          stablePollsRef.current++
          if (stablePollsRef.current >= 10) {
            bitrateRef.current = Math.min(MAX_VIDEO_BITRATE, Math.round(bitrateRef.current * 1.1))
            fpsRef.current = Math.min(MAX_VIDEO_FPS, fpsRef.current + 1)
            scaleRef.current = Math.max(MIN_SCALE, scaleRef.current - 0.25)
            stablePollsRef.current = 0
          }
          setQuality('good')
        }

        applyToSenders(pc)
      } catch { /* ignore */ }
    }, 3000)

    return () => clearInterval(interval)
  }, [pcRef, applyToSenders])

  return quality
}
