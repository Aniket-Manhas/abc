import { useEffect, useState } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { geoAPI, crowdAPI } from '../../services/api';
import StationMap from '../../components/Map/StationMap';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

export default function AdminCrowdMonitor() {
  const { crowdData, connected } = useSocket();
  const [stationGeo, setStationGeo] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [sortBy, setSortBy] = useState('density');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    Promise.all([geoAPI.getStation(), geoAPI.getGraph()])
      .then(([geo, graph]) => { setStationGeo(geo.data); setGraphData(graph.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (Object.keys(crowdData).length > 0) setLastUpdated(new Date());
  }, [crowdData]);

  if (loading) return <LoadingSpinner fullPage message="Loading crowd monitor…" />;

  const nodeList = graphData ? Object.values(graphData.nodes).filter(n => n.type !== 'boundary') : [];

  const enriched = nodeList.map(node => {
    const entry = crowdData[node.id];
    const density = entry ? (typeof entry === 'string' ? entry : entry.density) : 'low';
    const count = entry && typeof entry === 'object' ? entry.personCount : 0;
    return { ...node, density, personCount: count };
  });

  const sorted = [...enriched].sort((a, b) => {
    if (sortBy === 'density') {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.density] - order[b.density];
    }
    return a.name.localeCompare(b.name);
  });

  const counts = { high: 0, medium: 0, low: 0 };
  enriched.forEach(n => counts[n.density]++);

  const DENSITY_COLOR = { low: 'var(--crowd-low)', medium: 'var(--crowd-medium)', high: 'var(--crowd-high)' };
  const DENSITY_BG    = { low: 'rgba(34,197,94,0.1)', medium: 'rgba(245,158,11,0.1)', high: 'rgba(239,68,68,0.1)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>🔴 Crowd Monitor</h1>
          <p>Real-time crowd density across all station zones</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: connected ? 'var(--crowd-low)' : 'var(--crowd-high)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--crowd-low)' : 'var(--crowd-high)', animation: 'pulse-dot 2s infinite' }} />
            {connected ? 'Live' : 'Disconnected'}
          </div>
          {lastUpdated && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Updated {lastUpdated.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* Summary */}
      <div className="grid-3 grid">
        {[
          { label: 'High Density',   count: counts.high,   d: 'high' },
          { label: 'Medium Density', count: counts.medium, d: 'medium' },
          { label: 'Low Density',    count: counts.low,    d: 'low' },
        ].map(s => (
          <div key={s.d} className="stat-card" style={{ background: DENSITY_BG[s.d], borderColor: `${DENSITY_COLOR[s.d]}30` }}>
            <div className="stat-icon" style={{ background: DENSITY_BG[s.d] }}>
              <div className={`crowd-dot ${s.d}`} style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <div className="stat-value" style={{ color: DENSITY_COLOR[s.d] }}>{s.count}</div>
              <div className="stat-label">{s.label} Zones</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
        {/* Heatmap */}
        <div>
          <div className="section-title" style={{ marginBottom: '0.75rem' }}>🗺️ Live Heatmap</div>
          <StationMap stationGeo={stationGeo} graphData={graphData} showCrowdHeatmap height="480px"
            onNodeClick={n => setSelectedNode(n)} />
          {selectedNode && (
            <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 10 }}>
              <div style={{ fontWeight: 700 }}>{selectedNode.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Floor {selectedNode.floor} · {selectedNode.type}
              </div>
              {(() => {
                const entry = crowdData[selectedNode.id];
                const density = entry ? (typeof entry === 'string' ? entry : entry.density) : 'low';
                return <span className={`badge badge-${density}`} style={{ marginTop: '0.5rem', display: 'inline-flex' }}><span className={`crowd-dot ${density}`} style={{ width: 7, height: 7 }} />{density}</span>;
              })()}
            </div>
          )}
        </div>

        {/* Node list */}
        <div className="card" style={{ padding: '1rem' }}>
          <div className="section-header" style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>All Zones</div>
            <select className="input" style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="density">Sort: Density</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: 480, overflowY: 'auto' }}>
            {sorted.map(node => (
              <div key={node.id} onClick={() => setSelectedNode(node)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.625rem', borderRadius: 8, cursor: 'pointer', background: selectedNode?.id === node.id ? 'var(--bg-card-hover)' : 'transparent', transition: 'background 0.15s' }}>
                <div>
                  <div style={{ fontSize: '0.83rem', fontWeight: 500 }}>{node.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Floor {node.floor}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                  <span className={`badge badge-${node.density}`}>{node.density}</span>
                  {node.personCount > 0 && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{node.personCount}p</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
