import { useState, useEffect, useRef, useCallback } from 'react';

const STAMPEDE_URL = import.meta.env.VITE_STAMPEDE_URL || 'http://localhost:5002';

const RISK_CONFIG = {
  'Normal':                      { color: '#27ae60', bg: 'rgba(39,174,96,0.1)',   border: 'rgba(39,174,96,0.25)',   icon: '🟢', level: 0 },
  'High Density Cell Detected':  { color: '#e67e22', bg: 'rgba(230,126,34,0.1)',  border: 'rgba(230,126,34,0.25)',  icon: '🟡', level: 1 },
  'High Density Warning':        { color: '#e67e22', bg: 'rgba(230,126,34,0.12)', border: 'rgba(230,126,34,0.3)',   icon: '⚠️', level: 2 },
  'Critical Density Cell Detected': { color: '#e74c3c', bg: 'rgba(231,76,60,0.12)', border: 'rgba(231,76,60,0.3)', icon: '🔶', level: 3 },
  'CRITICAL RISK':               { color: '#e74c3c', bg: 'rgba(231,76,60,0.18)', border: 'rgba(231,76,60,0.4)',   icon: '🚨', level: 4 },
};

function getRiskConfig(status) {
  return RISK_CONFIG[status] || { color: 'var(--text-muted)', bg: 'var(--bg-secondary)', border: 'var(--border)', icon: '⏳', level: -1 };
}

// ── Density Grid Heatmap (8×8) ────────────────────────────────
function DensityGrid({ grid }) {
  if (!grid || !Array.isArray(grid)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Waiting for density data…
      </div>
    );
  }

  const flat = grid.flat();
  const maxVal = Math.max(...flat, 1);

  const getCell = (val) => {
    const ratio = val / maxVal;
    if (ratio > 0.8) return { bg: '#e74c3c', label: val };
    if (ratio > 0.5) return { bg: '#e67e22', label: val };
    if (ratio > 0.2) return { bg: '#f39c12', label: val };
    if (val > 0)     return { bg: '#27ae60', label: val };
    return { bg: 'rgba(255,255,255,0.04)', label: '' };
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
        {grid.map((row, r) =>
          row.map((val, c) => {
            const { bg, label } = getCell(val);
            return (
              <div
                key={`${r}-${c}`}
                title={`Cell [${r},${c}]: ${val} persons`}
                style={{
                  aspectRatio: '1', borderRadius: 4, background: bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', fontWeight: 700, color: '#fff',
                  transition: 'background 0.3s',
                }}
              >
                {label}
              </div>
            );
          })
        )}
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#27ae60', marginRight: 4 }} />Low</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#f39c12', marginRight: 4 }} />Medium</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#e67e22', marginRight: 4 }} />High</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#e74c3c', marginRight: 4 }} />Critical</span>
      </div>
    </div>
  );
}

function RiskScoreGrid({ grid }) {
  if (!grid || !Array.isArray(grid)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Waiting for risk patch data…
      </div>
    );
  }

  const getCell = (score) => {
    if (score >= 0.8) return { bg: '#e74c3c', label: `${Math.round(score * 100)}%` };
    if (score >= 0.6) return { bg: '#f1c40f', label: `${Math.round(score * 100)}%` };
    if (score > 0.35) return { bg: 'rgba(241,196,15,0.35)', label: '' };
    return { bg: 'rgba(255,255,255,0.04)', label: '' };
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
        {grid.map((row, r) =>
          row.map((val, c) => {
            const score = Number(val || 0);
            const { bg, label } = getCell(score);
            return (
              <div
                key={`${r}-${c}`}
                title={`Patch [${r},${c}] risk: ${Math.round(score * 100)}%`}
                style={{
                  aspectRatio: '1', borderRadius: 4, background: bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.58rem', fontWeight: 700, color: '#fff',
                  transition: 'background 0.3s',
                }}
              >
                {label}
              </div>
            );
          })
        )}
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#f1c40f', marginRight: 4 }} />High</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#e74c3c', marginRight: 4 }} />Critical</span>
      </div>
    </div>
  );
}

// ── Upload Tab ────────────────────────────────────────────────
function UploadTab() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError(''); setResult(null);
    const fd = new FormData();
    fd.append('media', file);
    try {
      const res = await fetch(`${STAMPEDE_URL}/upload_media`, { method: 'POST', body: fd });
      const text = await res.text();
      // Parse status from returned HTML (results.html)
      const statusMatch = text.match(/prediction_status['":\s]+([^<"']+)/i);
      const personsMatch = text.match(/max_persons['":\s]+(\d+)/i);
      const timeMatch = text.match(/processing_time['":\s]+([\d.]+)/i);
      setResult({
        status: statusMatch?.[1]?.trim() || 'Analysis complete',
        persons: personsMatch?.[1] || '?',
        time: timeMatch?.[1] || '?',
        raw: text,
      });
    } catch (e) {
      setError('Upload failed — is the Stampede server running on port 5002?');
    } finally { setUploading(false); }
  };

  const risk = result ? getRiskConfig(result.status) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${file ? 'var(--accent-blue)' : 'var(--border-bright)'}`,
          borderRadius: 14, padding: '2rem',
          textAlign: 'center', cursor: 'pointer',
          background: file ? 'rgba(59,130,246,0.05)' : 'var(--bg-secondary)',
          transition: 'var(--transition)',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{file ? '📁' : '📤'}</div>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
          {file ? file.name : 'Click to upload image or video'}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Supports MP4, AVI, MOV, JPG, PNG
        </div>
        <input
          ref={fileRef} type="file" accept="video/*,image/*" style={{ display: 'none' }}
          onChange={e => { setFile(e.target.files[0]); setResult(null); }}
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={handleUpload}
        disabled={!file || uploading}
        style={{ width: '100%' }}
      >
        {uploading ? '⏳ Analysing (YOLO)…' : '🔬 Run Stampede Analysis'}
      </button>

      {error && (
        <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#e74c3c' }}>
          {error}
        </div>
      )}

      {result && risk && (
        <div style={{ background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.8rem' }}>{risk.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: risk.color }}>{result.status}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Analysis complete</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: 2 }}>Max Persons</div>
              <div style={{ fontWeight: 700, color: risk.color, fontSize: '1.5rem' }}>{result.persons}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: 2 }}>Process Time</div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{result.time}s</div>
            </div>
          </div>
          {result.status.includes('CRITICAL') && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: '#e74c3c', fontWeight: 600 }}>
              ⚠️ Critical risk detected — immediate intervention recommended
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function StampedeMonitor() {
  const [activeTab, setActiveTab] = useState('live');
  const [sseStatus, setSseStatus] = useState({ status: 'Connecting…', persons: 0, highRiskCells: 0, criticalRiskCells: 0 });
  const [densityGrid, setDensityGrid] = useState(null);
  const [riskScoreGrid, setRiskScoreGrid] = useState(null);
  const [history, setHistory] = useState([]);
  const [serverOnline, setServerOnline] = useState(null); // null=checking, true, false
  const [cameraIndex, setCameraIndex] = useState(0);
  const [streamKey, setStreamKey] = useState(0); // force re-render for stream
  const eventSourceRef = useRef(null);

  // ── Check if server is online
  useEffect(() => {
    fetch(`${STAMPEDE_URL}/api/status`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? setServerOnline(true) : setServerOnline(false))
      .catch(() => setServerOnline(false));
  }, []);

  // ── SSE connection for live status
  useEffect(() => {
    if (activeTab !== 'live') return;

    const connectSSE = () => {
      eventSourceRef.current?.close();
      const es = new EventSource(`${STAMPEDE_URL}/stream_status`);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          setSseStatus({
            status: data.status || 'Normal',
            persons: data.persons ?? 0,
            highRiskCells: data.high_risk_cells ?? 0,
            criticalRiskCells: data.critical_risk_cells ?? 0,
          });
          if (data.density_grid) setDensityGrid(data.density_grid);
          if (data.risk_score_grid) setRiskScoreGrid(data.risk_score_grid);
          setHistory(h => [
            { time: new Date().toLocaleTimeString(), status: data.status, persons: data.persons ?? 0 },
            ...h.slice(0, 19)
          ]);
        } catch (_) {}
      };
      es.onerror = () => setSseStatus(s => ({ ...s, status: 'Stream unavailable' }));
      eventSourceRef.current = es;
    };

    connectSSE();
    return () => eventSourceRef.current?.close();
  }, [activeTab, streamKey]);

  const riskCfg = getRiskConfig(sseStatus.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>📹 Stampede AI Monitor</h1>
          <p>Real-time crowd density analysis and stampede risk prediction using YOLOv11</p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.4rem 0.875rem', borderRadius: 20,
          background: serverOnline === null ? 'var(--bg-secondary)'
                      : serverOnline ? 'rgba(39,174,96,0.1)' : 'rgba(231,76,60,0.1)',
          border: `1px solid ${serverOnline === null ? 'var(--border)'
                               : serverOnline ? 'rgba(39,174,96,0.3)' : 'rgba(231,76,60,0.3)'}`,
          fontSize: '0.8rem', fontWeight: 600,
          color: serverOnline === null ? 'var(--text-muted)'
                 : serverOnline ? '#27ae60' : '#e74c3c',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          {serverOnline === null ? 'Checking…' : serverOnline ? 'Server Online' : 'Server Offline'}
        </div>
      </div>

      {/* Server offline warning */}
      {serverOnline === false && (
        <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', borderRadius: 12, padding: '1rem 1.25rem', fontSize: '0.875rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.3rem' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: '#e74c3c' }}>Stampede Server Not Running</div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Start it with: <code style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4, fontSize: '0.8rem' }}>cd backend/stampede-server &amp;&amp; python app.py</code>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>📡 Live Feed</button>
        <button className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => setActiveTab('upload')}>📤 Upload Analyse</button>
        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>📋 Event Log</button>
      </div>

      {/* ── LIVE TAB ── */}
      {activeTab === 'live' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
          {/* MJPEG stream */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div className="section-title">📷 Camera Feed</div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select
                  value={cameraIndex}
                  onChange={e => { setCameraIndex(+e.target.value); setStreamKey(k => k + 1); }}
                  className="input"
                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                >
                  <option value={0}>Camera 0 (default)</option>
                  <option value={1}>Camera 1 (demo video)</option>
                  <option value={2}>Camera 2 (demo video)</option>
                </select>
                <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  onClick={() => setStreamKey(k => k + 1)}>
                  🔄 Refresh
                </button>
              </div>
            </div>
            <div style={{
              borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border-bright)',
              background: 'var(--bg-secondary)', position: 'relative',
              aspectRatio: '16/9',
            }}>
              {serverOnline === false ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '3rem' }}>📵</span>
                  <span>Server offline</span>
                </div>
              ) : (
                <img
                  key={streamKey}
                  src={`${STAMPEDE_URL}/video_feed?camera=${cameraIndex}&t=${streamKey}`}
                  alt="Live stampede risk overlay feed"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              {/* Live badge */}
              <div style={{
                position: 'absolute', top: 12, left: 12,
                background: 'rgba(231,76,60,0.9)', color: '#fff',
                borderRadius: 6, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulse-dot 1s infinite' }} />
                LIVE
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Risk status card */}
            <div className="card" style={{ borderColor: `${riskCfg.border}`, background: riskCfg.bg }}>
              <div className="section-title" style={{ marginBottom: '1rem' }}>⚡ Risk Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '2.5rem' }}>{riskCfg.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: riskCfg.color, lineHeight: 1.2 }}>
                    {sseStatus.status}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Current assessment</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Persons Detected</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: riskCfg.color, lineHeight: 1 }}>{sseStatus.persons}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Risk Level</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: riskCfg.color }}>{riskCfg.level >= 0 ? riskCfg.level : '—'}/4</div>
                </div>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <span>High patches: <strong style={{ color: '#f1c40f' }}>{sseStatus.highRiskCells}</strong></span>
                <span>Critical patches: <strong style={{ color: '#e74c3c' }}>{sseStatus.criticalRiskCells}</strong></span>
              </div>
            </div>

            {/* Risk score grid */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: '0.875rem' }}>🟥 High-Risk Patch Map (8×8)</div>
              <RiskScoreGrid grid={riskScoreGrid} />
            </div>

            {/* Density grid */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: '0.875rem' }}>📊 Person Density Support Grid (8×8)</div>
              <DensityGrid grid={densityGrid} />
            </div>

            {/* Quick thresholds */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: '0.75rem' }}>⚙️ Detection Thresholds</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>High density cell</span><span style={{ color: '#f1c40f', fontWeight: 600 }}>≥ 3 persons</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Critical density cell</span><span style={{ color: '#e74c3c', fontWeight: 600 }}>≥ 6 persons</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>High patch trigger</span><span style={{ color: '#f1c40f', fontWeight: 600 }}>Risk score ≥ 0.60</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Critical patch trigger</span><span style={{ color: '#e74c3c', fontWeight: 600 }}>Risk score ≥ 0.80</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── UPLOAD TAB ── */}
      {activeTab === 'upload' && (
        <div style={{ maxWidth: 640 }}>
          <UploadTab />
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: '1rem' }}>📋 Live Event Log</div>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📡</div>
              Switch to Live Feed tab to start collecting events
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {history.map((h, i) => {
                const cfg = getRiskConfig(h.status);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '0.5rem 0.75rem', borderRadius: 8,
                    background: i === 0 ? cfg.bg : 'var(--bg-secondary)',
                    border: `1px solid ${i === 0 ? cfg.border : 'var(--border)'}`,
                    fontSize: '0.83rem',
                  }}>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.75rem', flexShrink: 0 }}>{h.time}</span>
                    <span style={{ flex: 1, color: cfg.color, fontWeight: i === 0 ? 700 : 400 }}>{cfg.icon} {h.status}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{h.persons} persons</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
