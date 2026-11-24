import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowRight, Bell, Camera, CheckCircle2, ClipboardCheck, Leaf, MapPin, Megaphone, Recycle, Users } from "lucide-react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import "./App.css";

const features = [
  { icon: Megaphone, title: "Report Issues", text: "Report cleanliness and maintenance problems with photos and campus locations." },
  { icon: MapPin, title: "Location Tracking", text: "Identify the exact campus location of reported problems using an interactive map." },
  { icon: ClipboardCheck, title: "Track Progress", text: "Follow complaint progress from submission to successful completion." },
  { icon: Users, title: "Team Coordination", text: "Connect administrators and cleaning staff to resolve issues efficiently." }
];
const steps = [
  { number: "01", icon: Camera, title: "Report", text: "Students and faculty submit complaints with descriptions, photographs and locations." },
  { number: "02", icon: Users, title: "Resolve", text: "Administrators assign tasks to cleaning staff who work towards resolving the issue." },
  { number: "03", icon: CheckCircle2, title: "Complete", text: "Staff upload completion evidence and users can share their feedback." }
];

function LandingPage() {
  const [apiState, setApiState] = useState("checking");
  useEffect(() => {
    let active = true;
    axios.get("/api/health").then(() => active && setApiState("connected")).catch(() => active && setApiState("offline"));
    return () => { active = false; };
  }, []);
  return (
    <div className="site-shell">
      <header className="navbar">
        <Link className="navbar-brand" to="/"><span className="brand-icon"><Leaf size={19} fill="currentColor" /></span>Campus Care</Link>
        <nav className="nav-links">
          <a href="#features">Features</a><a href="#how-it-works">How It Works</a>
          <Link className="btn btn-outline" to="/login">Login</Link>
          <Link className="btn btn-success" to="/register">Get Started</Link>
        </nav>
        <span className="api-indicator" title="API connection status"><span className={apiState === "connected" ? "api-dot connected" : "api-dot"} />{apiState === "checking" ? "Checking system" : apiState === "connected" ? "System online" : "System setup"}</span>
      </header>
      <main>
        <section className="hero-section"><div className="container hero-grid">
          <div className="hero-copy">
            <span className="hero-badge"><Leaf size={15} fill="currentColor" /> Smart Campus Management</span>
            <h1 className="hero-title">A Cleaner Campus <span>Starts With You.</span></h1>
            <p className="hero-description">Campus Care brings students, faculty, administrators and cleaning staff together to create a cleaner, safer and more sustainable campus.</p>
            <div className="hero-actions"><Link to="/login" className="btn btn-success btn-large">Report an Issue <ArrowRight size={17} /></Link><a href="#how-it-works" className="btn btn-outline btn-large">Explore Platform</a></div>
            <div className="hero-trust"><span><CheckCircle2 size={16} fill="currentColor" /> Easy Complaint Reporting</span><span><CheckCircle2 size={16} fill="currentColor" /> Real-Time Updates</span></div>
          </div>
          <div className="hero-visual"><img className="hero-image" src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1100&q=85" alt="Green university campus" /><div className="floating-card"><span className="floating-icon"><Recycle size={23} /></span><span><strong>Small Actions, Big Impact</strong><small>Together for a better campus</small></span></div></div>
        </div></section>
        <section id="features" className="section container"><div className="section-intro"><span className="section-label">OUR FEATURES</span><h2>Everything Your Campus Needs</h2><p>A single platform to report, manage and resolve campus issues.</p></div><div className="feature-grid">
          {features.map(({ icon: Icon, title, text }) => <article className="feature-card" key={title}><span className="feature-icon"><Icon size={23} /></span><h3>{title}</h3><p>{text}</p></article>)}
        </div></section>
        <section id="how-it-works" className="how-section"><div className="container section"><div className="section-intro"><span className="section-label">SIMPLE PROCESS</span><h2>How Campus Care Works</h2><p>Three simple steps towards a cleaner campus.</p></div><div className="steps-grid">
          {steps.map(({ number, icon: Icon, title, text }) => <article className="process-card" key={number}><span className="process-number">{number}</span><Icon className="process-icon" size={38} /><h3>{title}</h3><p>{text}</p></article>)}
        </div></div></section>
        <section className="cta-section"><div className="container cta-content"><h2>Be Part of a Cleaner Campus</h2><p>Your report can make a real difference. Join Campus Care today.</p><Link to="/register" className="btn btn-light btn-large">Get Started <ArrowRight size={17} /></Link></div></section>
      </main>
      <footer className="footer"><div className="container footer-content"><div><strong>Campus Care <Leaf size={15} /></strong><p>Building a cleaner, greener and better campus together.</p></div><span>© {new Date().getFullYear()} Campus Care. All rights reserved.</span></div></footer>
    </div>
  );
}

function RoleDashboard({ role }) {
  return <ProtectedRoute allowedRoles={[role]}><Dashboard /></ProtectedRoute>;
}

function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-loading">Loading Campus Care...</div>;
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to={user.role === "ADMIN" ? "/admin/dashboard" : user.role === "CLEANER" ? "/cleaner/dashboard" : user.role === "FACULTY" ? "/faculty/dashboard" : "/student/dashboard"} replace /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/register/student" element={<Navigate to="/register" replace />} />
      <Route path="/register/faculty" element={<Navigate to="/register" replace />} />
      <Route path="/student/dashboard" element={<RoleDashboard role="STUDENT" />} />
      <Route path="/faculty/dashboard" element={<RoleDashboard role="FACULTY" />} />
      <Route path="/cleaner/dashboard" element={<RoleDashboard role="CLEANER" />} />
      <Route path="/admin/dashboard" element={<RoleDashboard role="ADMIN" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
export default App;
