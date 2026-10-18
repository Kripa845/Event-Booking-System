import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import BackButton from "../components/BackButton";
import AuthBrand from "../components/AuthBrand";

const ROLES = [
    { value: "CUSTOMER",  icon: "👤", label: "Customer",  desc: "Browse & book events" },
    { value: "ORGANIZER", icon: "🎤", label: "Organizer", desc: "Create & manage events" },
];

const PERKS = [
    { icon: "🔍", title: "Discover events", text: "Workshops, concerts, hackathons and more, all in one place." },
    { icon: "🎟️", title: "Tickets in your pocket", text: "Every booking comes with a QR ticket for quick check-in." },
    { icon: "🎤", title: "Host your own", text: "Organizers get a dashboard with attendees, check-ins and turnout forecasts." },
];

export default function Register() {
    const navigate  = useNavigate();
    const [form, setForm] = useState({
        email: "", username: "", password: "", password2: "", role: "CUSTOMER",
    });
    const [error,    setError]    = useState("");
    const [loading,  setLoading]  = useState(false);
    const [showPass, setShowPass] = useState(false);

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
        <div className="auth-split">
            <AuthBrand title="Join Nepal's home for great events." perks={PERKS} />

            <section className="auth-form-side">
                <div className="auth-form-wrap">
                    <BackButton />

                    <h1 className="auth-title">Create account</h1>
                    <p className="auth-subtitle">Join EventHub, it's free</p>

                    {error && <div className="alert alert-error" style={{ marginTop: 20 }}>{error}</div>}

                    <form onSubmit={onSubmit} className="auth-form">
                        <div className="form-group">
                            <span className="form-label">I am a</span>
                            <div className="role-picker" role="radiogroup" aria-label="Account type">
                                {ROLES.map((r) => (
                                    <button
                                        key={r.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={form.role === r.value}
                                        className={`role-option${form.role === r.value ? " selected" : ""}`}
                                        onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                                    >
                                        <span className="role-option-icon">{r.icon}</span>
                                        <span className="role-option-label">{r.label}</span>
                                        <span className="role-option-desc">{r.desc}</span>
                                    </button>
                                ))}
                            </div>
                            {form.role === "ORGANIZER" && (
                                <div className="pending-notice">
                                    ⏳ Organizer accounts need admin approval before you can log in.
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Email address</label>
                            <input id="email" name="email" type="email" className="form-input"
                                placeholder="you@example.com" autoComplete="email"
                                value={form.email} onChange={onChange} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="username">Username</label>
                            <input id="username" name="username" className="form-input"
                                placeholder="Choose a username" autoComplete="username"
                                value={form.username} onChange={onChange} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Password</label>
                            <div className="password-field">
                                <input id="password" name="password"
                                    type={showPass ? "text" : "password"} className="form-input"
                                    placeholder="Min. 8 characters" autoComplete="new-password"
                                    value={form.password} onChange={onChange} required />
                                <button
                                    type="button" className="password-toggle"
                                    onClick={() => setShowPass((s) => !s)}
                                    aria-label={showPass ? "Hide passwords" : "Show passwords"}
                                >
                                    {showPass ? "Hide" : "Show"}
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="password2">Confirm password</label>
                            <input id="password2" name="password2"
                                type={showPass ? "text" : "password"} className="form-input"
                                placeholder="Repeat password" autoComplete="new-password"
                                value={form.password2} onChange={onChange} required />
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
            </section>
        </div>
    );
}
