import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import MichiFace from './shared/MichiFace'
import { IconLogout, IconUsers } from './shared/Icons'

export default function AuctionList() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [lots, setLots] = useState([])

  useEffect(() => {
    fetchLiveLots()

    const sub = supabase.channel('live-lots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots' }, fetchLiveLots)
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [])

  async function fetchLiveLots() {
    const { data } = await supabase
      .from('lots')
      .select('*, auction:auctions(id,title,tiktok_handle,status), bids(count)')
      .in('status', ['live', 'pending'])
      .order('status', { ascending: false })
      .order('order_num')
    if (data) setLots(data)
  }

  const Sparkle = ({ left, top, delay, size = 12 }) => (
    <span style={{ position: 'absolute', left, top, width: size, height: size, animation: `ms-twinkle 2s ${delay}s ease-in-out infinite` }}>
      <svg viewBox="0 0 24 24" fill="#ffd23a" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 0 8px #ffd23a)' }}>
        <path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" />
      </svg>
    </span>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--ms-grad-hero)',
      backgroundSize: '200% 200%', animation: 'ms-bg-shift 14s ease-in-out infinite',
      position: 'relative',
    }}>
      <div className="ms-stars" />
      <Sparkle left="10%" top="8%" delay={0} size={14} />
      <Sparkle left="85%" top="15%" delay={0.6} size={10} />
      <Sparkle left="60%" top="6%" delay={1.2} size={12} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--ms-grad-gold)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <MichiFace size={26} />
          </span>
          <div>
            <div className="ms-display" style={{ fontSize: 17 }}>MichiStore</div>
            <div className="ms-mono" style={{ fontSize: 9, color: 'var(--ms-ink-dim)', letterSpacing: '0.18em' }}>LIVE AUCTIONS</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999,
            background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
            fontSize: 12, fontWeight: 600,
          }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: `linear-gradient(135deg, ${profile?.color || '#ff2e88'}, #b06bff)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
              {profile?.name?.[0]?.toUpperCase() || '?'}
            </div>
            {profile?.name || 'Usuario'}
          </div>
          <button onClick={signOut} className="ms-btn" style={{ padding: '6px 14px', fontSize: 11 }}>Salir</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '0 20px 40px', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <h1 className="ms-display" style={{
            fontSize: 36,
            background: 'linear-gradient(180deg,#fff8e7 0%,#ffd23a 60%,#ff2e88 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Subastas en vivo</h1>
          <p style={{ fontSize: 13, color: 'var(--ms-ink-dim)', marginTop: 6 }}>
            Selecciona un lote para pujar en tiempo real.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lots.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '48px 20px',
              border: '1px dashed rgba(255,255,255,.15)', borderRadius: 24,
              color: 'var(--ms-ink-mute)',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎙️</div>
              <p style={{ fontWeight: 600 }}>Ninguna subasta activa ahora</p>
              <p style={{ fontSize: 12, marginTop: 6 }}>El admin iniciará la subasta pronto. ¡Quédate!</p>
              <div className="ms-chip ms-chip-live" style={{ display: 'inline-flex', marginTop: 14 }}>
                <span className="ms-dot" /> Esperando...
              </div>
            </div>
          ) : lots.map(lot => (
            <div key={lot.id} className="ms-card" style={{
              padding: '14px 16px',
              background: lot.status === 'live'
                ? 'linear-gradient(135deg,rgba(255,46,136,.15),rgba(42,240,255,.1))'
                : 'rgba(255,255,255,.05)',
              border: lot.status === 'live' ? '1px solid rgba(255,46,136,.35)' : '1px solid rgba(255,255,255,.1)',
              cursor: 'pointer',
              transition: 'transform .15s, box-shadow .15s',
            }}
              onClick={() => lot.status === 'live' && navigate(`/live/${lot.id}`)}
              onMouseEnter={e => { if (lot.status === 'live') e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 14, flexShrink: 0,
                  background: 'linear-gradient(135deg,#ff2e88,#b06bff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                  boxShadow: lot.status === 'live' ? '0 6px 20px rgba(255,46,136,.4)' : 'none',
                }}>{lot.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {lot.status === 'live' ? (
                      <span className="ms-chip ms-chip-live" style={{ fontSize: 9, padding: '2px 8px' }}>
                        <span className="ms-dot" style={{ width: 5, height: 5 }} /> EN VIVO
                      </span>
                    ) : (
                      <span className="ms-chip" style={{ fontSize: 9, padding: '2px 8px' }}>Próximamente</span>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--ms-ink-mute)' }}>{lot.auction?.tiktok_handle || '@michistore'}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lot.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ms-ink-dim)', marginTop: 2 }}>
                    {lot.color_desc} · desde <b style={{ color: 'var(--ms-gold)' }}>S/ {lot.start_price}</b>
                  </div>
                </div>
                {lot.status === 'live' && (
                  <button style={{
                    appearance: 'none', border: 0, cursor: 'pointer',
                    background: 'linear-gradient(180deg,#ff8fc8,#ff2e88)',
                    color: '#fff', fontFamily: 'var(--ms-font-display)', fontSize: 13,
                    borderRadius: 12, padding: '10px 14px',
                    boxShadow: '0 6px 18px rgba(255,46,136,.45)',
                    whiteSpace: 'nowrap',
                  }}>
                    PUJAR ↑
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
