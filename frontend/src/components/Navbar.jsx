import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../index.css";
function Navbar() {
    const {isAuthenticated, logout } = useAuth();

    return (
        <nav>
            <Link to="/">
                <strong>EventHub</strong>
            </Link>

            <div>
                <Link to="/">Events</Link>
                {isAuthenticated ? (
                     <>
                     <Link to="/my-tickets">
    My Tickets
</Link>
                    <button onClick={logout}>
                        Logout
                    </button>
                </>
                ) : (
                     <>
                <Link to="/login">Login</Link>

                <Link to="/register">Register</Link>
                </>
                )}
            </div>
        </nav>
    );
}

export default Navbar;