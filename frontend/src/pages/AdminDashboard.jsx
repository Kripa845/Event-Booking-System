import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getImageUrl } from "../services/api";

function StatCard({ label, value, sub, icon, className = "" }) {
    return (
        <div className={`stat-card ${className}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                    <div className="stat-card-label">{label}</div>
                    <div className="stat-card-value">{value}</div>
                    {sub && <div className="stat-card-sub">{sub}</div>}
                </div>
                {icon && <div style={{ fontSize: "32px", opacity: 0.3 }}>{icon}</div>}
            </div>
        </div>
    );
}

function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [events, setEvents] = useState([]);
    const [activeTab, setActiveTab] = useState("overview"); // overview | users | events
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        Promise.all([
            api.get("admin/stats/"),
            api.get("admin/users/"),
            api.get("admin/events/"),
        ])
            .then(([statsRes, usersRes, eventsRes]) => {
                setStats(statsRes.data);
                setUsers(usersRes.data);
                setEvents(eventsRes.data);
            })
            .catch(() => setError("Failed to load admin data."))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="spinner-wrap" style={{ minHeight: "60vh" }}>
            <div className="spinner" />
        </div>
    );

    if (error) return (
        <div className="container page">
            <div className="alert alert-error">{error}</div>
        </div>
    );

    return (
        <div className="container page">
            <div className="section-header">
                <div>
                    <h1 className="page-title">🛡️ Admin Dashboard</h1>
                    <p className="page-subtitle">Platform management and analytics</p>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="admin-tabs">
                {[
                    { id: "overview", label: "📊 Overview" },
                    { id: "users",    label: `👥 Users (${stats?.users.total ?? 0})` },
                    { id: "events",   label: `🎪 Events (${stats?.events.total ?? 0})` },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        className={`admin-tab${activeTab === tab.id ? " active" : ""}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === "overview" && stats && (
                <>
                    {/* User Stats */}
                    <div className="stats-section">
                        <div className="admin-section-title">👥 User Statistics</div>
                        <div className="stats-grid">
                            <StatCard label="Total Users"   value={stats.users.total}     icon="👥" className="accent" />
                            <StatCard label="Customers"     value={stats.users.customers}  icon="👤" />
                            <StatCard label="Organizers"    value={stats.users.organizers} icon="🎤" />
                            <StatCard label="Admins"        value={stats.users.admins}     icon="🛡️" />
                        </div>
                    </div>

                    {/* Event Stats */}
                    <div className="stats-section">
                        <div className="admin-section-title">🎪 Event Statistics</div>
                        <div className="stats-grid">
                            <StatCard label="Total Events" value={stats.events.total}     icon="🎪" className="accent" />
                            <StatCard label="Published"    value={stats.events.published} icon="✅" className="green" />
                            <StatCard label="Drafts"       value={stats.events.draft}     icon="📝" />
                            <StatCard label="Completed"    value={stats.events.completed} icon="🏁" />
                        </div>
                    </div>

                    {/* Booking & Revenue Stats */}
                    <div className="stats-section">
                        <div className="admin-section-title">🎟️ Bookings & Revenue</div>
                        <div className="stats-grid">
                            <StatCard
                                label="Total Bookings"
                                value={stats.bookings.total}
                                sub={`${stats.bookings.confirmed} confirmed`}
                                icon="🎟️"
                            />
                            <StatCard label="Tickets Sold"  value={stats.bookings.confirmed}    icon="✅"  className="green" />
                            <StatCard
                                label="Checked In"
                                value={stats.tickets.used}
                                sub={`${stats.tickets.checkin_rate}% rate`}
                                icon="✓"
                                className="accent"
                            />
                            <StatCard
                                label="Total Revenue"
                                value={`NPR ${Number(stats.revenue.total).toLocaleString()}`}
                                icon="💰"
                                className="green"
                            />
                        </div>
                    </div>

                    {/* Misc Stats */}
                    <div className="stats-section">
                        <div className="admin-section-title">📋 Other Metrics</div>
                        <div className="stats-grid">
                            <StatCard label="Cancelled Bookings" value={stats.bookings.cancelled}                          icon="❌" className="red" />
                            <StatCard label="Valid Tickets"      value={stats.tickets.valid}                                icon="🎟️" />
                            <StatCard label="Waitlist Entries"   value={stats.waitlist.total}                               icon="📋" />
                            <StatCard
                                label="No-Shows"
                                value={stats.bookings.confirmed - stats.tickets.used}
                                sub={`${(100 - stats.tickets.checkin_rate).toFixed(1)}% of confirmed`}
                                icon="👻"
                            />
                        </div>
                    </div>
                </>
            )}

            {/* Users Tab */}
            {activeTab === "users" && (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Bookings</th>
                                <th>Events Created</th>
                                <th>Status</th>
                                <th>Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td>{user.id}</td>
                                    <td style={{ fontWeight: 600 }}>{user.username}</td>
                                    <td style={{ color: "var(--text-2)" }}>{user.email}</td>
                                    <td>
                                        <span className={`badge ${
                                            user.role === "ADMIN" ? "badge-danger" :
                                            user.role === "ORGANIZER" ? "badge-primary" :
                                            "badge-muted"
                                        }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td>{user.bookings_count}</td>
                                    <td>{user.events_count}</td>
                                    <td>
                                        <span className={`badge ${user.is_active ? "badge-success" : "badge-danger"}`}>
                                            {user.is_active ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: "13px", color: "var(--text-2)" }}>
                                        {new Date(user.date_joined).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Events Tab */}
            {activeTab === "events" && (
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
                                <th>Checked In</th>
                                <th>Revenue</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event) => (
                                <tr key={event.id}>
                                    <td>{event.id}</td>
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
                                            <Link
                                                to={`/events/${event.id}`}
                                                style={{ color: "var(--primary)" }}
                                            >
                                                {event.title}
                                            </Link>
                                        </div>
                                    </td>
                                    <td>{event.organizer_name}</td>
                                    <td>{event.date}</td>
                                    <td>
                                        <span className={`badge ${
                                            event.status === "PUBLISHED" ? "badge-success" :
                                            event.status === "DRAFT" ? "badge-warning" :
                                            event.status === "COMPLETED" ? "badge-muted" :
                                            "badge-danger"
                                        }`}>
                                            {event.status}
                                        </span>
                                    </td>
                                    <td>{event.capacity}</td>
                                    <td>{event.tickets_sold}</td>
                                    <td>{event.checked_in}</td>
                                    <td style={{ fontWeight: 600 }}>
                                        NPR {Number(event.revenue).toLocaleString()}
                                    </td>
                                    <td style={{ fontSize: "13px", color: "var(--text-2)" }}>
                                        {new Date(event.created_at).toLocaleDateString()}
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

export default AdminDashboard;
