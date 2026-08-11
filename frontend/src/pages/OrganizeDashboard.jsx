import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BackButton from "../components/BackButton";
import api, { getImageUrl } from "../services/api";

function StatCard({ label, value, sub, className = "" }) {
    return (
        <div className={`stat-card ${className}`}>
            <div className="stat-card-label">{label}</div>
            <div className="stat-card-value">{value}</div>
            {sub && <div className="stat-card-sub">{sub}</div>}
        </div>
    );
}

function StatusBadge({ status }) {
    const map = {
        DRAFT:     "badge-warning",
        PUBLISHED: "badge-success",
        SOLD_OUT:  "badge-danger",
        STARTED:   "badge-primary",
        COMPLETED: "badge-muted",
        CANCELLED: "badge-danger",
    };
    return <span className={`badge ${map[status] || "badge-muted"}`}>{status}</span>;
}

function OrganizerDashboard() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        api.get("organizer/events/")
            .then((r) => setEvents(r.data))
            .catch(() => setError("Failed to load dashboard."))
            .finally(() => setLoading(false));
    }, []);

    const totalRevenue = events.reduce(
        (sum, e) => sum + (e.tickets_sold * Number(e.price)), 0
    );
    const totalSold = events.reduce((sum, e) => sum + e.tickets_sold, 0);
    const totalCheckedIn = events.reduce((sum, e) => sum + e.checked_in, 0);
    const totalWaitlist = events.reduce((sum, e) => sum + e.waitlist, 0);

    const publishEvent = async (eventId) => {
        try {
            await api.patch(`events/${eventId}/`, { status: "PUBLISHED" });
            setEvents((prev) =>
                prev.map((e) => (e.id === eventId ? { ...e, status: "PUBLISHED" } : e))
            );
        } catch {
            alert("Failed to publish event.");
        }
    };

    const cancelEvent = async (eventId) => {
        if (!window.confirm("Cancel this event? This cannot be undone.")) return;
        try {
            await api.patch(`events/${eventId}/`, { status: "CANCELLED" });
            setEvents((prev) =>
                prev.map((e) => (e.id === eventId ? { ...e, status: "CANCELLED" } : e))
            );
        } catch {
            alert("Failed to cancel event.");
        }
    };

    const deleteEvent = async (eventId) => {
        if (!window.confirm("Delete this event permanently? This cannot be undone.")) return;
        try {
            await api.delete(`events/${eventId}/`);
            setEvents((prev) => prev.filter((e) => e.id !== eventId));
        } catch (err) {
            alert(err.response?.data?.error || "Failed to delete event.");
        }
    };

    if (loading) return (
        <div className="spinner-wrap" style={{ minHeight: "60vh" }}>
            <div className="spinner" />
        </div>
    );

    return (
        <div className="container page">
            <BackButton />
            <div className="section-header">
                <div>
                    <h1 className="page-title">Organizer Dashboard</h1>
                    <p className="page-subtitle">Manage your events and track performance.</p>
                </div>
                <Link to="/organizer/create-event" className="btn btn-primary">
                    + Create Event
                </Link>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* Summary stats */}
            <div className="stats-grid">
                <StatCard label="Total Events" value={events.length} />
                <StatCard label="Tickets Sold" value={totalSold} className="accent" />
                <StatCard label="Checked In" value={totalCheckedIn} className="green" />
                <StatCard
                    label="Total Revenue"
                    value={`NPR ${totalRevenue.toLocaleString()}`}
                    className="accent"
                />
            </div>

            {/* Events table */}
            {events.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📅</div>
                    <div className="empty-state-title">No events yet</div>
                    <div className="empty-state-text">
                        <Link to="/organizer/create-event" style={{ color: "var(--primary)" }}>
                            Create your first event
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Event</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Capacity</th>
                                <th>Sold</th>
                                <th>Checked In</th>
                                <th>Waitlist</th>
                                <th>Revenue</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event) => (
                                <tr key={event.id}>
                                    <td style={{ fontWeight: 600, maxWidth: "220px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                             {(event.banner || event.image) && (
                                                 <img
                                                     src={getImageUrl(event.banner || event.image)}
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
                                            <span>{event.title}</span>
                                        </div>
                                    </td>
                                    <td>{event.date}</td>
                                    <td><StatusBadge status={event.status} /></td>
                                    <td>{event.capacity}</td>
                                    <td>{event.tickets_sold}</td>
                                    <td>{event.checked_in}</td>
                                    <td>{event.waitlist}</td>
                                    <td>NPR {(event.tickets_sold * Number(event.price)).toLocaleString()}</td>
                                    <td>
                                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                            <Link
                                                to={`/organizer/events/${event.id}/attendees`}
                                                className="btn btn-outline btn-sm"
                                            >
                                                Attendees
                                            </Link>
                                            {event.status === "DRAFT" && (
                                                <button
                                                    className="btn btn-success btn-sm"
                                                    onClick={() => publishEvent(event.id)}
                                                >
                                                    Publish
                                                </button>
                                            )}
                                            {event.status !== "CANCELLED" && event.status !== "COMPLETED" && (
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => cancelEvent(event.id)}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => deleteEvent(event.id)}
                                                style={{ color: "var(--danger)" }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default OrganizerDashboard;
