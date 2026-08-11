import { useEffect, useState } from "react";
import api from "../../services/api";

function AdminOrganizers() {
    const [pending, setPending] = useState([]);
    const [approved, setApproved] = useState([]);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(null);

    const fetch = async () => {
        setLoading(true);
        try {
            const [p, a] = await Promise.all([
                api.get("admin/organizers/pending/"),
                api.get("admin/organizers/approved/"),
            ]);
            setPending(p.data);
            setApproved(a.data);
        } catch {
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetch(); }, []);

    const approve = async (id) => {
        setActing(id);
        try {
            await api.patch(`admin/organizers/${id}/approve/`);
            await fetch();
        } catch {
            alert("Failed to approve organizer.");
        } finally {
            setActing(null);
        }
    };

    const decline = async (id, username) => {
        if (!window.confirm(`Decline and remove ${username}? This cannot be undone.`)) return;
        setActing(id);
        try {
            await api.delete(`admin/organizers/${id}/decline/`);
            await fetch();
        } catch {
            alert("Failed to decline organizer.");
        } finally {
            setActing(null);
        }
    };

    if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;

    return (
        <>
            <div className="admin-page-header">
                <h1 className="admin-page-title">🎤 Organizers</h1>
                <p className="admin-page-subtitle">Manage organizer approvals and accounts</p>
            </div>

            {/* Pending Approvals */}
            {pending.length > 0 && (
                <>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", marginBottom: "12px" }}>
                        ⏳ Pending Approval ({pending.length})
                    </h3>
                    <div className="pending-list">
                        {pending.map((u) => (
                            <div key={u.id} className="pending-card">
                                <div className="pending-card-avatar">
                                    {u.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="pending-card-info">
                                    <div className="pending-card-name">{u.username}</div>
                                    <div className="pending-card-email">{u.email}</div>
                                    <div className="pending-card-date">
                                        Registered {new Date(u.date_joined).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="pending-card-actions">
                                    <button
                                        className="btn btn-success btn-sm"
                                        onClick={() => approve(u.id)}
                                        disabled={acting === u.id}
                                    >
                                        {acting === u.id ? "..." : "✓ Approve"}
                                    </button>
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => decline(u.id, u.username)}
                                        disabled={acting === u.id}
                                    >
                                        ✕ Decline
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {pending.length === 0 && (
                <div className="empty-state" style={{ marginBottom: "32px", padding: "32px" }}>
                    <div className="empty-state-icon">✅</div>
                    <div className="empty-state-title">No pending approvals</div>
                </div>
            )}

            {/* Approved Organizers */}
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", marginBottom: "12px" }}>
                ✅ Approved Organizers ({approved.length})
            </h3>

            {approved.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🎤</div>
                    <div className="empty-state-title">No approved organizers yet</div>
                </div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Organizer</th>
                                <th>Email</th>
                                <th>Events</th>
                                <th>Revenue</th>
                                <th>Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {approved.map((u) => (
                                <tr key={u.id}>
                                    <td>{u.id}</td>
                                    <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <div className="user-avatar">
                                                {u.username.charAt(0).toUpperCase()}
                                            </div>
                                            <span style={{ fontWeight: 600 }}>{u.username}</span>
                                        </div>
                                    </td>
                                    <td style={{ color: "var(--text-2)" }}>{u.email}</td>
                                    <td>{u.events_count}</td>
                                    <td style={{ fontWeight: 600 }}>NPR {Number(u.revenue).toLocaleString()}</td>
                                    <td style={{ fontSize: "13px", color: "var(--text-2)" }}>
                                        {new Date(u.date_joined).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}

export default AdminOrganizers;
