import { useEffect, useState } from "react";
import axios from "axios";
import { Activity, Database, Leaf, Server } from "lucide-react";
import "./App.css";

export default function App() {
  const [health, setHealth] = useState({ loading: true, data: null, error: "" });

  useEffect(() => {
    let active = true;
    axios.get("/api/health")
      .then(({ data }) => {
        if (active) setHealth({ loading: false, data, error: "" });
      })
      .catch((error) => {
        if (active) setHealth({
          loading: false,
          data: null,
          error: error.response?.data?.message || "Cannot reach the API. Start the backend and check its logs."
        });
      });
    return () => { active = false; };
  }, []);

  const connected = health.data?.success === true;

  return (
    <main className="page-shell">
      <nav className="topbar">
        <a className="brand" href="/" aria-label="Campus Care home">
          <span className="brand-mark"><Leaf size={21} /></span>
          <span>Campus<span className="brand-light">Care</span></span>
        </a>
        <span className="phase-label">MERN migration · Phase 1</span>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> CAMPUS CLEANLINESS & MAINTENANCE</span>
          <h1>A cleaner campus<br /><em>starts with us.</em></h1>
          <p>Report campus issues, follow their progress, and help keep shared spaces clean, safe, and welcoming.</p>
          <div className="hero-actions">
            <span className="primary-action">Campus Care is being migrated</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-circle art-circle-one" />
          <div className="art-circle art-circle-two" />
          <div className="art-leaf"><Leaf size={104} strokeWidth={1.1} /></div>
          <div className="art-caption">A better campus,<br />one action at a time.</div>
        </div>
      </section>

      <section className="status-section" aria-live="polite">
        <div className="section-heading">
          <div><span className="eyebrow">DEVELOPER CHECK</span><h2>System status</h2></div>
          <span className={connected ? "status-pill online" : "status-pill"}>
            <span /> {health.loading ? "Checking" : connected ? "All connected" : "Connection needed"}
          </span>
        </div>
        <div className="status-grid">
          <StatusCard icon={<Activity />} title="React frontend" value="Running" detail="Vite development server" ok />
          <StatusCard icon={<Server />} title="Express API" value={health.loading ? "Checking…" : health.data ? "Responding" : "Not connected"} detail={health.error || "GET /api/health"} ok={Boolean(health.data)} />
          <StatusCard icon={<Database />} title="MongoDB" value={health.loading ? "Checking…" : health.data?.database || "Not connected"} detail="Campus Care database" ok={connected} />
        </div>
        {health.error && <p className="error-message">{health.error}</p>}
      </section>

      <footer className="footer"><span>Campus Care</span><span>Building a cleaner, more responsible campus.</span></footer>
    </main>
  );
}

function StatusCard({ icon, title, value, detail, ok }) {
  return (
    <article className="status-card">
      <div className="card-top"><span className="card-icon">{icon}</span><span className={ok ? "check-dot good" : "check-dot"} /></div>
      <h3>{title}</h3>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
