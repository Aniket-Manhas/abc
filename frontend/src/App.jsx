import { useState } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Sidebar from './components/shared/Sidebar';
import Navbar from './components/shared/Navbar';
import LoadingSpinner from './components/shared/LoadingSpinner';

// Admin pages
import AdminLogin         from './pages/admin/AdminLogin';
import AdminDashboard     from './pages/admin/AdminDashboard';
import CrowdMonitor       from './pages/admin/CrowdMonitor';
import AlertManager       from './pages/admin/AlertManager';
import StationEditor      from './pages/admin/StationEditor';
import Analytics          from './pages/admin/Analytics';
import AdminNotifications from './pages/admin/AdminNotifications';
import StampedeMonitor    from './pages/admin/StampedeMonitor';

// Page title map
const PAGE_TITLES = {
  '/admin/dashboard':       '📊 Overview',
  // '/admin/crowd':           '🔴 Crowd Monitor',
  '/admin/alerts':          '🚨 Alert Manager',
  '/admin/editor':          '🗺️ Station Editor',
  '/admin/analytics':       '📈 Analytics',
  '/admin/notifications':   '🔔 Notifications',
  '/admin/stampede':        '📹 Stampede AI',
};

// ── Route Guard ────────────────────────────────────────────────

function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingSpinner fullPage message="Authenticating…" />;
  if (!user) return <Navigate to="/admin" state={{ from: location }} replace />;
  if (user.role !== 'admin') return <Navigate to="/admin" replace />;
  return children;
}

// ── App Layout ─────────────────────────────────────────────────

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'Sahyatri Admin';

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} isAdmin />
      <div className="main-content">
        <Navbar title={title} onMenuToggle={() => setSidebarOpen(p => !p)} isAdmin />
        <div className="page-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

// ── Root App ───────────────────────────────────────────────────

export default function App() {
  return (
    <Routes>
      {/* Redirect root to admin login */}
      <Route path="/" element={<Navigate to="/admin" replace />} />

      {/* Admin login (public) */}
      <Route path="/admin" element={<AdminLogin />} />

      {/* Protected admin routes */}
      <Route element={<RequireAdmin><AppLayout /></RequireAdmin>}>
        <Route path="/admin/dashboard"     element={<AdminDashboard />} />
        {/* <Route path="/admin/crowd"         element={<CrowdMonitor />} /> */}
        <Route path="/admin/alerts"        element={<AlertManager />} />
        <Route path="/admin/editor"        element={<StationEditor />} />
        <Route path="/admin/analytics"     element={<Analytics />} />
        <Route path="/admin/notifications" element={<AdminNotifications />} />
        <Route path="/admin/stampede"      element={<StampedeMonitor />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
