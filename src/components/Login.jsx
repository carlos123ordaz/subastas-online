import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import MichiFace from './shared/MichiFace'
import { IconCheck, IconDot } from './shared/Icons'
import { useBeep } from '../hooks/useBeep'

const Sparkle = ({ left, top, delay, size = 12 }) => (
  <span style={{
    position: 'absolute', left, top, width: size, height: size,
    animation: `ms-twinkle 2s ${delay}s ease-in-out infinite`,
  }}>
    <svg viewBox="0 0 24 24" fill="#ffd23a" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 0 8px #ffd23a)' }}>
      <path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" />
    </svg>
  </span>
)

export default function Login() {
  const { signInWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const beep = useBeep(true)

  const handleSignIn = async () => {
    if (loading) return
    beep(660, 0.08)
    setLoading(true)
    await signInWithGoogle()
  }

  return (
    <div className="ms-root" style={{
      width: '100%', minHeight: '100vh',
      background: 'var(--ms-grad-hero)',
      backgroundSize: '200% 200%', animation: 'ms-bg-shift 14s ease-in-out infinite',
    }}>
      <div className="ms-stars" />
      <Sparkle left="14%" top="18%" delay={0} size={14} />
      <Sparkle left="80%" top="22%" delay={0.5} size={10} />
      <Sparkle left="22%" top="62%" delay={1.1} size={12} />
      <Sparkle left="78%" top="68%" delay={0.3} size={16} />
      <Sparkle left="50%" top="12%" delay={0.8} size={8} />

      <div style={{
        maxWidth: 420, margin: '0 auto', padding: '0 24px',
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        position: 'relative', zIndex: 1,
      }}>
        {/* Status bar */}
        <div className="ms-statusbar" style={{ padding: '0 2px' }}>
          <span>9:41</span>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <IconDot size={6} /><IconDot size={6} /><IconDot size={6} />
          </span>
        </div>

        <div style={{ padding: '18px 0 26px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 42, height: 42, borderRadius: 14,
              background: 'var(--ms-grad-gold)', boxShadow: '0 6px 24px rgba(255,210,58,.4)',
            }}>
              <MichiFace size={28} />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
              <span className="ms-display" style={{ fontSize: 20 }}>MichiStore</span>
              <span className="ms-mono" style={{ fontSize: 10, color: 'var(--ms-ink-dim)', letterSpacing: '0.2em' }}>LIVE · AUCTIONS</span>
            </div>
          </div>

          {/* Hero */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, marginTop: 24 }}>
            <div className="ms-chip ms-chip-live" style={{ alignSelf: 'start' }}>
              <span className="ms-dot" /> EN VIVO AHORA
            </div>

            <h1 className="ms-display" style={{
              fontSize: 46, margin: 0,
              background: 'linear-gradient(180deg,#fff8e7 0%,#ffd23a 60%,#ff2e88 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              textShadow: '0 0 40px rgba(255,46,136,.3)',
            }}>
              Puja en vivo<br />desde el live.
            </h1>

            <p style={{ fontSize: 14, color: 'var(--ms-ink-dim)', margin: 0, lineHeight: 1.5 }}>
              Compite por gorras, hoodies, sneakers y más. Entra con tu Google y deja tu nombre en la escalera de pujas.
            </p>

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {[{ e: '🧥', n: 'Hoodie' }, { e: '🧢', n: 'Gorra' }, { e: '👟', n: 'Sneakers' }, { e: '🎴', n: 'Cartas' }].map((p, i) => (
                <div key={i} className="ms-card" style={{ flex: 1, padding: '10px 6px', textAlign: 'center', background: 'rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: 22 }}>{p.e}</div>
                  <div className="ms-mono" style={{ fontSize: 9, color: 'var(--ms-ink-dim)', marginTop: 2 }}>{p.n}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sign in */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={handleSignIn}
              disabled={loading}
              style={{
                appearance: 'none', border: 0, cursor: loading ? 'wait' : 'pointer',
                background: '#fff', color: '#1f1f1f',
                fontFamily: 'var(--ms-font-body)', fontWeight: 600, fontSize: 15,
                borderRadius: 16, padding: '14px 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 10px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.6)',
                transition: 'all .2s', opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? (
                <>
                  <span style={{ width: 18, height: 18, border: '2.5px solid #1f1f1f', borderTopColor: 'transparent', borderRadius: '50%', animation: 'ms-spin 0.7s linear infinite' }} />
                  Conectando con Google
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.85 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.67-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.67 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
                  </svg>
                  Continuar con Google
                </>
              )}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.12)' }} />
              <span style={{ fontSize: 11, color: 'var(--ms-ink-mute)', letterSpacing: '0.1em' }}>O</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.12)' }} />
            </div>

            <p style={{ fontSize: 10, color: 'var(--ms-ink-mute)', textAlign: 'center', margin: '4px 0 0', lineHeight: 1.5 }}>
              Al continuar aceptas las reglas del juego. Las pujas son <b style={{ color: 'var(--ms-gold)' }}>vinculantes</b>: si ganas, pagas. 😼
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
