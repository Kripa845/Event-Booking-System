import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import EventCard from "../components/EventCard";
import BackButton from "../components/BackButton";

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

export default function Home() {
    const [events,   setEvents]   = useState([]);
    const [search,   setSearch]   = useState("");
    const [category, setCategory] = useState("");
    const [loading,  setLoading]  = useState(true);

    const fetchEvents = useCallback(async (q = "", cat = "") => {
        setLoading(true);
        try {
            const params = {};
            if (q)   params.search   = q;
            if (cat) params.category = cat;
            const res = await api.get("events/", { params });
            // DRF pagination: results may be wrapped
            setEvents(Array.isArray(res.data) ? res.data : res.data.results ?? []);
        } catch { } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const onSearch = (e) => { e.preventDefault(); fetchEvents(search, category); };
    const onCat    = (cat) => { setCategory(cat); fetchEvents(search, cat); };
    const onClear  = () => { setSearch(""); setCategory(""); fetchEvents(); };

    const heading = search
        ? `Results for "${search}"`
        : category
        ? `${CATEGORIES.find(c => c.value === category)?.label ?? category} Events`
        : "Upcoming Events";

    return (
        <main>
            <div style={{ padding: "0 20px" }}>
                <BackButton />
            </div>

            {/* Hero */}
            <section className="hero">
                <div className="hero-eyebrow">🎟️ Nepal's Event Platform</div>
                <h1 className="hero-title">
                    Discover <em>Amazing</em><br />Events Near You
                </h1>
                <p className="hero-sub">
                    Workshops, concerts, hackathons and more — book tickets in seconds.
                </p>
                <form className="search-bar" onSubmit={onSearch}>
                    <input
                        type="text"
                        placeholder="Search events, locations, organizers…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button type="submit" className="search-btn">Search</button>
                </form>

                {/* Category chips */}
                <div className="filter-chips">
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
            </section>

            {/* Grid */}
            <section className="events-section container">
                <div className="section-header">
                    <h2 className="section-title">{heading}</h2>
                    {(search || category) && (
                        <button className="btn btn-ghost btn-sm" onClick={onClear}>
                            ✕ Clear filters
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="spinner-wrap"><div className="spinner" /></div>
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
            </section>
        </main>
    );
}
