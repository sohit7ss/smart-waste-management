import React, { useState, useEffect } from 'react'
import './Sidebar.css'

export default function Header() {
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs]       = useState(false)

  useEffect(() => {
    let ws
    try {
      ws = new WebSocket('ws://localhost:8000/ws/dashboard')
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'truck_dispatched') {
            setNotifications(prev => [{
              id:      Date.now(),
              type:    'dispatch',
              message: data.notification?.message || 'Truck dispatched!',
              time:    new Date().toLocaleTimeString(),
              read:    false,
              emoji:   '🚛'
            }, ...prev].slice(0, 10))
          }

          if (data.type === 'dustbin_update') {
            const overflowing = data.dustbins?.filter(b => b.status === 'overflowing')
            if (overflowing?.length > 0) {
              overflowing.forEach(bin => {
                setNotifications(prev => {
                  // Don't add duplicate alerts for same bin
                  if (prev.some(n => n.binId === bin.id && Date.now() - n.id < 30000)) return prev
                  return [{
                    id:      Date.now() + bin.id,
                    binId:   bin.id,
                    type:    'overflow',
                    message: `${bin.location} is overflowing!`,
                    time:    new Date().toLocaleTimeString(),
                    read:    false,
                    emoji:   '🚨'
                  }, ...prev].slice(0, 10)
                })
              })
            }
          }
        } catch {}
      }
      ws.onerror = () => {}
    } catch {}

    return () => { try { ws?.close() } catch {} }
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">🌿</div>
        <div>
          <div className="header-title">Smart Waste Management</div>
          <div className="header-subtitle">Real-time Urban Intelligence</div>
        </div>
      </div>
      <div className="header-right">
        <div className="header-badge">
          <span className="pulse-dot"></span>
          System Online
        </div>

        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowNotifs(!showNotifs)
              if (!showNotifs) {
                setNotifications(prev => prev.map(n => ({ ...n, read: true })))
              }
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '20px', position: 'relative', padding: '4px'
            }}
          >
            🔔
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '-6px', right: '-6px',
                background: '#ef4444', color: 'white', borderRadius: '50%',
                width: '18px', height: '18px', fontSize: '11px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold'
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div style={{
              position: 'absolute', top: '40px', right: 0,
              background: '#1e293b', border: '1px solid #334155',
              borderRadius: '12px', width: '320px', maxHeight: '400px',
              overflowY: 'auto', zIndex: 1000,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
            }}>
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid #334155',
                fontWeight: 'bold', color: 'white',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span>🔔 Notifications</span>
                {notifications.length > 0 && (
                  <button
                    onClick={() => setNotifications([])}
                    style={{
                      background: 'none', border: 'none', color: '#64748b',
                      fontSize: '11px', cursor: 'pointer'
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  No notifications yet
                </div>
              ) : (
                notifications.map(notif => (
                  <div key={notif.id} style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #334155',
                    background: notif.read ? 'transparent' : '#22c55e11'
                  }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '20px' }}>{notif.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: 'white', fontSize: '13px' }}>{notif.message}</div>
                        <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>{notif.time}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="header-team">Team NOCTURNAL</div>
      </div>
    </header>
  )
}
