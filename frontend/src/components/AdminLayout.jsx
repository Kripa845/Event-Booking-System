import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import BackButton from "./BackButton";
import api from "../services/api";

function AdminLayout({ children }) {
    const location = useLocation();
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        api.get("admin/organizers/pending/")
            .then((r) => setPendingCount(r.data.length))
            .catch(() => {});
    }, [location.pathname]);

    const isActive = (path) =>
        location.pathname === path ? "sidebar-link active" : "sidebar-link";

    return (
        <div className="admin-shell">
            {/* Sidebar */}
            <aside className="admin-sidebar">
                <div className="sidebar-section-label">Main</div>
                <Link to="/admin/dashboard" className={isActive("/admin/dashboard")}>
                    <span className="sidebar-link-icon">📊</span>
                    Dashboard
                </Link>

                <div className="sidebar-divider" />

                <div className="sidebar-section-label">Manage</div>
                <Link to="/admin/organizers" className={isActive("/admin/organizers")}>
                    <span className="sidebar-link-icon">🎤</span>
                    Organizers
                    {pendingCount > 0 && <span className="sidebar-badge">{pendingCount}</span>}
                </Link>
                <Link to="/admin/customers" className={isActive("/admin/customers")}>
                    <span className="sidebar-link-icon">👥</span>
                    Customers
                </Link>
                <Link to="/admin/events" className={isActive("/admin/events")}>
                    <span className="sidebar-link-icon">🎪</span>
                    Events
                </Link>

                <div className="sidebar-divider" />

                <div className="sidebar-section-label">Account</div>
                <Link to="/admin/profile" className={isActive("/admin/profile")}>
                    <span className="sidebar-link-icon">👤</span>
                    Profile
                </Link>
                <Link to="/admin/settings" className={isActive("/admin/settings")}>
                    <span className="sidebar-link-icon">⚙️</span>
                    Settings
                </Link>
            </aside>

            {/* Main content */}
            <main className="admin-main">
                <BackButton />
                {children}
            </main>
        </div>
    );
}

export default AdminLayout;
