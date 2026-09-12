import { Navigate, Route, Routes, Link, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { Login } from "./pages/Login";
import { AdminDashboard } from "./pages/AdminDashboard";
import { PMDashboard } from "./pages/PMDashboard";
import { DeveloperDashboard } from "./pages/DeveloperDashboard";
import { ProjectDetail } from "./pages/ProjectDetail";
import { NotificationBell } from "./components/NotificationBell";
import { RoleBadge } from "./components/Badge";
import { BackgroundAnimation } from "./components/BackgroundAnimation";

function RoleHome() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "ADMIN") return <AdminDashboard />;
  if (user.role === "PM") return <PMDashboard />;
  return <DeveloperDashboard />;
}

function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  if (!user) return null;

  const homeLabel = user.role === "ADMIN" ? "Global Overview" : user.role === "PM" ? "My Projects" : "My Tasks";

  return (
    <aside className="sidebar">
      <Link to="/" className="brand">
        <span className="brand-mark" />
        <span className="brand-name">Velozity</span>
      </Link>

      <nav className="sidebar-section">
        <div className="sidebar-label">Workspace</div>
        <Link to="/" className={`sidebar-link ${location.pathname === "/" ? "active" : ""}`}>
          {homeLabel}
        </Link>
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-name">{user.name}</div>
        <RoleBadge role={user.role} />
        <button onClick={logout} style={{ marginTop: 8 }}>
          Log out
        </button>
      </div>
    </aside>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <BackgroundAnimation />
      <div className="app-shell">
        <Sidebar />
        <div className="main">
          <div className="topbar">
            <NotificationBell />
          </div>
          <div className="content">{children}</div>
        </div>
      </div>
    </>
  );
}

export function App() {
  return (
    <SocketProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedLayout>
              <RoleHome />
            </ProtectedLayout>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedLayout>
              <ProjectDetail />
            </ProtectedLayout>
          }
        />
      </Routes>
    </SocketProvider>
  );
}