import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';

const STAMPEDE_URL = import.meta.env.VITE_STAMPEDE_URL || 'http://localhost:5002';

const RISK_CONFIG = {
  'SAFE':      { color: '#27ae60', bg: 'rgba(39,174,96,0.08)',   border: 'rgba(39,174,96,0.25)',   icon: '🟢', label: 'Safe',      level: 0 },
  'Normal':    { color: '#27ae60', bg: 'rgba(39,174,96,0.08)',   border: 'rgba(39,174,96,0.25)',   icon: '🟢', label: 'Safe',      level: 0 },
  'NORMAL':    { color: '#27ae60', bg: 'rgba(39,174,96,0.08)',   border: 'rgba(39,174,96,0.25)',   icon: '🟢', label: 'Safe',      level: 0 },
  'WARNING':   { color: '#f39c12', bg: 'rgba(243,156,18,0.08)',  border: 'rgba(243,156,18,0.3)',   icon: '⚠️', label: 'Warning',   level: 1 },
  'MEDIUM RISK':{ color:'#e67e22', bg: 'rgba(230,126,34,0.08)',  border: 'rgba(230,126,34,0.3)',   icon: '⚠️', label: 'Warning',   level: 1 },
  'HIGH RISK': { color: '#e74c3c', bg: 'rgba(231,76,60,0.10)',   border: 'rgba(231,76,60,0.35)',   icon: '🔶', label: 'High Risk', level: 2 },
  'DANGER':    { color: '#c0392b', bg: 'rgba(192,57,43,0.15)',   border: 'rgba(192,57,43,0.5)',    icon: '🚨', label: 'DANGER',    level: 3 },
};

function getRisk(s) {
  return RISK_CONFIG[s] || { color: 'var(--text-muted)', bg: 'var(--bg-secondary)', border: 'var(--border)', icon: '⏳', label: s || '…', level: -1 };
}

// Density heatmap grid (shows p/m² per cell)
function DensityGrid({ grid }) {
  if (!grid || !Array.isArray(grid)) {
    return <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Waiting for data…</div>;
  }
  const flat = grid.flat();
  const maxVal = Math.max(...flat, 0.01);

  const cellColor = (v) => {
    const r = v / maxVal;
    if (r > 0.8) return '#c0392b';
    if (r > 0.5) return '#e74c3c';
    if (r > 0.25) return '#e67e22';
    if (v > 0.05) return '#27ae60';
    return 'rgba(255,255,255,0.04)';
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${grid[0]?.length || 6}, 1fr)`, gap: 2 }}>
        {grid.map((row, r) => row.map((val, c) => (
          <div key={`${r}-${c}`}
            title={`Zone [${r},${c}]: ${Number(val).toFixed(2)} p/m²`}
            style={{ aspectRatio: '1', borderRadius: 3, background: cellColor(val), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 700, color: '#fff', transition: 'background 0.4s' }}>
            {val > 0.05 ? Number(val).toFixed(1) : ''}
          </div>
        )))}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.6rem', fontSize: '0.68rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        {[['#27ae60','Safe <1'],['#e67e22','Warning 1–2'],['#e74c3c','High 2–4'],['#c0392b','Danger >4']].map(([bg, lbl]) => (
          <span key={lbl}><span style={{ display:'inline-block', width:9, height:9, borderRadius:2, background:bg, marginRight:3 }} />{lbl} p/m²</span>
        ))}
      </div>
    </div>
  );
}

// Risk score grid (0–1 per cell)
function RiskScoreGrid({ grid }) {
  if (!grid || !Array.isArray(grid)) {
    return <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Waiting for data…</div>;
  }
  const cellBg = (s) => {
    if (s >= 0.8) return '#c0392b';
    if (s >= 0.6) return '#e74c3c';
    if (s >= 0.35) return '#e67e22';
    if (s > 0) return 'rgba(243,156,18,0.25)';
    return 'rgba(255,255,255,0.04)';
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${grid[0]?.length || 6}, 1fr)`, gap: 2 }}>
      {grid.map((row, r) => row.map((val, c) => {
        const s = Number(val || 0);
        return (
          <div key={`${r}-${c}`}
            title={`Patch [${r},${c}]: ${Math.round(s * 100)}% risk`}
            style={{ aspectRatio: '1', borderRadius: 3, background: cellBg(s), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.48rem', fontWeight: 700, color: '#fff', transition: 'background 0.4s' }}>
            {s >= 0.35 ? `${Math.round(s*100)}%` : ''}
          </div>
        );
      }))}
    </div>
  );
}

// Risk score bar
function RiskBar({ score }) {
  const pct = Math.min(Number(score) || 0, 100);
  const color = pct >= 80 ? '#c0392b' : pct >= 55 ? '#e74c3c' : pct >= 30 ? '#e67e22' : '#27ae60';
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:4 }}>
        <span>Crowd Risk Score</span><span style={{ color, fontWeight:700 }}>{pct.toFixed(1)}/100</span>
      </div>
      <div style={{ height:8, borderRadius:4, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:4, transition:'width 0.6s ease, background 0.4s' }} />
      </div>
    </div>
  );
}

// Upload / analyse tab
function UploadTab() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const ref = useRef();

  const run = async () => {
    if (!file) return;
    setBusy(true); setErr(''); setResult(null);
    const fd = new FormData();
    fd.append('media', file);
    try {
      const res  = await fetch(`${STAMPEDE_URL}/upload_media`, { method: 'POST', body: fd });
      const data = await res.json();
      setResult(data);
    } catch {
      setErr('Upload failed — is the crowd monitor server running on port 5002?');
    } finally { setBusy(false); }
  };

  const rc = result ? getRisk(result.prediction_status) : null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      <div onClick={() => ref.current?.click()}
        style={{ border:`2px dashed ${file ? 'var(--accent-blue)' : 'var(--border-bright)'}`, borderRadius:14, padding:'2rem', textAlign:'center', cursor:'pointer', background: file ? 'rgba(59,130,246,0.05)' : 'var(--bg-secondary)', transition:'var(--transition)' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>{file ? '📁' : '📤'}</div>
        <div style={{ fontWeight:600, marginBottom:'0.25rem' }}>{file ? file.name : 'Click to upload image or video'}</div>
        <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Supports MP4, AVI, MOV, JPG, PNG</div>
        <input ref={ref} type="file" accept="video/*,image/*" style={{ display:'none' }} onChange={e => { setFile(e.target.files[0]); setResult(null); }} />
      </div>

      <button className="btn btn-primary" onClick={run} disabled={!file || busy} style={{ width:'100%' }}>
        {busy ? '⏳ Analysing…' : '🔬 Run Crowd Density Analysis'}
      </button>

      {err && <div style={{ background:'rgba(231,76,60,0.1)', border:'1px solid rgba(231,76,60,0.3)', borderRadius:10, padding:'0.75rem 1rem', fontSize:'0.85rem', color:'#e74c3c' }}>{err}</div>}

      {result && rc && (
        <div style={{ background:rc.bg, border:`1px solid ${rc.border}`, borderRadius:12, padding:'1.25rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem' }}>
            <span style={{ fontSize:'1.8rem' }}>{rc.icon}</span>
            <div>
              <div style={{ fontWeight:700, fontSize:'1.1rem', color:rc.color }}>{result.prediction_status}</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Analysis complete</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:'2rem', fontSize:'0.875rem', flexWrap:'wrap' }}>
            <div><div style={{ color:'var(--text-muted)', fontSize:'0.7rem', textTransform:'uppercase', marginBottom:2 }}>Persons</div>
              <div style={{ fontWeight:800, color:rc.color, fontSize:'1.5rem' }}>{result.max_persons}</div></div>
            <div><div style={{ color:'var(--text-muted)', fontSize:'0.7rem', textTransform:'uppercase', marginBottom:2 }}>Density</div>
              <div style={{ fontWeight:700, fontSize:'1rem', color:rc.color }}>{result.density_m2} p/m²</div></div>
            <div><div style={{ color:'var(--text-muted)', fontSize:'0.7rem', textTransform:'uppercase', marginBottom:2 }}>Time</div>
              <div style={{ fontWeight:700, fontSize:'1rem' }}>{result.processing_time}s</div></div>
            {result.using_p2pnet && <div style={{ alignSelf:'center' }}>
              <span style={{ background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.4)', borderRadius:6, padding:'2px 8px', fontSize:'0.7rem', color:'#3b82f6', fontWeight:700 }}>P2PNet</span>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StampedeMonitor() {
  const [tab, setTab]             = useState('live');
  const [sse, setSse]             = useState({ status: 'SAFE', persons: 0, density_m2: 0, risk_score: 0, highRiskCells: 0, criticalRiskCells: 0, using_p2pnet: false, alert_msg: '' });
  const [densityGrid, setDGrid]   = useState(null);
  const [riskGrid, setRGrid]      = useState(null);
  const [history, setHistory]     = useState([]);
  const [online, setOnline]       = useState(null);
  const [camIdx, setCamIdx]       = useState(0);
  const [streamKey, setStreamKey] = useState(0);
  const esRef = useRef(null);
  const { reportCameraData } = useSocket();

  // Server health check
  useEffect(() => {
    fetch(`${STAMPEDE_URL}/api/status`, { signal: AbortSignal.timeout(3000) })
      .then(r => setOnline(r.ok))
      .catch(() => setOnline(false));
  }, []);

  // SSE connection
  useEffect(() => {
    if (tab !== 'live') return;
    esRef.current?.close();
    const es = new EventSource(`${STAMPEDE_URL}/stream_status`);
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        setSse({
          status:            d.status || 'SAFE',
          persons:           d.persons ?? 0,
          density_m2:        d.density_m2 ?? 0,
          risk_score:        d.risk_score ?? 0,
          using_p2pnet:      d.using_p2pnet ?? false,
          alert_msg:         d.alert_msg || '',
          highRiskCells:     d.high_risk_cells ?? 0,
          criticalRiskCells: d.critical_risk_cells ?? 0,
        });
        if (d.density_grid)    setDGrid(d.density_grid);
        if (d.risk_score_grid) setRGrid(d.risk_score_grid);
        setHistory(h => [
          { time: new Date().toLocaleTimeString(), status: d.status, persons: d.persons ?? 0, density: d.density_m2 ?? 0 },
          ...h.slice(0, 29)
        ]);

        // Report to realtime server to populate the rest of the admin dashboard
        if (d.status) {
          reportCameraData({
            nodeId: `camera_${camIdx}`,
            nodeName: d.location || `Camera ${camIdx}`,
            density: d.status === 'SAFE' ? 'low' : d.status === 'WARNING' ? 'medium' : 'high',
            personCount: d.persons ?? 0
          });
        }
      } catch (_) {}
    };
    es.onerror = () => setSse(s => ({ ...s, status: 'Stream unavailable' }));
    esRef.current = es;
    return () => es.close();
  }, [tab, streamKey]);

  const rc = getRisk(sse.status);
  const isHighAlert = rc.level >= 2;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h1>🎯 AI Crowd Density Monitor</h1>
          <p>Real-time crowd counting • Zone density (p/m²) • Hybrid YOLO + P2PNet pipeline</p>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center' }}>
          {sse.using_p2pnet && (
            <span style={{ background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.4)', borderRadius:20, padding:'0.3rem 0.75rem', fontSize:'0.75rem', color:'#3b82f6', fontWeight:700 }}>
              ⚡ P2PNet Active
            </span>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.4rem 0.875rem', borderRadius:20,
            background: online === null ? 'var(--bg-secondary)' : online ? 'rgba(39,174,96,0.1)' : 'rgba(231,76,60,0.1)',
            border:`1px solid ${online === null ? 'var(--border)' : online ? 'rgba(39,174,96,0.3)' : 'rgba(231,76,60,0.3)'}`,
            fontSize:'0.8rem', fontWeight:600,
            color: online === null ? 'var(--text-muted)' : online ? '#27ae60' : '#e74c3c' }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'currentColor', display:'inline-block' }} />
            {online === null ? 'Checking…' : online ? 'Server Online' : 'Server Offline'}
          </div>
        </div>
      </div>

      {/* Offline warning */}
      {online === false && (
        <div style={{ background:'rgba(231,76,60,0.08)', border:'1px solid rgba(231,76,60,0.25)', borderRadius:12, padding:'1rem 1.25rem', fontSize:'0.875rem', display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
          <span style={{ fontSize:'1.3rem' }}>⚠️</span>
          <div>
            <div style={{ fontWeight:700, marginBottom:'0.25rem', color:'#e74c3c' }}>Crowd Monitor Server Not Running</div>
            <div style={{ color:'var(--text-secondary)' }}>
              Start with: <code style={{ background:'var(--bg-elevated)', padding:'1px 6px', borderRadius:4, fontSize:'0.8rem' }}>cd stampede/Unified_Crowd_Risk_System &amp;&amp; python app.py</code>
            </div>
          </div>
        </div>
      )}

      {/* DANGER banner */}
      {isHighAlert && sse.alert_msg && (
        <div style={{ background: rc.level >= 3 ? 'rgba(192,57,43,0.18)' : 'rgba(231,76,60,0.12)',
          border:`1px solid ${rc.border}`, borderRadius:10, padding:'0.875rem 1.25rem',
          display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <span style={{ fontSize:'1.5rem' }}>{rc.icon}</span>
          <span style={{ color:rc.color, fontWeight:700, fontSize:'0.9rem' }}>{sse.alert_msg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar">
        {[['live','📡 Live Stream'],['upload','📤 Upload Analyse'],['history','📋 Event Log']].map(([id,lbl]) => (
          <button key={id} className={`tab-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>

      {/* ── LIVE TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'live' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:'1.5rem', alignItems:'start' }}>
          {/* Video stream */}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
              <div className="section-title">📷 Camera Feed</div>
              <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                <select value={camIdx}
                  onChange={e => { setCamIdx(+e.target.value); setStreamKey(k => k+1); }}
                  className="input" style={{ padding:'0.3rem 0.5rem', fontSize:'0.8rem', width:'auto' }}>
                  <option value={0}>Camera 0 (default)</option>
                  <option value={1}>Camera 1</option>
                  <option value={2}>Camera 2</option>
                </select>
                <button className="btn btn-secondary" style={{ fontSize:'0.8rem', padding:'0.35rem 0.75rem' }}
                  onClick={() => setStreamKey(k => k+1)}>🔄 Refresh</button>
              </div>
            </div>
            <div style={{ borderRadius:14, overflow:'hidden', border:`2px solid ${rc.border}`, background:'var(--bg-secondary)', position:'relative', aspectRatio:'16/9', transition:'border-color 0.4s' }}>
              {online === false ? (
                <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.5rem', color:'var(--text-muted)' }}>
                  <span style={{ fontSize:'3rem' }}>📵</span><span>Server offline</span>
                </div>
              ) : (
                <img key={streamKey}
                  src={`${STAMPEDE_URL}/video_feed?camera=${camIdx}&t=${streamKey}`}
                  alt="Live crowd density feed"
                  style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                  onError={e => { e.target.style.display = 'none'; }} />
              )}
              <div style={{ position:'absolute', top:12, left:12, background:'rgba(192,57,43,0.9)', color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:'0.7rem', fontWeight:700, display:'flex', alignItems:'center', gap:'0.4rem' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#fff', animation:'pulse-dot 1s infinite' }} />LIVE
              </div>
              {sse.using_p2pnet && (
                <div style={{ position:'absolute', top:12, right:12, background:'rgba(59,130,246,0.9)', color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:'0.68rem', fontWeight:700 }}>P2PNet</div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {/* Risk status */}
            <div className="card" style={{ borderColor:rc.border, background:rc.bg }}>
              <div className="section-title" style={{ marginBottom:'1rem' }}>⚡ Risk Status</div>
              <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1rem' }}>
                <span style={{ fontSize:'2.5rem' }}>{rc.icon}</span>
                <div>
                  <div style={{ fontWeight:800, fontSize:'1.1rem', color:rc.color, lineHeight:1.2 }}>{sse.status}</div>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:2 }}>Current risk level</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:'1.5rem', marginBottom:'1rem', flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontSize:'0.62rem', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:2 }}>Persons</div>
                  <div style={{ fontSize:'2rem', fontWeight:800, color:rc.color, lineHeight:1 }}>{sse.persons}</div>
                </div>
                <div>
                  <div style={{ fontSize:'0.62rem', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:2 }}>Density</div>
                  <div style={{ fontSize:'1.4rem', fontWeight:800, color:rc.color, lineHeight:1 }}>{Number(sse.density_m2).toFixed(2)}</div>
                  <div style={{ fontSize:'0.6rem', color:'var(--text-muted)' }}>persons/m²</div>
                </div>
              </div>
              <RiskBar score={sse.risk_score} />
              <div style={{ marginTop:'0.75rem', display:'flex', gap:'1rem', fontSize:'0.75rem', color:'var(--text-secondary)' }}>
                <span>High zones: <strong style={{ color:'#e74c3c' }}>{sse.highRiskCells}</strong></span>
                <span>Danger zones: <strong style={{ color:'#c0392b' }}>{sse.criticalRiskCells}</strong></span>
              </div>
            </div>

            {/* Density heatmap */}
            <div className="card">
              <div className="section-title" style={{ marginBottom:'0.875rem' }}>📊 Zone Density Map (p/m²)</div>
              <DensityGrid grid={densityGrid} />
            </div>

            {/* Risk patch map */}
            <div className="card">
              <div className="section-title" style={{ marginBottom:'0.875rem' }}>🟥 Risk Score Patches</div>
              <RiskScoreGrid grid={riskGrid} />
            </div>

            {/* Thresholds info */}
            <div className="card">
              <div className="section-title" style={{ marginBottom:'0.75rem' }}>⚙️ Density Thresholds (Fruin LOS)</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem', fontSize:'0.78rem', color:'var(--text-secondary)' }}>
                {[
                  ['🟢 Safe',      '< 1.0 p/m²',  '#27ae60'],
                  ['⚠️ Warning',   '1.0–2.0 p/m²','#f39c12'],
                  ['🔶 High Risk', '2.0–4.0 p/m²','#e74c3c'],
                  ['🚨 Danger',    '≥ 4.0 p/m²',  '#c0392b'],
                ].map(([lbl, val, col]) => (
                  <div key={lbl} style={{ display:'flex', justifyContent:'space-between' }}>
                    <span>{lbl}</span><span style={{ color:col, fontWeight:600 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── UPLOAD TAB ─────────────────────────────────────────────────────── */}
      {tab === 'upload' && (
        <div style={{ maxWidth:640 }}>
          <UploadTab />
        </div>
      )}

      {/* ── HISTORY TAB ───────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="card">
          <div className="section-title" style={{ marginBottom:'1rem' }}>📋 Live Event Log</div>
          {history.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
              <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>📡</div>
              Switch to Live Stream tab to start collecting events
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
              {history.map((h, i) => {
                const cfg = getRisk(h.status);
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'0.5rem 0.75rem', borderRadius:8,
                    background: i === 0 ? cfg.bg : 'var(--bg-secondary)',
                    border:`1px solid ${i === 0 ? cfg.border : 'var(--border)'}`, fontSize:'0.82rem' }}>
                    <span style={{ color:'var(--text-muted)', fontFamily:'monospace', fontSize:'0.72rem', flexShrink:0 }}>{h.time}</span>
                    <span style={{ flex:1, color:cfg.color, fontWeight: i === 0 ? 700 : 400 }}>{cfg.icon} {h.status}</span>
                    <span style={{ color:'var(--text-secondary)' }}>{h.persons} persons</span>
                    <span style={{ color:cfg.color, fontWeight:600 }}>{Number(h.density).toFixed(2)} p/m²</span>
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
