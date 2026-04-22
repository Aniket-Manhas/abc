import { useState, useEffect } from 'react';
import { notificationsAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';

const NOTIF_TYPES = [
  { id: 'info',         label: 'Info',           icon: 'ℹ️', color: 'var(--accent-blue)' },
  { id: 'warning',      label: 'Warning',         icon: '⚠️', color: 'var(--crowd-medium)' },
  { id: 'emergency',    label: 'Emergency',       icon: '🚨', color: 'var(--crowd-high)' },
  { id: 'congestion',   label: 'Congestion Alert',icon: '🔴', color: '#f97316' },
  { id: 'route_change', label: 'Route Change',    icon: '🔄', color: '#a855f7' },
];

export default function AdminNotifications() {
  const { connected } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [form, setForm] = useState({ title: '', message: '', type: 'info', targetRole: 'all', expiresIn: '' });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationsAPI.getActive()
      .then(r => setNotifications(r.data))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const send = async (e) => {
    e.preventDefault();
    if (!form.title || !form.message) { setError('Title and message are required'); return; }
    setSending(true); setError(''); setSuccess('');
    try {
      const payload = { ...form, expiresIn: form.expiresIn ? parseInt(form.expiresIn) : null };
      const res = await notificationsAPI.broadcast(payload);
      setNotifications(prev => [res.data, ...prev]);
      setSuccess(`✅ Notification sent to ${form.targetRole === 'all' ? 'all users' : form.targetRole + 's'} via WebSocket!`);
      setForm({ title: '', message: '', type: 'info', targetRole: 'all', expiresIn: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send notification');
    } finally { setSending(false); }
  };

  const deactivate = async (id) => {
    try {
      await notificationsAPI.deactivate(id);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (_) {}
  };

  const selectedType = NOTIF_TYPES.find(t => t.id === form.type);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1>🔔 Notifications</h1>
        <p>Broadcast real-time alerts and announcements to passengers and staff</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Compose */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: '1.25rem' }}>📢 Broadcast Message</div>
          <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Type selector */}
            <div className="input-group">
              <label className="label">Notification Type</label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {NOTIF_TYPES.map(t => (
                  <button key={t.id} type="button"
                    onClick={() => setForm(p => ({ ...p, type: t.id }))}
                    style={{
                      padding: '0.4rem 0.75rem', borderRadius: 8, border: `1.5px solid ${form.type === t.id ? t.color : 'var(--border)'}`,
                      background: form.type === t.id ? `${t.color}22` : 'var(--bg-secondary)',
                      color: form.type === t.id ? t.color : 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'var(--transition)',
                    }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label className="label">Target Audience</label>
              <select name="targetRole" className="input" value={form.targetRole} onChange={handleChange}>
                <option value="all">👥 All Users (Passengers + Admins)</option>
                <option value="passenger">🧳 Passengers Only</option>
                <option value="admin">👑 Admins Only</option>
              </select>
            </div>

            <div className="input-group">
              <label className="label">Title *</label>
              <input name="title" className="input" placeholder="e.g. Platform 2 Delayed" value={form.title} onChange={handleChange} required />
            </div>

            <div className="input-group">
              <label className="label">Message *</label>
              <textarea name="message" className="input" placeholder="Enter your announcement…" value={form.message} onChange={handleChange} rows={3} style={{ resize: 'vertical' }} required />
            </div>

            <div className="input-group">
              <label className="label">Expires In (minutes, leave blank = permanent)</label>
              <input name="expiresIn" className="input" type="number" placeholder="e.g. 30" value={form.expiresIn} onChange={handleChange} min={1} />
            </div>

            {/* Preview */}
            {(form.title || form.message) && (
              <div style={{ background: 'var(--bg-secondary)', border: `1px solid ${selectedType?.color || 'var(--border)'}40`, borderRadius: 10, padding: '0.875rem', display: 'flex', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{selectedType?.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: selectedType?.color }}>{form.title || 'Title preview'}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{form.message || 'Message preview'}</div>
                </div>
              </div>
            )}

            {error  && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.5rem 0.875rem', fontSize: '0.85rem', color: 'var(--crowd-high)' }}>{error}</div>}
            {success && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '0.5rem 0.875rem', fontSize: '0.85rem', color: 'var(--crowd-low)' }}>{success}</div>}

            <button className="btn btn-primary" type="submit" disabled={sending || !connected} id="send-notification-btn">
              {sending ? '⏳ Sending…' : `📢 Broadcast to ${form.targetRole === 'all' ? 'Everyone' : form.targetRole + 's'}`}
            </button>
            {!connected && <div style={{ fontSize: '0.78rem', color: 'var(--crowd-high)', textAlign: 'center' }}>⚠️ WebSocket disconnected — connect to broadcast</div>}
          </form>
        </div>

        {/* Active notifications */}
        <div className="card">
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <div className="section-title">📋 Active Notifications ({notifications.length})</div>
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
          ) : notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔕</div>
              No active notifications
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 520, overflowY: 'auto' }}>
              {notifications.map(n => {
                const t = NOTIF_TYPES.find(t => t.id === n.type) || NOTIF_TYPES[0];
                return (
                  <div key={n._id} style={{ background: 'var(--bg-secondary)', border: `1px solid ${t.color}30`, borderRadius: 10, padding: '0.875rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{t.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: t.color }}>{n.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{n.message}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'flex', gap: '0.75rem' }}>
                        <span>→ {n.targetRole}</span>
                        <span>{new Date(n.createdAt).toLocaleString()}</span>
                        {n.expiresAt && <span>Exp: {new Date(n.expiresAt).toLocaleTimeString()}</span>}
                      </div>
                    </div>
                    <button onClick={() => deactivate(n._id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0 }} title="Deactivate">×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
