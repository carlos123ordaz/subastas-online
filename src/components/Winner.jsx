import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useBeep } from '../hooks/useBeep'
import MichiFace from './shared/MichiFace'
import LEDPrice from './shared/LEDPrice'
import ConfettiBurst from './shared/ConfettiBurst'
import Fireworks from './shared/Fireworks'
import { IconShare, IconDot } from './shared/Icons'

export default function Winner() {
  const { lotId } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const beep = useBeep(true)

  const [lot, setLot] = useState(null)
  const [winnerBid, setWinnerBid] = useState(null)
  const [totalBids, setTotalBids] = useState(0)
  const [rivals, setRivals] = useState(0)
  const [confettiKey, setConfettiKey] = useState(0)
  const [whatsappNumber, setWhatsappNumber] = useState(null)

  const isWinner = winnerBid?.bidder_id === user?.id

  useEffect(() => {
    beep(660, 0.08, 'square', 0.05)
    setTimeout(() => beep(880, 0.08, 'square', 0.05), 120)
    setTimeout(() => beep(1320, 0.18, 'square', 0.05), 240)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setConfettiKey(k => k + 1), 3600)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!lotId) return
    fetchData()
  }, [lotId])

  async function fetchData() {
    const [{ data: lotData }, { data: bidsData }] = await Promise.all([
      supabase.from('lots').select('*, auction:auctions(whatsapp_number)').eq('id', lotId).single(),
      supabase.from('bids').select('*, profile:profiles(id, name, color)').eq('lot_id', lotId).order('amount', { ascending: false }),
    ])
    if (lotData) {
      setLot(lotData)
      if (lotData.auction?.whatsapp_number) setWhatsappNumber(lotData.auction.whatsapp_number)
    }
    if (bidsData) {
      setWinnerBid(bidsData[0])
      setTotalBids(bidsData.length)
      const unique = new Set(bidsData.map(b => b.bidder_id ?? b.bidder_name))
      setRivals(Math.max(0, unique.size - 1))
    }
  }

  if (!lot) return (
    <div style={{ minHeight: '100vh', background: 'var(--ms-bg-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--ms-gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'ms-spin 0.7s linear infinite' }} />
    </div>
  )

  return (
    <div className="ms-root" style={{
      width: '100%', minHeight: '100vh',
      background: 'radial-gradient(120% 80% at 50% 20%, rgba(255,210,58,.45), transparent 55%), radial-gradient(120% 80% at 50% 100%, rgba(255,46,136,.4), transparent 55%), linear-gradient(180deg,#2d0e6b,#08010f)',
      backgroundSize: '200% 200%', animation: 'ms-bg-shift 10s ease-in-out infinite',
      overflowY: 'auto',
    }}>
      <div className="ms-stars" />
      <div key={`c-${confettiKey}`}><ConfettiBurst count={60} seed={confettiKey || 1} /></div>
      <Fireworks count={6} seed={3} />

      {/* Rotating sweep */}
      <div style={{
        position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
        width: 280, height: 280, borderRadius: '50%',
        background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255,210,58,.25) 60deg, transparent 120deg, rgba(255,46,136,.25) 180deg, transparent 240deg, rgba(42,240,255,.2) 300deg, transparent 360deg)',
        animation: 'ms-spin 12s linear infinite', filter: 'blur(6px)', pointerEvents: 'none',
      }} />

      <div className="ms-statusbar" style={{ position: 'relative', zIndex: 5 }}>
        <button
          onClick={() => navigate('/live')}
          style={{
            appearance: 'none', border: 'none', cursor: 'pointer', background: 'none',
            color: 'var(--ms-ink-dim)', fontFamily: 'var(--ms-font-body)', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 5, padding: 0,
          }}
        >
          ‹ Subastas
        </button>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <IconDot size={6} /><IconDot size={6} /><IconDot size={6} />
        </span>
      </div>

      <div style={{ padding: '8px 22px 40px', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 5, maxWidth: 480, margin: '0 auto' }}>
        {/* Badge */}
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', borderRadius: 999,
            background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
            fontSize: 10, letterSpacing: '0.2em', color: 'var(--ms-ink-dim)', fontWeight: 700,
          }}>
            SUBASTA CERRADA
          </div>
        </div>

        {/* Trophy */}
        <div style={{ textAlign: 'center', marginTop: 16, animation: 'ms-bounce-in .8s cubic-bezier(.4,1.6,.4,1) both' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 96, height: 96, borderRadius: '50%', background: 'var(--ms-grad-gold)',
            boxShadow: '0 12px 40px rgba(255,210,58,.55), inset 0 -6px 0 rgba(140,60,0,.3), inset 0 4px 0 rgba(255,255,255,.6)',
            position: 'relative',
          }}>
            <MichiFace size={68} mood="stars" />
            {[{ top: -8, left: -4 }, { top: -4, right: -8 }, { bottom: -2, left: 8 }, { bottom: 0, right: 0 }].map((s, i) => (
              <span key={i} style={{ position: 'absolute', ...s, fontSize: 14, animation: `ms-twinkle 1.4s ${i * 0.18}s ease-in-out infinite` }}>✨</span>
            ))}
          </div>
        </div>

        {/* Heading */}
        {isWinner ? (
          <>
            <h1 className="ms-display" style={{
              fontSize: 54, textAlign: 'center', margin: '10px 0 0', lineHeight: 0.9,
              background: 'linear-gradient(180deg,#fff8e7 0%,#ffd23a 50%,#f5a300 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 6px 20px rgba(255,210,58,.4))',
            }}>¡GANASTE!</h1>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ms-ink-dim)', margin: '8px 0 0' }}>
              Venciste a <b style={{ color: 'var(--ms-magenta)' }}>{rivals} michi{rivals !== 1 ? 's' : ''}</b> y te llevaste el lote 🏆
            </p>
          </>
        ) : (
          <>
            <h1 className="ms-display" style={{
              fontSize: 40, textAlign: 'center', margin: '10px 0 0', lineHeight: 0.9,
              background: 'linear-gradient(180deg,#fff8e7 0%,#b06bff 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Subasta cerrada</h1>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ms-ink-dim)', margin: '8px 0 0' }}>
              El ganador fue <b style={{ color: 'var(--ms-gold)' }}>{winnerBid?.bidder_name || winnerBid?.profile?.name || lot?.winner_name || 'otro participante'}</b>
            </p>
          </>
        )}

        {/* Item card */}
        <div className="ms-card" style={{
          padding: 14, marginTop: 18, display: 'flex', alignItems: 'center', gap: 12,
          background: 'linear-gradient(135deg,rgba(255,210,58,.18),rgba(255,46,136,.15))',
          border: '1px solid rgba(255,210,58,.4)', boxShadow: '0 12px 40px rgba(255,210,58,.2)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 14, overflow: 'hidden',
            background: 'linear-gradient(135deg,#ff2e88,#b06bff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
            boxShadow: '0 6px 18px rgba(255,46,136,.45)', flexShrink: 0,
          }}>
            {lot.image_url
              ? <img src={lot.image_url} alt={lot.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : lot.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ms-eyebrow" style={{ color: 'var(--ms-gold)' }}>PREMIO</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, lineHeight: 1.2 }}>{lot.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ms-ink-dim)', marginTop: 2 }}>{lot.color_desc}</div>
          </div>
        </div>

        {/* Price */}
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="ms-eyebrow" style={{ marginBottom: 6 }}>PUJA GANADORA</div>
          <LEDPrice value={winnerBid?.amount ?? 0} fontSize={52} />
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
          <div className="ms-card" style={{ padding: '8px 6px', textAlign: 'center' }}>
            <div className="ms-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ms-cyan)' }}>{totalBids}</div>
            <div style={{ fontSize: 9, color: 'var(--ms-ink-dim)', letterSpacing: '0.1em' }}>PUJAS TOTAL</div>
          </div>
          <div className="ms-card" style={{ padding: '8px 6px', textAlign: 'center' }}>
            <div className="ms-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ms-magenta)' }}>{rivals}</div>
            <div style={{ fontSize: 9, color: 'var(--ms-ink-dim)', letterSpacing: '0.1em' }}>RIVALES</div>
          </div>
          <div className="ms-card" style={{ padding: '8px 6px', textAlign: 'center' }}>
            <div className="ms-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ms-lime)' }}>+S/{Math.max(0, (winnerBid?.amount ?? 0) - lot.start_price)}</div>
            <div style={{ fontSize: 9, color: 'var(--ms-ink-dim)', letterSpacing: '0.1em' }}>SOBRE INICIO</div>
          </div>
        </div>

        {/* CTAs */}
        {isWinner && (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `¡Hola! Gané el lote "${lot.name}" por S/ ${winnerBid?.amount} en MichiStore Live 🏆\n` +
                  `Mi nombre: ${profile?.name || winnerBid?.profile?.name || user?.email || 'Ganador'}\n` +
                  `¿Me pueden confirmar el pago y coordinar el envío?`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => beep(880, 0.1)}
                style={{
                  textDecoration: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  background: 'linear-gradient(180deg,#3bdb6b 0%,#25c558 45%,#128C3E 100%)',
                  color: '#fff', fontFamily: 'var(--ms-font-display)', fontSize: 18,
                  borderRadius: 16, padding: '14px 18px',
                  boxShadow: 'inset 0 2px 0 rgba(255,255,255,.35), inset 0 -3px 0 rgba(0,0,0,.2), 0 10px 30px rgba(37,197,88,.4)',
                }}
              >
                <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                PAGAR · S/ {winnerBid?.amount ?? 0}
              </a>
            )}
            <button className="ms-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', fontSize: 13 }}
              onClick={() => navigator.share?.({ title: '¡Gané en MichiStore!', text: `Gané el ${lot.name} por S/ ${winnerBid?.amount}` })}
            >
              <IconShare size={14} /> Compartir mi victoria
            </button>
            <p style={{ fontSize: 10, color: 'var(--ms-ink-mute)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
              Coordina el envío por WhatsApp. El pago se realiza directo al vendedor 📦
            </p>
          </div>
        )}

        {!isWinner && (
          <button className="ms-btn" style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => navigate('/live')}
          >
            Ver próximas subastas
          </button>
        )}

        <button className="ms-btn" style={{ marginTop: isWinner ? 0 : 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13 }}
          onClick={() => navigate('/live')}
        >
          ‹ Volver a subastas
        </button>
      </div>
    </div>
  )
}
