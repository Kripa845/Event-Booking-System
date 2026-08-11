import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar() {
    const { isAuthenticated, isOrganizer, isAdmin, isCustomer, user, logout } = useAuth();
    const { pathname } = useLocation();
    const a = (p) => pathname === p ? "nav-link active" : "nav-link";

    // Admin — minimal bar (they use the sidebar)
    if (isAdmin) {
        return (
            <nav className="navbar">
                <Link to="/admin/dashboard" className="navbar-logo">
                    <div className="navbar-logo-icon">🎟️</div>
                    <span>EventHub</span>
                    <span className="nav-role-badge">Admin</span>
                </Link>
                <div className="navbar-links">
                    <span className="nav-user">
                        <span className="nav-user-dot" />
                        {user?.username}
                    </span>
                    <button className="btn btn-outline btn-sm" onClick={logout}>Sign out</button>
                </div>
            </nav>
        );
    }

    return (
        <nav className="navbar">
            <Link to="/" className="navbar-logo">
                <div className="navbar-logo-icon">🎟️</div>
                <span>EventHub</span>
            </Link>

            <div className="navbar-links">
                <Link to="/" className={a("/")}>Events</Link>

                {isAuthenticated && isCustomer && (
                    <>
                        <Link to="/customer/dashboard" className={a("/customer/dashboard")}>Dashboard</Link>
                        <Link to="/my-tickets" className={a("/my-tickets")}>My Tickets</Link>
                    </>
                )}

                {isOrganizer && (
                    <>
                        <Link to="/organizer/dashboard"     className={a("/organizer/dashboard")}>Dashboard</Link>
                        <Link to="/organizer/create-event"  className={a("/organizer/create-event")}>+ Create</Link>
                        <Link to="/check-in"                className={a("/check-in")}>Check-In</Link>
                    </>
                )}

                <div className="nav-divider" />

                {isAuthenticated ? (
                    <>
                        <span className="nav-user">
                            <span className="nav-user-dot" />
                            {user?.username}
                        </span>
                        <button className="btn btn-outline btn-sm" onClick={logout}>Sign out</button>
                    </>
                ) : (
                    <>
                        <Link to="/login"    className={a("/login")}>Login</Link>
                        <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
                    </>
                )}
            </div>
        </nav>
    );
}

export default Navbar;
