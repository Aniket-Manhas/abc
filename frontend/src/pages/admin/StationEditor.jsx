import { useState, useEffect } from 'react';
import { geoAPI } from '../../services/api';
import StationMap from '../../components/Map/StationMap';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const TYPE_OPTIONS = ['gate','platform','ticket','concourse','waiting','bridge','lift','stairs','ramp','food','restroom','medical','inquiry','atm'];
const TYPE_ICONS = { gate:'🚪', platform:'🚉', ticket:'🎫', concourse:'🏛️', waiting:'🪑', bridge:'🌉', lift:'🛗', stairs:'🪜', ramp:'♿', food:'🍽️', restroom:'🚻', medical:'🏥', inquiry:'❓', atm:'🏧' };

export default function StationEditor() {
  const [stationGeo, setStationGeo] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [editMode, setEditMode] = useState('view'); // view | edit_node
  const [search, setSearch] = useState('');
  const [editForm, setEditForm] = useState({});
  const [changes, setChanges] = useState([]);

  useEffect(() => {
    Promise.all([geoAPI.getStation(), geoAPI.getGraph()])
      .then(([geo, graph]) => { setStationGeo(geo.data); setGraphData(graph.data); })
      .finally(() => setLoading(false));
  }, []);

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    setEditForm({ name: node.name, type: node.type, floor: node.floor, accessible: node.accessible });
    setEditMode('edit_node');
  };

  const saveNodeEdit = () => {
    if (!selectedNode) return;
    setChanges(prev => [...prev, { type: 'node_edit', nodeId: selectedNode.id, before: selectedNode, after: editForm, timestamp: new Date().toLocaleTimeString() }]);
    setEditMode('view');
    alert(`✅ Node "${editForm.name}" updated (in-memory only — connect backend to persist)`);
  };

  const nodes = graphData ? Object.values(graphData.nodes).filter(n => n.type !== 'boundary') : [];
  const filteredNodes = nodes.filter(n => n.name.toLowerCase().includes(search.toLowerCase()) || n.type.includes(search.toLowerCase()));

  const nodesByType = filteredNodes.reduce((acc, n) => {
    if (!acc[n.type]) acc[n.type] = [];
    acc[n.type].push(n);
    return acc;
  }, {});

  if (loading) return <LoadingSpinner fullPage message="Loading station editor…" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>🗺️ Station Editor</h1>
          <p>View and edit station nodes and map elements. Click any node on the map to inspect it.</p>
        </div>
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.8rem', color: 'var(--crowd-medium)' }}>
          ⚠️ Map edits are in-memory only in this build. Backend persistence requires a PATCH endpoint.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Map */}
        <div>
          <StationMap stationGeo={stationGeo} graphData={graphData} onNodeClick={handleNodeClick}
            selectedSource={selectedNode?.id} showCrowdHeatmap={false} height="520px" />
          <div style={{ marginTop: '0.625rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            💡 Click any marker on the map to inspect and edit that node
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Node edit form */}
          {editMode === 'edit_node' && selectedNode && (
            <div className="card" style={{ borderColor: 'rgba(59,130,246,0.3)' }}>
              <div className="section-title" style={{ marginBottom: '1rem' }}>✏️ Edit Node</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div className="input-group">
                  <label className="label">Node ID</label>
                  <input className="input" value={selectedNode.id} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                </div>
                <div className="input-group">
                  <label className="label">Display Name</label>
                  <input className="input" value={editForm.name || ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="label">Type</label>
                  <select className="input" value={editForm.type || ''} onChange={e => setEditForm(p => ({ ...p, type: e.target.value }))}>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="label">Floor</label>
                  <select className="input" value={editForm.floor || 0} onChange={e => setEditForm(p => ({ ...p, floor: parseInt(e.target.value) }))}>
                    <option value={0}>Ground Floor (0)</option>
                    <option value={1}>Floor 1 (FOB)</option>
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editForm.accessible || false} onChange={e => setEditForm(p => ({ ...p, accessible: e.target.checked }))} />
                  ♿ Wheelchair accessible
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button className="btn btn-secondary" onClick={() => setEditMode('view')}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveNodeEdit} id="save-node-btn">💾 Save</button>
                </div>
              </div>
            </div>
          )}

          {/* Node explorer */}
          <div className="card" style={{ padding: '1rem' }}>
            <div className="section-title" style={{ marginBottom: '0.75rem' }}>📋 All Nodes ({nodes.length})</div>
            <input className="input" placeholder="Search nodes…" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: '0.75rem' }} />
            <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Object.entries(nodesByType).map(([type, list]) => (
                <div key={type}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', marginBottom: '0.3rem' }}>
                    {TYPE_ICONS[type]} {type} ({list.length})
                  </div>
                  {list.map(node => (
                    <button key={node.id} onClick={() => handleNodeClick(node)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                      padding: '0.4rem 0.5rem', borderRadius: 6, background: selectedNode?.id === node.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)'
                    }}>
                      <span style={{ fontSize: '0.82rem' }}>{node.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>F{node.floor}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Change log */}
          {changes.length > 0 && (
            <div className="card" style={{ padding: '1rem' }}>
              <div className="section-title" style={{ marginBottom: '0.75rem' }}>📝 Changes ({changes.length})</div>
              {changes.slice(-5).reverse().map((c, i) => (
                <div key={i} style={{ fontSize: '0.78rem', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  [{c.timestamp}] {c.type}: {c.nodeId}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
