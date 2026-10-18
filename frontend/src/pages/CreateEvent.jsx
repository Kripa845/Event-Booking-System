import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import BackButton from "../components/BackButton";
import api from "../services/api";
import { fmtBs } from "../utils/format";

const CATEGORIES = [
    { value: "WORKSHOP",    label: "🛠️ Workshop" },
    { value: "HACKATHON",   label: "🏆 Hackathon" },
    { value: "CONCERT",     label: "🎵 Concert" },
    { value: "CONFERENCE",  label: "🎙️ Conference" },
    { value: "SEMINAR",     label: "📚 Seminar" },
    { value: "SPORTS",      label: "⚽ Sports" },
    { value: "FESTIVAL",    label: "🎉 Festival" },
    { value: "MEETUP",      label: "☕ Meetup" },
];

const INITIAL = {
    title: "",
    description: "",
    category: "",
    date: "",
    start_time: "",
    end_time: "",
    location: "",
    capacity: "",
    price: "0",
    early_bird_discount: "0",
    early_bird_seats: "0",
    is_outdoor: false,
    status: "DRAFT",
};

function CreateEvent() {
    const navigate = useNavigate();
    const [form, setForm] = useState(INITIAL);
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e) =>
        setForm({
            ...form,
            [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
        });

    const earlyPrice = Math.round(Number(form.price || 0) * (100 - Number(form.early_bird_discount || 0)) / 100);

    // Warn about public holidays and similar events on the chosen date.
    const [dateCheck, setDateCheck] = useState(null);
    useEffect(() => {
        if (!form.date) { setDateCheck(null); return; }
        const timer = setTimeout(() => {
            api.get("events/date-check/", {
                params: { date: form.date, location: form.location, category: form.category },
            })
                .then((res) => setDateCheck(res.data))
                .catch(() => setDateCheck(null));
        }, 400);
        return () => clearTimeout(timer);
    }, [form.date, form.location, form.category]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const data = new FormData();
            Object.entries(form).forEach(([k, v]) => data.append(k, v));
            if (image) data.append("image", image);

            await api.post("events/", data);
            navigate("/organizer/dashboard");
        } catch (err) {
            const d = err.response?.data;
            if (d) {
                const msgs = Object.entries(d)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
                    .join(" | ");
                setError(msgs);
            } else {
                setError("Failed to create event.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container page">
            <BackButton />

            <div className="form-card">
                <h1 className="page-title" style={{ marginBottom: "6px" }}>Create Event</h1>
                <p className="page-subtitle">Fill in the details. You can publish later.</p>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Event Title *</label>
                        <input
                            name="title"
                            className="form-input"
                            placeholder="e.g. Django Backend Workshop"
                            value={form.title}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description *</label>
                        <textarea
                            name="description"
                            className="form-textarea"
                            placeholder="Describe what attendees will experience..."
                            value={form.description}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Event Type *</label>
                        <select
                            name="category"
                            className="form-select"
                            value={form.category}
                            onChange={handleChange}
                            required
                        >
                            <option value="" disabled>Select an event type</option>
                            {CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-grid-2">
                        <div className="form-group">
                            <label className="form-label">Date *</label>
                            <input
                                name="date"
                                type="date"
                                className="form-input"
                                value={form.date}
                                onChange={handleChange}
                                required
                            />
                            {form.date && <span className="form-hint">{fmtBs(form.date, "np")} · {fmtBs(form.date)}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Location *</label>
                            <input
                                name="location"
                                className="form-input"
                                placeholder="e.g. Kathmandu"
                                value={form.location}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Start Time *</label>
                            <input
                                name="start_time"
                                type="time"
                                className="form-input"
                                value={form.start_time}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">End Time *</label>
                            <input
                                name="end_time"
                                type="time"
                                className="form-input"
                                value={form.end_time}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Capacity *</label>
                            <input
                                name="capacity"
                                type="number"
                                min="1"
                                className="form-input"
                                placeholder="e.g. 100"
                                value={form.capacity}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ticket Price (NPR)</label>
                            <input
                                name="price"
                                type="number"
                                min="0"
                                className="form-input"
                                placeholder="0 for free"
                                value={form.price}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {Number(form.price) > 0 && (
                        <fieldset className="form-fieldset">
                            <legend>Early-bird pricing (optional)</legend>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="early_bird_discount">Discount (%)</label>
                                    <input
                                        id="early_bird_discount" name="early_bird_discount" type="number"
                                        min="0" max="90" className="form-input"
                                        value={form.early_bird_discount} onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="early_bird_seats">For the first … tickets</label>
                                    <input
                                        id="early_bird_seats" name="early_bird_seats" type="number"
                                        min="0" max={form.capacity || undefined} className="form-input"
                                        value={form.early_bird_seats} onChange={handleChange}
                                    />
                                </div>
                            </div>
                            {Number(form.early_bird_discount) > 0 && Number(form.early_bird_seats) > 0 && (
                                <p className="form-hint">
                                    The first {form.early_bird_seats} tickets sell at NPR {earlyPrice.toLocaleString()},
                                    then the price goes up to NPR {Number(form.price).toLocaleString()}.
                                </p>
                            )}
                        </fieldset>
                    )}

                    <label className="form-check">
                        <input type="checkbox" name="is_outdoor" checked={form.is_outdoor} onChange={handleChange} />
                        <span>
                            <strong>This is an outdoor event</strong>
                            <span className="form-hint">Attendees get a weather forecast and rain alerts.</span>
                        </span>
                    </label>

                    {dateCheck && (dateCheck.holidays.length > 0 || dateCheck.clashes.length > 0) && (
                        <div className="date-warnings" role="status">
                            {dateCheck.holidays.map((h) => (
                                <div key={h.name} className={`alert ${h.major ? "alert-warning" : "alert-info"}`}>
                                    <strong>{h.name}{h.name_np && ` (${h.name_np})`}</strong>{" "}
                                    {h.start_date === h.end_date ? "is a public holiday that day." : `runs ${h.start_date} to ${h.end_date}.`}{" "}
                                    {h.major
                                        ? "Many people travel home for this festival, so turnout may be lower."
                                        : "Some people will be off work, which can help or hurt turnout."}
                                </div>
                            ))}
                            {dateCheck.clashes.length > 0 && (
                                <div className="alert alert-warning">
                                    <strong>Similar events on the same day:</strong>
                                    <ul className="date-clash-list">
                                        {dateCheck.clashes.map((c) => (
                                            <li key={c.id}>
                                                <Link to={`/events/${c.id}`} target="_blank">{c.title}</Link>{" "}
                                                by {c.organizer}, {c.location} ({c.reasons.join(", ")})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Event Image (optional)</label>
                        <input
                            type="file"
                            accept="image/*"
                            className="form-input"
                            onChange={(e) => setImage(e.target.files[0])}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Initial Status</label>
                        <select
                            name="status"
                            className="form-select"
                            value={form.status}
                            onChange={handleChange}
                        >
                            <option value="DRAFT">Draft — not visible to public</option>
                            <option value="PUBLISHED">Published — open for booking</option>
                        </select>
                    </div>

                    <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            disabled={loading}
                        >
                            {loading ? "Creating..." : "Create Event"}
                        </button>
                        <Link to="/organizer/dashboard" className="btn btn-ghost btn-lg">
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateEvent;
