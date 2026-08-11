import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BackButton from "../components/BackButton";
import api from "../services/api";

function EventAttendees() {
    const { id } = useParams();
    const [stats, setStats] = useState(null);
    const [attendees, setAttendees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        Promise.all([
            api.get(`organizer/events/${id}/stats/`),
            api.get(`organizer/events/${id}/attendees/`),
        ])
            .then(([s, a]) => {
                setStats(s.data);
                setAttendees(a.data);
            })
            .catch(() => setError("Failed to load attendees."))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return (
        <div className="spinner-wrap" style={{ minHeight: "60vh" }}>
            <div className="spinner" />
        </div>
    );

    return (
        <div className="container page">
            <BackButton />

            {error && <div className="alert alert-error">{error}</div>}

            {stats && (
                <>
                    <div className="section-header">
                        <div>
                            <h1 className="page-title">{stats.event}</h1>
                            <p className="page-subtitle">Attendee list and event statistics.</p>
                        </div>
                    </div>

                    <div className="stats-grid" style={{ marginBottom: "32px" }}>
                        <div className="stat-card">
                            <div className="stat-card-label">Capacity</div>
                            <div className="stat-card-value">{stats.capacity}</div>
                        </div>
                        <div className="stat-card accent">
                            <div className="stat-card-label">Tickets Sold</div>
                            <div className="stat-card-value">{stats.tickets_sold}</div>
                        </div>
                        <div className="stat-card green">
                            <div className="stat-card-label">Checked In</div>
                            <div className="stat-card-value">{stats.checked_in}</div>
                        </div>
                        <div className="stat-card red">
                            <div className="stat-card-label">No Show</div>
                            <div className="stat-card-value">{stats.no_show}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-label">Waitlist</div>
                            <div className="stat-card-value">{stats.waitlist}</div>
                        </div>
                        <div className="stat-card accent">
                            <div className="stat-card-label">Revenue</div>
                            <div className="stat-card-value">NPR {Number(stats.revenue).toLocaleString()}</div>
                        </div>
                    </div>
                </>
            )}

            {attendees.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">👥</div>
                    <div className="empty-state-title">No bookings yet</div>
                </div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Booking</th>
                                <th>Ticket</th>
                                <th>Check-In</th>
                                <th>Booked At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendees.map((a) => (
                                <tr key={a.booking_id}>
                                    <td style={{ fontWeight: 600 }}>{a.username}</td>
                                    <td style={{ color: "var(--text-2)" }}>{a.email}</td>
                                    <td>
                                        <span className={`badge ${a.booking_status === "CONFIRMED" ? "badge-success" : "badge-danger"}`}>
                                            {a.booking_status}
                                        </span>
                                    </td>
                                    <td style={{ fontFamily: "monospace", fontSize: "12px" }}>
                                        {a.ticket_number || "—"}
                                    </td>
                                    <td>
                                        {a.ticket_status === "USED" ? (
                                            <span className="badge badge-primary">Checked In</span>
                                        ) : a.booking_status === "CONFIRMED" ? (
                                            <span className="badge badge-warning">Not Yet</span>
                                        ) : "—"}
                                    </td>
                                    <td style={{ color: "var(--text-2)", fontSize: "13px" }}>
                                        {a.booked_at
                                            ? new Date(a.booked_at).toLocaleDateString()
                                            : "—"}
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

export default EventAttendees;
