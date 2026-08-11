import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import BackButton from "../components/BackButton";

export default function Login() {
    const navigate  = useNavigate();
    const location  = useLocation();
    const { login } = useAuth();
    const from      = location.state?.from?.pathname || "/";

    const [form,    setForm]    = useState({ email: "", password: "" });
    const [error,   setError]   = useState("");
    const [loading, setLoading] = useState(false);

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();
        setError(""); setLoading(true);
        try {
            const data = await login(form.email, form.password);
            // redirect admins straight to their dashboard
            if (data.user?.role === "ADMIN")     { navigate("/admin/dashboard"); return; }
            if (data.user?.role === "ORGANIZER")  { navigate("/organizer/dashboard"); return; }
            navigate(from, { replace: true });
        } catch (err) {
            const d = err.response?.data;
            const msg = d?.detail || d?.non_field_errors?.[0] || d?.email?.[0] || "Invalid email or password.";
            setError(msg);
        } finally { setLoading(false); }
    };

    return (
        <div className="auth-page">
            <BackButton label="← Back" style={{ textAlign: "center", marginBottom: "16px" }} />
            <div className="auth-card">
                <div className="auth-logo-wrap">
                    <div className="auth-logo-icon">🎟️</div>
                    <div>
                        <h1 className="auth-title">Welcome back</h1>
                        <p className="auth-subtitle">Sign in to your EventHub account</p>
                    </div>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={onSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email address</label>
                        <input
                            name="email" type="email" className="form-input"
                            placeholder="you@example.com"
                            value={form.email} onChange={onChange} required autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            name="password" type="password" className="form-input"
                            placeholder="Enter your password"
                            value={form.password} onChange={onChange} required
                        />
                    </div>
                    <button
                        type="submit" disabled={loading}
                        className="btn btn-primary btn-full btn-lg"
                        style={{ marginTop: 8 }}
                    >
                        {loading ? "Signing in…" : "Sign In"}
                    </button>
                </form>

                <div className="auth-footer">
                    Don't have an account? <Link to="/register">Create one</Link>
                </div>
            </div>
        </div>
    );
}
