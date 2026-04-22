import { useState, useEffect } from 'react';
import { geoAPI } from '../../services/api';
import StationMap from './StationMap';
import RoutePanel from '../Navigation/RoutePanel';
import LoadingSpinner from '../shared/LoadingSpinner';
import { analyticsAPI_req } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function IndoorPanel({ open, onClose }) {
  const { user } = useAuth();
  const [stationGeo, setStationGeo] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [routeResult, setRouteResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('route');

  useEffect(() => {
    if (!open) return;
    if (stationGeo) return; // already loaded
    Promise.all([geoAPI.getStation(), geoAPI.getGraph()])
      .then(([geo, graph]) => { setStationGeo(geo.data); setGraphData(graph.data); })
      .finally(() => setLoading(false));
  }, [open]);

  const handleRouteComputed = async (result) => {
    setRouteResult(result);
    if (result) {
      try {
        await analyticsAPI_req.logNavigation({
          userId: user?._id,
          sourceNode: result.source,
          destNode: result.dest,
          pathNodes: result.path,
          totalDistance: result.realDistance,
          estimatedTime: result.etaSeconds,
          crowdAware: true,
        });
      } catch (_) {}
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 199,
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(1px)',
          }}
        />
      )}

      {/* Panel */}
      <div className={`indoor-panel ${open ? 'open' : ''}`}>
        {/* Header */}
        <div className="indoor-panel-header">
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #e8a020, #d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem'
          }}>🚉</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'Rajdhani', letterSpacing: '0.04em' }}>
              Jammu Tawi Junction
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Indoor Navigation
            </div>
          </div>
          <button onClick={onClose} className="btn-icon">✕</button>
        </div>

        {/* Mini station map */}
        <div style={{ padding: '1rem 1.25rem 0' }}>
          <StationMap
            stationGeo={stationGeo}
            graphData={graphData}
            routeCoords={routeResult?.coords}
            showCrowdHeatmap
            height="220px"
          />
          {routeResult && (
            <div className="route-info-bar" style={{ marginTop: '0.625rem' }}>
              <span style={{ fontFamily: 'DM Mono', fontSize: '0.82rem' }}>
                📍 {Math.round(routeResult.realDistance)}m
              </span>
              <span style={{ fontFamily: 'DM Mono', fontSize: '0.82rem' }}>
                ⏱ {Math.ceil(routeResult.etaSeconds / 60)} min
              </span>
              <span style={{ fontFamily: 'DM Mono', fontSize: '0.82rem' }}>
                🔵 {routeResult.path.length} stops
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ padding: '0.875rem 1.25rem 0' }}>
          <div className="tab-bar">
            <button className={`tab-btn ${activeTab === 'route' ? 'active' : ''}`} onClick={() => setActiveTab('route')}>
              🧭 Route
            </button>
            <button className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>
              ℹ️ Station Info
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="indoor-panel-body">
          {loading ? (
            <LoadingSpinner message="Loading indoor map…" />
          ) : activeTab === 'route' ? (
            graphData ? (
              <RoutePanel graphData={graphData} onRouteComputed={handleRouteComputed} />
            ) : null
          ) : (
            <StationInfo />
          )}
        </div>
      </div>
    </>
  );
}

function StationInfo() {
  const facts = [
    { icon: '🚉', label: 'Station Code', value: 'JAT' },
    { icon: '🛤️', label: 'Zone', value: 'Northern Railway' },
    { icon: '📍', label: 'Division', value: 'Firozpur' },
    { icon: '🚊', label: 'Platforms', value: '6 + 1 Bay Platform' },
    { icon: '🏢', label: 'Category', value: 'A1 (Major)' },
    { icon: '📞', label: 'Enquiry', value: '139' },
    { icon: '⏰', label: 'Timings', value: '24 × 7' },
    { icon: '♿', label: 'Accessibility', value: 'Lift, Ramp, Tactile Paths' },
  ];

  const amenities = ['Waiting Hall', 'Cloak Room', 'ATM', 'Food Stalls', 'Medical Room', 'Police Post', 'Reservation Counter', 'Tourism Office', 'Prepaid Taxi'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card" style={{ padding: '1rem' }}>
        <div className="section-title" style={{ marginBottom: '0.875rem', fontSize: '0.95rem' }}>📋 Station Details</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {facts.map(f => (
            <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{f.icon} {f.label}</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, fontFamily: 'DM Mono' }}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        <div className="section-title" style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>🏛️ Amenities</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {amenities.map(a => (
            <span key={a} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', borderRadius: 6, padding: '0.25rem 0.625rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{a}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
