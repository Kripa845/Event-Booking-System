import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wraps a route that requires authentication.
 * - requireOrganizer={true}: restricts to organizers/admins.
 * - requireAdmin={true}: restricts to admins only.
 */
function PrivateRoute({ children, requireOrganizer = false, requireAdmin = false }) {
    const { isAuthenticated, isOrganizer, isAdmin, profileLoading } = useAuth();
    const location = useLocation();

    if (profileLoading) {
        return (
            <div className="spinner-wrap" style={{ minHeight: "60vh" }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requireAdmin && !isAdmin) {
        return <Navigate to="/" replace />;
    }

    if (requireOrganizer && !isOrganizer) {
        return <Navigate to="/" replace />;
    }

    return children;
}

export default PrivateRoute;
