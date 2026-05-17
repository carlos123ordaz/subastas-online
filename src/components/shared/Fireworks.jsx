import { useMemo } from 'react'

function rng(seed) {
  let x = seed | 0
  return () => { x = (x * 1664525 + 1013904223) | 0; return ((x >>> 0) / 0xffffffff) }
}

export default function Fireworks({ count = 5, seed = 7 }) {
  const bursts = useMemo(() => {
    const r = rng(seed)
    return Array.from({ length: count }).map((_, i) => ({
      x: 15 + r() * 70, y: 15 + r() * 55,
      delay: i * 0.4 + r() * 0.5,
      color: ['#ff2e88', '#2af0ff', '#ffd23a', '#c8ff2e', '#b06bff'][i % 5],
    }))
  }, [count, seed])

  return (
    <div className="ms-stage">
      {bursts.map((b, i) => (
        <span key={i} style={{
          position: 'absolute', left: `${b.x}%`, top: `${b.y}%`,
          width: 12, height: 12, borderRadius: '50%',
          background: b.color,
          boxShadow: `0 0 16px ${b.color}, 0 0 36px ${b.color}`,
          animation: `ms-firework 1.8s ease-out ${b.delay}s infinite`,
        }} />
      ))}
    </div>
  )
}
