import { useEffect, useState } from "react";
import api from "../../services/api";

function AdminCustomers() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("admin/customers/")
            .then((r) => setCustomers(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;

    return (
        <>
            <div className="admin-page-header">
                <h1 className="admin-page-title">👥 Customers</h1>
                <p className="admin-page-subtitle">All customer accounts</p>
            </div>

            {customers.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">👥</div>
                    <div className="empty-state-title">No customers yet</div>
                </div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Customer</th>
                                <th>Email</th>
                                <th>Confirmed</th>
                                <th>Cancelled</th>
                                <th>Status</th>
                                <th>Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map((c) => (
                                <tr key={c.id}>
                                    <td>{c.id}</td>
                                    <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <div className="user-avatar">
                                                {c.username.charAt(0).toUpperCase()}
                                            </div>
                                            <span style={{ fontWeight: 600 }}>{c.username}</span>
                                        </div>
                                    </td>
                                    <td style={{ color: "var(--text-2)" }}>{c.email}</td>
                                    <td>{c.bookings_confirmed}</td>
                                    <td>{c.bookings_cancelled}</td>
                                    <td>
                                        <span className={`badge ${c.is_active ? "badge-success" : "badge-danger"}`}>
                                            {c.is_active ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: "13px", color: "var(--text-2)" }}>
                                        {new Date(c.date_joined).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}

export default AdminCustomers;
