import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import MichiFace from './shared/MichiFace'
import { IconPlus, IconPlay, IconLogout, IconHammer } from './shared/Icons'

export default function AdminDashboard() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [auctions, setAuctions] = useState([])
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    fetchAuctions()
  }, [])

  async function fetchAuctions() {
    const { data } = await supabase
      .from('auctions')
      .select('*, lots(count)')
      .order('created_at', { ascending: false })
    if (data) setAuctions(data)
  }

  async function createAuction() {
    if (!newTitle.trim()) return
    const { data } = await supabase
      .from('auctions')
      .insert({ title: newTitle.trim(), created_by: profile.id })
      .select()
      .single()
    if (data) { navigate(`/admin/auction/${data.id}`); setCreating(false) }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg,#0a0218,#08010f)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Navbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,.08)',
        background: 'rgba(8,1,15,.7)', backdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--ms-grad-gold)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <MichiFace size={24} />
          </span>
          <div>
            <div className="ms-display" style={{ fontSize: 16 }}>MichiStore <span style={{ color: 'var(--ms-magenta)' }}>· Admin</span></div>
            <div className="ms-mono" style={{ fontSize: 9, color: 'var(--ms-ink-dim)', letterSpacing: '0.16em' }}>PANEL DE CONTROL</div>
          </div>
        </div>
        <button onClick={signOut} className="ms-btn" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px' }}>
          <IconLogout size={13} /> Cerrar sesión
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', width: '100%', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 className="ms-display" style={{ fontSize: 28, margin: 0 }}>Subastas</h1>
            <p style={{ fontSize: 13, color: 'var(--ms-ink-dim)', marginTop: 4 }}>Crea y gestiona tus sesiones de subasta en vivo.</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            style={{
              appearance: 'none', border: 0, cursor: 'pointer',
              background: 'linear-gradient(180deg,#ff8fc8,#ff2e88)', color: '#fff',
              fontFamily: 'var(--ms-font-display)', fontSize: 14,
              borderRadius: 14, padding: '10px 20px',
              boxShadow: '0 8px 24px rgba(255,46,136,.4)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <IconPlus size={14} /> Nueva subasta
          </button>
        </div>

        {creating && (
          <div className="ms-card" style={{ padding: 20, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Nueva subasta</h3>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createAuction()}
              placeholder="Ej: Subasta MichiStore #12 — Drops de Octubre"
              className="ms-input"
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={createAuction} style={{
                appearance: 'none', border: 0, cursor: 'pointer',
                background: 'linear-gradient(180deg,#c8ff7a,#92d100)', color: '#08010f',
                fontFamily: 'var(--ms-font-body)', fontWeight: 700, fontSize: 13,
                borderRadius: 12, padding: '10px 20px',
              }}>Crear y abrir</button>
              <button onClick={() => setCreating(false)} className="ms-btn" style={{ fontSize: 13 }}>Cancelar</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {auctions.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              border: '1px dashed rgba(255,255,255,.12)', borderRadius: 20,
              color: 'var(--ms-ink-mute)',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎙️</div>
              <p>No hay subastas aún. ¡Crea la primera!</p>
            </div>
          ) : auctions.map(a => (
            <div key={a.id} className="ms-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: a.status === 'live' ? 'linear-gradient(135deg,#ff2e88,#b06bff)' : 'rgba(255,255,255,.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
              }}>
                {a.status === 'live' ? '🔴' : a.status === 'closed' ? '✅' : '📋'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                <div style={{ fontSize: 11, color: 'var(--ms-ink-dim)', marginTop: 3 }}>
                  {new Date(a.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {' · '}
                  <span style={{ color: a.status === 'live' ? 'var(--ms-magenta)' : a.status === 'closed' ? 'var(--ms-lime)' : 'var(--ms-ink-mute)', fontWeight: 600 }}>
                    {a.status === 'live' ? '● EN VIVO' : a.status === 'closed' ? '✓ Cerrada' : '○ Pendiente'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => navigate(`/admin/auction/${a.id}`)}
                style={{
                  appearance: 'none', border: 0, cursor: 'pointer',
                  background: a.status === 'live' ? 'linear-gradient(180deg,#ff8fc8,#ff2e88)' : 'rgba(255,255,255,.08)',
                  color: '#fff', fontFamily: 'var(--ms-font-body)', fontWeight: 600, fontSize: 12,
                  borderRadius: 10, padding: '8px 16px',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <IconPlay size={12} /> {a.status === 'live' ? 'Controlar' : 'Abrir'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
