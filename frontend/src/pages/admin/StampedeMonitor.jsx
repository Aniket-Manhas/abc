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

// Alarm Audio System using Web Audio API
class AlarmPlayer {
  constructor() {
    this.audioCtx = null;
    this.osc = null;
    this.lfo = null;
    this.lfoGain = null;
    this.mainGain = null;
    this.isPlaying = false;
  }

  init() {
    if (this.audioCtx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      this.audioCtx = new AudioContextClass();
    }
  }

  async resume() {
    this.init();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (e) {
        console.error('Failed to resume audio context', e);
      }
    }
  }

  start() {
    this.init();
    if (!this.audioCtx || this.isPlaying) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    try {
      this.osc = this.audioCtx.createOscillator();
      this.lfo = this.audioCtx.createOscillator();
      this.lfoGain = this.audioCtx.createGain();
      this.mainGain = this.audioCtx.createGain();

      this.osc.type = 'sine';
      this.osc.frequency.setValueAtTime(700, this.audioCtx.currentTime);

      this.lfo.type = 'sine';
      this.lfo.frequency.setValueAtTime(2.5, this.audioCtx.currentTime); // 2.5Hz modulation (sweeps)

      this.lfoGain.gain.setValueAtTime(150, this.audioCtx.currentTime); // sweep range: 550Hz to 850Hz

      this.mainGain.gain.setValueAtTime(0.15, this.audioCtx.currentTime); // comfortable volume

      this.lfo.connect(this.lfoGain);
      this.lfoGain.connect(this.osc.frequency);
      this.osc.connect(this.mainGain);
      this.mainGain.connect(this.audioCtx.destination);

      this.osc.start();
      this.lfo.start();
      this.isPlaying = true;
    } catch (e) {
      console.error('Error playing alarm', e);
    }
  }

  stop() {
    if (!this.isPlaying) return;
    try {
      if (this.osc) {
        this.osc.stop();
        this.osc.disconnect();
      }
      if (this.lfo) {
        this.lfo.stop();
        this.lfo.disconnect();
      }
      if (this.lfoGain) {
        this.lfoGain.disconnect();
      }
      if (this.mainGain) {
        this.mainGain.disconnect();
      }
    } catch (e) {
      console.error('Error stopping alarm', e);
    }
    this.osc = null;
    this.lfo = null;
    this.lfoGain = null;
    this.mainGain = null;
    this.isPlaying = false;
  }
}

const alarm = new AlarmPlayer();

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

// Upload / analyse tab — uses VideoFileCamera backend for frame-by-frame analysis
function UploadTab({ soundEnabled, setUploadAlarmActive }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [err, setErr] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [streamKey, setStreamKey] = useState(0);
  const ref = useRef();
  const pollRef = useRef(null);

  const rc = metrics ? getRisk(metrics.risk_level) : null;
  const isHighAlert = rc && rc.level >= 2;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Trigger alarm on high risk
  useEffect(() => {
    const play = isHighAlert && soundEnabled && analysing;
    if (play) {
      alarm.start();
      setUploadAlarmActive?.(true);
    } else {
      alarm.stop();
      setUploadAlarmActive?.(false);
    }
    return () => {
      alarm.stop();
      setUploadAlarmActive?.(false);
    };
  }, [isHighAlert, soundEnabled, analysing, setUploadAlarmActive]);

  const run = async () => {
    if (!file) return;
    setBusy(true); setErr(''); setMetrics(null); setAnalysing(false);

    const fd = new FormData();
    fd.append('video', file);
    try {
      const res = await fetch(`${STAMPEDE_URL}/load_video`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) {
        setErr(data.error);
        setBusy(false);
        return;
      }
      // Video loaded — start streaming + polling metrics
      setAnalysing(true);
      setStreamKey(k => k + 1);

      // Poll /file_metrics every 500ms for real-time frame-by-frame data
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const mRes = await fetch(`${STAMPEDE_URL}/file_metrics`);
          if (mRes.ok) {
            const m = await mRes.json();
            setMetrics(m);
          }
        } catch { /* ignore polling errors */ }
      }, 500);

    } catch {
      setErr('Upload failed — is the crowd monitor server running on port 5002?');
    } finally { setBusy(false); }
  };

  const stopAnalysis = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setAnalysing(false);
  };

  const progress = metrics && metrics.total_frames > 0
    ? Math.min(100, (metrics.frame_no / metrics.total_frames) * 100)
    : 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      {/* File picker */}
      <div onClick={() => ref.current?.click()}
        style={{ border:`2px dashed ${file ? 'var(--accent-blue)' : 'var(--border-bright)'}`, borderRadius:14, padding:'2rem', textAlign:'center', cursor:'pointer', background: file ? 'rgba(59,130,246,0.05)' : 'var(--bg-secondary)', transition:'var(--transition)' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>{file ? '📁' : '📤'}</div>
        <div style={{ fontWeight:600, marginBottom:'0.25rem' }}>{file ? file.name : 'Click to upload video'}</div>
        <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Supports MP4, AVI, MOV</div>
        <input ref={ref} type="file" accept="video/*" style={{ display:'none' }} onChange={e => {
          setFile(e.target.files[0]); setMetrics(null); setAnalysing(false);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }} />
      </div>

      <div style={{ display:'flex', gap:'0.5rem' }}>
        <button className="btn btn-primary" onClick={run} disabled={!file || busy} style={{ flex:1 }}>
          {busy ? '⏳ Uploading…' : '🔬 Analyse Frame-by-Frame'}
        </button>
        {analysing && (
          <button className="btn btn-secondary" onClick={stopAnalysis} style={{ flexShrink:0 }}>
            ⏹ Stop
          </button>
        )}
      </div>

      {err && <div style={{ background:'rgba(231,76,60,0.1)', border:'1px solid rgba(231,76,60,0.3)', borderRadius:10, padding:'0.75rem 1rem', fontSize:'0.85rem', color:'#e74c3c' }}>{err}</div>}

      {/* Live annotated video stream */}
      {analysing && (
        <div>
          <div className="section-title" style={{ marginBottom:'0.5rem' }}>🎬 Frame-by-Frame Analysis</div>
          <div style={{ borderRadius:14, overflow:'hidden', border:`2px solid ${rc ? rc.border : 'var(--border)'}`, background:'var(--bg-secondary)', position:'relative', transition:'border-color 0.4s' }}>
            <img
              key={streamKey}
              src={analysing ? `${STAMPEDE_URL}/file_latest_frame?t=${streamKey}` : ''}
              alt="Video analysis feed"
              style={{ width:'100%', display:'block' }}
            />
            <div style={{ position:'absolute', top:12, left:12, background:'rgba(59,130,246,0.9)', color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:'0.7rem', fontWeight:700, display:'flex', alignItems:'center', gap:'0.4rem' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#fff', animation:'pulse-dot 1s infinite' }} />ANALYSING
            </div>
            {metrics?.using_p2pnet && (
              <div style={{ position:'absolute', top:12, right:12, background:'rgba(59,130,246,0.9)', color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:'0.68rem', fontWeight:700 }}>P2PNet</div>
            )}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {analysing && metrics && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:4 }}>
            <span>Frame {metrics.frame_no || 0} / {metrics.total_frames || '?'}</span>
            <span style={{ fontWeight:600 }}>{progress.toFixed(1)}%</span>
          </div>
          <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${progress}%`, background:'var(--accent-blue, #3b82f6)', borderRadius:3, transition:'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {/* Live metrics panel */}
      {metrics && rc && (
        <div style={{ background:rc.bg, border:`1px solid ${rc.border}`, borderRadius:12, padding:'1.25rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem' }}>
            <span style={{ fontSize:'1.8rem' }}>{rc.icon}</span>
            <div>
              <div style={{ fontWeight:700, fontSize:'1.1rem', color:rc.color }}>{metrics.risk_level}</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{metrics.alert_msg || (analysing ? 'Analysing…' : 'Analysis complete')}</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:'2rem', fontSize:'0.875rem', flexWrap:'wrap' }}>
            <div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.7rem', textTransform:'uppercase', marginBottom:2 }}>Current Persons</div>
              <div style={{ fontWeight:800, color:rc.color, fontSize:'1.5rem' }}>{metrics.person_count}</div>
            </div>
            <div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.7rem', textTransform:'uppercase', marginBottom:2 }}>Peak Count</div>
              <div style={{ fontWeight:800, color:rc.color, fontSize:'1.3rem' }}>{metrics.peak_count}</div>
            </div>
            <div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.7rem', textTransform:'uppercase', marginBottom:2 }}>Density</div>
              <div style={{ fontWeight:700, fontSize:'1rem', color:rc.color }}>{metrics.density_m2} p/m²</div>
            </div>
            <div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.7rem', textTransform:'uppercase', marginBottom:2 }}>Risk Score</div>
              <div style={{ fontWeight:700, fontSize:'1rem', color:rc.color }}>{Number(metrics.risk_score || 0).toFixed(1)}/100</div>
            </div>
            {metrics.using_p2pnet && <div style={{ alignSelf:'center' }}>
              <span style={{ background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.4)', borderRadius:6, padding:'2px 8px', fontSize:'0.7rem', color:'#3b82f6', fontWeight:700 }}>P2PNet</span>
            </div>}
          </div>
          {/* Risk bar */}
          <div style={{ marginTop:'1rem' }}>
            <RiskBar score={metrics.risk_score} />
          </div>
        </div>
      )}
    </div>
  );
}

function checkStampedeOnline() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  return fetch(`${STAMPEDE_URL}/api/status`, { signal: ctrl.signal })
    .then(r => r.ok)
    .catch(() => false)
    .finally(() => clearTimeout(t));
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StampedeMonitor() {
  const [tab, setTab]             = useState('live');
  const [sse, setSse]             = useState({ status: 'SAFE', persons: 0, density_m2: 0, risk_score: 0, highRiskCells: 0, criticalRiskCells: 0, using_p2pnet: false, alert_msg: '' });
  const [soundEnabled, setSoundEnabled]           = useState(true);
  const [uploadAlarmActive, setUploadAlarmActive] = useState(false);

  // Resume AudioContext on any user interaction to bypass autoplay restrictions
  useEffect(() => {
    const resumeAudio = () => {
      alarm.resume();
    };
    window.addEventListener('click', resumeAudio);
    window.addEventListener('keydown', resumeAudio);
    return () => {
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
    };
  }, []);
  const [densityGrid, setDGrid]   = useState(null);
  const [riskGrid, setRGrid]      = useState(null);
  const [history, setHistory]     = useState([]);
  const [online, setOnline]       = useState(null);
  const [cameras, setCameras]     = useState([]);
  const [camIdx, setCamIdx]       = useState(0);
  const [streamKey, setStreamKey] = useState(Date.now());
  const [feedError, setFeedError] = useState(false);
  const esRef = useRef(null);
  const sseRetryRef = useRef(null);
  const camIdxRef = useRef(camIdx);
  const pollIntervalRef = useRef(null);
  const { reportCameraData } = useSocket();

  camIdxRef.current = camIdx;

  const refreshStream = () => {
    setFeedError(false);
    setStreamKey(Date.now());
  };

  // Load camera list + periodic health check
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const ok = await checkStampedeOnline();
      if (cancelled) return;
      setOnline(ok);
      if (ok) {
        try {
          const res = await fetch(`${STAMPEDE_URL}/api/cameras`);
          if (res.ok) {
            const list = await res.json();
            if (!cancelled && Array.isArray(list) && list.length) {
              setCameras(list);
            }
          }
        } catch (_) {}
      }
    };

    poll();
    const id = setInterval(poll, 12000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // SSE — single connection with reconnect (avoids piling connections on refresh)
  useEffect(() => {
    if (tab !== 'live') {
      esRef.current?.close();
      esRef.current = null;
      if (sseRetryRef.current) clearTimeout(sseRetryRef.current);
      return undefined;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      esRef.current?.close();
      const es = new EventSource(`${STAMPEDE_URL}/stream_status`);
      esRef.current = es;

      es.onopen = () => {
        setOnline(true);
        setSse(s => (s.status === 'Stream unavailable' ? { ...s, status: 'SAFE' } : s));
      };

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
            ...h.slice(0, 29),
          ]);

          if (d.status && d.status !== 'Stream error') {
            const idx = camIdxRef.current;
            reportCameraData({
              nodeId: `camera_${idx}`,
              nodeName: d.location || `Camera ${idx}`,
              density: d.status === 'SAFE' ? 'low' : d.status === 'WARNING' ? 'medium' : 'high',
              personCount: d.persons ?? 0,
            });
          }
        } catch (_) {}
      };

      es.onerror = () => {
        es.close();
        if (!cancelled) {
          setSse(s => ({ ...s, status: 'Reconnecting…' }));
          sseRetryRef.current = setTimeout(connect, 2500);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (sseRetryRef.current) clearTimeout(sseRetryRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [tab, reportCameraData]);

  // Polling for images (HF Spaces workaround)
  useEffect(() => {
    if (online !== true) return undefined;
    
    // For live tab, we poll /latest_frame. For upload tab, we poll /file_latest_frame when analysing.
    // The image src already has streamKey, so we just update streamKey rapidly.
    const id = setInterval(() => {
      setStreamKey(Date.now());
    }, 200); // 5 FPS polling
    pollIntervalRef.current = id;
    
    return () => clearInterval(id);
  }, [online, tab]);

  // Restart MJPEG / camera when camera changes
  useEffect(() => {
    if (tab !== 'live' || online !== true) return undefined;
    refreshStream();
    fetch(`${STAMPEDE_URL}/switch/${camIdx}`, { method: 'POST' }).catch(() => {});
    return undefined;
  }, [camIdx, tab, online]);

  const rc = getRisk(sse.status);
  const isHighAlert = rc.level >= 2;

  const isAlarmActive = soundEnabled && (
    tab === 'live' ? (isHighAlert && online) : (tab === 'upload' ? uploadAlarmActive : false)
  );

  useEffect(() => {
    if (tab === 'live' && isHighAlert && soundEnabled && online) {
      alarm.start();
    } else {
      alarm.stop();
    }
    return () => {
      alarm.stop();
    };
  }, [tab, isHighAlert, soundEnabled, online]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <style>{`
        @keyframes pulse-alarm {
          0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.4); }
          100% { box-shadow: 0 0 0 8px rgba(231, 76, 60, 0); }
        }
      `}</style>
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
          <button 
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              alarm.resume();
            }}
            style={{ 
              display:'flex', 
              alignItems:'center', 
              gap:'0.5rem', 
              padding:'0.4rem 0.875rem', 
              borderRadius:20,
              background: isAlarmActive ? 'rgba(231,76,60,0.15)' : (soundEnabled ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)'),
              border: `1px solid ${isAlarmActive ? '#e74c3c' : (soundEnabled ? 'rgba(59,130,246,0.3)' : 'var(--border)')}`,
              fontSize:'0.8rem', 
              fontWeight:600,
              color: isAlarmActive ? '#e74c3c' : (soundEnabled ? '#3b82f6' : 'var(--text-muted)'),
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none',
              animation: isAlarmActive ? 'pulse-alarm 1.2s infinite alternate' : 'none'
            }}
            title={soundEnabled ? 'Mute emergency alarm' : 'Unmute emergency alarm'}
          >
            <span style={{ fontSize: '0.9rem' }}>{soundEnabled ? '🔊' : '🔇'}</span>
            <span>{soundEnabled ? 'Alarm On' : 'Alarm Muted'}</span>
          </button>
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
                  onChange={e => setCamIdx(+e.target.value)}
                  className="input" style={{ padding:'0.3rem 0.5rem', fontSize:'0.8rem', width:'auto', maxWidth:220 }}>
                  {(cameras.length ? cameras : [{ id: 0, location: 'Camera 0' }]).map((cam, i) => (
                    <option key={cam.id ?? i} value={i}>
                      {cam.location || `Camera ${i}`}
                    </option>
                  ))}
                </select>
                <button className="btn btn-secondary" style={{ fontSize:'0.8rem', padding:'0.35rem 0.75rem' }}
                  onClick={refreshStream}>🔄 Refresh</button>
              </div>
            </div>
            <div style={{ borderRadius:14, overflow:'hidden', border:`2px solid ${rc.border}`, background:'var(--bg-secondary)', position:'relative', aspectRatio:'16/9', transition:'border-color 0.4s' }}>
              {online === false ? (
                <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.5rem', color:'var(--text-muted)' }}>
                  <span style={{ fontSize:'3rem' }}>📵</span><span>Server offline</span>
                </div>
              ) : feedError ? (
                <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.75rem', color:'var(--text-muted)', padding:'1rem' }}>
                  <span style={{ fontSize:'2rem' }}>📵</span>
                  <span>Feed unavailable — camera may be offline</span>
                  <button type="button" className="btn btn-secondary" style={{ fontSize:'0.8rem' }} onClick={refreshStream}>🔄 Retry feed</button>
                </div>
              ) : (
                <img
                  key={`${camIdx}`}
                  src={`${STAMPEDE_URL}/latest_frame?camera=${camIdx}&t=${streamKey}`}
                  alt="Live crowd density feed"
                  style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                  onLoad={() => setFeedError(false)}
                  onError={() => setFeedError(true)}
                />
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
        <div style={{ maxWidth:960 }}>
          <UploadTab soundEnabled={soundEnabled} setUploadAlarmActive={setUploadAlarmActive} />
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
