import { useEffect, useState } from "react";
import api from "../../services/api";

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

function AdminOverview() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = () => {
        api.get("admin/stats/")
            .then((r) => setStats(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchStats(); }, []);

    if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
    if (!stats) return <div className="alert alert-error">Failed to load stats.</div>;

    return (
        <>
            <div className="admin-page-header">
                <h1 className="admin-page-title">📊 Dashboard</h1>
                <p className="admin-page-subtitle">Platform overview and key metrics</p>
                <button className="btn btn-outline btn-sm" onClick={fetchStats}>
                    ↻ Refresh
                </button>
            </div>

            {/* Users */}
            <div className="admin-stats-group">
                <div className="admin-stats-group-title">👥 Users</div>
                <div className="stats-grid">
                    <StatCard label="Total Users"      value={stats.users.total}      icon="👥" className="accent" />
                    <StatCard label="Customers"        value={stats.users.customers}  icon="👤" />
                    <StatCard label="Organizers"       value={stats.users.organizers} icon="🎤" />
                    <StatCard label="Pending Approval" value={stats.users.pending}    icon="⏳" className="red" />
                </div>
            </div>

            {/* Events */}
            <div className="admin-stats-group">
                <div className="admin-stats-group-title">🎪 Events</div>
                <div className="stats-grid">
                    <StatCard label="Total Events" value={stats.events.total}     icon="🎪" className="accent" />
                    <StatCard label="Published"    value={stats.events.published} icon="✅" className="green" />
                    <StatCard label="Drafts"       value={stats.events.draft}     icon="📝" />
                    <StatCard label="Completed"    value={stats.events.completed} icon="🏁" />
                </div>
            </div>

            {/* Bookings & Revenue */}
            <div className="admin-stats-group">
                <div className="admin-stats-group-title">🎟️ Bookings & Revenue</div>
                <div className="stats-grid">
                    <StatCard
                        label="Total Bookings"
                        value={stats.bookings.total}
                        sub={`${stats.bookings.confirmed} confirmed`}
                        icon="🎟️"
                    />
                    <StatCard label="Tickets Sold" value={stats.bookings.confirmed}   icon="✅" className="green" />
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

            {/* Other */}
            <div className="admin-stats-group">
                <div className="admin-stats-group-title">📋 Other Metrics</div>
                <div className="stats-grid">
                    <StatCard label="Cancelled Bookings" value={stats.bookings.cancelled}                     icon="❌" className="red" />
                    <StatCard label="Valid Tickets"      value={stats.tickets.valid}                           icon="🎟️" />
                    <StatCard label="Waitlist Entries"   value={stats.waitlist.total}                          icon="📋" />
                    <StatCard
                        label="No-Shows"
                        value={stats.bookings.confirmed - stats.tickets.used}
                        sub={`${(100 - stats.tickets.checkin_rate).toFixed(1)}% of confirmed`}
                        icon="👻"
                    />
                </div>
            </div>
        </>
    );
}

export default AdminOverview;
