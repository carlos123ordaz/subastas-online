import { useMemo } from 'react'

function rng(seed) {
  let x = seed | 0
  return () => { x = (x * 1664525 + 1013904223) | 0; return ((x >>> 0) / 0xffffffff) }
}

export default function ConfettiBurst({ count = 40, seed = 1, durationOffset = 0 }) {
  const pieces = useMemo(() => {
    const r = rng(seed)
    const colors = ['c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6']
    return Array.from({ length: count }).map(() => ({
      left:  r() * 100,
      delay: r() * 1.6 + durationOffset,
      dx:    (r() * 200 - 100) + 'px',
      cls:   colors[Math.floor(r() * colors.length)],
      w: 6 + r() * 6,
      h: 8 + r() * 10,
      rot: r() * 360,
    }))
  }, [count, seed])

  return (
    <div className="ms-stage">
      {pieces.map((p, i) => (
        <span key={i} className={`ms-confetti ms-${p.cls}`} style={{
          left: `${p.left}%`, width: `${p.w}px`, height: `${p.h}px`,
          animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)`,
          '--dx': p.dx,
        }} />
      ))}
    </div>
  )
}
