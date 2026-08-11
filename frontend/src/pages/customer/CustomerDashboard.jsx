import { useEffect, useState, useCallback } from "react";
import api from "../../services/api";
import EventCard from "../../components/EventCard";
import BackButton from "../../components/BackButton";
import { useAuth } from "../../context/AuthContext";

const CATEGORIES = [
    { value: "",           label: "All Events" },
    { value: "WORKSHOP",   label: "🛠️ Workshop" },
    { value: "HACKATHON",  label: "🏆 Hackathon" },
    { value: "CONCERT",    label: "🎵 Concert" },
    { value: "CONFERENCE", label: "🎙️ Conference" },
    { value: "SEMINAR",    label: "📚 Seminar" },
    { value: "SPORTS",     label: "⚽ Sports" },
    { value: "FESTIVAL",   label: "🎉 Festival" },
    { value: "MEETUP",     label: "☕ Meetup" },
];

export default function CustomerDashboard() {
    const { user } = useAuth();
    const [events,   setEvents]   = useState([]);
    const [search,   setSearch]   = useState("");
    const [category, setCategory] = useState("");
    const [loading,  setLoading]  = useState(true);
    
    // Recommendations state
    const [recommendedEvents, setRecommendedEvents] = useState([]);
    const [recsLoading, setRecsLoading] = useState(true);

    const fetchEvents = useCallback(async (q = "", cat = "") => {
        setLoading(true);
        try {
            const params = {};
            if (q)   params.search   = q;
            if (cat) params.category = cat;
            const res = await api.get("events/", { params });
            setEvents(Array.isArray(res.data) ? res.data : res.data.results ?? []);
        } catch { } finally { setLoading(false); }
    }, []);

    const fetchRecommendations = useCallback(async () => {
        setRecsLoading(true);
        try {
            const res = await api.get("recommendations/");
            setRecommendedEvents(res.data.recommendations || []);
        } catch (err) {
            console.error("Failed to fetch recommendations:", err);
        } finally {
            setRecsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEvents();
        fetchRecommendations();
    }, [fetchEvents, fetchRecommendations]);

    const onSearch = (e) => { e.preventDefault(); fetchEvents(search, category); };
    const onCat    = (cat) => { setCategory(cat); fetchEvents(search, cat); };
    const onClear  = () => { setSearch(""); setCategory(""); fetchEvents(); };

    const heading = search
        ? `Results for "${search}"`
        : category
        ? `${CATEGORIES.find(c => c.value === category)?.label ?? category} Events`
        : "Upcoming Events";

    return (
        <div className="container page">
            <BackButton />
            <div className="section-header">
                <div>
                    <h1 className="page-title">🎟️ Customer Dashboard</h1>
                    <p className="page-subtitle">Welcome back, {user?.username || user?.first_name || "customer"}! Browse and book upcoming events.</p>
                </div>
            </div>

            {/* ✨ Recommended For You */}
            {!recsLoading && recommendedEvents.length > 0 && (
                <div className="recommendations-section" style={{ marginBottom: "40px" }}>
                    <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>✨</span> Recommended For You
                    </h2>
                    <div className="events-grid">
                        {recommendedEvents.slice(0, 3).map((e) => (
                            <EventCard key={e.id} event={e} />
                        ))}
                    </div>
                    <hr style={{ margin: "40px 0 24px", border: "0", borderTop: "1px solid var(--border)" }} />
                </div>
            )}

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px", alignItems: "center" }}>
                <form onSubmit={onSearch} style={{ display: "flex", gap: "8px", flex: 1, minWidth: "280px" }}>
                    <input
                        type="text"
                        placeholder="Search events, locations, organizers…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="form-input"
                        style={{ flex: 1 }}
                    />
                    <button type="submit" className="btn btn-primary">Search</button>
                </form>

                <select
                    value={category}
                    onChange={(e) => onCat(e.target.value)}
                    className="form-select"
                    style={{ minWidth: "180px" }}
                >
                    {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                </select>

                {(search || category) && (
                    <button className="btn btn-ghost btn-sm" onClick={onClear}>
                        ✕ Clear filters
                    </button>
                )}
            </div>

            <div className="filter-chips" style={{ marginBottom: "24px" }}>
                {CATEGORIES.map((c) => (
                    <button
                        key={c.value}
                        className={`chip${category === c.value ? " active" : ""}`}
                        onClick={() => onCat(c.value)}
                        type="button"
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="spinner-wrap" style={{ minHeight: "40vh" }}>
                    <div className="spinner" />
                </div>
            ) : events.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <div className="empty-state-title">No events found</div>
                    <div className="empty-state-text">Try a different search or category.</div>
                </div>
            ) : (
                <div className="events-grid">
                    {events.map((e) => <EventCard key={e.id} event={e} />)}
                </div>
            )}
        </div>
    );
}
