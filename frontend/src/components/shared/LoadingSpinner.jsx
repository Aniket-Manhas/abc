export default function LoadingSpinner({ message = 'Loading…', fullPage = false }) {
  if (fullPage) return (
    <div className="page-loader">
      <div className="spinner" />
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{message}</p>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2rem' }}>
      <div className="spinner" />
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{message}</p>
    </div>
  );
}
