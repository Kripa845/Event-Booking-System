import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BackButton from "../components/BackButton";
import api from "../services/api";
import WeatherCard from "../components/WeatherCard";
import { downloadCsv } from "../utils/download";
import EventCharts from "../components/EventCharts";
import { PromoManager, StaffManager } from "../components/OrganizerTools";

const RISK_BADGE = {
    LOW: "badge-success",
    MEDIUM: "badge-warning",
    HIGH: "badge-danger",
};

function EventAttendees() {
    const { id } = useParams();
    const [stats, setStats] = useState(null);
    const [attendees, setAttendees] = useState([]);
    const [turnout, setTurnout] = useState(null);
    const [entries, setEntries] = useState([]);   // entry log: who came in and when
    const [announcement, setAnnouncement] = useState("");
    const [sending, setSending] = useState(false);
    const [sendNote, setSendNote] = useState(null);   // { ok, text }
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

        api.get(`organizer/events/${id}/attendance/`)
            .then((r) => setEntries(r.data))
            .catch(() => setEntries([]));

        // The forecast is a nice-to-have; don't fail the page if it errors.
        api.get(`organizer/events/${id}/turnout/`)
            .then((t) => setTurnout(t.data))
            .catch(() => setTurnout(null));
    }, [id]);

    const sendAnnouncement = async (e) => {
        e.preventDefault();
        setSending(true);
        setSendNote(null);
        try {
            const res = await api.post(`organizer/events/${id}/announce/`, { message: announcement.trim() });
            setSendNote({ ok: true, text: res.data.message });
            setAnnouncement("");
        } catch (err) {
            setSendNote({ ok: false, text: err.response?.data?.error || "Couldn't send the message." });
        } finally {
            setSending(false);
        }
    };

    const fileBase = (stats?.event || "event").replace(/[^\w-]+/g, "-");
    const exportEntries = () => downloadCsv(`${fileBase}-entry-log.csv`, [
        ["#", (r) => r.position],
        ["Name", (r) => r.attendee_name],
        ["Entry time", (r) => new Date(r.entered_at).toLocaleString()],
        ["Ticket", (r) => r.ticket_number],
        ["Scanned by", (r) => r.scanned_by],
    ], entries.map((r, i) => ({ ...r, position: i + 1 })));
    const exportBookings = () => downloadCsv(`${fileBase}-bookings.csv`, [
        ["Name", (r) => r.username],
        ["Email", (r) => r.email],
        ["Booking", (r) => r.booking_status],
        ["Ticket", (r) => r.ticket_number],
        ["Ticket status", (r) => r.ticket_status],
        ["Checked in at", (r) => (r.checked_in_at ? new Date(r.checked_in_at).toLocaleString() : "")],
        ["Booked at", (r) => (r.booked_at ? new Date(r.booked_at).toLocaleString() : "")],
    ], attendees);

    const forecastByBooking = Object.fromEntries(
        (turnout?.attendees || []).map((a) => [a.booking_id, a])
    );

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
                    <WeatherCard eventId={id} compact />

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
                        <div className="stat-card">
                            <div className="stat-card-label">Rating</div>
                            <div className="stat-card-value">
                                {stats.avg_rating ? `${stats.avg_rating}★` : "—"}
                            </div>
                            <div className="stat-card-sub">
                                {stats.ratings ? `from ${stats.ratings} postcard${stats.ratings === 1 ? "" : "s"}` : "no ratings yet"}
                            </div>
                        </div>
                        <div className="stat-card accent">
                            <div className="stat-card-label">Revenue</div>
                            <div className="stat-card-value">NPR {Number(stats.revenue).toLocaleString()}</div>
                        </div>
                    </div>
                </>
            )}

            {turnout && turnout.confirmed > 0 && (
                <div className="card card-pad" style={{ marginBottom: "32px" }}>
                    <h2 className="section-title">Turnout Forecast</h2>
                    <div className="stats-grid" style={{ marginBottom: "16px" }}>
                        <div className="stat-card green">
                            <div className="stat-card-label">Expected to Attend</div>
                            <div className="stat-card-value">
                                {turnout.expected_attendees} / {turnout.confirmed}
                            </div>
                        </div>
                        <div className="stat-card red">
                            <div className="stat-card-label">Expected No-Shows</div>
                            <div className="stat-card-value">{turnout.expected_no_shows}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-label">Expected Show Rate</div>
                            <div className="stat-card-value">
                                {Math.round(turnout.expected_show_rate * 100)}%
                            </div>
                        </div>
                        <div className="stat-card accent">
                            <div className="stat-card-label">Safe to Overbook</div>
                            <div className="stat-card-value">
                                {turnout.enough_history ? `+${turnout.suggested_overbook}` : "—"}
                            </div>
                        </div>
                    </div>
                    {turnout.enough_history ? (
                        <div className="alert alert-info">
                            Based on {turnout.history_size} past bookings. You could sell about{" "}
                            {turnout.suggested_overbook} extra seats and still be 95% sure
                            attendance stays within capacity.
                        </div>
                    ) : (
                        <div className="alert alert-warning">
                            Only {turnout.history_size} past bookings on the platform so far.
                            The forecast is rough, and overbooking advice unlocks once there is more history.
                        </div>
                    )}
                </div>
            )}

            <EventCharts attendees={attendees} entries={entries} />

            <div className="tool-grid">
                <PromoManager eventId={id} />
                <StaffManager eventId={id} />
            </div>

            <form className="card" onSubmit={sendAnnouncement} style={{ padding: 18, marginBottom: 28 }}>
                <label className="form-label" htmlFor="announce">📣 Message all ticket holders</label>
                <textarea
                    id="announce" className="form-textarea" rows={2} maxLength={400}
                    placeholder="e.g. Doors open at 9:30. Bring a valid ID."
                    value={announcement} onChange={(e) => setAnnouncement(e.target.value)}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !announcement.trim()}>
                        {sending ? "Sending…" : "Send notification"}
                    </button>
                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>{announcement.length}/400</span>
                    {sendNote && (
                        <span style={{ fontSize: 13, color: sendNote.ok ? "var(--success-text)" : "var(--danger)" }}>{sendNote.text}</span>
                    )}
                </div>
            </form>

            <div className="section-header" style={{ margin: "8px 0 12px" }}>
                <h3 className="section-title">
                    Entry log <span className="section-count">{entries.length}</span>
                </h3>
                {entries.length > 0 && <button className="btn btn-outline btn-sm" onClick={exportEntries}>⬇ Export CSV</button>}
            </div>
            {entries.length === 0 ? (
                <div className="empty-state" style={{ marginBottom: 28, padding: 24 }}>
                    <div className="empty-state-title">Nobody has checked in yet</div>
                </div>
            ) : (
                <div className="table-wrap" style={{ marginBottom: 28 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Name</th>
                                <th>Entry time</th>
                                <th>Ticket</th>
                                <th>Scanned by</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((e, i) => (
                                <tr key={e.ticket_number}>
                                    <td>{i + 1}</td>
                                    <td style={{ fontWeight: 600 }}>{e.attendee_name}</td>
                                    <td>{new Date(e.entered_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td>
                                    <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{e.ticket_number}</td>
                                    <td style={{ color: "var(--text-2)" }}>{e.scanned_by || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="section-header" style={{ margin: "8px 0 12px" }}>
                <h3 className="section-title">All bookings</h3>
                {attendees.length > 0 && <button className="btn btn-outline btn-sm" onClick={exportBookings}>⬇ Export CSV</button>}
            </div>
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
                                <th>Show-up Chance</th>
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
                                    <td>
                                        {forecastByBooking[a.booking_id] ? (
                                            <span
                                                className={`badge ${RISK_BADGE[forecastByBooking[a.booking_id].risk]}`}
                                                title={forecastByBooking[a.booking_id].reason}
                                            >
                                                {Math.round(forecastByBooking[a.booking_id].show_probability * 100)}%
                                            </span>
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
