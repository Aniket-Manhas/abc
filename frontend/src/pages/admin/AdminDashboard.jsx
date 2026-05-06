import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useTranslation } from 'react-i18next';
import { alertsAPI, analyticsAPI_req } from '../../services/api';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { crowdData, connected, adminAlerts } = useSocket();
  const navigate = useNavigate();
  const [usageStats, setUsageStats] = useState(null);
  const [crowdSummary, setCrowdSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([analyticsAPI_req.getUsageStats(), analyticsAPI_req.getCrowdSummary()])
      .then(([stats, summary]) => {
        setUsageStats(stats.data);
        setCrowdSummary(summary.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const crowdCounts = Object.values(crowdData).reduce(
    (acc, v) => {
      const d = typeof v === 'string' ? v : v?.density || 'low';
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, { low: 0, medium: 0, high: 0 }
  );

  const activeAlerts = adminAlerts.filter(a => a.status === 'active').length;

  const stats = [
    { icon: '🔴', label: t('high_density'), value: crowdCounts.high, color: 'var(--crowd-high)', bg: 'rgba(239,68,68,0.1)', to: '/admin/crowd' },
    { icon: '🚨', label: t('active_alerts'), value: activeAlerts, color: '#f97316', bg: 'rgba(249,115,22,0.1)', to: '/admin/alerts' },
    { icon: '🧭', label: t('today_navs'), value: usageStats?.todayNavigations || 0, color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.1)', to: '/admin/analytics' },
    { icon: '📊', label: t('total_navs'), value: usageStats?.totalNavigations || 0, color: 'var(--accent-cyan)', bg: 'rgba(6,182,212,0.1)', to: '/admin/analytics' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>📊 {t('admin_overview')}</h1>
          <p>{t('station_control')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: connected ? 'var(--crowd-low)' : 'var(--crowd-high)' }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: connected ? 'var(--crowd-low)' : 'var(--crowd-high)', animation: 'pulse-dot 2s infinite' }} />
          {connected ? t('live') : t('disconnected')}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid-4 grid">
        {stats.map(s => (
          <div key={s.label} className="stat-card" style={{ borderColor: `${s.color}30`, background: s.bg, cursor: 'pointer' }} onClick={() => navigate(s.to)}>
            <div className="stat-icon" style={{ background: `${s.color}22`, fontSize: '1.3rem' }}>{s.icon}</div>
            <div>
              <div className="stat-value" style={{ color: s.color }}>{loading ? '–' : s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Active alerts */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">🚨 {t('recent_alerts')}</div>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }} onClick={() => navigate('/admin/alerts')}>{t('view_all')}</button>
          </div>
          {adminAlerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
              {t('no_alerts')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {adminAlerts.slice(0, 4).map(alert => (
                <div key={alert._id} className={`alert-item ${alert.status}`}>
                  <span style={{ fontSize: '1.1rem' }}>{alert.status === 'active' ? '🔴' : alert.status === 'acknowledged' ? '🟡' : '✅'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{alert.userName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{alert.location?.nodeName} · {alert.type}</div>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(alert.createdAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Crowd hotspots */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">🔥 {t('crowd_hotspots')}</div>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }} onClick={() => navigate('/admin/crowd')}>{t('monitor')}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {Object.entries(crowdData)
              .map(([id, v]) => ({ id, density: typeof v === 'string' ? v : v?.density || 'low', count: typeof v === 'object' ? v?.personCount : 0 }))
              .filter(({ density }) => density !== 'low')
              .sort((a, b) => (b.density === 'high' ? 1 : -1) - (a.density === 'high' ? 1 : -1))
              .slice(0, 6)
              .map(({ id, density, count }) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{id.replace(/_/g, ' ')}</span>
                  <span className={`badge badge-${density}`}><span className={`crowd-dot ${density}`} style={{ width: 7, height: 7 }} />{density}{count > 0 ? ` · ${count}p` : ''}</span>
                </div>
              ))}
            {Object.values(crowdData).every(v => (typeof v === 'string' ? v : v?.density) === 'low') && (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>🟢 {t('all_clear')}</div>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <div className="section-title" style={{ marginBottom: '1rem' }}>⚡ {t('quick_actions')}</div>
        <div className="grid-4 grid">
          {[
            { icon: '🗺️', label: t('station_editor'), to: '/admin/editor' },
            { icon: '🔔', label: t('send_notification'), to: '/admin/notifications' },
            { icon: '📈', label: t('analytics'), to: '/admin/analytics' },
            { icon: '🔴', label: t('crowd_monitor'), to: '/admin/crowd' },
          ].map(a => (
            <button key={a.to} className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate(a.to)}>
              <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>{a.icon}</div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{a.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
