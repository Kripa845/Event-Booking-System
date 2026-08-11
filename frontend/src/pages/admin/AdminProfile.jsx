import { useAuth } from "../../context/AuthContext";

function AdminProfile() {
    const { user } = useAuth();

    return (
        <>
            <div className="admin-page-header">
                <h1 className="admin-page-title">👤 Profile</h1>
                <p className="admin-page-subtitle">Your account information</p>
            </div>

            <div className="card" style={{ padding: "28px", maxWidth: "560px" }}>
                <div className="form-group">
                    <label className="form-label">Username</label>
                    <input className="form-input" value={user?.username || ""} disabled />
                </div>
                <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" value={user?.email || ""} disabled />
                </div>
                <div className="form-group">
                    <label className="form-label">Role</label>
                    <span className="badge badge-danger" style={{ display: "inline-flex", fontSize: "13px", padding: "6px 12px" }}>
                        {user?.role}
                    </span>
                </div>
            </div>
        </>
    );
}

export default AdminProfile;
