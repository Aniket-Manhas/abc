import { useState, useEffect } from 'react';
import { alertsAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';

export default function AlertManager() {
  const { adminAlerts, setAdminAlerts } = useSocket();
  const [dbAlerts, setDbAlerts] = useState([]);
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    alertsAPI.getAll({ limit: 100 })
      .then(r => setDbAlerts(r.data))
      .finally(() => setLoading(false));
  }, []);

  // Merge socket alerts with DB alerts (socket alerts take priority for active ones)
  const mergedAlerts = [
    ...adminAlerts,
    ...dbAlerts.filter(db => !adminAlerts.find(a => a._id === db._id))
  ];

  const filtered = mergedAlerts.filter(a => filter === 'all' ? true : a.status === filter);

  const acknowledge = async (id) => {
    setActionLoading(p => ({ ...p, [id]: true }));
    try {
      const res = await alertsAPI.acknowledge(id);
      updateAlert(res.data);
    } finally { setActionLoading(p => ({ ...p, [id]: false })); }
  };

  const resolve = async (id) => {
    setActionLoading(p => ({ ...p, [id]: true }));
    try {
      const res = await alertsAPI.resolve(id);
      updateAlert(res.data);
    } finally { setActionLoading(p => ({ ...p, [id]: false })); }
  };

  const updateAlert = (updated) => {
    setAdminAlerts(prev => prev.map(a => a._id === updated._id ? updated : a));
    setDbAlerts(prev => prev.map(a => a._id === updated._id ? updated : a));
  };

  const STATUS_COLORS = { active: 'var(--crowd-high)', acknowledged: 'var(--crowd-medium)', resolved: 'var(--crowd-low)' };
  const TYPE_ICONS = { panic: '🆘', medical: '🏥', fire: '🔥', security: '🛡️', lost: '❓' };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1>🚨 Alert Manager</h1>
        <p>Respond to passenger emergency alerts in real time</p>
      </div>

      {/* Stats */}
      <div className="grid-3 grid">
        {['active', 'acknowledged', 'resolved'].map(s => {
          const count = mergedAlerts.filter(a => a.status === s).length;
          return (
            <div key={s} className="stat-card" style={{ cursor: 'pointer', borderColor: `${STATUS_COLORS[s]}30`, background: `${STATUS_COLORS[s]}10` }}
              onClick={() => setFilter(s)}>
              <div className="stat-icon" style={{ background: `${STATUS_COLORS[s]}20`, fontSize: '1.2rem' }}>
                {s === 'active' ? '🔴' : s === 'acknowledged' ? '🟡' : '✅'}
              </div>
              <div>
                <div className="stat-value" style={{ color: STATUS_COLORS[s] }}>{count}</div>
                <div className="stat-label">{s.charAt(0).toUpperCase() + s.slice(1)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="tab-bar" style={{ width: 'fit-content' }}>
        {['active', 'acknowledged', 'resolved', 'all'].map(f => (
          <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} {f !== 'all' && `(${mergedAlerts.filter(a => a.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
            No {filter} alerts
          </div>
        )}
        {filtered.map(alert => (
          <div key={alert._id} className={`alert-item ${alert.status}`} style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>{TYPE_ICONS[alert.type] || '🆘'}</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700 }}>{alert.userName}</span>
                {alert.userPhone && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📞 {alert.userPhone}</span>}
                <span className={`badge`} style={{ background: `${STATUS_COLORS[alert.status]}22`, color: STATUS_COLORS[alert.status] }}>{alert.status}</span>
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                📍 {alert.location?.nodeName}
                {alert.location?.floor != null && alert.location?.floor !== undefined && (
                  <span> · Floor {alert.location.floor}</span>
                )}
                {alert.location?.lat != null && alert.location?.lng != null && (
                  <span style={{ marginLeft: '0.5rem', color: 'var(--accent-blue)' }}>
                    <a href={`https://maps.google.com/?q=${alert.location.lat},${alert.location.lng}`} target="_blank" rel="noreferrer" style={{color: 'inherit', textDecoration: 'underline'}}>
                      ({Number(alert.location.lat).toFixed(5)}, {Number(alert.location.lng).toFixed(5)})
                    </a>
                  </span>
                )}
                {alert.location?.accuracy != null && (
                  <span style={{ marginLeft: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ±{Math.round(alert.location.accuracy)}m
                  </span>
                )}
              </div>
              {alert.message && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontStyle: 'italic' }}>"{alert.message}"</div>}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                {new Date(alert.createdAt).toLocaleString()} · {alert.type.toUpperCase()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
              {alert.status === 'active' && (
                <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }}
                  disabled={actionLoading[alert._id]} onClick={() => acknowledge(alert._id)} id={`ack-${alert._id}`}>
                  {actionLoading[alert._id] ? '…' : '👁️ Acknowledge'}
                </button>
              )}
              {alert.status !== 'resolved' && (
                <button className="btn btn-success" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }}
                  disabled={actionLoading[alert._id]} onClick={() => resolve(alert._id)} id={`resolve-${alert._id}`}>
                  {actionLoading[alert._id] ? '…' : '✅ Resolve'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
