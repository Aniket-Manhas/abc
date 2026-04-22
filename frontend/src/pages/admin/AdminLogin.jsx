import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLogin() {
  const [email, setEmail] = useState('admin@sahyatri.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role !== 'admin') {
        setError('This account does not have admin privileges.');
        setLoading(false);
        return;
      }
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 1rem',
            background: 'linear-gradient(135deg, var(--accent-purple), #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem'
          }}>👑</div>
          <h1 style={{ fontSize: '1.5rem' }}>Admin Portal</h1>
          <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Sahyatri Station Control</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label className="label" htmlFor="admin-email">Admin Email</label>
            <input id="admin-email" className="input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="label" htmlFor="admin-password">Password</label>
            <input id="admin-password" className="input" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
          </div>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.625rem 0.875rem', fontSize: '0.85rem', color: 'var(--crowd-high)' }}>{error}</div>
          )}
          <button className="btn btn-primary" type="submit" disabled={loading} id="admin-login-btn" style={{ marginTop: '0.5rem' }}>
            {loading ? '⏳ Authenticating…' : '🔐 Sign In as Admin'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Default: <code style={{ color: 'var(--accent-cyan)' }}>admin@sahyatri.com</code> / <code style={{ color: 'var(--accent-cyan)' }}>Admin@123</code>
        </div>
        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <a href="/" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>← Passenger login</a>
        </div>
      </div>
    </div>
  );
}
