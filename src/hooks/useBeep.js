import { useRef } from 'react'

export function useBeep(enabled = true) {
  const ctxRef = useRef(null)

  return (freq = 880, dur = 0.07, type = 'square', vol = 0.05) => {
    if (!enabled) return
    try {
      ctxRef.current = ctxRef.current || new (window.AudioContext || window.webkitAudioContext)()
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') ctx.resume()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.value = freq
      g.gain.value = vol
      o.connect(g).connect(ctx.destination)
      const t0 = ctx.currentTime
      g.gain.setValueAtTime(vol, t0)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      o.start(t0)
      o.stop(t0 + dur)
    } catch (e) {}
  }
}
