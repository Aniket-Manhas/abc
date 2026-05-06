import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';

export default function Navbar({ title, onMenuToggle, isAdmin = false }) {
  const { t, i18n } = useTranslation();
  const { notifications, dismissNotification } = useSocket();
  const { user } = useAuth();
  const [showNotifs, setShowNotifs] = useState(false);
  const unread = notifications.length;

  return (
    <div className={`topbar ${isAdmin ? 'topbar-admin' : 'topbar-passenger'}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button className="btn-icon" onClick={onMenuToggle} style={{ display: 'none' }} id="menu-toggle">☰</button>
        <h2 style={{ fontSize: '1.2rem', margin: 0, fontFamily: 'Rajdhani', fontWeight: 600 }}>{title}</h2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Language Toggle */}
        <button 
          className="btn-icon" 
          onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'hi' : 'en')}
          style={{ fontSize: '1rem', width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}
          title="Toggle Language"
        >
          {i18n.language === 'en' ? 'अ' : 'A'}
        </button>

        {/* Notification bell */}
        <div style={{ position: 'relative' }}>
          <button className="btn-icon" onClick={() => setShowNotifs(p => !p)} style={{ fontSize: '1.2rem' }}>
            🔔
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: 'var(--crowd-high)', color: '#fff',
                borderRadius: '50%', width: 18, height: 18,
                fontSize: '0.65rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>{unread > 9 ? '9+' : unread}</span>
            )}
          </button>

          {showNotifs && (
            <div style={{
              position: 'absolute', top: '110%', right: 0, width: 320,
              background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
              zIndex: 200, overflow: 'hidden'
            }}>
              <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Notifications</span>
                {unread > 0 && <button className="btn btn-secondary" style={{ padding: '0.2rem 0.75rem', fontSize: '0.75rem' }} onClick={() => notifications.forEach((_, i) => dismissNotification(i))}>Clear all</button>}
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No notifications</div>
                ) : notifications.map((n, i) => (
                  <div key={i} style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <span>{n.type === 'emergency' ? '🚨' : n.type === 'warning' ? '⚠️' : n.type === 'congestion' ? '🔴' : 'ℹ️'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{n.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>{n.message}</div>
                    </div>
                    <button onClick={() => dismissNotification(i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {user?.name}
        </div>
      </div>
      <style>{`@media(max-width:900px){#menu-toggle{display:flex!important;}}`}</style>
    </div>
  );
}
