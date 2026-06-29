let audioCtx: AudioContext | null = null
let ringTimer: ReturnType<typeof setInterval> | null = null
let unlocked = false

function ensureContext() {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

export function unlockCallRing() {
  if (unlocked) return
  const ctx = ensureContext()
  if (ctx.state === 'suspended') void ctx.resume()
  unlocked = true
}

function playTone(freq: number, durationSec: number, when: number) {
  const ctx = audioCtx
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(0.28, when + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + durationSec)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(when)
  osc.stop(when + durationSec + 0.02)
}

function playRingBurst() {
  const ctx = ensureContext()
  if (ctx.state === 'suspended') void ctx.resume()
  const t = ctx.currentTime
  playTone(440, 0.22, t)
  playTone(554, 0.22, t + 0.28)
  playTone(659, 0.28, t + 0.56)
}

export function startIncomingCallRing() {
  if (ringTimer) return
  unlockCallRing()
  playRingBurst()
  ringTimer = setInterval(playRingBurst, 2200)
}

export function stopIncomingCallRing() {
  if (ringTimer) {
    clearInterval(ringTimer)
    ringTimer = null
  }
}

export function isIncomingCallRinging() {
  return ringTimer !== null
}
