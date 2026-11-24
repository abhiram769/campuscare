import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import CampusMap from "../components/CampusMap";

const emptyForm = { title: "", description: "", category: "CLEANLINESS", location: "", latitude: "", longitude: "" };
const statusLabels = {
  SUBMITTED: "Submitted", UNDER_REVIEW: "Under review", ASSIGNED: "Assigned",
  ACCEPTED: "Accepted", IN_PROGRESS: "In progress", COMPLETED: "Completed", DUPLICATE: "Duplicate"
};

function StatusPill({ status }) {
  return <span className={`complaint-status status-${String(status || "").toLowerCase()}`}>{statusLabels[status] || status}</span>;
}

function RequesterDashboard({ user }) {
  const [stats, setStats] = useState({ total: 0, open: 0, completed: 0 });
  const [complaints, setComplaints] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsResponse, complaintsResponse] = await Promise.all([
        api.get("/complaints/stats"),
        api.get("/complaints/mine")
      ]);
      setStats(statsResponse.data.stats || { total: 0, open: 0, completed: 0 });
      setComplaints(complaintsResponse.data.complaints || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load your complaints. Please check that the server and database are running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    const previews = imageFiles.map((file) => URL.createObjectURL(file));
    setImagePreviews(previews);
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [imageFiles]);

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Location is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setForm((current) => ({ ...current, latitude: String(coords.latitude), longitude: String(coords.longitude), location: current.location || "Campus location" })),
      () => setError("Could not access your location. Please allow location permission or enter the location manually.")
    );
  };

  const chooseImages = (event) => {
    const chosen = Array.from(event.target.files || []);
    if (chosen.length > 5) { setError("Please select no more than 5 images."); event.target.value = ""; return; }
    if (chosen.some((file) => file.size > 5 * 1024 * 1024)) { setError("Each image must be 5 MB or smaller."); event.target.value = ""; return; }
    if (chosen.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setError("Only JPG, PNG and WEBP images are supported."); event.target.value = ""; return; }
    setError(""); setImageFiles(chosen); setDuplicateMatches([]); setConfirmDuplicate(false);
  };

  const submitComplaint = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      if (imageFiles.length > 0 && !confirmDuplicate) {
        const checkPayload = new FormData();
        if (form.latitude && form.longitude) {
          checkPayload.append("latitude", form.latitude);
          checkPayload.append("longitude", form.longitude);
        }
        imageFiles.forEach((file) => checkPayload.append("images", file));
        const duplicateResponse = await api.post("/complaints/duplicates/check", checkPayload, { headers: { "Content-Type": "multipart/form-data" } });
        const matches = duplicateResponse.data.matches || [];
        if (matches.length > 0) {
          setDuplicateMatches(matches);
          setConfirmDuplicate(true);
          setNotice("We found reports that may show the same issue. Review them before deciding whether to continue.");
          setSubmitting(false);
          return;
        }
      }

      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => { if (value !== "") payload.append(key, value); });
      imageFiles.forEach((file) => payload.append("images", file));
      if (confirmDuplicate && duplicateMatches.length) payload.append("suspectedDuplicateIds", JSON.stringify(duplicateMatches.map((match) => match.complaintId)));
      await api.post("/complaints", payload, { headers: { "Content-Type": "multipart/form-data" } });
      setForm(emptyForm);
      setImageFiles([]);
      setImagePreviews([]);
      setDuplicateMatches([]);
      setConfirmDuplicate(false);
      setNotice("Your complaint has been submitted successfully.");
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit the complaint. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar">
        <Link className="dashboard-brand" to="/"><span className="dashboard-brand-mark">C</span> Campus Care</Link>
        <div className="dashboard-user"><span className="user-avatar">{user?.firstName?.[0] || "U"}</span><span><strong>{user?.firstName} {user?.lastName || ""}</strong><small>{user?.role === "FACULTY" ? "Faculty account" : "Student account"}</small></span></div>
      </header>
      <div className="dashboard-container">
        <section className="dashboard-welcome">
          <div><span className="dashboard-eyebrow">CAMPUS CARE PORTAL</span><h1>Hello, {user?.firstName || "there"} 👋</h1><p>Report campus issues and follow their progress from one place.</p></div>
          <span className="role-tag">{user?.role === "FACULTY" ? "Faculty" : "Student"}</span>
        </section>

        <section className="stat-grid" aria-label="Complaint summary">
          <article className="stat-card"><span className="stat-icon">▤</span><div><small>Total reports</small><strong>{stats.total}</strong></div></article>
          <article className="stat-card"><span className="stat-icon stat-open">◷</span><div><small>Open reports</small><strong>{stats.open}</strong></div></article>
          <article className="stat-card"><span className="stat-icon stat-done">✓</span><div><small>Resolved</small><strong>{stats.completed}</strong></div></article>
        </section>

        <section className="dashboard-panel campus-overview-panel">
          <div className="panel-heading"><div><span className="dashboard-eyebrow">CAMPUS OVERVIEW</span><h2>3D complaint location map</h2><p>Explore the campus and view GPS locations attached to your reports. Zoom, rotate and tilt the map.</p></div></div>
          <CampusMap complaints={complaints} />
          <p className="map-footnote">Only complaints with saved GPS coordinates appear as markers. Building detail depends on available OpenStreetMap data.</p>
        </section>

        <div className="dashboard-content-grid">
          <section className="dashboard-panel">
            <div className="panel-heading"><div><span className="dashboard-eyebrow">NEW REQUEST</span><h2>Report a campus issue</h2><p>Share the details so the campus team can take action.</p></div></div>
            {error && <div className="dashboard-alert dashboard-alert-error" role="alert">{error}</div>}
            {notice && <div className="dashboard-alert dashboard-alert-success" role="status">{notice}</div>}
            <form className="complaint-form" onSubmit={submitComplaint}>
              <label>Issue title<input name="title" value={form.title} onChange={updateField} maxLength="120" placeholder="e.g. Overflowing dustbin near library" required /></label>
              <label>Category<select name="category" value={form.category} onChange={updateField}><option value="CLEANLINESS">Cleanliness</option><option value="GARBAGE">Garbage</option><option value="PLUMBING">Plumbing</option><option value="ELECTRICAL">Electrical</option><option value="MAINTENANCE">Maintenance</option><option value="OTHER">Other</option></select></label>
              <label>Campus location<input name="location" value={form.location} onChange={updateField} placeholder="Building, block or nearby landmark" required /></label>
              <div className="location-row"><span>GPS coordinates are optional.</span><button type="button" className="text-button" onClick={useCurrentLocation}>◎ Use my location</button></div>
              <div className="location-map-heading"><strong>Pin the exact location</strong><span>Click anywhere on the map to select a point.</span></div>
              <CampusMap compact interactive selectedLocation={form.latitude && form.longitude ? { latitude: form.latitude, longitude: form.longitude } : null} onLocationSelect={({ latitude, longitude }) => setForm((current) => ({ ...current, latitude, longitude, location: current.location || "Selected on campus map" }))} />
              <div className="coordinate-grid"><label>Latitude<input name="latitude" value={form.latitude} onChange={updateField} inputMode="decimal" placeholder="Selected from map" /></label><label>Longitude<input name="longitude" value={form.longitude} onChange={updateField} inputMode="decimal" placeholder="Selected from map" /></label></div>
              <label>Description<textarea name="description" value={form.description} onChange={updateField} rows="4" maxLength="3000" placeholder="Describe what happened and where..." required /></label>
              <label className="image-upload-label">Add complaint photos <span>Up to 5 images · JPG, PNG or WEBP · 5 MB each</span>
                <input className="image-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseImages} />
              </label>
              {imagePreviews.length > 0 && <div className="image-preview-grid">{imagePreviews.map((src, index) => <div className="image-preview-item" key={src}><img src={src} alt={imageFiles[index]?.name || "Complaint preview"} /><button type="button" aria-label="Remove image" onClick={() => setImageFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}</div>}
              {duplicateMatches.length > 0 && <div className="duplicate-warning" role="alert">
                <strong>Possible duplicate reports found</strong>
                <p>These recent reports are nearby and contain visually similar photos. Please check them before submitting again.</p>
                {duplicateMatches.map((match) => <div className="duplicate-match" key={match.complaintId}>
                  <span><b>{match.title}</b><small>{match.location} · {match.distanceMeters == null ? "GPS distance not checked" : `${match.distanceMeters} m away`} · {match.similarity}% image similarity</small></span>
                </div>)}
                <button type="button" className="duplicate-cancel" onClick={() => { setDuplicateMatches([]); setConfirmDuplicate(false); setNotice(""); }}>Review my report</button>
              </div>}
              <button className="dashboard-submit" type="submit" disabled={submitting}>{submitting ? "Checking and submitting..." : confirmDuplicate ? "Submit anyway →" : "Submit complaint →"}</button>
            </form>
          </section>

          <section className="dashboard-panel reports-panel">
            <div className="panel-heading reports-heading"><div><span className="dashboard-eyebrow">YOUR ACTIVITY</span><h2>Recent complaints</h2><p>Track the latest updates to your reports.</p></div><button type="button" className="refresh-button" onClick={loadDashboard} disabled={loading}>↻ Refresh</button></div>
            {loading ? <div className="empty-state">Loading your complaints...</div> : complaints.length === 0 ? <div className="empty-state"><span className="empty-icon">▤</span><strong>No complaints yet</strong><p>When you submit a campus issue, it will appear here.</p></div> : <div className="complaint-list">{complaints.map((item) => <article className="complaint-item" key={item._id}><div className="complaint-item-top"><span className="complaint-category">{String(item.category || "").replaceAll("_", " ")}</span><StatusPill status={item.status} /></div><h3>{item.title}</h3><p>{item.location}</p>{Array.isArray(item.images) && item.images.length > 0 && <div className="complaint-image-strip">{item.images.map((src, index) => <a href={src} target="_blank" rel="noreferrer" key={src}><img src={src} alt={"Complaint attachment " + (index + 1)} loading="lazy" /></a>)}</div>}<small>{new Date(item.createdAt).toLocaleString()}</small></article>)}</div>}
          </section>
        </div>
        <footer className="dashboard-footer">Campus Care · A cleaner, safer campus starts with you.</footer>
      </div>
    </main>
  );
}


function AdminDashboard({ user, logout, navigate }) {
  const [complaints, setComplaints] = useState([]);
  const [cleaners, setCleaners] = useState([]);
  const [selectedCleaners, setSelectedCleaners] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [complaintResponse, cleanerResponse] = await Promise.all([
        api.get("/admin/complaints"),
        api.get("/admin/cleaners")
      ]);
      setComplaints(complaintResponse.data.complaints || []);
      setCleaners(cleanerResponse.data.cleaners || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load the admin review queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAdminData(); }, [loadAdminData]);

  const reviewDuplicate = async (complaintId, decision) => {
    setBusyId(complaintId); setError(""); setNotice("");
    try {
      const response = await api.patch(`/admin/complaints/${complaintId}/duplicate-review`, { decision });
      setNotice(response.data.message);
      await loadAdminData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to review this complaint.");
    } finally { setBusyId(""); }
  };

  const assignComplaint = async (complaintId) => {
    const cleanerId = selectedCleaners[complaintId];
    if (!cleanerId) { setError("Select a cleaner before assigning."); return; }
    setBusyId(complaintId); setError(""); setNotice("");
    try {
      const response = await api.patch(`/admin/complaints/${complaintId}/assign`, { cleanerId });
      setNotice(response.data.message);
      await loadAdminData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to assign this complaint.");
    } finally { setBusyId(""); }
  };

  const pending = complaints.filter((item) => item.duplicateReview === "PENDING");
  const assignable = complaints.filter((item) => item.status !== "DUPLICATE" && item.status !== "COMPLETED" && item.duplicateReview !== "PENDING" && item.duplicateReview !== "CONFIRMED");

  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar"><Link className="dashboard-brand" to="/"><span className="dashboard-brand-mark">C</span> Campus Care</Link><div className="dashboard-user"><span><strong>{user?.firstName} {user?.lastName || ""}</strong><small>Administrator</small></span><button className="refresh-button" onClick={() => { logout(); navigate("/login"); }}>Log out</button></div></header>
      <div className="dashboard-container">
        <section className="dashboard-welcome"><div><span className="dashboard-eyebrow">ADMINISTRATION</span><h1>Complaint review centre</h1><p>Review suspected duplicate reports and assign verified complaints to cleaning staff.</p></div><span className="role-tag">ADMIN</span></section>
        {error && <div className="dashboard-alert dashboard-alert-error" role="alert">{error}</div>}
        {notice && <div className="dashboard-alert dashboard-alert-success" role="status">{notice}</div>}
        <section className="stat-grid">
          <article className="stat-card"><span className="stat-icon">!</span><div><small>Pending duplicate review</small><strong>{pending.length}</strong></div></article>
          <article className="stat-card"><span className="stat-icon stat-open">▤</span><div><small>Awaiting assignment</small><strong>{assignable.filter((item) => !item.assignedTo).length}</strong></div></article>
          <article className="stat-card"><span className="stat-icon stat-done">✓</span><div><small>Active cleaners</small><strong>{cleaners.length}</strong></div></article>
        </section>
        <section className="dashboard-panel admin-queue-panel">
          <div className="panel-heading reports-heading"><div><span className="dashboard-eyebrow">REQUIRES YOUR DECISION</span><h2>Suspected duplicate reports</h2><p>Compare the new report with the reports that triggered the image similarity warning.</p></div><button type="button" className="refresh-button" onClick={loadAdminData} disabled={loading}>↻ Refresh</button></div>
          {loading ? <div className="empty-state">Loading admin queue...</div> : pending.length === 0 ? <div className="empty-state"><strong>No pending duplicate reviews</strong><p>New reports flagged by image detection will appear here.</p></div> : <div className="admin-complaint-list">{pending.map((item) => <article className="admin-complaint-card" key={item._id}>
            <div className="complaint-item-top"><span className="complaint-category">{item.category}</span><StatusPill status={item.status} /></div>
            <h3>{item.title}</h3><p>{item.description}</p><small>Reported by {item.reporter?.firstName || "User"} · {item.location} · {new Date(item.createdAt).toLocaleString()}</small>
            <div className="admin-image-grid">{(item.images || []).map((src, index) => <a href={src} target="_blank" rel="noreferrer" key={src}><img src={src} alt={`New report photo ${index + 1}`} /></a>)}</div>
            <h4>Similar existing reports</h4>
            {(item.suspectedDuplicates || []).map((match) => <div className="admin-match-card" key={match._id}><div><strong>{match.title}</strong><small>{match.location} · {match.status} · {new Date(match.createdAt).toLocaleString()}</small></div><div className="admin-image-grid">{(match.images || []).map((src, index) => <a href={src} target="_blank" rel="noreferrer" key={src}><img src={src} alt={`Existing report photo ${index + 1}`} /></a>)}</div></div>)}
            <div className="admin-action-row"><button type="button" className="admin-secondary-action" disabled={busyId === item._id} onClick={() => reviewDuplicate(item._id, "CONFIRMED")}>Confirm duplicate</button><button type="button" className="dashboard-submit admin-approve-action" disabled={busyId === item._id} onClick={() => reviewDuplicate(item._id, "REJECTED")}>Not a duplicate — approve</button></div>
          </article>)}</div>}
        </section>
        <section className="dashboard-panel admin-queue-panel">
          <div className="panel-heading"><div><span className="dashboard-eyebrow">WORK ALLOCATION</span><h2>Assign complaints to cleaners</h2><p>Only reports cleared for assignment are listed here.</p></div></div>
          {assignable.length === 0 ? <div className="empty-state">No complaints are currently ready for assignment.</div> : <div className="admin-assign-list">{assignable.map((item) => <article className="admin-assign-row" key={item._id}><div><strong>{item.title}</strong><small>{item.location} · {item.status} · {item.assignedTo ? `Assigned to ${item.assignedTo.firstName} ${item.assignedTo.lastName || ""}` : "Unassigned"}</small></div><div className="admin-assign-controls"><select value={selectedCleaners[item._id] || item.assignedTo?._id || ""} onChange={(event) => setSelectedCleaners((current) => ({ ...current, [item._id]: event.target.value }))}><option value="">Select cleaner</option>{cleaners.map((cleaner) => <option key={cleaner._id} value={cleaner._id}>{cleaner.firstName} {cleaner.lastName} ({cleaner.username})</option>)}</select><button type="button" className="dashboard-submit" disabled={busyId === item._id || cleaners.length === 0} onClick={() => assignComplaint(item._id)}>{item.assignedTo ? "Reassign" : "Assign"}</button></div></article>)}</div>}
        </section>
      </div>
    </main>
  );
}

function StaffDashboard({ user, logout, navigate }) {
  const isAdmin = user?.role === "ADMIN";
  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar"><Link className="dashboard-brand" to="/"><span className="dashboard-brand-mark">C</span> Campus Care</Link><button className="refresh-button" onClick={() => { logout(); navigate("/login"); }}>Log out</button></header>
      <div className="dashboard-container">
        <section className="dashboard-welcome"><div><span className="dashboard-eyebrow">{isAdmin ? "ADMINISTRATION" : "CLEANING TEAM"}</span><h1>Welcome, {user?.firstName || "team member"} 👋</h1><p>{isAdmin ? "Your administration workspace is ready." : "Your staff workspace is ready."}</p></div><span className="role-tag">{user?.role}</span></section>
        <section className="dashboard-panel staff-coming-soon"><span className="empty-icon">{isAdmin ? "⌘" : "✓"}</span><h2>{isAdmin ? "Admin workspace" : "Cleaner workspace"}</h2><p>{isAdmin ? "Staff management, complaint assignment, campus activity and feedback tools will be added here." : "Your assigned tasks, attendance, duty hours and online status will be added here."}</p><p className="muted-note">This is the initial authenticated workspace. These operational modules are not connected yet.</p></section>
      </div>
    </main>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (user?.role === "STUDENT" || user?.role === "FACULTY") return <RequesterDashboard user={user} />;
  if (user?.role === "ADMIN") return <AdminDashboard user={user} logout={logout} navigate={navigate} />;
  return <StaffDashboard user={user} logout={logout} navigate={navigate} />;
}
