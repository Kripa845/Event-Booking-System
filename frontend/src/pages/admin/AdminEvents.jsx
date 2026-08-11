import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getImageUrl } from "../../services/api";

function AdminEvents() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [error, setError] = useState("");

    const fetchEvents = () => {
        setLoading(true);
        setError("");
        api.get("admin/events/")
            .then((r) => setEvents(r.data))
            .catch((err) => setError(err.response?.data?.error || "Failed to load events."))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchEvents(); }, []);

    if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;

    return (
        <>
            <div className="admin-page-header">
                <h1 className="admin-page-title">🎪 Events</h1>
                <p className="admin-page-subtitle">All events (read-only view)</p>
                <button className="btn btn-outline btn-sm" onClick={fetchEvents}>
                    ↻ Refresh
                </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {events.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🎪</div>
                    <div className="empty-state-title">No events yet</div>
                </div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Event</th>
                                <th>Organizer</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Capacity</th>
                                <th>Sold</th>
                                <th>Revenue</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((e) => (
                                <>
                                    <tr key={e.id}>
                                        <td>{e.id}</td>
                                     <td style={{ fontWeight: 600, maxWidth: "220px" }}>
                                         <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                             {(e.banner || e.image) && (
                                                 <img
                                                     src={getImageUrl(e.banner || e.image)}
                                                     alt=""
                                                     style={{
                                                         width: "40px",
                                                         height: "40px",
                                                         objectFit: "cover",
                                                         borderRadius: "6px",
                                                         flexShrink: 0,
                                                     }}
                                                 />
                                             )}
                                             <Link to={`/events/${e.id}`} style={{ color: "var(--primary)" }}>
                                                 {e.title}
                                             </Link>
                                         </div>
                                     </td>
                                        <td>{e.organizer_name}</td>
                                        <td>{e.date}</td>
                                        <td>
                                            <span className={`badge ${
                                                e.status === "PUBLISHED" ? "badge-success" :
                                                e.status === "DRAFT"     ? "badge-warning" :
                                                e.status === "COMPLETED" ? "badge-muted" :
                                                "badge-danger"
                                            }`}>
                                                {e.status}
                                            </span>
                                        </td>
                                        <td>{e.capacity}</td>
                                        <td>{e.tickets_sold}</td>
                                        <td style={{ fontWeight: 600 }}>
                                            NPR {Number(e.revenue).toLocaleString()}
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                                            >
                                                {expandedId === e.id ? "▲ Hide" : "▼ Details"}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedId === e.id && (
                                        <tr>
                                            <td colSpan="9" style={{ background: "var(--bg)", padding: "20px" }}>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
                                                    <div>
                                                        <strong>Description:</strong>
                                                        <div style={{ color: "var(--text-2)", marginTop: "4px" }}>
                                                            {e.description}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <strong>Organizer Contact:</strong>
                                                        <div style={{ color: "var(--text-2)", marginTop: "4px" }}>
                                                            {e.organizer_email}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <strong>Time:</strong>
                                                        <div style={{ color: "var(--text-2)", marginTop: "4px" }}>
                                                            {e.start_time} – {e.end_time}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <strong>Location:</strong>
                                                        <div style={{ color: "var(--text-2)", marginTop: "4px" }}>
                                                            {e.location}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <strong>Available Seats:</strong>
                                                        <div style={{ color: "var(--text-2)", marginTop: "4px" }}>
                                                            {e.available_seats}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <strong>Checked In:</strong>
                                                        <div style={{ color: "var(--text-2)", marginTop: "4px" }}>
                                                            {e.checked_in}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <strong>Waitlist:</strong>
                                                        <div style={{ color: "var(--text-2)", marginTop: "4px" }}>
                                                            {e.waitlist}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <strong>Created:</strong>
                                                        <div style={{ color: "var(--text-2)", marginTop: "4px" }}>
                                                            {new Date(e.created_at).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}

export default AdminEvents;
