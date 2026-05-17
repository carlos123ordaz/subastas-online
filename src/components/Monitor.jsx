import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Avatar from './shared/Avatar'
import MichiFace from './shared/MichiFace'
import ConfettiBurst from './shared/ConfettiBurst'
import Fireworks from './shared/Fireworks'
import { IconHammer, IconPlay, IconArrowUp, IconUsers, IconBolt } from './shared/Icons'

function rng(seed) {
  let x = seed | 0
  return () => { x = (x * 1664525 + 1013904223) | 0; return ((x >>> 0) / 0xffffffff) }
}

function BigLED({ value }) {
  const txt = `S/ ${value}`
  const color = 'var(--ms-gold)'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'baseline',
      padding: '24px 44px', borderRadius: 28,
      background: '#040008',
      border: '3px solid rgba(255,210,58,.45)',
      boxShadow: 'inset 0 0 80px rgba(255,210,58,.18), 0 0 60px rgba(255,210,58,.35)',
      position: 'relative', overflow: 'hidden',
      fontFamily: 'var(--ms-font-display)',
    }}>
      <span style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(0,0,0,.35) 1px, transparent 1px)',
        backgroundSize: '100% 5px', pointerEvents: 'none', opacity: .45,
      }} />
      {txt.split('').map((c, i) => (
        <span key={i + c + '-' + value} style={{
          display: 'inline-block',
          minWidth: c === ' ' ? '0.4em' : (/\d/.test(c) ? '0.62em' : 'auto'),
          fontSize: 200, lineHeight: 0.9,
          color,
          textShadow: `0 0 18px ${color}, 0 0 40px ${color}, 0 4px 0 rgba(0,0,0,.45)`,
          fontVariantNumeric: 'tabular-nums',
          animation: 'ms-rollin 0.45s cubic-bezier(.4,1.6,.4,1) both',
        }}>{c}</span>
      ))}
    </div>
  )
}

function CoinShower({ trigger }) {
  const coins = useMemo(() => {
    const r = rng(trigger || 1)
    return Array.from({ length: 20 }).map(() => ({
      left: r() * 100, delay: r() * 0.6,
      size: 24 + r() * 22, dur: 2.4 + r() * 1.4,
    }))
  }, [trigger])

  if (!trigger) return null
  return (
    <div className="ms-stage">
      {coins.map((c, i) => (
        <span key={trigger + '-' + i} style={{
          position: 'absolute', left: `${c.left}%`, top: -40,
          width: c.size, height: c.size, borderRadius: '50%',
          background: 'var(--ms-grad-gold)',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,.7), inset 0 -3px 0 rgba(140,60,0,.45), 0 0 18px rgba(255,210,58,.6)',
          color: '#2a0f00', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--ms-font-display)', fontSize: c.size * 0.55,
          animation: `ms-coin-drop ${c.dur}s linear ${c.delay}s forwards`,
        }}>S/</span>
      ))}
    </div>
  )
}

function Ribbon({ children, color = 'var(--ms-magenta)' }) {
  const gradEnd = color === 'var(--ms-magenta)' ? '#ff7ab8' : '#ffdd77'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 14,
      padding: '10px 24px',
      background: `linear-gradient(90deg, ${color}, ${gradEnd})`,
      color: '#fff', fontFamily: 'var(--ms-font-display)', fontSize: 18, letterSpacing: '0.04em',
      borderRadius: 999,
      boxShadow: `0 8px 30px rgba(0,0,0,.4), 0 0 30px ${color}`,
    }}>{children}</div>
  )
}

const TICKER_ITEMS = [
  '🔥 SUBASTAS EN VIVO',
  'PUJA DESDE TU CELULAR',
  '⚡ ENVÍO GRATIS LIMA',
  '🎁 ¡SORPRESA AL GANADOR!',
  '💰 LOS MEJORES PRECIOS',
  '🎉 NUEVA SUBASTA AHORA',
]

export default function Monitor() {
  const { lotId } = useParams()
  const [lot, setLot] = useState(null)
  const [topBids, setTopBids] = useState([])
  const [recentBids, setRecentBids] = useState([])
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [pulseKey, setPulseKey] = useState(0)
  const [coinKey, setCoinKey] = useState(0)
  const timerRef = useRef(null)
  const idRef = useRef(0)

  const currentPrice = topBids[0]?.amount ?? lot?.start_price ?? 0
  const leader = topBids[0]
  const leaderName = lot?.winner_name ?? topBids[0]?.bidder_name ?? topBids[0]?.profile?.name ?? null
  const others = topBids.slice(1, 5)

  const danger = secondsLeft <= 10 && secondsLeft > 0
  const veryDanger = secondsLeft <= 5 && lot?.status === 'live'

  let phase = 'idle'
  if (lot?.status === 'live')       phase = secondsLeft <= 10 ? 'closing' : 'live'
  else if (lot?.status === 'sold')  phase = 'sold'

  const today = new Date()
  const dateStr = `${today.getDate()}/${today.getMonth() + 1}`
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const lotLabel = lot?.order_num != null ? `#${String(lot.order_num + 1).padStart(2, '0')}` : ''

  useEffect(() => {
    if (!lotId) return
    fetchData()

    const lotSub = supabase.channel(`monitor-lot-${lotId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots', filter: `id=eq.${lotId}` }, p => setLot(p.new))
      .subscribe()

    const bidSub = supabase.channel(`monitor-bids-${lotId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `lot_id=eq.${lotId}` }, p => handleNewBid(p.new))
      .subscribe()

    return () => { supabase.removeChannel(lotSub); supabase.removeChannel(bidSub) }
  }, [lotId])

  useEffect(() => {
    clearInterval(timerRef.current)
    if (!lot) return
    const computeLeft = () => {
      if (lot.status !== 'live') return 0
      if (!lot.timer_ends_at) return lot.timer_remaining ?? 0
      return Math.max(0, Math.floor((new Date(lot.timer_ends_at) - Date.now()) / 1000))
    }
    setSecondsLeft(computeLeft())
    timerRef.current = setInterval(() => setSecondsLeft(computeLeft()), 500)
    return () => clearInterval(timerRef.current)
  }, [lot])

  async function fetchData() {
    const [{ data: lotData }, { data: bidsData }] = await Promise.all([
      supabase.from('lots').select('*').eq('id', lotId).single(),
      supabase.from('bids').select('*, profile:profiles(id,name,color,handle)').eq('lot_id', lotId).order('amount', { ascending: false }).limit(10),
    ])
    if (lotData) setLot(lotData)
    if (bidsData) setTopBids(bidsData)
  }

  function handleNewBid(newBid) {
    setPulseKey(k => k + 1)
    if ((newBid.delta ?? 0) >= 10) setCoinKey(k => k + 1)

    supabase.from('bids').select('*, profile:profiles(id,name,color,handle)').eq('id', newBid.id).single()
      .then(({ data }) => {
        if (!data) return
        setTopBids(prev => {
          const filtered = data.bidder_id
            ? prev.filter(b => b.bidder_id !== data.bidder_id)
            : prev.filter(b => !(b.bidder_id === null && b.bidder_name === data.bidder_name))
          return [...filtered, data].sort((a, b) => b.amount - a.amount).slice(0, 10)
        })
        idRef.current++
        setRecentBids(prev => [...prev, {
          id: idRef.current,
          name: data.bidder_name || data.profile?.name || 'Pujador',
          profile: data.profile,
          delta: data.delta ?? newBid.delta ?? 1,
        }].slice(-8))
      })
  }

  // ── PHASE: IDLE ─────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="ms-root" style={{
        width: '100vw', height: '100vh',
        background: 'radial-gradient(120% 80% at 50% 30%, rgba(255,46,136,.3), transparent 55%), linear-gradient(180deg,#14062a 0%,#08010f 100%)',
        backgroundSize: '200% 200%', animation: 'ms-bg-shift 14s ease-in-out infinite',
      }}>
        <div className="ms-stars" />

        {/* Top chrome */}
        <div style={{ position: 'absolute', top: 32, left: 48, right: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--ms-grad-gold)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(255,210,58,.4)' }}>
              <MichiFace size={40} />
            </span>
            <div style={{ lineHeight: 1 }}>
              <div className="ms-display" style={{ fontSize: 32 }}>MichiStore</div>
              <div className="ms-mono" style={{ fontSize: 12, letterSpacing: '0.22em', color: 'var(--ms-ink-dim)', marginTop: 4 }}>LIVE AUCTIONS · LIMA</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="ms-chip ms-chip-live" style={{ fontSize: 14, padding: '8px 18px' }}>
              <span className="ms-dot" style={{ width: 9, height: 9 }} /> EN VIVO
            </span>
            <span className="ms-chip" style={{ fontSize: 14, padding: '8px 16px', color: 'var(--ms-cyan)', borderColor: 'rgba(42,240,255,.35)' }}>
              <IconUsers size={16} /> michistore.live
            </span>
          </div>
        </div>

        {/* Hero */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          display: 'flex', alignItems: 'center', gap: 64, maxWidth: '88%',
        }}>
          {/* Product */}
          <div style={{ position: 'relative', animation: 'ms-bounce-in .9s cubic-bezier(.4,1.6,.4,1) both' }}>
            <div style={{
              position: 'absolute', inset: -60, borderRadius: '50%',
              background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255,210,58,.35) 60deg, transparent 120deg, rgba(255,46,136,.3) 180deg, transparent 240deg, rgba(42,240,255,.3) 300deg, transparent 360deg)',
              animation: 'ms-spin 18s linear infinite', filter: 'blur(8px)',
            }} />
            <div style={{
              width: 420, height: 420, borderRadius: 36,
              background: 'linear-gradient(135deg,#ff2e88 0%,#b06bff 50%,#2af0ff 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', zIndex: 2, overflow: 'hidden',
              boxShadow: '0 24px 80px rgba(255,46,136,.5), inset 0 -8px 0 rgba(0,0,0,.18), inset 0 4px 0 rgba(255,255,255,.4)',
            }}>
              {lot?.image_url
                ? <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ fontSize: 220, filter: 'drop-shadow(0 12px 30px rgba(0,0,0,.3))', animation: 'ms-pulse 3s ease-in-out infinite' }}>{lot?.emoji ?? '🎁'}</div>
              }
            </div>
            {lotLabel && (
              <div style={{ position: 'absolute', top: -24, right: -32, animation: 'ms-bounce-in .9s .2s cubic-bezier(.4,1.6,.4,1) both', zIndex: 3 }}>
                <div className="ms-plaque" style={{ fontSize: 16, padding: '10px 20px', transform: 'rotate(8deg)' }}>LOTE {lotLabel}</div>
              </div>
            )}
          </div>

          {/* Text */}
          <div style={{ flex: 1, maxWidth: 680, animation: 'ms-bounce-in .9s .15s cubic-bezier(.4,1.6,.4,1) both' }}>
            <div className="ms-eyebrow" style={{ fontSize: 14, letterSpacing: '0.3em', color: 'var(--ms-cyan)', textShadow: '0 0 12px var(--ms-cyan-glow)' }}>SIGUIENTE LOTE</div>
            <h1 className="ms-display" style={{
              fontSize: 96, margin: '12px 0 16px', lineHeight: 0.9,
              background: 'linear-gradient(180deg,#fff8e7 0%,#ffd23a 55%,#ff2e88 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 8px 30px rgba(255,46,136,.3))',
            }}>{lot?.name ?? 'Próximo lote'}</h1>
            <p style={{ fontSize: 22, color: 'var(--ms-ink-dim)', lineHeight: 1.4, margin: '0 0 22px', maxWidth: 560 }}>
              {lot?.color_desc ?? 'Preparando la subasta...'}{lot?.hint ? ` · ${lot.hint}` : ''}
            </p>

            <div style={{ display: 'flex', gap: 18, marginBottom: 32, flexWrap: 'wrap' }}>
              {[
                { label: 'PRECIO INICIAL', value: `S/ ${lot?.start_price ?? 0}`, color: 'var(--ms-gold)' },
                { label: 'DURACIÓN', value: lot?.timer_duration ? `${String(Math.floor(lot.timer_duration / 60)).padStart(2, '0')}:${String(lot.timer_duration % 60).padStart(2, '0')}` : '--:--', color: 'var(--ms-cyan)' },
              ].map((s, i) => (
                <div key={i} style={{ padding: '14px 22px', borderRadius: 16, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>
                  <div className="ms-eyebrow" style={{ fontSize: 11 }}>{s.label}</div>
                  <div className="ms-mono" style={{ fontSize: 30, fontWeight: 700, marginTop: 4, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ position: 'relative', display: 'inline-block', animation: 'ms-pulse 2s ease-in-out infinite' }}>
              <div style={{
                padding: '24px 56px', borderRadius: 24,
                background: 'linear-gradient(180deg,#c8ff7a 0%, #c8ff2e 50%, #92d100 100%)',
                color: '#08010f', fontFamily: 'var(--ms-font-display)', fontSize: 48,
                boxShadow: 'inset 0 3px 0 rgba(255,255,255,.6), inset 0 -5px 0 rgba(0,0,0,.18), 0 16px 50px rgba(200,255,46,.45)',
                display: 'flex', alignItems: 'center', gap: 18, position: 'relative', overflow: 'hidden',
              }}>
                <IconPlay size={36} />
                EMPEZAR SUBASTA
                <span style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,.55) 50%, transparent 70%)',
                  animation: 'ms-glow-sweep 2.4s ease-in-out infinite',
                }} />
              </div>
              <div style={{ marginTop: 16, fontSize: 14, color: 'var(--ms-ink-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ms-magenta)', boxShadow: '0 0 8px var(--ms-magenta)' }} />
                Esperando al admin desde el panel de control
              </div>
            </div>
          </div>
        </div>

        {/* Bottom ticker */}
        <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 20, padding: '0 48px' }}>
          <Ribbon color="var(--ms-magenta)">
            <span style={{ fontSize: 24 }}>🐾</span> MICHISTORE LIVE · {dateStr}
          </Ribbon>
          <div className="ms-ticker" style={{ flex: 1, padding: '12px 0', borderTop: '1px solid rgba(255,255,255,.1)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <div className="ms-ticker-track" style={{ fontSize: 18, fontFamily: 'var(--ms-font-display)', letterSpacing: '0.04em' }}>
              {[0, 1].map(dup =>
                TICKER_ITEMS.map((t, i) => (
                  <span key={`${dup}-${i}`} style={{ color: i % 3 === 0 ? 'var(--ms-gold)' : i % 3 === 1 ? 'var(--ms-cyan)' : '#fff' }}>{t}</span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── PHASE: LIVE / CLOSING ────────────────────────────────────
  if (phase === 'live' || phase === 'closing') {
    return (
      <div className="ms-root" style={{
        width: '100vw', height: '100vh',
        background: veryDanger
          ? 'radial-gradient(120% 80% at 50% 30%, rgba(255,46,136,.45), transparent 55%), linear-gradient(180deg,#3a0a1a, #08010f)'
          : 'radial-gradient(120% 80% at 50% 30%, rgba(255,46,136,.2), transparent 55%), radial-gradient(120% 80% at 50% 100%, rgba(42,240,255,.15), transparent 55%), linear-gradient(180deg,#14062a, #08010f)',
        transition: 'background 0.5s',
      }}>
        <div className="ms-stars" />

        <div key={`shake-${pulseKey}`} style={{
          position: 'absolute', inset: 0,
          animation: pulseKey > 0 ? 'ms-shake .35s ease-out' : undefined,
        }}>
          {/* Top bar */}
          <div style={{ position: 'absolute', top: 24, left: 48, right: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--ms-grad-gold)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(255,210,58,.4)' }}>
                <MichiFace size={34} />
              </span>
              <div style={{ lineHeight: 1.05 }}>
                <div className="ms-display" style={{ fontSize: 24 }}>MichiStore Live</div>
                <div className="ms-mono" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--ms-ink-dim)', marginTop: 2 }}>
                  LOTE {lotLabel} · {lot?.name?.toUpperCase() ?? ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="ms-chip ms-chip-live" style={{ fontSize: 13, padding: '6px 14px' }}>
                <span className="ms-dot" /> {phase === 'closing' ? 'CERRANDO' : 'EN VIVO'}
              </span>
              <span className="ms-chip" style={{ fontSize: 13, padding: '6px 14px', color: 'var(--ms-gold)', borderColor: 'rgba(255,210,58,.3)' }}>
                <IconBolt size={14} /> {topBids.length + recentBids.length} pujas
              </span>
            </div>
          </div>

          {/* Countdown center-top */}
          <div style={{ position: 'absolute', top: 90, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 4 }}>
            <div className="ms-eyebrow" style={{
              fontSize: 13, letterSpacing: '0.32em',
              color: danger ? 'var(--ms-magenta)' : 'var(--ms-cyan)',
              textShadow: danger ? '0 0 12px var(--ms-magenta-glow)' : '0 0 12px var(--ms-cyan-glow)',
            }}>
              {phase === 'closing' ? '⚠ ÚLTIMA LLAMADA · TIEMPO RESTANTE' : 'TIEMPO RESTANTE'}
            </div>
            <span className={`ms-clock ${danger ? 'ms-clock-danger' : ''}`} style={{
              fontSize: 96, padding: '12px 36px', borderRadius: 20, borderWidth: 3,
              animation: veryDanger ? 'ms-pulse .4s ease-in-out infinite' : danger ? 'ms-pulse .9s ease-in-out infinite' : undefined,
            }}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
          </div>

          {/* 3-col grid */}
          <div style={{
            position: 'absolute', top: 280, left: 48, right: 48, bottom: 200,
            display: 'grid', gridTemplateColumns: '380px 1fr 380px', gap: 40, alignItems: 'center',
          }}>
            {/* Product */}
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', inset: -30, borderRadius: '50%',
                background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255,46,136,.4) 90deg, transparent 180deg, rgba(255,210,58,.35) 270deg, transparent 360deg)',
                animation: 'ms-spin 14s linear infinite', filter: 'blur(10px)',
              }} />
              <div style={{
                width: 380, height: 380, borderRadius: 30,
                background: 'linear-gradient(135deg,#ff2e88 0%,#b06bff 50%,#2af0ff 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 24px 60px rgba(255,46,136,.45), inset 0 -8px 0 rgba(0,0,0,.18), inset 0 4px 0 rgba(255,255,255,.35)',
              }}>
                {lot?.image_url
                  ? <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ fontSize: 200, filter: 'drop-shadow(0 12px 30px rgba(0,0,0,.3))', animation: 'ms-pulse 3s ease-in-out infinite' }}>{lot?.emoji ?? '🎁'}</div>
                }
                {lotLabel && (
                  <div className="ms-plaque" style={{ position: 'absolute', top: -16, left: -16, fontSize: 14, padding: '8px 16px', transform: 'rotate(-8deg)' }}>
                    {lotLabel}
                  </div>
                )}
              </div>
              <div style={{ marginTop: 18, textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontFamily: 'var(--ms-font-display)', lineHeight: 1.1 }}>{lot?.name}</div>
                <div style={{ fontSize: 14, color: 'var(--ms-ink-dim)', marginTop: 4 }}>{lot?.color_desc}</div>
              </div>
            </div>

            {/* Center: price + leader */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, minWidth: 0 }}>
              <div className="ms-eyebrow" style={{ fontSize: 14, letterSpacing: '0.32em', color: 'var(--ms-gold)' }}>PUJA ACTUAL</div>
              <div key={`price-${pulseKey}`} style={{ animation: pulseKey > 0 ? 'ms-pricepop .55s cubic-bezier(.5,1.6,.4,1) both' : undefined }}>
                <BigLED value={currentPrice} />
              </div>
              {leaderName && (
                <div key={`leader-${pulseKey}`} style={{
                  display: 'flex', alignItems: 'center', gap: 24,
                  padding: '18px 36px 18px 22px', borderRadius: 999,
                  background: 'linear-gradient(90deg, rgba(255,46,136,.25), rgba(176,107,255,.18))',
                  border: '2px solid var(--ms-magenta)',
                  boxShadow: '0 0 0 1px rgba(255,46,136,.4), 0 12px 40px rgba(255,46,136,.45)',
                  animation: pulseKey > 0 ? 'ms-bounce-in .55s cubic-bezier(.4,1.6,.4,1) both' : undefined,
                  maxWidth: '100%',
                }}>
                  <span style={{ position: 'relative' }}>
                    <Avatar user={leader?.profile ?? { name: leaderName, color: '#ff2e88' }} size={72} />
                    <span style={{ position: 'absolute', top: -10, right: -10, fontSize: 28, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.4))' }}>👑</span>
                  </span>
                  <div style={{ lineHeight: 1.1, minWidth: 0 }}>
                    <div className="ms-eyebrow" style={{ fontSize: 11, color: 'var(--ms-magenta)' }}>LÍDER</div>
                    <div className="ms-display" style={{ fontSize: 52, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 520 }}>{leaderName}</div>
                    <div style={{ fontSize: 14, color: 'var(--ms-ink-dim)', marginTop: 2 }}>{leader?.profile?.handle ?? ''}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: others */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="ms-eyebrow" style={{ fontSize: 12, letterSpacing: '0.28em', color: 'var(--ms-ink-dim)', marginBottom: 4 }}>
                TAMBIÉN PUJANDO
              </div>
              {others.map((b, i) => (
                <div key={b.id ?? i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px 10px 10px', borderRadius: 14,
                  background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
                  marginRight: i * 12, opacity: 1 - i * 0.12,
                  animation: 'ms-bounce-in .4s cubic-bezier(.4,1.6,.4,1) both',
                }}>
                  <span style={{ width: 24, fontFamily: 'var(--ms-font-display)', fontSize: 16, color: 'var(--ms-ink-mute)', textAlign: 'center' }}>{i + 2}</span>
                  <Avatar user={b.profile ?? { name: b.bidder_name || 'Pujador', color: '#b06bff' }} size={32} />
                  <div style={{ flex: 1, minWidth: 0, lineHeight: 1.1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {b.bidder_name || b.profile?.name || 'Pujador'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--ms-ink-mute)' }}>{b.profile?.handle ?? ''}</div>
                  </div>
                  <span className="ms-mono" style={{ fontSize: 13, color: 'var(--ms-ink-dim)' }}>S/ {b.amount}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ position: 'absolute', bottom: 32, left: 48, right: 48, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="ms-eyebrow" style={{ fontSize: 12, letterSpacing: '0.28em', whiteSpace: 'nowrap' }}>ÚLTIMAS PUJAS</div>
            <div style={{ flex: 1, display: 'flex', gap: 8, overflow: 'hidden', padding: '4px 0' }}>
              {recentBids.slice(-8).reverse().map(b => (
                <div key={b.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px 8px 6px', borderRadius: 999,
                  background: b.delta >= 10
                    ? 'linear-gradient(90deg,rgba(255,46,136,.22),rgba(255,46,136,.08))'
                    : b.delta >= 5
                      ? 'linear-gradient(90deg,rgba(255,210,58,.18),rgba(255,210,58,.06))'
                      : 'linear-gradient(90deg,rgba(200,255,46,.18),rgba(200,255,46,.06))',
                  border: `1px solid ${b.delta >= 10 ? 'rgba(255,46,136,.4)' : b.delta >= 5 ? 'rgba(255,210,58,.4)' : 'rgba(200,255,46,.4)'}`,
                  animation: 'ms-bounce-in .4s cubic-bezier(.4,1.6,.4,1) both',
                  flexShrink: 0,
                }}>
                  <Avatar user={b.profile ?? { name: b.name, color: '#ff2e88' }} size={26} />
                  <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{b.name.split(' ')[0]}</span>
                  <span className="ms-mono" style={{
                    fontSize: 14, fontWeight: 700,
                    color: b.delta >= 10 ? 'var(--ms-magenta)' : b.delta >= 5 ? 'var(--ms-gold)' : 'var(--ms-lime)',
                  }}>+S/{b.delta}</span>
                </div>
              ))}
            </div>
            <Ribbon color={veryDanger ? 'var(--ms-magenta)' : 'var(--ms-gold-deep)'}>
              <IconArrowUp size={20} />
              {phase === 'closing' ? '¡QUE NO SE TE ESCAPE!' : 'PUJA AHORA'} · michistore.live
            </Ribbon>
          </div>
        </div>

        {coinKey > 0 && <CoinShower trigger={coinKey} />}

        {veryDanger && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(255,46,136,.35) 100%)',
            animation: 'ms-pulse .5s ease-in-out infinite', zIndex: 3,
          }} />
        )}
      </div>
    )
  }

  // ── PHASE: SOLD ──────────────────────────────────────────────
  const winnerName = lot?.winner_name ?? leaderName
  const winningPrice = lot?.winning_price ?? currentPrice

  return (
    <div className="ms-root" style={{
      width: '100vw', height: '100vh',
      background: 'radial-gradient(120% 80% at 50% 30%, rgba(255,210,58,.45), transparent 55%), radial-gradient(120% 80% at 50% 100%, rgba(255,46,136,.4), transparent 55%), linear-gradient(180deg,#2d0e6b,#08010f)',
      backgroundSize: '200% 200%', animation: 'ms-bg-shift 9s ease-in-out infinite',
    }}>
      <div className="ms-stars" />
      <ConfettiBurst count={120} seed={1} />
      <ConfettiBurst count={80} seed={2} durationOffset={1.2} />
      <Fireworks count={8} seed={3} />

      <div style={{
        position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 900, height: 900, borderRadius: '50%',
        background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255,210,58,.18) 60deg, transparent 120deg, rgba(255,46,136,.18) 180deg, transparent 240deg, rgba(42,240,255,.15) 300deg, transparent 360deg)',
        animation: 'ms-spin 14s linear infinite', filter: 'blur(12px)', zIndex: 1,
      }} />

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5,
      }}>
        <div style={{ animation: 'ms-bounce-in .6s cubic-bezier(.4,1.6,.4,1) both', marginBottom: 12 }}>
          <Ribbon color="var(--ms-magenta)">
            <IconHammer size={28} /> SUBASTA CERRADA · {lot?.name?.toUpperCase() ?? ''}
          </Ribbon>
        </div>

        <h1 className="ms-display" style={{
          fontSize: 240, margin: 0, lineHeight: 0.85,
          background: 'linear-gradient(180deg,#fff8e7 0%,#ffd23a 50%,#f5a300 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 16px 50px rgba(255,210,58,.4))',
          animation: 'ms-bounce-in .8s cubic-bezier(.4,1.6,.4,1) both',
        }}>¡VENDIDO!</h1>

        {winnerName && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 28, marginTop: 24,
            padding: '24px 48px 24px 28px', borderRadius: 999,
            background: 'linear-gradient(90deg, rgba(255,210,58,.28), rgba(255,46,136,.2))',
            border: '3px solid var(--ms-gold)',
            boxShadow: '0 16px 60px rgba(255,210,58,.5)',
            animation: 'ms-bounce-in .8s .2s cubic-bezier(.4,1.6,.4,1) both',
          }}>
            <span style={{ position: 'relative' }}>
              <Avatar user={leader?.profile ?? { name: winnerName, color: '#ffd23a' }} size={96} />
              <span style={{ position: 'absolute', top: -14, right: -14, fontSize: 44, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.4))' }}>👑</span>
            </span>
            <div style={{ lineHeight: 1.05 }}>
              <div className="ms-eyebrow" style={{ fontSize: 14, letterSpacing: '0.28em', color: 'var(--ms-gold)' }}>EL GANADOR</div>
              <div className="ms-display" style={{ fontSize: 64, marginTop: 8 }}>{winnerName}</div>
              <div style={{ fontSize: 18, color: 'var(--ms-ink-dim)', marginTop: 4 }}>{leader?.profile?.handle ?? ''}</div>
            </div>
            <div style={{ width: 2, height: 90, background: 'rgba(255,255,255,.2)', margin: '0 8px' }} />
            <div style={{ textAlign: 'left', lineHeight: 1.05 }}>
              <div className="ms-eyebrow" style={{ fontSize: 14, letterSpacing: '0.28em', color: 'var(--ms-gold)' }}>SE LO LLEVA POR</div>
              <div className="ms-display" style={{
                fontSize: 64, marginTop: 8,
                background: 'linear-gradient(180deg,#fff8e7,#ffd23a)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>S/ {winningPrice}</div>
            </div>
          </div>
        )}

        <div style={{
          marginTop: 32, fontSize: 18, color: 'var(--ms-ink-dim)', display: 'flex', alignItems: 'center', gap: 10,
          animation: 'ms-bounce-in .8s .4s cubic-bezier(.4,1.6,.4,1) both',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ms-cyan)', boxShadow: '0 0 8px var(--ms-cyan)', animation: 'ms-blink 1.2s infinite' }} />
          Siguiente lote en breve...
        </div>
      </div>
    </div>
  )
}
