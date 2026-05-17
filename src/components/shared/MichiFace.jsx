export default function MichiFace({ size = 22, mood = 'happy', color1 = '#ffd23a', color2 = '#2a0f00' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block' }}>
      <polygon points="4,8 10,4 11,11" fill={color1} />
      <polygon points="28,8 22,4 21,11" fill={color1} />
      <polygon points="6.5,8.5 9.5,6.5 10,10" fill="#ff5fb3" opacity="0.7" />
      <polygon points="25.5,8.5 22.5,6.5 22,10" fill="#ff5fb3" opacity="0.7" />
      <circle cx="16" cy="17" r="11" fill={color1} />
      {mood === 'happy' ? (
        <>
          <path d="M10 17 q1.5 -2 3 0" stroke={color2} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M19 17 q1.5 -2 3 0" stroke={color2} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      ) : mood === 'stars' ? (
        <>
          <text x="11.5" y="19" fontSize="6" fill={color2} fontWeight="900">✦</text>
          <text x="19.5" y="19" fontSize="6" fill={color2} fontWeight="900">✦</text>
        </>
      ) : (
        <>
          <circle cx="12" cy="17" r="1.4" fill={color2} />
          <circle cx="20" cy="17" r="1.4" fill={color2} />
        </>
      )}
      <polygon points="15,20 17,20 16,21.4" fill={color2} />
      <path d="M14.5 22 q1.5 1.4 3 0" stroke={color2} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M5 19h4M5 21h4M23 19h4M23 21h4" stroke={color2} strokeWidth="0.8" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}
