import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { takeAuthNotice } from "../services/api";
import BackButton from "../components/BackButton";
import AuthBrand from "../components/AuthBrand";

const PERKS = [
    { icon: "⚡", title: "Book in seconds", text: "Reserve your seat and get a QR ticket instantly." },
    { icon: "⏳", title: "Never miss out", text: "Join the waitlist and get a seat automatically when one opens." },
    { icon: "✨", title: "Made for you", text: "Recommendations based on the events you love." },
];

export default function Login() {
    const navigate  = useNavigate();
    const location  = useLocation();
    const { login } = useAuth();
    // Set when a protected page sent the user here; otherwise go to their dashboard.
    const from      = location.state?.from?.pathname;

    const [form,     setForm]     = useState({ email: "", password: "" });
    const [error,    setError]    = useState(takeAuthNotice);   // e.g. "account suspended" after a forced logout
    const [loading,  setLoading]  = useState(false);
    const [showPass, setShowPass] = useState(false);

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();
        setError(""); setLoading(true);
        try {
            const data = await login(form.email, form.password);
            const role = data.user?.role;
            if (role === "ADMIN") { navigate("/admin/dashboard", { replace: true }); return; }
            const home = role === "ORGANIZER" ? "/organizer/dashboard" : "/customer/dashboard";
            navigate(from && from !== "/" ? from : home, { replace: true });
        } catch (err) {
            const d = err.response?.data;
            const msg = d?.detail || d?.non_field_errors?.[0] || d?.email?.[0] || "Invalid email or password.";
            setError(msg);
        } finally { setLoading(false); }
    };

    return (
        <div className="auth-split">
            <AuthBrand title="Your next great event is one tap away." perks={PERKS} />

            <section className="auth-form-side">
                <div className="auth-form-wrap">
                    <BackButton />

                    <h1 className="auth-title">Welcome back</h1>
                    <p className="auth-subtitle">Sign in to your EventHub account</p>

                    {location.state?.registered && !error && (
                        location.state.role === "ORGANIZER" ? (
                            <div className="alert alert-info" style={{ marginTop: 20 }}>
                                Organizer account created. An admin needs to approve it before you can
                                sign in. Try again once you've been approved.
                            </div>
                        ) : (
                            <div className="alert alert-success" style={{ marginTop: 20 }}>
                                Account created. Sign in to get started.
                            </div>
                        )
                    )}
                    {error && <div className="alert alert-error" style={{ marginTop: 20 }}>{error}</div>}

                    <form onSubmit={onSubmit} className="auth-form">
                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Email address</label>
                            <input
                                id="email" name="email" type="email" className="form-input"
                                placeholder="you@example.com" autoComplete="email"
                                value={form.email} onChange={onChange} required autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Password</label>
                            <div className="password-field">
                                <input
                                    id="password" name="password"
                                    type={showPass ? "text" : "password"}
                                    className="form-input"
                                    placeholder="Enter your password" autoComplete="current-password"
                                    value={form.password} onChange={onChange} required
                                />
                                <button
                                    type="button" className="password-toggle"
                                    onClick={() => setShowPass((s) => !s)}
                                    aria-label={showPass ? "Hide password" : "Show password"}
                                >
                                    {showPass ? "Hide" : "Show"}
                                </button>
                            </div>
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
            </section>
        </div>
    );
}
