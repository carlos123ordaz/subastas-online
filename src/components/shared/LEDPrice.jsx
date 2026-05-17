import { useState, useEffect } from 'react'

function SlotDigit({ digit }) {
  const [d, setD] = useState(digit)
  const [k, setK] = useState(0)
  useEffect(() => {
    if (digit !== d) { setD(digit); setK(x => x + 1) }
  }, [digit])
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', height: '1em', verticalAlign: 'bottom' }}>
      <span key={k} style={{ display: 'inline-block', color: '#ffd23a', animation: 'ms-rollin 0.45s cubic-bezier(.4,1.6,.4,1) both' }}>
        {d}
      </span>
    </span>
  )
}

export default function LEDPrice({ value, fontSize = 56, prefix = 'S/' }) {
  const txt = String(Math.round(value))
  return (
    <span className="ms-led-board">
      <span className="ms-led-digit" style={{ fontSize: fontSize * 0.55, marginRight: 6, opacity: .9 }}>{prefix}</span>
      <span className="ms-led-digit" style={{ fontSize, fontVariantNumeric: 'tabular-nums' }}>
        {txt.split('').map((c, i) => <SlotDigit key={i} digit={c} />)}
      </span>
    </span>
  )
}
