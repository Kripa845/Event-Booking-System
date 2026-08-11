import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import BackButton from "../components/BackButton";

const ROLES = [
    { value: "CUSTOMER",  icon: "👤", label: "Customer",  desc: "Browse & book events" },
    { value: "ORGANIZER", icon: "🎤", label: "Organizer", desc: "Create & manage events" },
];

export default function Register() {
    const navigate  = useNavigate();
    const [form, setForm] = useState({
        email: "", username: "", password: "", password2: "", role: "CUSTOMER",
    });
    const [error,   setError]   = useState("");
    const [loading, setLoading] = useState(false);

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();
        setError(""); setLoading(true);
        try {
            await api.post("auth/register/", form);
            navigate("/login", { state: { registered: true } });
        } catch (err) {
            const d = err.response?.data;
            if (d) {
                const msgs = Object.entries(d).map(([k, v]) =>
                    `${k !== "non_field_errors" ? k + ": " : ""}${Array.isArray(v) ? v[0] : v}`
                );
                setError(msgs[0] || "Registration failed.");
            } else { setError("Registration failed."); }
        } finally { setLoading(false); }
    };

    return (
        <div className="auth-page">
            <BackButton label="← Back" style={{ textAlign: "center", marginBottom: "16px" }} />
            <div className="auth-card">
                <div className="auth-logo-wrap">
                    <div className="auth-logo-icon">✨</div>
                    <div>
                        <h1 className="auth-title">Create account</h1>
                        <p className="auth-subtitle">Join EventHub — it's free</p>
                    </div>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                {/* Role picker — outside form so clicking doesn't submit */}
                <div className="form-group">
                    <label className="form-label">I am a</label>
                    <div className="role-picker">
                        {ROLES.map((r) => (
                            <div
                                key={r.value}
                                className={`role-option${form.role === r.value ? " selected" : ""}`}
                                onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                            >
                                <div className="role-option-icon">{r.icon}</div>
                                <div className="role-option-label">{r.label}</div>
                                <div className="role-option-desc">{r.desc}</div>
                            </div>
                        ))}
                    </div>
                    {form.role === "ORGANIZER" && (
                        <div className="pending-notice">
                            ⏳ Organizer accounts need admin approval before you can log in.
                        </div>
                    )}
                </div>

                <form onSubmit={onSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email address</label>
                        <input name="email" type="email" className="form-input"
                            placeholder="you@example.com"
                            value={form.email} onChange={onChange} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input name="username" className="form-input"
                            placeholder="Choose a username"
                            value={form.username} onChange={onChange} required />
                    </div>
                    <div className="form-grid-2">
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input name="password" type="password" className="form-input"
                                placeholder="Min. 8 characters"
                                value={form.password} onChange={onChange} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirm password</label>
                            <input name="password2" type="password" className="form-input"
                                placeholder="Repeat password"
                                value={form.password2} onChange={onChange} required />
                        </div>
                    </div>
                    <button type="submit" disabled={loading}
                        className="btn btn-primary btn-full btn-lg" style={{ marginTop: 8 }}>
                        {loading ? "Creating account…" : "Create Account"}
                    </button>
                </form>

                <div className="auth-footer">
                    Already have an account? <Link to="/login">Sign in</Link>
                </div>
            </div>
        </div>
    );
}
