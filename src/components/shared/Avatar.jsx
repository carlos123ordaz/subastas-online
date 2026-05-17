export function initials(name = '') {
  return name.split(/[\s_.]/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase().slice(0, 2)
}

function shade(hex, pct) {
  const h = hex.replace('#', '')
  const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  let r = (num >> 16) + pct, g = ((num >> 8) & 0xff) + pct, b = (num & 0xff) + pct
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b))
  return `rgb(${r},${g},${b})`
}

export default function Avatar({ user, size = 36 }) {
  const color = user?.color || '#ff2e88'
  const name  = user?.name  || '?'
  return (
    <span className="ms-avatar" style={{
      width: size, height: size,
      background: `linear-gradient(135deg, ${color}, ${shade(color, -25)})`,
      fontSize: size * 0.4,
    }}>
      {initials(name)}
    </span>
  )
}
