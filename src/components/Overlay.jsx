import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Avatar from './shared/Avatar'
import LEDPrice from './shared/LEDPrice'
import MichiFace from './shared/MichiFace'
import ConfettiBurst from './shared/ConfettiBurst'
import Fireworks from './shared/Fireworks'
import { IconUsers, IconShare, IconMic } from './shared/Icons'

function FlyingBid({ user, name, amount, onDone, side = 'right' }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400)
    return () => clearTimeout(t)
  }, [])
  const displayName = name || user?.name || 'Alguien'
  return (
    <div style={{
      position: 'absolute',
      right: side === 'right' ? '8%' : 'auto',
      left: side === 'left' ? '8%' : 'auto',
      bottom: '34%',
      animation: 'ms-fly 2.4s cubic-bezier(.5,1.4,.4,1) forwards',
      zIndex: 5,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px 6px 6px', borderRadius: 999,
        background: 'linear-gradient(90deg, rgba(255,46,136,.95), rgba(176,107,255,.85))',
        boxShadow: '0 8px 32px rgba(255,46,136,.6), 0 0 0 2px rgba(255,255,255,.4)',
        color: '#fff',
      }}>
        <Avatar user={user} size={32} />
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: .9 }}>{displayName}</div>
          <div className="ms-mono" style={{ fontSize: 14, fontWeight: 800 }}>+S/ {amount} ↑</div>
        </div>
      </div>
    </div>
  )
}

function Reaction({ emoji, x, delay }) {
  return (
    <span style={{
      position: 'absolute', bottom: '25%', left: `${x}%`,
      fontSize: 22 + Math.random() * 12,
      animation: `ms-react 3s ease-out ${delay}s forwards`,
      opacity: 0, zIndex: 4,
    }}>
      {emoji}
    </span>
  )
}

export default function Overlay() {
  const { lotId } = useParams()
  const [lot, setLot] = useState(null)
  const [topBids, setTopBids] = useState([])
  const [flyingBids, setFlyingBids] = useState([])
  const [reactions, setReactions] = useState([])
  const [overlayEvents, setOverlayEvents] = useState([])
  const [pulse, setPulse] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [showEffect, setShowEffect] = useState(null)
  const idRef = useRef(0)
  const timerRef = useRef(null)

  const currentPrice = topBids[0]?.amount ?? lot?.start_price ?? 0
  const leader = topBids[0]?.profile
  const leaderName = topBids[0]?.bidder_name || leader?.name || null
  const danger = secondsLeft <= 10 && secondsLeft > 0

  useEffect(() => {
    if (!lotId) return
    fetchData()

    const lotSub = supabase
      .channel(`overlay-lot-${lotId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots', filter: `id=eq.${lotId}` }, payload => {
        setLot(payload.new)
      })
      .subscribe()

    const bidSub = supabase
      .channel(`overlay-bids-${lotId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `lot_id=eq.${lotId}` }, payload => {
        handleNewBid(payload.new)
      })
      .subscribe()

    const eventSub = supabase
      .channel(`overlay-events-${lotId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'overlay_events', filter: `lot_id=eq.${lotId}` }, payload => {
        handleOverlayEvent(payload.new)
      })
      .subscribe()

    const reactionTimer = setInterval(() => {
      setReactions(prev => {
        const arr = [...prev.slice(-12)]
        arr.push({
          id: Date.now() + Math.random(),
          e: ['💖', '😻', '🔥', '💎', '✨', '🎉', '😼', '💸'][Math.floor(Math.random() * 8)],
          x: 5 + Math.random() * 60,
          delay: 0,
        })
        return arr
      })
    }, 800)

    return () => {
      supabase.removeChannel(lotSub)
      supabase.removeChannel(bidSub)
      supabase.removeChannel(eventSub)
      clearInterval(reactionTimer)
    }
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
      supabase.from('bids').select('*, profile:profiles(id,name,color)').eq('lot_id', lotId).order('amount', { ascending: false }).limit(5),
    ])
    if (lotData) setLot(lotData)
    if (bidsData) setTopBids(bidsData)
  }

  function handleNewBid(newBid) {
    setPulse(k => k + 1)
    idRef.current++
    const bidId = idRef.current
    setFlyingBids(prev => [...prev.slice(-4), { id: bidId, user: null, name: newBid.bidder_name || null, amount: newBid.delta, side: bidId % 2 ? 'right' : 'left' }])

    supabase.from('bids').select('*, profile:profiles(id,name,color)').eq('id', newBid.id).single()
      .then(({ data }) => {
        if (data) {
          setTopBids(prev => {
            const filtered = data.bidder_id
              ? prev.filter(b => b.bidder_id !== data.bidder_id)
              : prev.filter(b => !(b.bidder_id === null && b.bidder_name === data.bidder_name))
            return [...filtered, data].sort((a, b) => b.amount - a.amount).slice(0, 5)
          })
          setFlyingBids(prev => prev.map(f => f.id === bidId ? { ...f, user: data.profile, name: data.bidder_name || null } : f))
        }
      })
  }

  function handleOverlayEvent(event) {
    setShowEffect(event)
    setTimeout(() => setShowEffect(null), 4000)
  }

  const removeFlying = (id) => setFlyingBids(prev => prev.filter(f => f.id !== id))

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  return (
    <div className="ms-root" style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(180deg,#08010f, #14062a 60%, #08010f)',
      overflow: 'hidden',
    }}>
      {/* Live backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(120% 60% at 50% 30%, rgba(255,46,136,.15), transparent 60%), repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 18px, transparent 18px 36px)',
        opacity: .9,
      }} />
      <div className="ms-stars" />

      {/* Overlay effects */}
      {showEffect?.type === 'confetti' && <ConfettiBurst count={80} seed={Date.now()} />}
      {showEffect?.type === 'fireworks' && <Fireworks count={8} seed={Date.now()} />}
      {showEffect?.type === 'sold' && (
        <>
          <ConfettiBurst count={100} seed={42} />
          <Fireworks count={10} seed={99} />
        </>
      )}
      {showEffect?.message && (
        <div style={{
          position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%,-50%)',
          padding: '14px 28px', borderRadius: 20,
          background: 'linear-gradient(90deg,var(--ms-magenta),var(--ms-violet))',
          fontSize: 20, fontWeight: 700, textAlign: 'center',
          boxShadow: '0 20px 60px rgba(255,46,136,.6)',
          animation: 'ms-pop-in .4s cubic-bezier(.4,1.6,.4,1) both',
          zIndex: 20,
        }}>
          {showEffect.message}
        </div>
      )}

      {/* Top chrome */}
      <div style={{ position: 'absolute', top: 18, left: 18, right: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 6 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 12px 5px 5px', borderRadius: 999,
          background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,.08)',
        }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--ms-grad-gold)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <MichiFace size={26} />
          </span>
          <div style={{ lineHeight: 1.05 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>@michistore</div>
            <div style={{ fontSize: 10, color: 'var(--ms-ink-dim)' }}>Subasta Live · Lima 🇵🇪</div>
          </div>
          <button style={{
            appearance: 'none', border: 0, marginLeft: 8, padding: '5px 12px', borderRadius: 999,
            background: 'var(--ms-magenta)', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer',
          }}>Seguir</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="ms-chip ms-chip-live" style={{ fontSize: 10, padding: '4px 10px', background: 'rgba(0,0,0,.5)' }}>
            <span className="ms-dot" /> LIVE
          </span>
        </div>
      </div>

      {/* Center: faux video */}
      <div style={{
        position: 'absolute', top: '15%', left: '12%', right: '12%', bottom: '42%',
        borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 40%, rgba(255,46,136,.5), transparent 65%), linear-gradient(135deg, #2d0e6b, #14062a)',
        border: '1px solid rgba(255,255,255,.08)', overflow: 'hidden',
      }}>
        <div style={{ fontSize: 80, filter: 'drop-shadow(0 8px 30px rgba(255,210,58,.5))' }}>🎙️</div>
        <div style={{
          position: 'absolute', bottom: 10, left: 10,
          display: 'flex', gap: 6, alignItems: 'center',
          padding: '4px 10px', borderRadius: 999, background: 'rgba(0,0,0,.55)',
          fontSize: 10, color: 'var(--ms-ink-dim)',
        }}>
          <IconMic size={10} /> Host: @michistore
        </div>
      </div>

      {/* Reactions */}
      {reactions.map(r => <Reaction key={r.id} emoji={r.e} x={r.x} delay={r.delay} />)}
      {flyingBids.map(f => <FlyingBid key={f.id} {...f} onDone={() => removeFlying(f.id)} />)}

      {/* QR */}
      {lot && (
        <div style={{
          position: 'absolute', top: '15%', right: '4%', width: 74,
          padding: 8, borderRadius: 14, background: '#fff', color: '#08010f',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          boxShadow: '0 10px 30px rgba(0,0,0,.4)', zIndex: 6,
          animation: 'ms-pulse 2.4s ease-in-out infinite',
        }}>
          <div style={{ width: 60, height: 60, background: `repeating-conic-gradient(#08010f 0% 25%, transparent 0% 50%) 0/8px 8px`, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 4, left: 4, width: 14, height: 14, border: '3px solid #08010f', borderRadius: 2 }} />
            <div style={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, border: '3px solid #08010f', borderRadius: 2 }} />
            <div style={{ position: 'absolute', bottom: 4, left: 4, width: 14, height: 14, border: '3px solid #08010f', borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 8, fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>ESCANEA<br />Y PUJA</div>
        </div>
      )}

      {/* Top bids tower */}
      {topBids.length > 0 && (
        <div style={{ position: 'absolute', left: '4%', top: '45%', width: 140, zIndex: 5 }}>
          <div className="ms-eyebrow" style={{ color: 'var(--ms-cyan)', marginBottom: 6, textShadow: '0 0 8px var(--ms-cyan-glow)' }}>TOP PUJAS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {topBids.slice(0, 3).map((b, i) => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px 5px 5px', borderRadius: 10, marginLeft: i * 8,
                background: i === 0 ? 'linear-gradient(90deg,rgba(255,210,58,.95),rgba(245,163,0,.8))' : 'rgba(0,0,0,.55)',
                border: i === 0 ? '1px solid rgba(255,255,255,.4)' : '1px solid rgba(255,255,255,.08)',
                color: i === 0 ? '#2a0f00' : '#fff', fontSize: 11, fontWeight: 700,
                boxShadow: i === 0 ? '0 6px 20px rgba(255,210,58,.5)' : 'none',
              }}>
                <Avatar user={b.profile} size={20} />
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }}>
                  {b.bidder_name || b.profile?.name || 'Pujador'}
                </div>
                <span className="ms-mono" style={{ fontSize: 11 }}>S/{b.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom panel */}
      {lot && (
        <div className="ms-overlay-card" style={{
          position: 'absolute', bottom: 18, left: 14, right: 14, padding: 14,
          boxShadow: '0 -20px 60px rgba(0,0,0,.5)', zIndex: 7,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 54, height: 54, borderRadius: 12,
              background: 'linear-gradient(135deg,#ff2e88,#b06bff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
              boxShadow: '0 6px 20px rgba(255,46,136,.4)',
            }}>{lot.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ms-eyebrow" style={{ color: 'var(--ms-magenta)' }}>SUBASTANDO AHORA</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{lot.name}</div>
              <div style={{ fontSize: 10, color: 'var(--ms-ink-dim)' }}>{lot.color_desc}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="ms-eyebrow">CIERRA EN</div>
              <span className={`ms-clock ${danger ? 'ms-clock-danger' : ''}`} style={{ fontSize: 20, padding: '4px 10px', marginTop: 4 }}>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 12 }}>
            <div key={pulse} style={{ animation: 'ms-pricepop 0.5s cubic-bezier(.5,1.6,.4,1) both' }}>
              <LEDPrice value={currentPrice} fontSize={40} />
            </div>
            {leaderName && (
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 9, color: 'var(--ms-ink-mute)', letterSpacing: '0.1em' }}>LÍDER</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,46,136,.18)', border: '1px solid rgba(255,46,136,.4)' }}>
                  <Avatar user={leader} size={22} />
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{leaderName}</span>
                </div>
              </div>
            )}
          </div>

          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 12,
            background: 'linear-gradient(90deg,rgba(200,255,46,.12),rgba(42,240,255,.12))',
            border: '1px dashed rgba(200,255,46,.4)',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600,
          }}>
            <span style={{ fontSize: 14 }}>👉</span>
            <span style={{ flex: 1 }}>Entra a <b className="ms-mono" style={{ color: 'var(--ms-lime)' }}>michistore.live/auction</b></span>
            <IconShare size={12} />
          </div>
        </div>
      )}
    </div>
  )
}
