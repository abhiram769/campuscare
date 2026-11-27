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

function RequesterDashboard({ user, logout, navigate }) {
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
        <div className="dashboard-user"><span className="user-avatar">{user?.firstName?.[0] || "U"}</span><span><strong>{user?.firstName} {user?.lastName || ""}</strong><small>{user?.role === "FACULTY" ? "Faculty account" : "Student account"}</small></span><button type="button" className="refresh-button" onClick={() => { logout(); navigate("/login"); }}>Log out</button></div>
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

        {(user?.role === "STUDENT" || user?.role === "FACULTY") && (
          <section className="dashboard-panel recent-complaints-panel">
            <div className="panel-heading reports-heading">
              <div>
                <span className="dashboard-eyebrow">YOUR REPORTS</span>
                <h2>Recent Complaints</h2>
                <p>Track the latest campus issues you have reported.</p>
              </div>
              <button
                type="button"
                className="refresh-button"
                onClick={loadDashboard}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "↻ Refresh"}
              </button>
            </div>

            {loading ? (
              <div className="empty-state">Loading your recent complaints...</div>
            ) : complaints.length === 0 ? (
              <div className="empty-state">
                <strong>No complaints submitted yet</strong>
                <p>Your submitted complaints will appear here.</p>
              </div>
            ) : (
              <div className="recent-complaints-list">
                {[...complaints]
                  .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                  .slice(0, 5)
                  .map((complaint) => (
                    <article className="recent-complaint-card" key={complaint._id}>
                      <div className="complaint-item-top">
                        <span className="complaint-category">
                          {String(complaint.category || "OTHER").replaceAll("_", " ")}
                        </span>
                        <StatusPill status={complaint.status} />
                      </div>
                      <h3>{complaint.title || "Untitled complaint"}</h3>
                      <div className="recent-complaint-meta">
                        <span>⌖ {complaint.location || "Location not provided"}</span>
                        <span>
                          Submitted{" "}
                          {complaint.createdAt
                            ? new Date(complaint.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric"
                              })
                            : "Date unavailable"}
                        </span>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </section>
        )}


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
  const [cleanerForm, setCleanerForm] = useState({ username: "", firstName: "", lastName: "", email: "", password: "", department: "", phone: "" });
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [creatingCleaner, setCreatingCleaner] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

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
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const loadUsers = async () => {
    setUsersLoading(true);
    setError("");
    try {
      const response = await api.get("/admin/users");
      const people = (response.data.users || []).filter((person) =>
        person.role === "STUDENT" || person.role === "FACULTY"
      );
      setUsers(people);
      setSelectedUser((current) => {
        if (!current) return people[0] || null;
        return people.find((person) => String(person.id || person._id) === String(current.id || current._id)) || people[0] || null;
      });
      setUsersLoaded(true);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load student and faculty accounts.");
    } finally {
      setUsersLoading(false);
    }
  };

  const toggleUserManagement = async () => {
    const nextState = !showUserManagement;
    setShowUserManagement(nextState);
    if (nextState && !usersLoaded) await loadUsers();
  };

  const createCleaner = async (event) => {
    event.preventDefault();
    setCreatingCleaner(true); setError(""); setNotice("");
    try {
      const response = await api.post("/admin/users", { ...cleanerForm, role: "CLEANER" });
      setNotice(response.data.message || "Cleaner account created successfully.");
      setCleanerForm({ username: "", firstName: "", lastName: "", email: "", password: "", department: "", phone: "" });
      await loadAdminData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create cleaner account.");
    } finally {
      setCreatingCleaner(false);
    }
  };

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
    if (!assignmentWindowOpen) { setError("Work assignment is closed after 5:00 PM IST."); return; }
    if (!cleanerId) { setError("Select an online cleaner with fewer than 5 active assignments."); return; }
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
  const onlineCleaners = cleaners.filter((cleaner) => cleaner.isOnline);
  const eligibleCleaners = cleaners.filter((cleaner) => cleaner.canAcceptWork);
  const adminClock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).format(currentTime);
  const assignmentWindowOpen = adminClock < "17:00:00";

  const normalizedUserSearch = userSearch.trim().toLowerCase();
  const filteredUsers = users.filter((person) => {
    const fullName = `${person.firstName || ""} ${person.lastName || ""}`.toLowerCase();
    return !normalizedUserSearch ||
      fullName.includes(normalizedUserSearch) ||
      (person.username || "").toLowerCase().includes(normalizedUserSearch) ||
      (person.email || "").toLowerCase().includes(normalizedUserSearch) ||
      (person.department || "").toLowerCase().includes(normalizedUserSearch);
  });
  const selectedUserId = selectedUser?.id || selectedUser?._id;
  const selectedUserComplaints = selectedUser
    ? complaints
        .filter((complaint) => {
          const reporterId = complaint.reporter?._id || complaint.reporter?.id || complaint.reporter;
          return String(reporterId || "") === String(selectedUserId || "");
        })
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    : [];

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
          <article className="stat-card"><span className="stat-icon stat-done">●</span><div><small>Online cleaners</small><strong>{onlineCleaners.length}</strong></div></article>
          <article className="stat-card"><span className="stat-icon">▣</span><div><small>Active cleaner accounts</small><strong>{cleaners.length}</strong></div></article>
        </section>
        <section className="admin-user-management">
          <div className="admin-user-management-heading">
            <div>
              <span className="dashboard-eyebrow">CAMPUS DIRECTORY</span>
              <h2>Student &amp; Faculty Management</h2>
              <p>Find a student or faculty member and open their profile to review all complaints they have submitted.</p>
            </div>
            <button type="button" className="dashboard-submit user-management-toggle" onClick={toggleUserManagement}>
              {showUserManagement ? "Close user management" : "View students & faculty"}
            </button>
          </div>
          {showUserManagement && (
            <div className="user-management-content">
              <div className="user-management-toolbar">
                <div className="user-counts">
                  <span><strong>{users.filter((person) => person.role === "STUDENT").length}</strong> Students</span>
                  <span><strong>{users.filter((person) => person.role === "FACULTY").length}</strong> Faculty</span>
                </div>
                <div className="user-management-actions">
                  <input
                    className="user-search-input"
                    type="search"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Search name, username, email or department..."
                    aria-label="Search students and faculty"
                  />
                  <button type="button" className="refresh-button" onClick={loadUsers} disabled={usersLoading}>
                    {usersLoading ? "Loading..." : "↻ Refresh"}
                  </button>
                </div>
              </div>
              {usersLoading && users.length === 0 ? (
                <div className="empty-state">Loading student and faculty accounts...</div>
              ) : users.length === 0 ? (
                <div className="empty-state"><strong>No student or faculty accounts found</strong><p>Registered student and faculty accounts will appear here.</p></div>
              ) : (
                <div className="user-management-grid">
                  <aside className="user-directory-list" aria-label="Students and faculty">
                    {filteredUsers.length === 0 ? (
                      <div className="user-directory-empty">No matching accounts.</div>
                    ) : filteredUsers.map((person) => {
                      const personId = person.id || person._id;
                      const isSelected = String(personId) === String(selectedUserId);
                      return (
                        <button
                          type="button"
                          key={personId}
                          className={`user-directory-entry${isSelected ? " selected" : ""}`}
                          onClick={() => setSelectedUser(person)}
                        >
                          <span className="user-directory-avatar">{(person.firstName || person.username || "U").charAt(0).toUpperCase()}</span>
                          <span className="user-directory-copy">
                            <strong>{person.firstName} {person.lastName || ""}</strong>
                            <small>@{person.username} · {person.role === "FACULTY" ? "Faculty" : "Student"}</small>
                            <small>{person.email}</small>
                          </span>
                        </button>
                      );
                    })}
                  </aside>
                  <section className="user-profile-panel">
                    {!selectedUser ? (
                      <div className="empty-state">Select a person to view their profile.</div>
                    ) : (
                      <>
                        <div className="user-profile-header">
                          <span className="user-profile-avatar">{(selectedUser.firstName || selectedUser.username || "U").charAt(0).toUpperCase()}</span>
                          <div>
                            <span className="dashboard-eyebrow">{selectedUser.role === "FACULTY" ? "FACULTY PROFILE" : "STUDENT PROFILE"}</span>
                            <h3>{selectedUser.firstName} {selectedUser.lastName || ""}</h3>
                            <p>@{selectedUser.username} · {selectedUser.isActive ? "Active account" : "Disabled account"}</p>
                          </div>
                        </div>
                        <dl className="user-profile-details">
                          <div><dt>Email</dt><dd>{selectedUser.email || "Not provided"}</dd></div>
                          <div><dt>Department</dt><dd>{selectedUser.department || "Not provided"}</dd></div>
                          <div><dt>Phone</dt><dd>{selectedUser.phone || "Not provided"}</dd></div>
                          <div><dt>Registered</dt><dd>{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not available"}</dd></div>
                        </dl>
                        <div className="user-history-heading">
                          <div><span className="dashboard-eyebrow">REPORTING ACTIVITY</span><h4>Complaint history <span>{selectedUserComplaints.length}</span></h4></div>
                        </div>
                        {selectedUserComplaints.length === 0 ? (
                          <div className="empty-state user-history-empty">This user has not submitted any complaints yet.</div>
                        ) : (
                          <div className="user-complaint-history">
                            {selectedUserComplaints.map((complaint) => (
                              <article className="user-history-card" key={complaint._id}>
                                <div className="complaint-item-top">
                                  <span className="complaint-category">{String(complaint.category || "OTHER").replaceAll("_", " ")}</span>
                                  <StatusPill status={complaint.status} />
                                </div>
                                <h5>{complaint.title || "Untitled complaint"}</h5>
                                <p>{complaint.description || "No description provided."}</p>
                                <div className="user-history-meta">
                                  <span>⌖ {complaint.location || "Location not provided"}</span>
                                  <span>Submitted {complaint.createdAt ? new Date(complaint.createdAt).toLocaleString("en-IN") : "Date unavailable"}</span>
                                  {complaint.assignedTo && <span>Assigned to {complaint.assignedTo.firstName} {complaint.assignedTo.lastName || ""}</span>}
                                  {complaint.resolvedAt && <span>Resolved {new Date(complaint.resolvedAt).toLocaleString("en-IN")}</span>}
                                </div>
                                {(complaint.images || []).length > 0 && (
                                  <div className="user-history-images">
                                    {complaint.images.map((src, index) => (
                                      <a href={src} target="_blank" rel="noreferrer" key={src}>
                                        <img src={src} alt={`Complaint attachment ${index + 1}`} />
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </article>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </section>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="dashboard-panel admin-queue-panel">
          <div className="panel-heading"><div><span className="dashboard-eyebrow">STAFF MANAGEMENT</span><h2>Create cleaner account</h2><p>Create login credentials for a cleaning staff member. Share the username and temporary password with them securely.</p></div></div>
          <form className="cleaner-create-form" onSubmit={createCleaner}>
            <label>Username<input required minLength="3" maxLength="30" value={cleanerForm.username} onChange={(event) => setCleanerForm((current) => ({ ...current, username: event.target.value }))} placeholder="e.g. cleaner01" /></label>
            <label>First name<input required value={cleanerForm.firstName} onChange={(event) => setCleanerForm((current) => ({ ...current, firstName: event.target.value }))} placeholder="First name" /></label>
            <label>Last name<input value={cleanerForm.lastName} onChange={(event) => setCleanerForm((current) => ({ ...current, lastName: event.target.value }))} placeholder="Last name (optional)" /></label>
            <label>Email<input required type="email" value={cleanerForm.email} onChange={(event) => setCleanerForm((current) => ({ ...current, email: event.target.value }))} placeholder="cleaner@campus.edu" /></label>
            <label>Temporary password<input required type="password" minLength="8" value={cleanerForm.password} onChange={(event) => setCleanerForm((current) => ({ ...current, password: event.target.value }))} placeholder="At least 8 characters" /></label>
            <label>Department<input value={cleanerForm.department} onChange={(event) => setCleanerForm((current) => ({ ...current, department: event.target.value }))} placeholder="e.g. Facilities" /></label>
            <label>Phone<input value={cleanerForm.phone} onChange={(event) => setCleanerForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Optional contact number" /></label>
            <button type="submit" className="dashboard-submit" disabled={creatingCleaner}>{creatingCleaner ? "Creating account..." : "Create cleaner account"}</button>
          </form>
          <div className="cleaner-directory">
            <strong>Cleaner availability · {onlineCleaners.length} online</strong>
            {cleaners.length === 0 ? <p>No active cleaners yet.</p> : <ul>{cleaners.map((cleaner) => <li key={cleaner._id}>
              {cleaner.firstName} {cleaner.lastName || ""} <span>@{cleaner.username}</span>
              <span>{cleaner.isOnline ? "Online" : cleaner.checkedOut ? "Checked out" : "Not checked in"} · {cleaner.activeAssignments || 0}/5 active tasks</span>
            </li>)}</ul>}
          </div>
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
          {assignable.length === 0 ? <div className="empty-state">No complaints are currently ready for assignment.</div> : <div className="admin-assign-list">{assignable.map((item) => <article className="admin-assign-row" key={item._id}><div><strong>{item.title}</strong><small>{item.location} · {item.status} · {item.assignedTo ? `Assigned to ${item.assignedTo.firstName} ${item.assignedTo.lastName || ""}` : "Unassigned"}</small>{item.completionEvidence?.length > 0 && <div className="admin-image-grid completion-evidence-grid">{item.completionEvidence.map((src, index) => <a href={src} target="_blank" rel="noreferrer" key={src}><img src={src} alt={`Completion evidence ${index + 1}`} /></a>)}</div>}</div><div className="admin-assign-controls">
            <select value={selectedCleaners[item._id] || (eligibleCleaners.some((cleaner) => cleaner._id === item.assignedTo?._id) ? item.assignedTo?._id : "")} onChange={(event) => setSelectedCleaners((current) => ({ ...current, [item._id]: event.target.value }))}>
              <option value="">Select checked-in cleaner</option>
              {eligibleCleaners.map((cleaner) => <option key={cleaner._id} value={cleaner._id}>{cleaner.firstName} {cleaner.lastName || ""} (@{cleaner.username}) · {cleaner.activeAssignments}/5 tasks</option>)}
            </select>
            <button type="button" className="dashboard-submit" disabled={busyId === item._id || !assignmentWindowOpen || eligibleCleaners.length === 0} onClick={() => assignComplaint(item._id)}>{item.assignedTo ? "Reassign" : "Assign"}</button>
            {!assignmentWindowOpen ? <small>Assignment closes at 5:00 PM IST.</small> : eligibleCleaners.length === 0 ? <small>No checked-in cleaner has capacity (maximum 5 active tasks).</small> : <small>Only checked-in cleaners with fewer than 5 active tasks can be assigned.</small>}
          </div></article>)}</div>}
        </section>
        <section className="dashboard-panel admin-queue-panel">
          <div className="panel-heading"><div><span className="dashboard-eyebrow">WORK VERIFICATION</span><h2>Completed tasks and evidence</h2><p>Review photos uploaded by cleaners when they finish their assigned work.</p></div></div>
          {complaints.filter((item) => item.status === "COMPLETED").length === 0 ? <div className="empty-state">No completed tasks yet.</div> : <div className="admin-assign-list">{complaints.filter((item) => item.status === "COMPLETED").map((item) => <article className="admin-assign-row" key={item._id}><div><strong>{item.title}</strong><small>{item.location} · Completed {item.resolvedAt ? new Date(item.resolvedAt).toLocaleString() : ""} · {item.assignedTo ? `By ${item.assignedTo.firstName} ${item.assignedTo.lastName || ""}` : "Cleaner unavailable"}</small>{item.completionEvidence?.length ? <div className="admin-image-grid completion-evidence-grid">{item.completionEvidence.map((src, index) => <a href={src} target="_blank" rel="noreferrer" key={src}><img src={src} alt={`Completion evidence ${index + 1}`} /></a>)}</div> : <small>Evidence not available for this older task.</small>}</div></article>)}</div>}
        </section>
      </div>
    </main>
  );
}


function CleanerDashboard({ user, logout, navigate }) {
  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [isWorkingDay, setIsWorkingDay] = useState(true);
  const [evidenceFiles, setEvidenceFiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [taskResponse, completedResponse, attendanceResponse] = await Promise.all([
        api.get("/staff/tasks"),
        api.get("/staff/tasks/completed"),
        api.get("/staff/attendance/today")
      ]);
      setTasks(taskResponse.data.tasks || []);
      setCompletedTasks(completedResponse.data.tasks || []);
      setAttendance(attendanceResponse.data.attendance || null);
      setIsWorkingDay(attendanceResponse.data.isWorkingDay);
    } catch (err) { setError(err.response?.data?.message || "Unable to load cleaner dashboard."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const indiaClock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).format(currentTime);
  const checkInWindowOpen = indiaClock >= "07:00:00" && indiaClock <= "15:00:00";
  const canCheckIn = isWorkingDay && checkInWindowOpen && !attendance?.checkIn;
  const formatIndiaTime = (value) => value
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true
      }).format(new Date(value))
    : "—";

  const updateStatus = async (task, status) => {
    setBusyId(task._id); setError(""); setNotice("");
    try {
      const response = await api.patch(`/staff/tasks/${task._id}/status`, { status });
      setNotice(response.data.message); await loadTasks();
    } catch (err) { setError(err.response?.data?.message || "Unable to update task."); }
    finally { setBusyId(""); }
  };

  const markAttendance = async (action) => {
    setAttendanceBusy(true); setError(""); setNotice("");
    try {
      const response = await api.post(`/staff/attendance/${action}`);
      setAttendance(response.data.attendance); setNotice(response.data.message);
    } catch (err) { setError(err.response?.data?.message || "Unable to update attendance."); }
    finally { setAttendanceBusy(false); }
  };

  const completeWithEvidence = async (task) => {
    const selected = evidenceFiles[task._id] || [];
    if (!selected.length) { setError("Upload at least one photo showing the completed work."); return; }
    const payload = new FormData();
    selected.forEach((file) => payload.append("evidence", file));
    setBusyId(task._id); setError(""); setNotice("");
    try {
      const response = await api.post(`/staff/tasks/${task._id}/complete`, payload, { headers: { "Content-Type": "multipart/form-data" } });
      setNotice(response.data.message);
      setEvidenceFiles((current) => { const next = { ...current }; delete next[task._id]; return next; });
      await loadTasks();
    } catch (err) { setError(err.response?.data?.message || "Unable to submit completion evidence."); }
    finally { setBusyId(""); }
  };

  const nextStep = { ASSIGNED: ["ACCEPTED", "Accept task"], ACCEPTED: ["IN_PROGRESS", "Start work"] };
  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar"><Link className="dashboard-brand" to="/"><span className="dashboard-brand-mark">C</span> Campus Care</Link><div className="dashboard-user"><span><strong>{user?.firstName} {user?.lastName || ""}</strong><small>Cleaning staff</small></span><button className="refresh-button" onClick={() => { logout(); navigate("/login"); }}>Log out</button></div></header>
      <div className="dashboard-container">
        <section className="dashboard-welcome"><div><span className="dashboard-eyebrow">CLEANING TEAM</span><h1>Your assigned tasks</h1><p>Duty hours: 7:00 AM–3:00 PM · Monday–Saturday · 30-minute late grace period.</p></div><span className="role-tag">CLEANER</span></section>
        {error && <div className="dashboard-alert dashboard-alert-error" role="alert">{error}</div>}
        {notice && <div className="dashboard-alert dashboard-alert-success" role="status">{notice}</div>}
        <section className="dashboard-panel attendance-panel">
          <div className="panel-heading"><div><span className="dashboard-eyebrow">DAILY ATTENDANCE</span><h2>Check in and check out</h2><p>Check-in opens at 7:00 AM IST. Check in by 7:30 AM to be marked PRESENT; check-ins after 7:30 AM are marked LATE.</p></div></div>
          {!isWorkingDay ? <div className="empty-state"><strong>Today is a non-working day</strong><p>Attendance is scheduled Monday through Saturday.</p></div> : <>
            <div className="attendance-summary"><span><strong>Duty</strong> 7:00 AM – 3:00 PM (IST)</span><span><strong>Status</strong> {attendance?.status || "Not checked in"}</span><span><strong>Check-in</strong> {formatIndiaTime(attendance?.checkIn)}</span><span><strong>Check-out</strong> {formatIndiaTime(attendance?.checkOut)}</span></div>
            <div className="admin-action-row"><button type="button" className="dashboard-submit attendance-action" disabled={attendanceBusy || !canCheckIn} onClick={() => markAttendance("check-in")}>Check in</button><button type="button" className="admin-secondary-action" disabled={attendanceBusy || !attendance?.checkIn || Boolean(attendance?.checkOut)} onClick={() => markAttendance("check-out")}>Check out</button></div>
            {!attendance?.checkIn && <p className="muted-note">{!checkInWindowOpen ? (indiaClock < "07:00:00" ? "Check-in becomes available at 7:00 AM IST." : "The check-in window closed at 3:00 PM IST.") : (indiaClock <= "07:30:00" ? "You can check in now and be marked PRESENT." : "You can still check in, but check-ins after 7:30 AM are marked LATE.")}</p>}
          </>}
        </section>
                <section className="dashboard-panel admin-queue-panel"><div className="panel-heading reports-heading"><div><span className="dashboard-eyebrow">MY WORK</span><h2>Active assignments</h2></div><button className="refresh-button" onClick={loadTasks} disabled={loading}>↻ Refresh</button></div>
          {loading ? <div className="empty-state">Loading assigned tasks...</div> : tasks.length === 0 ? <div className="empty-state"><strong>No active tasks assigned</strong><p>New assignments from the administrator will appear here.</p></div> : <div className="admin-assign-list">{tasks.map((task) => <article className="admin-assign-row cleaner-task-row" key={task._id}><div><strong>{task.title}</strong><small>{task.category} · {task.location} · Reported by {task.reporter?.firstName || "Campus user"}</small><p>{task.description}</p><StatusPill status={task.status} />{task.images?.length > 0 && <div className="admin-image-grid">{task.images.map((src, index) => <a href={src} target="_blank" rel="noreferrer" key={src}><img src={src} alt={`Task attachment ${index + 1}`} /></a>)}</div>}
            {task.status === "IN_PROGRESS" && <div className="task-evidence-upload"><label>Upload completion evidence (required) <span>1–5 photos · JPG, PNG or WEBP · 5 MB each</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { const chosen = Array.from(event.target.files || []); if (chosen.length > 5 || chosen.some((file) => file.size > 5 * 1024 * 1024) || chosen.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setError("Choose up to 5 JPG, PNG or WEBP photos, each no larger than 5 MB."); event.target.value = ""; return; } setError(""); setEvidenceFiles((current) => ({ ...current, [task._id]: chosen })); }} /></label>{(evidenceFiles[task._id] || []).length > 0 && <small>{evidenceFiles[task._id].length} evidence photo(s) selected</small>}<button type="button" className="dashboard-submit" disabled={busyId === task._id} onClick={() => completeWithEvidence(task)}>{busyId === task._id ? "Uploading evidence..." : "Upload evidence & complete task"}</button></div>}
          </div>{nextStep[task.status] && <button className="dashboard-submit" disabled={busyId === task._id} onClick={() => updateStatus(task, nextStep[task.status][0])}>{nextStep[task.status][1]}</button>}</article>)}</div>}
        </section>
        <section className="dashboard-panel cleaner-history-panel">
          <div className="panel-heading reports-heading">
            <div><span className="dashboard-eyebrow">WORK HISTORY</span><h2>Tasks you completed</h2><p>Review your finished work and the evidence photos you submitted.</p></div>
            <span className="role-tag">{completedTasks.length} completed</span>
          </div>
          {loading ? <div className="empty-state">Loading completed tasks...</div> : completedTasks.length === 0 ? (
            <div className="empty-state"><strong>No completed tasks yet</strong><p>Tasks you finish with evidence will be saved here for future reference.</p></div>
          ) : <div className="admin-assign-list">{completedTasks.map((task) => (
            <article className="admin-assign-row cleaner-completed-task" key={task._id}>
              <div className="cleaner-completed-task-main">
                <div className="complaint-item-top"><span className="complaint-category">{String(task.category || "").replaceAll("_", " ")}</span><StatusPill status={task.status} /></div>
                <strong>{task.title}</strong>
                <small>{task.location} · Completed {task.resolvedAt ? new Date(task.resolvedAt).toLocaleString() : new Date(task.updatedAt).toLocaleString()}</small>
                <p>{task.description}</p>
                <small>Reported by {task.reporter?.firstName || "Campus user"} {task.reporter?.lastName || ""}</small>
                {task.completionEvidence?.length > 0 ? <div className="admin-image-grid completion-evidence-grid">{task.completionEvidence.map((src, index) => <a href={src} target="_blank" rel="noreferrer" key={src}><img src={src} alt={"Your completion evidence " + (index + 1)} loading="lazy" /></a>)}</div> : <small className="muted-note">No completion photos were saved for this task.</small>}
              </div>
            </article>
          ))}</div>}
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
  if (user?.role === "STUDENT" || user?.role === "FACULTY") return <RequesterDashboard user={user} logout={logout} navigate={navigate} />;
  if (user?.role === "ADMIN") return <AdminDashboard user={user} logout={logout} navigate={navigate} />;
  if (user?.role === "CLEANER") return <CleanerDashboard user={user} logout={logout} navigate={navigate} />;
  return <StaffDashboard user={user} logout={logout} navigate={navigate} />;
}