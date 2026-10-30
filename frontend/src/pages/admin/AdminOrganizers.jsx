import { useEffect, useState } from "react";
import api from "../../services/api";

const EMPTY_FORM = { email: "", username: "", organization_name: "", password: "" };

const formGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0 16px" };
const sectionTitle = { fontSize: "16px", fontWeight: 700, color: "var(--text)", marginBottom: "12px" };

function AdminOrganizers() {
    const [lists, setLists] = useState({ pending: [], approved: [], suspended: [], rejected: [] });
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(null);
    const [message, setMessage] = useState(null);   // { type: "success" | "error", text }
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [creating, setCreating] = useState(false);

    const load = async () => {
        try {
            const keys = ["pending", "approved", "suspended", "rejected"];
            const res = await Promise.all(keys.map((k) => api.get(`admin/organizers/${k}/`)));
            setLists(Object.fromEntries(keys.map((k, i) => [k, res[i].data])));
        } catch {
            setMessage({ type: "error", text: "Failed to load organizers." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    // approve / reject / suspend. Reject and suspend ask for an optional reason.
    const act = async (user, action) => {
        let reason = "";
        if (action !== "approve") {
            const answer = window.prompt(
                `${action === "reject" ? "Reject" : "Suspend"} ${user.username}? Optional reason (they will see it):`,
                "",
            );
            if (answer === null) return;   // cancelled
            reason = answer;
        }
        setActing(user.id);
        setMessage(null);
        try {
            const res = await api.patch(`admin/organizers/${user.id}/${action}/`, { reason });
            setMessage({ type: "success", text: res.data.message });
            await load();
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.error || `Failed to ${action} organizer.` });
        } finally {
            setActing(null);
        }
    };

    const createOrganizer = async (e) => {
        e.preventDefault();
        setCreating(true);
        setMessage(null);
        try {
            const res = await api.post("admin/organizers/create/", form);
            setMessage({ type: "success", text: `${res.data.username} can now sign in with the temporary password.` });
            setForm(EMPTY_FORM);
            setShowCreate(false);
            await load();
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.error || "Failed to create organizer." });
        } finally {
            setCreating(false);
        }
    };

    if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;

    const { pending, approved, suspended, rejected } = lists;
    const inactive = [...suspended, ...rejected];
    const onField = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    return (
        <>
            <div className="admin-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div>
                    <h1 className="admin-page-title">🎤 Organizers</h1>
                    <p className="admin-page-subtitle">Review applications and manage organizer accounts</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowCreate((s) => !s)}>
                    {showCreate ? "Close" : "+ Add organizer"}
                </button>
            </div>

            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}>{message.text}</div>
            )}

            {showCreate && (
                <form className="card" onSubmit={createOrganizer} style={{ padding: 20, marginBottom: 28 }}>
                    <h3 style={sectionTitle}>Add an organizer (approved immediately)</h3>
                    <div style={formGrid}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="new-email">Email</label>
                            <input id="new-email" name="email" type="email" className="form-input" required
                                value={form.email} onChange={onField} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="new-username">Name / username</label>
                            <input id="new-username" name="username" className="form-input" required
                                value={form.username} onChange={onField} />
                        </div>
                    </div>
                    <div style={formGrid}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="new-org">Organization (optional)</label>
                            <input id="new-org" name="organization_name" className="form-input"
                                value={form.organization_name} onChange={onField} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="new-password">Temporary password</label>
                            <input id="new-password" name="password" type="text" className="form-input" required minLength={8}
                                autoComplete="off" value={form.password} onChange={onField} />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={creating}>
                        {creating ? "Creating…" : "Create organizer"}
                    </button>
                </form>
            )}

            {/* Pending applications */}
            {pending.length > 0 ? (
                <>
                    <h3 style={sectionTitle}>⏳ Pending Approval ({pending.length})</h3>
                    <div className="pending-list">
                        {pending.map((u) => (
                            <div key={u.id} className="pending-card" style={{ alignItems: "flex-start" }}>
                                <div className="pending-card-avatar">
                                    {u.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="pending-card-info">
                                    <div className="pending-card-name">
                                        {u.organization_name || u.username}
                                        {u.organization_name && <span style={{ fontWeight: 500, color: "var(--text-2)" }}> · {u.username}</span>}
                                    </div>
                                    <div className="pending-card-email">{u.email}{u.phone && <> · 📞 {u.phone}</>}</div>
                                    {u.organizer_about && (
                                        <p style={{ fontSize: 13.5, color: "var(--text)", margin: "8px 0 0", lineHeight: 1.5 }}>
                                            “{u.organizer_about}”
                                        </p>
                                    )}
                                    <div className="pending-card-date">
                                        Applied {new Date(u.date_joined).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="pending-card-actions">
                                    <button className="btn btn-success btn-sm" onClick={() => act(u, "approve")} disabled={acting === u.id}>
                                        {acting === u.id ? "..." : "✓ Approve"}
                                    </button>
                                    <button className="btn btn-danger btn-sm" onClick={() => act(u, "reject")} disabled={acting === u.id}>
                                        ✕ Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="empty-state" style={{ marginBottom: "32px", padding: "32px" }}>
                    <div className="empty-state-icon">✅</div>
                    <div className="empty-state-title">No pending approvals</div>
                </div>
            )}

            {/* Approved organizers */}
            <h3 style={sectionTitle}>✅ Approved Organizers ({approved.length})</h3>
            {approved.length === 0 ? (
                <div className="empty-state" style={{ marginBottom: 32 }}>
                    <div className="empty-state-icon">🎤</div>
                    <div className="empty-state-title">No approved organizers yet</div>
                </div>
            ) : (
                <div className="table-wrap" style={{ marginBottom: 32 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Organizer</th>
                                <th>Email</th>
                                <th>Events</th>
                                <th>Revenue</th>
                                <th>Joined</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {approved.map((u) => (
                                <tr key={u.id}>
                                    <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <div className="user-avatar">{u.username.charAt(0).toUpperCase()}</div>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{u.username}</div>
                                                {u.organization_name && <div style={{ fontSize: 12, color: "var(--text-2)" }}>{u.organization_name}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ color: "var(--text-2)" }}>{u.email}</td>
                                    <td>{u.events_count}</td>
                                    <td style={{ fontWeight: 600 }}>NPR {Number(u.revenue).toLocaleString()}</td>
                                    <td style={{ fontSize: "13px", color: "var(--text-2)" }}>
                                        {new Date(u.date_joined).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }}
                                            onClick={() => act(u, "suspend")} disabled={acting === u.id}>
                                            Suspend
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Suspended and rejected */}
            {inactive.length > 0 && (
                <>
                    <h3 style={sectionTitle}>🚫 Suspended &amp; Rejected ({inactive.length})</h3>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Organizer</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                    <th>Reason</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {inactive.map((u) => (
                                    <tr key={u.id}>
                                        <td style={{ fontWeight: 600 }}>{u.organization_name || u.username}</td>
                                        <td style={{ color: "var(--text-2)" }}>{u.email}</td>
                                        <td>
                                            <span className={`badge ${u.organizer_status === "SUSPENDED" ? "badge-warning" : "badge-danger"}`}>
                                                {u.organizer_status}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 13, color: "var(--text-2)" }}>{u.status_reason || "—"}</td>
                                        <td>
                                            <button className="btn btn-success btn-xs" onClick={() => act(u, "approve")} disabled={acting === u.id}>
                                                Re-approve
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </>
    );
}

export default AdminOrganizers;
