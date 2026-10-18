import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CloudBank, Constellation } from "./NightSky";

export default function SiteFooter() {
    const { isAuthenticated, isOrganizer, isCustomer } = useAuth();

    return (
        <footer className="lk-footer">
            <CloudBank className="lk-footer-clouds" seed={30} tone="dark" height={280} edges={false} />
            <div className="lk-footer-inner container">
                <div className="lk-footer-col">
                    <div className="lk-footer-head">Explore</div>
                    <Link to="/">Events</Link>
                    {isCustomer && <><Link to="/customer/dashboard">Dashboard</Link><Link to="/my-tickets">My Tickets</Link><Link to="/my-sky">My Sky</Link></>}
                    {isOrganizer && <><Link to="/organizer/dashboard">Dashboard</Link><Link to="/check-in">Check-in</Link></>}
                    {!isAuthenticated && <Link to="/login">Sign in</Link>}
                    {!isAuthenticated && <Link to="/register">Create account</Link>}
                </div>
                <div className="lk-footer-brand">
                    <Constellation points={[[4, 30], [24, 8], [44, 22], [64, 4], [70, 34], [44, 22]]} />
                    <div className="lk-footer-name">EVENTHUB</div>
                </div>
                <div className="lk-footer-col lk-footer-host">
                    <div className="lk-footer-head">Hosting an event?</div>
                    <p>Sell tickets, run check-in and see your turnout forecast.</p>
                    {isOrganizer
                        ? <Link to="/organizer/create-event" className="btn btn-gold btn-sm">Create an event →</Link>
                        : <Link to="/register" className="btn btn-gold btn-sm">Become an organizer →</Link>}
                </div>
            </div>
            <div className="lk-footer-copy">© {new Date().getFullYear()} EventHub · Made in Nepal</div>
        </footer>
    );
}
