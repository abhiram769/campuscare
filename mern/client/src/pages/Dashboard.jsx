import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const roleLabels = {
    STUDENT: "Student",
    FACULTY: "Faculty",
    CLEANER: "Cleaner",
    ADMIN: "Administrator",
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar">
        <Link className="dashboard-brand" to="/">
          <span className="dashboard-brand-mark">C</span> Campus Care
        </Link>
        <div className="dashboard-user">
          <span>
            <strong>{user?.firstName || "User"} {user?.lastName || ""}</strong>
            <small>{roleLabels[user?.role] || "Campus Care member"}</small>
          </span>
          <button type="button" className="refresh-button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="dashboard-container">
        <section className="dashboard-welcome">
          <div>
            <span className="dashboard-eyebrow">CAMPUS CARE</span>
            <h1>Welcome, {user?.firstName || "there"}!</h1>
            <p>Your {roleLabels[user?.role] || "member"} account is active.</p>
          </div>
          <span className="role-tag">{roleLabels[user?.role] || user?.role}</span>
        </section>

        <section className="dashboard-panel staff-coming-soon">
          <h2>Dashboard under development</h2>
          <p>
            The existing role-based dashboard UI has been cleared so the team can
            build the new Student, Faculty, Cleaner and Admin dashboards.
          </p>
          <p className="muted-note">
            Authentication and role-based access are still active. Your teammate
            can now implement the dashboard interface for the assigned role.
          </p>
        </section>
      </div>
    </main>
  );
}
