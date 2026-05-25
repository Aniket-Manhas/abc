import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

// ── Admin navigation ──────────────────────────────────────────
const ADMIN_NAV = [
  { to: '/admin/dashboard', icon: '📊', label: 'Overview' },
  { to: '/admin/alerts', icon: '🚨', label: 'Alert Manager' },
  { to: '/admin/notifications', icon: '🔔', label: 'Notifications' },
  { to: '/admin/stampede', icon: '📹', label: 'Stampede AI', badge: 'AI' },
  { to: '/admin/analytics', icon: '📈', label: 'Analytics' },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const { connected } = useSocket();

  const accentColor = 'var(--accent-admin)';
  const accentBg = 'var(--accent-admin-bg)';
  const roleGradient = 'linear-gradient(135deg, #8b1a1a, #c0392b)';

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="sidebar-backdrop" onClick={onClose} />
      )}

      <aside className={`sidebar sidebar-admin ${open ? 'open' : ''}`}>
        {/* ── Logo ──────────────────────────────────────────── */}
        <div style={{
          padding: '1.25rem 1.25rem 1rem',
          borderBottom: 'rgba(192,57,43,0.2) 1px solid',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.625rem' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: roleGradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem',
            }}>
              🛡️
            </div>
            <div>
              <div style={{
                fontFamily: 'Rajdhani', fontWeight: 700, fontSize: '1.2rem',
                color: accentColor, letterSpacing: '0.05em', lineHeight: 1,
              }}>
                SAHYATRI
              </div>
              <div style={{
                fontSize: '0.6rem', color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>
                Control Room
              </div>
            </div>
          </div>

          {/* User chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'var(--bg-elevated)', borderRadius: 8,
            padding: '0.5rem 0.625rem',
            border: `1px solid ${accentColor}20`,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: roleGradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', fontWeight: 700, color: '#fff',
              flexShrink: 0,
            }}>
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }} className="truncate">
                {user?.name || 'Admin'}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }} className="truncate">
                {user?.email || ''}
              </div>
            </div>
          </div>
        </div>

        {/* ── Connection status ───────────────────────────── */}
        <div style={{
          margin: '0.75rem 1.25rem 0',
          padding: '0.5rem 0.75rem',
          background: connected ? 'rgba(39,174,96,0.08)' : 'rgba(231,76,60,0.08)',
          borderRadius: 8,
          border: `1px solid ${connected ? 'rgba(39,174,96,0.2)' : 'rgba(231,76,60,0.2)'}`,
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          fontSize: '0.75rem',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: connected ? '#27ae60' : '#e74c3c',
            animation: connected ? 'pulse-dot 2s infinite' : 'none',
            flexShrink: 0,
          }} />
          <span style={{ color: connected ? '#27ae60' : '#e74c3c', fontWeight: 600 }}>
            {connected ? 'WebSocket Live' : 'Disconnected'}
          </span>
        </div>

        {/* ── Navigation ────────────────────────────────────── */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          {ADMIN_NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.6rem 0.625rem',
                borderRadius: 8,
                fontSize: '0.875rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? accentColor : 'var(--text-secondary)',
                background: isActive ? accentBg : 'transparent',
                borderLeft: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
                transition: 'var(--transition)',
                textDecoration: 'none',
                position: 'relative',
              })}
            >
              {({ isActive }) => (
                <>
                  <span style={{ fontSize: '1rem', flexShrink: 0, opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      fontSize: '0.58rem', fontWeight: 800,
                      background: 'var(--accent-saffron)', color: 'var(--text-on-accent)',
                      padding: '1px 5px', borderRadius: 4, letterSpacing: '0.05em',
                    }}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── Bottom: Logout ──────────────────────────────────── */}
        <div style={{
          padding: '0.875rem 1.25rem',
          borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: 2 }}>
            🚉 Jammu Tawi · JAT · Northern Railway
          </div>
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.55rem 0.75rem',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-muted)',
              fontSize: '0.82rem', fontWeight: 500,
              cursor: 'pointer', transition: 'var(--transition)',
              width: '100%',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e74c3c'; e.currentTarget.style.borderColor = 'rgba(231,76,60,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <span>⬅</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
