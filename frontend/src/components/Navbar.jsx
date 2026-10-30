import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import TicketIcon from "./TicketIcon";
import NotificationBell from "./NotificationBell";
import { LanguageToggle, useLang } from "../context/LanguageContext";

function Navbar() {
    const { isAuthenticated, isOrganizer, isAdmin, isCustomer, isDoorStaff, user, logout } = useAuth();
    const { pathname } = useLocation();
    const { t } = useLang();
    const a = (p) => pathname === p ? "nav-link active" : "nav-link";

    // Admin — minimal bar (they use the sidebar)
    if (isAdmin) {
        return (
            <nav className="navbar navbar-night">
                <Link to="/admin/dashboard" className="navbar-logo">
                    <div className="navbar-logo-icon"><TicketIcon /></div>
                    <span>EventHub</span>
                    <span className="nav-role-badge">Admin</span>
                </Link>
                <div className="navbar-links">
                    <span className="nav-user">
                        {user?.username}
                    </span>
                    <button className="btn btn-outline btn-sm" onClick={logout}>Sign out</button>
                </div>
            </nav>
        );
    }

    return (
        <nav className="navbar navbar-night">
            <Link to="/" className="navbar-logo">
                <div className="navbar-logo-icon"><TicketIcon /></div>
                <span>EventHub</span>
            </Link>

            <div className="navbar-links">
                <Link to="/" className={`${a("/")} nav-hide-mobile`}>{t("nav.events")}</Link>

                {isAuthenticated && isCustomer && (
                    <>
                        <Link to="/customer/dashboard" className={a("/customer/dashboard")}>{t("nav.dashboard")}</Link>
                        <Link to="/my-tickets" className={a("/my-tickets")}>{t("nav.myTickets")}</Link>
                        <Link to="/my-sky" className={a("/my-sky")}>{t("nav.mySky")}</Link>
                        {isDoorStaff && <Link to="/check-in" className={a("/check-in")}>{t("nav.checkIn")}</Link>}
                    </>
                )}

                {isOrganizer && (
                    <>
                        <Link to="/organizer/dashboard"     className={a("/organizer/dashboard")}>{t("nav.dashboard")}</Link>
                        <Link to="/organizer/create-event"  className={a("/organizer/create-event")}>{t("nav.create")}</Link>
                        <Link to="/check-in"                className={a("/check-in")}>{t("nav.checkIn")}</Link>
                    </>
                )}

                <div className="nav-divider" />
                <LanguageToggle />

                {isAuthenticated ? (
                    <>
                        <NotificationBell />
                        <span className="nav-user">
                            {user?.username}
                        </span>
                        <button className="btn btn-outline btn-sm" onClick={logout}>{t("nav.signOut")}</button>
                    </>
                ) : (
                    <>
                        <Link to="/login"    className={a("/login")}>{t("nav.login")}</Link>
                        <Link to="/register" className="btn btn-primary btn-sm">{t("nav.signUp")}</Link>
                    </>
                )}
            </div>
        </nav>
    );
}

export default Navbar;
