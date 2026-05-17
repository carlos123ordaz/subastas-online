import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useBeep } from '../hooks/useBeep'
import Avatar from './shared/Avatar'
import LEDPrice from './shared/LEDPrice'
import MichiFace from './shared/MichiFace'
import {
  IconBolt, IconHammer, IconPlay, IconPause,
  IconPlus, IconCheck, IconTrash, IconLink, IconLogout
} from './shared/Icons'

const EFFECT_BUTTONS = [
  { e: '🎉', n: 'Confetti',       type: 'confetti' },
  { e: '🎆', n: 'Fuegos',         type: 'fireworks' },
  { e: '💰', n: 'Lluvia coins',   type: 'coins' },
  { e: '⚡', n: 'Shake',          type: 'shake' },
  { e: '🚨', n: 'Última llamada', type: 'last_call', message: '🚨 ÚLTIMA LLAMADA' },
  { e: '🏆', n: '¡Vendido!',      type: 'sold',      message: '🏆 ¡VENDIDO!' },
]

// Sube imagen a Supabase Storage y devuelve la URL pública
async function uploadLotImage(file, lotId) {
  const ext = file.name.split('.').pop().toLowerCase()
  const path = `lots/${lotId}.${ext}`
  const { error } = await supabase.storage.from('lot-images').upload(path, file, { upsert: true })
  if (error) { console.error('Upload error:', error); return null }
  const { data } = supabase.storage.from('lot-images').getPublicUrl(path)
  return data.publicUrl
}

export default function Admin() {
  const { auctionId } = useParams()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const beep = useBeep(true)
  const fileInputRef = useRef(null)
  const lotFileInputRef = useRef(null)

  const [auction, setAuction]           = useState(null)
  const [lots, setLots]                 = useState([])
  const [activeLotId, setActiveLotId]   = useState(null)
  const [bids, setBids]                 = useState([])
  const [secondsLeft, setSecondsLeft]   = useState(0)
  const [messageInput, setMessageInput] = useState('')
  const [addingLot, setAddingLot]       = useState(false)
  const [newLot, setNewLot]             = useState({ name: '', emoji: '📦', color_desc: '', start_price: 10, hint: '' })
  const [newLotFile, setNewLotFile]     = useState(null)   // imagen del nuevo lote
  const [newLotPreview, setNewLotPreview] = useState(null)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [savingWa, setSavingWa]         = useState(false)
  const [waInput, setWaInput]           = useState('')
  const [editingWa, setEditingWa]       = useState(false)
  const [ctxMenu, setCtxMenu]               = useState(null)
  const [participants, setParticipants]     = useState([])
  const [selectedP, setSelectedP]           = useState(null) // participant id
  const [bidDelta, setBidDelta]             = useState(1)
  const [placingManual, setPlacingManual]   = useState(false)
  const [newPName, setNewPName]             = useState('')
  const [addingP, setAddingP]               = useState(false)
  const [winnerModal, setWinnerModal]       = useState(null) // { lotName, lotEmoji, lotImage, winnerName, price }
  const [imgModal, setImgModal]             = useState(null) // URL de imagen a ampliar
  const [isMobile, setIsMobile]             = useState(() => window.innerWidth < 768)
  const [mobileTab, setMobileTab]           = useState('control')
  const timerRef = useRef(null)
  const newPInputRef = useRef(null)
  const didAutoSelectRef = useRef(false)

  const activeLot    = lots.find(l => l.id === activeLotId)
  const topBid       = bids[0]
  const currentPrice = topBid?.amount ?? activeLot?.start_price ?? 0
  const danger       = secondsLeft <= 10 && secondsLeft > 0
  const mins         = Math.floor(secondsLeft / 60)
  const secs         = secondsLeft % 60

  useEffect(() => {
    if (!auctionId) return
    fetchAuction()
    fetchLots()
  }, [auctionId])

  useEffect(() => {
    if (auction) setWaInput(auction.whatsapp_number || '')
  }, [auction])

  useEffect(() => {
    if (!auctionId) return
    fetchParticipants()
    const sub = supabase.channel(`admin-participants-${auctionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `auction_id=eq.${auctionId}` }, fetchParticipants)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [auctionId])

  useEffect(() => {
    if (!auctionId) return
    const sub = supabase.channel(`admin-lots-${auctionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lots', filter: `auction_id=eq.${auctionId}` }, () => fetchLots())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [auctionId])

  useEffect(() => {
    if (!activeLotId) return
    fetchBids()
    const sub = supabase.channel(`admin-bids-${activeLotId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `lot_id=eq.${activeLotId}` }, payload => handleNewBid(payload.new))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [activeLotId])

  useEffect(() => {
    clearInterval(timerRef.current)
    if (!activeLot) return
    const computeLeft = () => {
      if (activeLot.status !== 'live') return activeLot.timer_remaining ?? activeLot.timer_duration ?? 60
      if (!activeLot.timer_ends_at) return activeLot.timer_remaining ?? 0
      return Math.max(0, Math.floor((new Date(activeLot.timer_ends_at) - Date.now()) / 1000))
    }
    setSecondsLeft(computeLeft())
    timerRef.current = setInterval(() => setSecondsLeft(computeLeft()), 500)
    return () => clearInterval(timerRef.current)
  }, [activeLot])

  async function fetchParticipants() {
    const { data } = await supabase.from('participants').select('*').eq('auction_id', auctionId).order('created_at')
    if (data) setParticipants(data)
  }

  async function addParticipant() {
    const name = newPName.trim()
    if (!name) return
    const { data } = await supabase.from('participants').insert({ auction_id: auctionId, name }).select().single()
    if (data) {
      setParticipants(prev => [...prev, data])
      setSelectedP(data.id)
    }
    setNewPName('')
    setAddingP(false)
  }

  async function removeParticipant(id) {
    await supabase.from('participants').delete().eq('id', id)
    setParticipants(prev => prev.filter(p => p.id !== id))
    if (selectedP === id) setSelectedP(null)
  }

  async function fetchAuction() {
    const { data } = await supabase.from('auctions').select('*').eq('id', auctionId).single()
    if (data) setAuction(data)
  }

  async function fetchLots() {
    const { data } = await supabase.from('lots').select('*').eq('auction_id', auctionId).order('order_num')
    if (data) {
      setLots(data)
      if (!didAutoSelectRef.current && data.length > 0) {
        didAutoSelectRef.current = true
        const preferred = data.find(l => l.status === 'live')
          ?? data.find(l => l.status === 'pending')
          ?? data[0]
        setActiveLotId(preferred.id)
      }
    }
  }

  async function fetchBids() {
    const { data } = await supabase
      .from('bids')
      .select('*, profile:profiles(id,name,color,handle)')
      .eq('lot_id', activeLotId)
      .order('amount', { ascending: false })
      .limit(20)
    if (data) setBids(data)
  }

  function handleNewBid(newBid) {
    beep(700 + Math.random() * 200, 0.06, 'square', 0.02)
    supabase.from('bids').select('*, profile:profiles(id,name,color,handle)').eq('id', newBid.id).single()
      .then(({ data }) => {
        if (data) setBids(prev => {
          const filtered = data.bidder_id
            ? prev.filter(b => b.bidder_id !== data.bidder_id)
            : prev.filter(b => !(b.bidder_id === null && b.bidder_name === data.bidder_name))
          return [...filtered, data].sort((a, b) => b.amount - a.amount).slice(0, 20)
        })
      })
  }

  const startTimer = useCallback(async () => {
    if (!activeLot) return
    const remaining = activeLot.timer_remaining ?? activeLot.timer_duration ?? 60
    await supabase.from('lots').update({
      status: 'live',
      timer_ends_at: new Date(Date.now() + remaining * 1000).toISOString(),
      timer_remaining: null,
    }).eq('id', activeLotId)
    await supabase.from('auctions').update({ status: 'live' }).eq('id', auctionId)
    beep(440, 0.12)
  }, [activeLot, activeLotId, auctionId])

  const pauseTimer = useCallback(async () => {
    if (!activeLot) return
    const remaining = Math.max(0, Math.floor((new Date(activeLot.timer_ends_at) - Date.now()) / 1000))
    await supabase.from('lots').update({ timer_ends_at: null, timer_remaining: remaining }).eq('id', activeLotId)
    beep(330, 0.1)
  }, [activeLot, activeLotId])

  const addTime = useCallback(async (n) => {
    if (!activeLot) return
    beep(440, 0.08)
    if (activeLot.timer_ends_at) {
      await supabase.from('lots').update({
        timer_ends_at: new Date(new Date(activeLot.timer_ends_at).getTime() + n * 1000).toISOString()
      }).eq('id', activeLotId)
    } else {
      await supabase.from('lots').update({ timer_remaining: (activeLot.timer_remaining ?? 0) + n }).eq('id', activeLotId)
    }
  }, [activeLot, activeLotId])

  const closeLot = useCallback(async () => {
    if (!activeLot) return
    const winner = bids[0]
    await supabase.from('lots').update({
      status: 'sold', timer_ends_at: null,
      winner_id: winner?.bidder_id ?? null,
      winner_name: winner?.bidder_name ?? winner?.profile?.name ?? null,
      winning_price: winner?.amount ?? null,
    }).eq('id', activeLotId)
    await sendEffect('sold', '🏆 ¡VENDIDO!')
    beep(660, 0.08); setTimeout(() => beep(880, 0.12), 120); setTimeout(() => beep(1100, 0.16), 240)
    setWinnerModal({
      lotName:   activeLot.name,
      lotEmoji:  activeLot.emoji,
      lotImage:  activeLot.image_url ?? null,
      winnerName: winner?.bidder_name ?? winner?.profile?.name ?? null,
      price:     winner?.amount ?? null,
    })
  }, [activeLot, activeLotId, bids])

  const placeBidManual = async () => {
    const p = participants.find(x => x.id === selectedP)
    if (!p || !activeLot || placingManual || activeLot.status !== 'live') return
    const newAmount = Math.round((currentPrice + bidDelta) * 100) / 100
    if (newAmount < 0.5) return
    setPlacingManual(true)
    beep(880, 0.08); setTimeout(() => beep(1320, 0.1), 80)
    await supabase.from('bids').insert({
      lot_id: activeLotId,
      bidder_id: null,
      bidder_name: p.name,
      amount: newAmount,
      delta: bidDelta,
    })
    setPlacingManual(false)
  }

  const sendEffect = async (type, message = '') => {
    await supabase.from('overlay_events').insert({ lot_id: activeLotId, auction_id: auctionId, type, message: message || null })
    beep(500 + Math.random() * 200, 0.1)
  }

  const sendMessage = async () => {
    if (!messageInput.trim()) return
    await sendEffect('message', messageInput.trim())
    setMessageInput('')
  }

  // Imagen del nuevo lote seleccionada (preview)
  const handleNewLotFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNewLotFile(file)
    setNewLotPreview(URL.createObjectURL(file))
  }

  const addLot = async () => {
    if (!newLot.name.trim()) return
    setUploadingImg(true)
    const { data: inserted, error } = await supabase.from('lots').insert({
      ...newLot,
      auction_id: auctionId,
      order_num: lots.length,
      status: 'pending',
      timer_duration: 60,
      timer_remaining: 60,
    }).select().single()

    if (!error && inserted && newLotFile) {
      const url = await uploadLotImage(newLotFile, inserted.id)
      if (url) await supabase.from('lots').update({ image_url: url }).eq('id', inserted.id)
    }

    setNewLot({ name: '', emoji: '📦', color_desc: '', start_price: 10, hint: '' })
    setNewLotFile(null)
    setNewLotPreview(null)
    setAddingLot(false)
    setUploadingImg(false)
  }

  // Subir / reemplazar imagen de un lote existente
  const handleLotImageChange = async (e, lotId) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImg(true)
    const url = await uploadLotImage(file, lotId)
    if (url) await supabase.from('lots').update({ image_url: url }).eq('id', lotId)
    setUploadingImg(false)
  }

  const deleteLot = async (id) => {
    await supabase.from('lots').delete().eq('id', id)
    setLots(prev => prev.filter(l => l.id !== id))
    if (activeLotId === id) { setActiveLotId(null); setBids([]) }
  }

  const clearBids = async (id) => {
    await supabase.from('bids').delete().eq('lot_id', id)
    if (id === activeLotId) setBids([])
  }

  const saveWhatsApp = async () => {
    setSavingWa(true)
    await supabase.from('auctions').update({ whatsapp_number: waInput.trim() }).eq('id', auctionId)
    await fetchAuction()
    setSavingWa(false)
    setEditingWa(false)
  }

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isRunning    = activeLot?.status === 'live' && !!activeLot?.timer_ends_at
  const totalRevenue = lots.filter(l => l.status === 'sold').reduce((sum, l) => sum + (l.winning_price || 0), 0)
  const overlayUrl   = `${window.location.origin}/overlay/${activeLotId}`

  return (
    <div className="ms-root" style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(180deg,#0a0218,#08010f)',
      ...(isMobile
        ? { display: 'flex', flexDirection: 'column' }
        : { display: 'grid', gridTemplateColumns: '260px 1fr 320px', gridTemplateRows: '48px 1fr' }
      ),
      fontSize: 13, overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        ...(isMobile ? { flexShrink: 0 } : { gridColumn: '1 / -1' }),
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 48, padding: '0 12px', borderBottom: '1px solid rgba(255,255,255,.08)',
        background: 'rgba(8,1,15,.7)', backdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--ms-grad-gold)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MichiFace size={20} />
          </span>
          {!isMobile && (
            <div style={{ lineHeight: 1.05 }}>
              <div className="ms-display" style={{ fontSize: 15 }}>MichiStore <span style={{ color: 'var(--ms-magenta)' }}>· Studio</span></div>
              <div className="ms-mono" style={{ fontSize: 9, color: 'var(--ms-ink-dim)', letterSpacing: '0.16em' }}>ADMIN CONSOLE</div>
            </div>
          )}
          {isMobile && auction?.title && (
            <div className="ms-display" style={{ fontSize: 13, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{auction.title}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10 }}>
          {auction?.status === 'live' && (
            <span className="ms-chip ms-chip-live" style={{ fontSize: 10 }}>
              <span className="ms-dot" />{isMobile ? '' : ' EN VIVO · TikTok'}
            </span>
          )}
          {activeLotId && !isMobile && (
            <a href={overlayUrl} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(42,240,255,.3)', color: 'var(--ms-cyan)', fontSize: 10, textDecoration: 'none', background: 'rgba(42,240,255,.08)' }}>
              <IconLink size={10} /> Overlay
            </a>
          )}
          <button onClick={signOut} className="ms-btn" style={{ padding: isMobile ? '6px 8px' : '5px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
            <IconLogout size={12} />{!isMobile && ' Salir'}
          </button>
        </div>
      </div>

      {/* Left: lots queue */}
      <div style={{
        padding: '14px 10px',
        borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,.06)',
        background: 'rgba(255,255,255,.02)', overflowY: 'auto',
        ...(isMobile ? { display: mobileTab === 'lotes' ? 'block' : 'none', flex: 1 } : {}),
      }}>
        <div className="ms-eyebrow" style={{ marginBottom: 8, padding: '0 4px' }}>LOTES ({lots.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {lots.map((lot) => (
            <div key={lot.id} style={{ position: 'relative' }}
              onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, lotId: lot.id }) }}
            >
              <button onClick={() => setActiveLotId(lot.id)} style={{
                width: '100%', appearance: 'none', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 10,
                border: lot.id === activeLotId ? '1px solid var(--ms-magenta)' : '1px solid rgba(255,255,255,.06)',
                background: lot.id === activeLotId ? 'linear-gradient(90deg,rgba(255,46,136,.18),transparent)' : 'transparent',
                color: 'var(--ms-ink)',
              }}>
                {/* Thumbnail */}
                <span
                  onClick={lot.image_url ? e => { e.stopPropagation(); setImgModal(lot.image_url) } : undefined}
                  style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                    background: 'linear-gradient(135deg,#2d0e6b,#14062a)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                    cursor: lot.image_url ? 'zoom-in' : 'inherit',
                  }}
                >
                  {lot.image_url
                    ? <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : lot.emoji}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lot.name}</div>
                  <div className="ms-mono" style={{ fontSize: 9.5, color: lot.status === 'sold' ? 'var(--ms-lime)' : lot.status === 'live' ? 'var(--ms-magenta)' : 'var(--ms-ink-dim)' }}>
                    {lot.status === 'sold' ? `✓ S/${lot.winning_price}` : lot.status === 'live' ? '● en subasta' : `desde S/${lot.start_price}`}
                  </div>
                </div>
                {lot.id === activeLotId && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ms-magenta)', boxShadow: '0 0 8px var(--ms-magenta)', flexShrink: 0 }} />}
              </button>
              {/* Botón subir/cambiar imagen del lote existente */}
              {lot.status !== 'sold' && (
                <>
                  <input
                    type="file" accept="image/*" style={{ display: 'none' }} id={`img-${lot.id}`}
                    onChange={e => handleLotImageChange(e, lot.id)}
                  />
                  <label htmlFor={`img-${lot.id}`} title="Cambiar foto" style={{
                    position: 'absolute', right: lot.status === 'pending' ? 26 : 6, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--ms-ink-mute)', cursor: 'pointer', padding: 4,
                    display: 'flex', fontSize: 13, lineHeight: 1,
                  }}>📷</label>
                  {lot.status === 'pending' && (
                    <button onClick={() => deleteLot(lot.id)} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ms-ink-mute)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                      <IconTrash size={12} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Formulario nuevo lote */}
          {addingLot ? (
            <div style={{ padding: 10, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Zona de imagen */}
              <label htmlFor="new-lot-img" style={{ cursor: 'pointer' }}>
                <div style={{
                  height: 80, borderRadius: 10, overflow: 'hidden',
                  background: 'linear-gradient(135deg,#2d0e6b,#14062a)',
                  border: '1px dashed rgba(255,255,255,.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: newLotPreview ? 0 : 24, color: 'var(--ms-ink-mute)',
                  position: 'relative',
                }}>
                  {newLotPreview
                    ? <img src={newLotPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ms-ink-mute)' }}>
                        <span style={{ fontSize: 22 }}>📷</span> Subir foto
                      </span>
                  }
                </div>
              </label>
              <input id="new-lot-img" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleNewLotFile} />

              <div style={{ display: 'flex', gap: 6 }}>
                <input value={newLot.emoji} onChange={e => setNewLot(p => ({ ...p, emoji: e.target.value }))}
                  style={{ width: 40, textAlign: 'center', padding: '6px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.4)', color: 'var(--ms-ink)', fontSize: 16 }} />
                <input value={newLot.name} onChange={e => setNewLot(p => ({ ...p, name: e.target.value }))}
                  placeholder="Nombre del lote" className="ms-input" style={{ flex: 1 }} />
              </div>
              <input value={newLot.color_desc} onChange={e => setNewLot(p => ({ ...p, color_desc: e.target.value }))}
                placeholder="Color / talla / descripción" className="ms-input" />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--ms-ink-dim)', whiteSpace: 'nowrap' }}>Inicio S/</span>
                <input type="number" value={newLot.start_price} onChange={e => setNewLot(p => ({ ...p, start_price: Number(e.target.value) }))}
                  className="ms-input" style={{ width: 70 }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={addLot} disabled={uploadingImg} className="ms-btn"
                  style={{ flex: 1, background: 'var(--ms-magenta)', borderColor: 'transparent', color: '#fff', fontSize: 11, padding: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {uploadingImg ? <span style={{ width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'ms-spin .6s linear infinite' }} /> : <IconCheck size={11} />}
                  Guardar
                </button>
                <button onClick={() => { setAddingLot(false); setNewLotFile(null); setNewLotPreview(null) }} className="ms-btn" style={{ fontSize: 11, padding: '7px 10px' }}>✕</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingLot(true)} className="ms-btn" style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11 }}>
              <IconPlus size={12} /> Añadir lote
            </button>
          )}
        </div>

        <div className="ms-divider" style={{ margin: '14px 0' }} />

        {/* WhatsApp de la subasta */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' }}>
          <span className="ms-eyebrow">WHATSAPP DE PAGO</span>
          {auction?.whatsapp_number && !editingWa && (
            <button
              onClick={() => setEditingWa(true)}
              style={{ appearance: 'none', border: 'none', background: 'none', color: 'var(--ms-ink-mute)', cursor: 'pointer', fontSize: 10, padding: 0, fontFamily: 'var(--ms-font-body)' }}
            >
              ✏️ Editar
            </button>
          )}
        </div>
        {auction?.whatsapp_number && !editingWa ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: 'rgba(37,211,102,.08)', border: '1px solid rgba(37,211,102,.25)' }}>
            <span style={{ fontSize: 16 }}>💬</span>
            <span className="ms-mono" style={{ fontSize: 12, color: '#25d366', fontWeight: 700, flex: 1 }}>{auction.whatsapp_number}</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 5 }}>
              <input value={waInput} onChange={e => setWaInput(e.target.value)} placeholder="+51999999999"
                className="ms-input" style={{ flex: 1, fontSize: 11 }} autoFocus={editingWa} />
              <button onClick={saveWhatsApp} disabled={savingWa} className="ms-btn"
                style={{ padding: '8px 10px', background: '#25d366', borderColor: 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center' }}>
                {savingWa ? '...' : <IconCheck size={12} />}
              </button>
              {editingWa && (
                <button onClick={() => { setEditingWa(false); setWaInput(auction?.whatsapp_number || '') }} className="ms-btn"
                  style={{ padding: '8px 8px', fontSize: 11 }}>✕</button>
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ms-ink-mute)', marginTop: 5, lineHeight: 1.4 }}>
              Con código de país. Ej: +51987654321
            </div>
          </>
        )}

        <div className="ms-divider" style={{ margin: '14px 0' }} />

        <div className="ms-eyebrow" style={{ marginBottom: 8, padding: '0 4px' }}>SESIÓN</div>
        <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
          {[
            { label: 'Recaudado', value: `S/ ${totalRevenue}`, color: 'var(--ms-gold)' },
            { label: 'Lotes vendidos', value: lots.filter(l => l.status === 'sold').length },
            { label: 'En vivo', value: lots.filter(l => l.status === 'live').length },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: i < 2 ? 6 : 0, fontSize: 11 }}>
              <span style={{ color: 'var(--ms-ink-dim)' }}>{row.label}</span>
              <span className="ms-mono" style={{ fontWeight: 700, color: row.color || 'var(--ms-ink)' }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Center: controls */}
      <div style={{
        padding: isMobile ? '12px' : '16px 20px',
        overflowY: 'auto',
        ...(isMobile ? { display: mobileTab === 'control' ? 'block' : 'none', flex: 1 } : {}),
      }}>
        {activeLot ? (
          <>
            {/* Now showing */}
            <div className="ms-card" style={{
              padding: isMobile ? 10 : 16, display: 'flex', gap: isMobile ? 10 : 16, alignItems: 'center',
              background: 'linear-gradient(135deg,rgba(255,46,136,.08),rgba(42,240,255,.06))',
              position: 'relative', overflow: 'hidden',
            }}>
              <div
                onClick={() => activeLot.image_url && setImgModal(activeLot.image_url)}
                style={{
                  width: isMobile ? 56 : 90, height: isMobile ? 56 : 90,
                  borderRadius: isMobile ? 12 : 18, flexShrink: 0, overflow: 'hidden',
                  background: 'linear-gradient(135deg,#ff2e88,#b06bff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isMobile ? 28 : 44,
                  boxShadow: '0 8px 24px rgba(255,46,136,.35)',
                  cursor: activeLot.image_url ? 'zoom-in' : 'default',
                }}
              >
                {activeLot.image_url
                  ? <img src={activeLot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : activeLot.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ms-eyebrow" style={{ color: 'var(--ms-magenta)' }}>LOTE EN VIVO</div>
                <div className="ms-display" style={{ fontSize: isMobile ? 15 : 20, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeLot.name}</div>
                {!isMobile && <div style={{ fontSize: 11, color: 'var(--ms-ink-dim)', marginTop: 2 }}>{activeLot.color_desc} · desde S/{activeLot.start_price}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="ms-eyebrow">PUJA ACTUAL</div>
                <div style={{ marginTop: 4 }}><LEDPrice value={currentPrice} fontSize={isMobile ? 24 : 32} /></div>
                {topBid && !isMobile && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', fontSize: 11, color: 'var(--ms-ink-dim)' }}>
                    <Avatar user={topBid.profile} size={18} /> {topBid.bidder_name || topBid.profile?.name || 'Pujador'}
                  </div>
                )}
              </div>
            </div>

            {/* Timer + Effects */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr', gap: 12, marginTop: 12 }}>
              <div className="ms-card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span className="ms-eyebrow">CRONÓMETRO</span>
                  <span style={{ fontSize: 10, color: 'var(--ms-ink-dim)' }}>tú decides cuándo cierra</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={`ms-clock ${danger ? 'ms-clock-danger' : ''}`} style={{ fontSize: 40, padding: '8px 14px' }}>
                    {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                  </span>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {[10, 30, 60].map(n => (
                        <button key={n} className="ms-btn" style={{ flex: 1, fontSize: 11, padding: '7px' }} onClick={() => addTime(n)}>
                          +{n < 60 ? `${n}s` : '1m'}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button className="ms-btn" style={{
                        flex: 1, fontSize: 11, padding: '7px',
                        background: isRunning ? 'rgba(255,255,255,.06)' : 'linear-gradient(180deg,#c8ff7a,#92d100)',
                        color: isRunning ? 'var(--ms-ink)' : '#08010f', borderColor: 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }} onClick={isRunning ? pauseTimer : startTimer}>
                        {isRunning ? <><IconPause size={11} /> Pausar</> : <><IconPlay size={11} /> Iniciar</>}
                      </button>
                      <button className="ms-btn" style={{
                        flex: 1, fontSize: 11, padding: '7px',
                        background: 'linear-gradient(180deg,#ff8fc8,#ff2e88)', color: '#fff', borderColor: 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }} onClick={closeLot}>
                        <IconHammer size={11} /> CERRAR
                      </button>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 10, padding: '7px 10px', borderRadius: 10, background: 'rgba(200,255,46,.06)', border: '1px dashed rgba(200,255,46,.3)', fontSize: 11, color: 'var(--ms-lime)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconBolt size={11} /> Anti-sniping ON: puja en últimos 5s suma +10s.
                </div>
              </div>

              <div className="ms-card" style={{ padding: 14 }}>
                <div className="ms-eyebrow" style={{ marginBottom: 10 }}>EFECTOS EN OVERLAY</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {EFFECT_BUTTONS.map((b, i) => (
                    <button key={i} className="ms-btn" style={{ fontSize: 11, padding: '9px 6px', display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}
                      onClick={() => sendEffect(b.type, b.message)}>
                      <span style={{ fontSize: 14 }}>{b.e}</span> {b.n}
                    </button>
                  ))}
                </div>
                <div className="ms-divider" style={{ margin: '10px 0' }} />
                <div className="ms-eyebrow" style={{ marginBottom: 7 }}>MENSAJE AL OVERLAY</div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <input value={messageInput} onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Escribe algo a la audiencia..." className="ms-input" style={{ fontSize: 11 }} />
                  <button className="ms-btn" style={{ padding: '8px 12px', background: 'var(--ms-magenta)', borderColor: 'transparent', color: '#fff', whiteSpace: 'nowrap' }}
                    onClick={sendMessage}>Enviar</button>
                </div>
              </div>
            </div>

            {/* Bid feed */}
            <div className="ms-card" style={{ padding: 14, marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span className="ms-eyebrow">FEED DE PUJAS · TIEMPO REAL</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: 'var(--ms-ink-mute)' }}>{bids.length} pujas</span>
                  {bids.length > 0 && (
                    <button
                      onClick={() => clearBids(activeLotId)}
                      className="ms-btn"
                      style={{ fontSize: 10, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#ff5f5f', borderColor: 'rgba(255,95,95,.3)' }}
                    >
                      <IconTrash size={10} /> Limpiar
                    </button>
                  )}
                </div>
              </div>
              {bids.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--ms-ink-mute)', textAlign: 'center', padding: '16px 0' }}>Esperando pujas...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', rowGap: 6, columnGap: 12, alignItems: 'center', fontSize: 12 }}>
                  {bids.slice(0, 10).map((f, i) => (
                    <div key={f.id || i} style={{ display: 'contents' }}>
                      <Avatar user={f.profile} size={26} />
                      <div>
                        <div style={{ fontWeight: 600 }}>{f.bidder_name || f.profile?.name || 'Pujador'}</div>
                        <div style={{ fontSize: 10, color: 'var(--ms-ink-mute)' }}>{f.profile?.handle || ''}</div>
                      </div>
                      <span className="ms-mono" style={{ padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11, background: f.delta >= 10 ? 'rgba(255,46,136,.18)' : f.delta >= 5 ? 'rgba(255,210,58,.15)' : 'rgba(200,255,46,.12)', color: f.delta >= 10 ? 'var(--ms-magenta)' : f.delta >= 5 ? 'var(--ms-gold)' : 'var(--ms-lime)' }}>+S/ {f.delta}</span>
                      <span className="ms-mono" style={{ fontWeight: 700 }}>S/ {f.amount}</span>
                      <span className="ms-mono" style={{ color: 'var(--ms-ink-mute)', fontSize: 10 }}>
                        {new Date(f.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, color: 'var(--ms-ink-dim)' }}>
            <div style={{ fontSize: 48 }}>📋</div>
            <p>Selecciona un lote para comenzar</p>
          </div>
        )}
      </div>

      {/* Context menu lotes */}
      {ctxMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setCtxMenu(null) }} />
          <div style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 999,
            background: '#1a0a36', border: '1px solid rgba(255,255,255,.14)',
            borderRadius: 10, padding: 4, minWidth: 170,
            boxShadow: '0 8px 32px rgba(0,0,0,.6)',
          }}>
            <button
              onClick={() => { clearBids(ctxMenu.lotId); setCtxMenu(null) }}
              style={{
                width: '100%', appearance: 'none', border: 'none', cursor: 'pointer',
                background: 'none', color: 'var(--ms-gold)', fontFamily: 'var(--ms-font-body)',
                fontSize: 13, padding: '8px 12px', borderRadius: 7, textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,210,58,.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              🗑 Limpiar pujas
            </button>
            <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '2px 8px' }} />
            <button
              onClick={() => { deleteLot(ctxMenu.lotId); setCtxMenu(null) }}
              style={{
                width: '100%', appearance: 'none', border: 'none', cursor: 'pointer',
                background: 'none', color: '#ff5f5f', fontFamily: 'var(--ms-font-body)',
                fontSize: 13, padding: '8px 12px', borderRadius: 7, textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,95,95,.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <IconTrash size={13} /> Eliminar lote
            </button>
          </div>
        </>
      )}

      {/* Right: participants */}
      <div style={{
        borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,.06)',
        padding: '14px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto',
        ...(isMobile ? { display: mobileTab === 'participantes' ? 'flex' : 'none', flex: 1 } : {}),
      }}>
        {(() => {
          const selP = participants.find(p => p.id === selectedP)
          const pBid = (name) => bids.find(b => b.bidder_name === name)?.amount ?? null
          const isLeader = (name) => bids[0]?.bidder_name === name
          const nextAmount = Math.round((currentPrice + bidDelta) * 100) / 100
          return (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="ms-eyebrow" style={{ color: 'var(--ms-magenta)' }}>PARTICIPANTES ({participants.length})</span>
                <button onClick={() => { setAddingP(true); setTimeout(() => newPInputRef.current?.focus(), 50) }}
                  style={{ appearance: 'none', border: '1px solid rgba(255,255,255,.14)', borderRadius: 7, background: 'rgba(255,255,255,.06)', color: 'var(--ms-ink-dim)', cursor: 'pointer', fontSize: 11, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IconPlus size={10} /> Agregar
                </button>
              </div>

              {addingP && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    ref={newPInputRef}
                    value={newPName}
                    onChange={e => setNewPName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addParticipant(); if (e.key === 'Escape') { setAddingP(false); setNewPName('') } }}
                    placeholder="Nombre del participante..."
                    className="ms-input"
                    style={{ flex: 1, fontSize: 12 }}
                    autoComplete="off"
                  />
                  <button onClick={addParticipant} style={{ appearance: 'none', border: 0, cursor: 'pointer', borderRadius: 8, background: 'var(--ms-magenta)', color: '#fff', padding: '0 10px', fontSize: 11 }}>OK</button>
                  <button onClick={() => { setAddingP(false); setNewPName('') }} style={{ appearance: 'none', border: '1px solid rgba(255,255,255,.12)', cursor: 'pointer', borderRadius: 8, background: 'none', color: 'var(--ms-ink-mute)', padding: '0 8px', fontSize: 11 }}>✕</button>
                </div>
              )}

              {participants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: 'var(--ms-ink-mute)' }}>
                  Agrega participantes antes de iniciar la subasta
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, flex: 1, overflowY: 'auto' }}>
                  {participants.map(p => {
                    const bid = pBid(p.name)
                    const leader = isLeader(p.name)
                    const active = selectedP === p.id
                    return (
                      <div key={p.id}
                        onClick={() => setSelectedP(p.id)}
                        onContextMenu={e => { e.preventDefault(); removeParticipant(p.id) }}
                        style={{
                          padding: '8px 10px', borderRadius: 9, cursor: 'pointer',
                          border: active ? '1.5px solid var(--ms-magenta)' : leader ? '1px solid rgba(255,210,58,.4)' : '1px solid rgba(255,255,255,.08)',
                          background: active ? 'rgba(255,46,136,.2)' : leader ? 'rgba(255,210,58,.08)' : 'rgba(255,255,255,.04)',
                          transition: 'all .1s',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {leader && <span style={{ color: 'var(--ms-gold)', marginRight: 4 }}>🏆</span>}
                          {p.name}
                        </div>
                        <div className="ms-mono" style={{ fontSize: 11, color: bid ? (leader ? 'var(--ms-gold)' : 'var(--ms-lime)') : 'var(--ms-ink-mute)', marginTop: 2 }}>
                          {bid != null ? `S/ ${bid}` : 'Sin puja'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {selP && (
                <>
                  <div className="ms-divider" />
                  <div style={{ fontSize: 11, color: 'var(--ms-ink-dim)' }}>
                    Pujando por <b style={{ color: 'var(--ms-magenta)' }}>{selP.name}</b>
                    {pBid(selP.name) != null && <span style={{ color: 'var(--ms-ink-mute)' }}> · actual S/ {pBid(selP.name)}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[0.5, 1, 5, 10].map(d => (
                      <button key={d} onClick={() => setBidDelta(d)} style={{
                        flex: 1, appearance: 'none', cursor: 'pointer',
                        fontFamily: 'var(--ms-font-display)', fontSize: 15, padding: '7px 4px', borderRadius: 8,
                        border: bidDelta === d ? '2px solid var(--ms-magenta)' : '1px solid rgba(255,255,255,.12)',
                        background: bidDelta === d ? 'rgba(255,46,136,.25)' : 'rgba(255,255,255,.05)',
                        color: bidDelta === d ? 'var(--ms-magenta)' : 'var(--ms-ink)',
                      }}>+{d}</button>
                    ))}
                  </div>
                  <button
                    onClick={placeBidManual}
                    disabled={!activeLot || activeLot.status !== 'live' || placingManual}
                    style={{
                      width: '100%', appearance: 'none', border: 0, cursor: 'pointer',
                      background: activeLot?.status === 'live' ? 'linear-gradient(180deg,#ff8fc8,#ff2e88)' : 'rgba(255,255,255,.07)',
                      color: activeLot?.status === 'live' ? '#fff' : 'var(--ms-ink-mute)',
                      fontFamily: 'var(--ms-font-display)', fontSize: 15, borderRadius: 12, padding: '11px 14px',
                      boxShadow: activeLot?.status === 'live' ? '0 8px 24px rgba(255,46,136,.4)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {placingManual
                      ? <span style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'ms-spin .6s linear infinite' }} />
                      : <><span>{selP.name}</span><span style={{ opacity: .7, fontSize: 13 }}>→</span><span className="ms-mono">S/ {nextAmount}</span></>
                    }
                  </button>
                </>
              )}
            </>
          )
        })()}
      </div>

      {/* Mobile tab bar */}
      {isMobile && (
        <div style={{
          flexShrink: 0, display: 'flex',
          background: 'rgba(8,1,15,.96)', borderTop: '1px solid rgba(255,255,255,.1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {[
            { tab: 'lotes',         label: 'Lotes',       icon: '📋' },
            { tab: 'control',       label: 'Control',     icon: '⚡' },
            { tab: 'participantes', label: 'Participantes', icon: '👥' },
          ].map(t => (
            <button key={t.tab} onClick={() => setMobileTab(t.tab)} style={{
              flex: 1, appearance: 'none', border: 'none', cursor: 'pointer',
              background: 'none', padding: '8px 4px 6px',
              borderTop: mobileTab === t.tab ? '2px solid var(--ms-magenta)' : '2px solid transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              color: mobileTab === t.tab ? 'var(--ms-magenta)' : 'var(--ms-ink-mute)',
              transition: 'color .15s',
            }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ fontSize: 10, fontFamily: 'var(--ms-font-body)', fontWeight: mobileTab === t.tab ? 700 : 400 }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Modal imagen ampliada */}
      {imgModal && (
        <div
          onClick={() => setImgModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'ms-fadein .2s ease',
          }}
        >
          <img
            src={imgModal}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '88vh',
              borderRadius: 16, objectFit: 'contain',
              boxShadow: '0 24px 80px rgba(0,0,0,.7)',
            }}
          />
          <button
            onClick={() => setImgModal(null)}
            style={{
              position: 'fixed', top: 16, right: 16,
              appearance: 'none', border: '1px solid rgba(255,255,255,.2)',
              borderRadius: '50%', width: 36, height: 36,
              background: 'rgba(0,0,0,.6)', color: '#fff',
              fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
      )}

      {/* Modal ganador */}
      {winnerModal && (
        <div
          onClick={() => setWinnerModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(8,1,15,.85)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'ms-fadein .25s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'linear-gradient(160deg,#1a0535,#0a0218)',
              border: '1px solid rgba(255,210,58,.35)',
              borderRadius: 24, padding: '36px 40px', maxWidth: 420, width: '90%',
              boxShadow: '0 0 60px rgba(255,210,58,.18), 0 24px 64px rgba(0,0,0,.6)',
              textAlign: 'center', position: 'relative',
            }}
          >
            {/* Imagen / emoji del lote */}
            <div style={{
              width: 100, height: 100, borderRadius: 22, overflow: 'hidden',
              background: 'linear-gradient(135deg,#ff2e88,#b06bff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 54, margin: '0 auto 20px',
              boxShadow: '0 12px 32px rgba(255,46,136,.4)',
            }}>
              {winnerModal.lotImage
                ? <img src={winnerModal.lotImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : winnerModal.lotEmoji}
            </div>

            <div className="ms-eyebrow" style={{ color: 'var(--ms-gold)', letterSpacing: '0.18em', marginBottom: 6 }}>
              🏆 LOTE CERRADO
            </div>
            <div className="ms-display" style={{ fontSize: 22, marginBottom: 4 }}>{winnerModal.lotName}</div>

            <div style={{ margin: '20px 0', padding: '16px', borderRadius: 14, background: 'rgba(255,210,58,.08)', border: '1px solid rgba(255,210,58,.2)' }}>
              <div className="ms-eyebrow" style={{ color: 'var(--ms-ink-dim)', marginBottom: 8 }}>GANADOR</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ms-gold)' }}>
                {winnerModal.winnerName ?? '—'}
              </div>
              {winnerModal.price != null && (
                <div className="ms-mono" style={{ fontSize: 32, fontWeight: 700, color: '#fff', marginTop: 8 }}>
                  S/ {winnerModal.price}
                </div>
              )}
            </div>

            {!winnerModal.winnerName && (
              <div style={{ fontSize: 12, color: 'var(--ms-ink-mute)', marginBottom: 16 }}>
                No hubo pujas en este lote.
              </div>
            )}

            <button
              onClick={() => setWinnerModal(null)}
              className="ms-btn"
              style={{ width: '100%', padding: '11px', fontSize: 13, marginTop: 4, background: 'var(--ms-gold)', borderColor: 'transparent', color: '#08010f', fontWeight: 700 }}
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
