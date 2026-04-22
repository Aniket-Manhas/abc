import { useState, useEffect } from 'react';
import { analyticsAPI_req } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 8, padding: '0.75rem' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.85rem' }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ fontSize: '0.8rem', color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</div>)}
    </div>
  );
};

export default function Analytics() {
  const [usageStats, setUsageStats] = useState(null);
  const [popularRoutes, setPopularRoutes] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [crowdSummary, setCrowdSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    Promise.all([
      analyticsAPI_req.getUsageStats(),
      analyticsAPI_req.getPopularRoutes(),
      analyticsAPI_req.getPeakHours(),
      analyticsAPI_req.getCrowdSummary(),
    ]).then(([stats, routes, peak, crowd]) => {
      setUsageStats(stats.data);
      setPopularRoutes(routes.data);
      setPeakHours(peak.data);
      setCrowdSummary(crowd.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Build hourly chart data (0-23)
  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const entry = usageStats?.hourlyToday?.find(e => parseInt(e.hour) === h);
    return { hour: `${h}:00`, navigations: entry?.count || 0 };
  });

  // Peak hours chart (avg density per hour)
  const peakHoursChart = Array.from({ length: 24 }, (_, h) => {
    const entries = peakHours.filter(p => p.hour === h);
    const avg = entries.length ? entries.reduce((s, p) => s + p.avg_density, 0) / entries.length : 0;
    return { hour: `${h}h`, avgDensity: parseFloat((avg * 100).toFixed(1)) };
  });

  const crowdPie = [
    { name: 'Low', value: crowdSummary.reduce((s, n) => s + (n.low_count || 0), 0) },
    { name: 'Medium', value: crowdSummary.reduce((s, n) => s + (n.medium_count || 0), 0) },
    { name: 'High', value: crowdSummary.reduce((s, n) => s + (n.high_count || 0), 0) },
  ];

  if (loading) return <LoadingSpinner fullPage message="Loading analytics…" />;

  const chartStyle = { fontSize: 11, fill: '#94a3b8' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1>📈 Analytics & Reports</h1>
        <p>Station usage patterns, crowd trends, and navigation statistics</p>
      </div>

      {/* Summary stats */}
      <div className="grid-4 grid">
        {[
          { label: "Today's Navigations", value: usageStats?.todayNavigations || 0, icon: '🧭', color: 'var(--accent-blue)' },
          { label: 'Total All Time', value: usageStats?.totalNavigations || 0, icon: '📊', color: 'var(--accent-cyan)' },
          { label: 'Accessible Routes', value: usageStats?.accessibleNavigations || 0, icon: '♿', color: '#a855f7' },
          { label: 'Avg Distance (m)', value: usageStats?.avgDistance || 0, icon: '📍', color: '#f97316' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: `${s.color}22`, fontSize: '1.3rem' }}>{s.icon}</div>
            <div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ width: 'fit-content' }}>
        {['overview', 'routes', 'crowd'].map(t => (
          <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card">
            <div className="section-title" style={{ marginBottom: '1rem' }}>🧭 Today's Navigation by Hour</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyData}>
                <XAxis dataKey="hour" tick={chartStyle} interval={3} />
                <YAxis tick={chartStyle} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="navigations" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="section-title" style={{ marginBottom: '1rem' }}>📊 Crowd Distribution (All Time)</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={crowdPie} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {crowdPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="section-title" style={{ marginBottom: '1rem' }}>⏰ Peak Crowd Hours</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={peakHoursChart}>
                <XAxis dataKey="hour" tick={chartStyle} interval={2} />
                <YAxis tick={chartStyle} unit="%" domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="avgDensity" stroke="#f59e0b" strokeWidth={2} dot={false} name="Avg Density %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'routes' && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: '1rem' }}>🔥 Most Popular Routes</div>
          {popularRoutes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No route data yet. Routes will appear after passengers navigate.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: '0.5rem', padding: '0.5rem 0.875rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                <span>From</span><span>To</span><span>Count</span><span>Avg Dist</span><span>Avg Time</span>
              </div>
              {popularRoutes.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: '0.5rem', padding: '0.75rem 0.875rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', alignItems: 'center' }}>
                  <span>{r.source_node?.replace(/_/g, ' ')}</span>
                  <span>{r.dest_node?.replace(/_/g, ' ')}</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{r.count}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{Math.round(r.avg_distance)}m</span>
                  <span style={{ color: 'var(--text-muted)' }}>{Math.ceil(r.avg_time / 60)}min</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'crowd' && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: '1rem' }}>📊 Crowd History by Zone</div>
          {crowdSummary.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No crowd history yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '0.5rem', padding: '0.5rem 0.875rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                <span>Zone</span><span style={{ color: 'var(--crowd-high)' }}>High</span><span style={{ color: 'var(--crowd-medium)' }}>Medium</span><span style={{ color: 'var(--crowd-low)' }}>Low</span><span>Total</span>
              </div>
              {crowdSummary.slice(0, 15).map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '0.5rem', padding: '0.625rem 0.875rem', borderBottom: '1px solid var(--border)', fontSize: '0.82rem', alignItems: 'center' }}>
                  <span>{r.node_name}</span>
                  <span style={{ color: 'var(--crowd-high)', fontWeight: 600 }}>{r.high_count}</span>
                  <span style={{ color: 'var(--crowd-medium)', fontWeight: 600 }}>{r.medium_count}</span>
                  <span style={{ color: 'var(--crowd-low)', fontWeight: 600 }}>{r.low_count}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{r.total_readings}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
