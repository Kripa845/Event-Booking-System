import { useEffect, useState } from "react";
import api from "../services/api";

/** Create and switch off discount codes for one event. */
export function PromoManager({ eventId }) {
    const [promos, setPromos] = useState([]);
    const [form, setForm] = useState({ code: "", percent_off: "", max_uses: "" });
    const [error, setError] = useState("");

    useEffect(() => {
        api.get(`organizer/events/${eventId}/promos/`).then((r) => setPromos(r.data)).catch(() => {});
    }, [eventId]);

    const create = async (e) => {
        e.preventDefault();
        setError("");
        try {
            const res = await api.post(`organizer/events/${eventId}/promos/`, form);
            setPromos([res.data, ...promos]);
            setForm({ code: "", percent_off: "", max_uses: "" });
        } catch (err) {
            setError(err.response?.data?.error || "Couldn't create the code.");
        }
    };

    const toggle = async (promo) => {
        const res = await api.patch(`organizer/promos/${promo.id}/`, { active: !promo.active });
        setPromos(promos.map((p) => (p.id === promo.id ? res.data : p)));
    };

    const onField = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    return (
        <section className="card tool-card">
            <h3 className="section-title">🏷️ Promo codes</h3>
            <form className="tool-form" onSubmit={create}>
                <input name="code" className="form-input" placeholder="CODE e.g. STUDENT20" maxLength={30} required
                    value={form.code} onChange={onField} style={{ textTransform: "uppercase" }} aria-label="Code" />
                <input name="percent_off" type="number" min={1} max={100} className="form-input" placeholder="% off" required
                    value={form.percent_off} onChange={onField} aria-label="Percent off" />
                <input name="max_uses" type="number" min={1} className="form-input" placeholder="Max uses (optional)"
                    value={form.max_uses} onChange={onField} aria-label="Max uses" />
                <button type="submit" className="btn btn-primary btn-sm">Add</button>
            </form>
            {error && <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>}
            {promos.length > 0 && (
                <ul className="tool-list">
                    {promos.map((p) => (
                        <li key={p.id} className={p.active ? "" : "is-off"}>
                            <code>{p.code}</code>
                            <span>{p.percent_off}% off · used {p.uses}{p.max_uses ? ` / ${p.max_uses}` : ""}</span>
                            <button type="button" className="btn btn-ghost btn-xs" onClick={() => toggle(p)}>
                                {p.active ? "Turn off" : "Turn on"}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

/** Let helpers (customer accounts) scan tickets for this event. */
export function StaffManager({ eventId }) {
    const [staff, setStaff] = useState([]);
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        api.get(`organizer/events/${eventId}/staff/`).then((r) => setStaff(r.data)).catch(() => {});
    }, [eventId]);

    const add = async (e) => {
        e.preventDefault();
        setError("");
        try {
            const res = await api.post(`organizer/events/${eventId}/staff/`, { email });
            setStaff([...staff.filter((s) => s.user_id !== res.data.user_id), res.data]);
            setEmail("");
        } catch (err) {
            setError(err.response?.data?.error || "Couldn't add that person.");
        }
    };

    const remove = async (userId) => {
        await api.delete(`organizer/events/${eventId}/staff/${userId}/`);
        setStaff(staff.filter((s) => s.user_id !== userId));
    };

    return (
        <section className="card tool-card">
            <h3 className="section-title">🎫 Door staff</h3>
            <p className="tool-hint">Helpers can scan tickets for this event only. They can't see revenue or attendee details.</p>
            <form className="tool-form" onSubmit={add}>
                <input type="email" className="form-input" placeholder="helper@example.com" required
                    value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Helper email" />
                <button type="submit" className="btn btn-primary btn-sm">Add helper</button>
            </form>
            {error && <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>}
            {staff.length > 0 && (
                <ul className="tool-list">
                    {staff.map((s) => (
                        <li key={s.user_id}>
                            <strong>{s.username}</strong>
                            <span>{s.email}</span>
                            <button type="button" className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }} onClick={() => remove(s.user_id)}>
                                Remove
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
