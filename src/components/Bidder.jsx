import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useBeep } from '../hooks/useBeep'
import Avatar from './shared/Avatar'
import LEDPrice from './shared/LEDPrice'
import MichiFace from './shared/MichiFace'
import ConfettiBurst from './shared/ConfettiBurst'
import { IconBolt, IconUsers, IconDot } from './shared/Icons'

function StepRow({ entry, rank, total, isYou, stepUp }) {
  const offset = (total - rank) * 8
  return (
    <div
      className={`ms-step ${isYou ? 'ms-step-you' : ''}`}
      style={{
        marginLeft: offset,
        animation: stepUp ? 'ms-step-up .55s cubic-bezier(.4,1.6,.4,1)' : undefined,
      }}
    >
      <span className="ms-step-rank" style={{
        background: rank === 1 ? 'var(--ms-grad-gold)' : 'rgba(255,255,255,.1)',
        color: rank === 1 ? '#2a0f00' : 'var(--ms-ink)',
      }}>{rank}</span>
      <Avatar user={entry.profile} size={28} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {entry.profile?.name || 'Usuario'}
        {isYou && <span style={{ color: 'var(--ms-magenta)', marginLeft: 6, fontSize: 10 }}>● TÚ</span>}
      </span>
      <span className="ms-mono" style={{ fontSize: 13, fontWeight: 700, color: rank === 1 ? 'var(--ms-gold)' : 'var(--ms-ink)' }}>
        S/ {entry.amount}
      </span>
    </div>
  )
}

export default function Bidder() {
  const { lotId } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const beep = useBeep(true)

  const [lot, setLot] = useState(null)
  const [bids, setBids] = useState([])
  const [viewers, setViewers] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [shakeKey, setShakeKey] = useState(0)
  const [stepUpKey, setStepUpKey] = useState(0)
  const [burstKey, setBurstKey] = useState(0)
  const [placing, setPlacing] = useState(false)
  const [bidError, setBidError] = useState(null)
  const timerRef = useRef(null)

  const topBid = bids[0]
  const myBid  = bids.find(b => b.bidder_id === user?.id)
  const iAmLeader = topBid?.bidder_id === user?.id
  const wasOutbid = myBid && !iAmLeader
  const currentPrice = topBid?.amount ?? lot?.start_price ?? 0
  const danger = secondsLeft <= 10 && secondsLeft > 0

  // Si el lote ya está vendido (ej: al presionar Atrás), redirigir a la pantalla de ganador
  useEffect(() => {
    if (lot?.status === 'sold') navigate(`/winner/${lotId}`, { replace: true })
  }, [lot?.status])

  // Fetch initial data
  useEffect(() => {
    if (!lotId) return
    fetchLot()
    fetchBids()
  }, [lotId])

  // Timer tick
  useEffect(() => {
    clearInterval(timerRef.current)
    if (!lot) return

    const computeLeft = () => {
      if (lot.status !== 'live') return 0
      if (!lot.timer_ends_at) return lot.timer_remaining ?? 0
      const left = Math.max(0, Math.floor((new Date(lot.timer_ends_at) - Date.now()) / 1000))
      return left
    }

    setSecondsLeft(computeLeft())
    timerRef.current = setInterval(() => {
      const left = computeLeft()
      setSecondsLeft(left)
      if (left === 0) clearInterval(timerRef.current)
    }, 500)

    return () => clearInterval(timerRef.current)
  }, [lot])

  // Real-time subscriptions
  useEffect(() => {
    if (!lotId) return

    const lotSub = supabase
      .channel(`lot-${lotId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots', filter: `id=eq.${lotId}` }, payload => {
        setLot(payload.new)
        if (payload.new.status === 'sold') navigate(`/winner/${lotId}`)
      })
      .subscribe()

    const bidSub = supabase
      .channel(`bids-${lotId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `lot_id=eq.${lotId}` }, payload => {
        handleNewBid(payload.new)
      })
      .subscribe()

    return () => { supabase.removeChannel(lotSub); supabase.removeChannel(bidSub) }
  }, [lotId, user?.id])

  // Viewers en tiempo real via Presence
  useEffect(() => {
    if (!lotId) return
    const ch = supabase.channel(`presence-lot-${lotId}`)
      .on('presence', { event: 'sync' }, () => {
        setViewers(Object.keys(ch.presenceState()).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ uid: user?.id ?? 'guest', at: Date.now() })
        }
      })
    return () => supabase.removeChannel(ch)
  }, [lotId, user?.id])

  async function fetchLot() {
    const { data } = await supabase.from('lots').select('*').eq('id', lotId).single()
    if (data) setLot(data)
  }

  async function fetchBids() {
    const { data } = await supabase
      .from('bids')
      .select('*, profile:profiles(id, name, color, handle)')
      .eq('lot_id', lotId)
      .order('amount', { ascending: false })
      .limit(20)
    if (data) setBids(data)
  }

  function handleNewBid(newBid) {
    setBids(prev => {
      const filtered = prev.filter(b => b.bidder_id !== newBid.bidder_id)
      const enriched = [...filtered, newBid].sort((a, b) => b.amount - a.amount)
      if (newBid.bidder_id !== user?.id) {
        setShakeKey(k => k + 1)
        beep(220, 0.18, 'sawtooth', 0.06)
      }
      return enriched.slice(0, 20)
    })
    // Re-fetch for profile data
    supabase.from('bids').select('*, profile:profiles(id, name, color, handle)').eq('id', newBid.id).single()
      .then(({ data }) => {
        if (data) setBids(prev => {
          const filtered = prev.filter(b => b.id !== data.id && b.bidder_id !== data.bidder_id)
          return [...filtered, data].sort((a, b) => b.amount - a.amount).slice(0, 20)
        })
      })
  }

  const placeBid = useCallback(async (delta) => {
    if (!user || !lot || placing || lot.status !== 'live') return
    setPlacing(true)
    const newAmount = currentPrice + delta
    beep(880, 0.06, 'square', 0.05)
    setTimeout(() => beep(1320, 0.08, 'square', 0.05), 80)
    setStepUpKey(k => k + 1)
    setBurstKey(k => k + 1)

    const updates = {}
    if (lot.timer_ends_at) {
      const remaining = Math.floor((new Date(lot.timer_ends_at) - Date.now()) / 1000)
      const antiSnipe = lot.anti_snipe_seconds ?? 5
      if (remaining < antiSnipe) {
        const extension = lot.anti_snipe_extension ?? 10
        const newEndsAt = new Date(new Date(lot.timer_ends_at).getTime() + extension * 1000).toISOString()
        updates.timer_ends_at = newEndsAt
      }
    }

    const [{ error }] = await Promise.all([
      supabase.from('bids').insert({ lot_id: lotId, bidder_id: user.id, amount: newAmount, delta }),
      Object.keys(updates).length ? supabase.from('lots').update(updates).eq('id', lotId) : Promise.resolve(),
    ])
    if (error) {
      setBidError('No se pudo registrar la puja. Intenta de nuevo.')
      setTimeout(() => setBidError(null), 3000)
    }
    setPlacing(false)
  }, [user, lot, placing, currentPrice, lotId])

  if (!lot) return (
    <div style={{ minHeight: '100vh', background: 'var(--ms-bg-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--ms-magenta)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'ms-spin 0.7s linear infinite' }} />
    </div>
  )

  if (lot.status === 'pending') return (
    <div style={{ minHeight: '100vh', background: 'var(--ms-grad-hero)', backgroundSize: '200% 200%', animation: 'ms-bg-shift 14s ease-in-out infinite', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <div className="ms-stars" />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div style={{ width: 96, height: 96, borderRadius: 20, background: 'linear-gradient(135deg,#ff2e88,#b06bff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, overflow: 'hidden', margin: '0 auto 16px' }}>
          {lot.image_url
            ? <img src={lot.image_url} alt={lot.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : lot.emoji}
        </div>
        <h2 className="ms-display" style={{ fontSize: 32 }}>{lot.name}</h2>
        <p style={{ color: 'var(--ms-ink-dim)', marginTop: 8 }}>La subasta comienza pronto...</p>
        <div className="ms-chip ms-chip-live" style={{ marginTop: 16, display: 'inline-flex' }}>
          <span className="ms-dot" /> Esperando al admin
        </div>
      </div>
    </div>
  )

  if (lot.status === 'sold') return (
    <div style={{ minHeight: '100vh', background: 'var(--ms-bg-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--ms-gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'ms-spin 0.7s linear infinite' }} />
    </div>
  )

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  return (
    <div className="ms-root" style={{
      width: '100%', minHeight: '100vh',
      background: 'linear-gradient(180deg,#14062a 0%,#08010f 60%,#1a0a36 100%)',
      overflowY: 'auto', overflowX: 'hidden',
    }}>
      <div className="ms-stars" />

      {/* Header */}
      <div className="ms-statusbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--ms-grad-gold)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <MichiFace size={22} />
          </span>
          <div style={{ lineHeight: 1 }}>
            <div className="ms-display" style={{ fontSize: 14 }}>MichiStore</div>
            <div className="ms-mono" style={{ fontSize: 8.5, color: 'var(--ms-ink-dim)', letterSpacing: '0.18em' }}>LIVE AUCTION</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="ms-chip ms-chip-live" style={{ fontSize: 9.5, padding: '3px 8px' }}>
            <span className="ms-dot" style={{ width: 5, height: 5 }} /> EN VIVO
          </span>
          {viewers > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, color: 'var(--ms-ink-dim)' }}>
              <IconUsers size={10} /> {viewers}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '0 16px 80px', position: 'relative', zIndex: 1 }}>
        {/* Item card */}
        <div key={shakeKey} className={wasOutbid ? 'ms-shake' : ''}
          style={{
            margin: '8px 0 0', padding: 14, borderRadius: 22, position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(160deg,rgba(255,46,136,.18),rgba(42,240,255,.12))',
            border: '1px solid rgba(255,255,255,.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="ms-photo" style={{ width: 78, height: 78, borderRadius: 16, fontSize: 36, background: 'linear-gradient(135deg,#ff2e88,#b06bff)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {lot.image_url
                ? <img src={lot.image_url} alt={lot.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : lot.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ms-eyebrow" style={{ color: 'var(--ms-gold)' }}>{lot.hint || `LOTE · ${lot.name}`}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, lineHeight: 1.2 }}>{lot.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ms-ink-dim)', marginTop: 3 }}>{lot.color_desc}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ms-eyebrow">PUJA ACTUAL</div>
              <div style={{ marginTop: 6 }}>
                <LEDPrice value={currentPrice} fontSize={36} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div className="ms-eyebrow">TIEMPO</div>
              <span className={`ms-clock ${danger ? 'ms-clock-danger' : ''}`}>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>
            </div>
          </div>

          {topBid && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <Avatar user={topBid.profile} size={22} />
              <div style={{ fontSize: 11, color: 'var(--ms-ink-dim)' }}>
                líder: <b style={{ color: iAmLeader ? 'var(--ms-lime)' : 'var(--ms-ink)' }}>
                  {iAmLeader ? '¡Tú!' : topBid.profile?.name || 'Alguien'}
                </b>
              </div>
            </div>
          )}
        </div>

        {/* Status banner */}
        <div style={{ margin: '12px 0', textAlign: 'center', minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {wasOutbid ? (
            <div style={{
              padding: '8px 14px', borderRadius: 999,
              background: 'linear-gradient(90deg,rgba(255,46,136,.25),rgba(255,46,136,.1))',
              border: '1px solid var(--ms-magenta)',
              fontSize: 12, fontWeight: 700, color: 'var(--ms-magenta)',
              animation: 'ms-pulse 1s ease-in-out infinite',
            }}>
              😾 ¡{topBid?.profile?.name || 'Alguien'} te superó! Súbele.
            </div>
          ) : iAmLeader ? (
            <div style={{
              padding: '8px 14px', borderRadius: 999,
              background: 'linear-gradient(90deg,rgba(200,255,46,.25),rgba(255,210,58,.18))',
              border: '1px solid var(--ms-lime)',
              fontSize: 12, fontWeight: 700, color: 'var(--ms-lime)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <IconBolt size={12} /> VAS GANANDO — no bajes la guardia, michi
            </div>
          ) : (
            <div style={{
              padding: '8px 14px', borderRadius: 999,
              background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
              fontSize: 12, color: 'var(--ms-ink-dim)',
            }}>
              📣 Toca un botón para entrar a la subasta
            </div>
          )}
        </div>

        {/* Error toast */}
        {bidError && (
          <div style={{
            margin: '0 0 8px', padding: '10px 14px', borderRadius: 12,
            background: 'linear-gradient(90deg,rgba(255,46,136,.22),rgba(255,46,136,.08))',
            border: '1px solid var(--ms-magenta)',
            fontSize: 12, fontWeight: 700, color: 'var(--ms-magenta)', textAlign: 'center',
          }}>
            ⚠️ {bidError}
          </div>
        )}

        {/* Bid buttons */}
        <div>
          <div className="ms-eyebrow" style={{ marginBottom: 6 }}>SÚBELE A LA PUJA</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, position: 'relative' }}>
            {[1, 5, 10].map((delta, i) => (
              <button
                key={delta}
                className={`ms-btn-bid ms-btn-bid-${delta}`}
                onClick={() => placeBid(delta)}
                disabled={placing || lot.status !== 'live'}
              >
                <div style={{ fontSize: 11, letterSpacing: '0.08em', opacity: .8, fontFamily: 'var(--ms-font-body)', fontWeight: 700 }}>+S/</div>
                <div>{delta}</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--ms-ink-mute)', marginTop: 6, textAlign: 'center' }}>
            Tu próxima puja sería <b className="ms-mono" style={{ color: 'var(--ms-gold)' }}>S/ {currentPrice + 1}</b> ↑
          </div>
        </div>

        {/* Staircase */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="ms-eyebrow">ESCALERA DE PUJAS</span>
            <span style={{ fontSize: 10, color: 'var(--ms-ink-mute)' }}>{bids.length} pujas</span>
          </div>
          <div key={stepUpKey} style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
            {bids.slice(0, 5).map((e, i) => (
              <StepRow
                key={e.id || i}
                entry={e}
                rank={i + 1}
                total={Math.min(bids.length, 5)}
                isYou={e.bidder_id === user?.id}
                stepUp={i === 0 && e.bidder_id === user?.id && stepUpKey > 0}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Confetti */}
      {iAmLeader && burstKey > 0 && (
        <div key={`c-${burstKey}`} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 99 }}>
          <ConfettiBurst count={26} seed={burstKey} />
        </div>
      )}
    </div>
  )
}
