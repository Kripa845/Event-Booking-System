import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import EventCard from "./EventCard";
import "../pages/Home.css";

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

/**
 * The "browse events" section (search, plain-English search, category chips, event grid).
 * Shared by the landing page and the organizer dashboard so both look the same.
 * onEventsChange lets the landing page hero show the same events.
 */
export default function EventBrowser({ onEventsChange }) {
    const [events,   setEvents]   = useState([]);
    const [search,   setSearch]   = useState("");
    const [category, setCategory] = useState("");
    const [loading,  setLoading]  = useState(true);
    const [smart,    setSmart]    = useState(false);      // plain-English mode
    const [smartInfo, setSmartInfo] = useState(null);     // { summary, relaxed } | { fallback }

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

    useEffect(() => { onEventsChange?.(events); }, [events, onEventsChange]);

    const runSmartSearch = async (q) => {
        setLoading(true);
        setCategory("");
        try {
            const res = await api.post("events/smart-search/", { query: q });
            setEvents(res.data.results);
            setSmartInfo({ summary: res.data.filters.summary, relaxed: res.data.relaxed });
            setLoading(false);
        } catch (err) {
            // Not configured / unavailable: fall back to a normal keyword search.
            setSmartInfo({ fallback: err.response?.data?.error || "Smart search is unavailable right now." });
            fetchEvents(q, "");
        }
    };

    const onSearch = (e) => {
        e.preventDefault();
        setSmartInfo(null);
        if (smart && search.trim()) runSmartSearch(search.trim());
        else fetchEvents(search, category);
    };
    const onCat    = (cat) => { setSmartInfo(null); setCategory(cat); fetchEvents(search, cat); };
    const onClear  = () => { setSearch(""); setCategory(""); setSmartInfo(null); fetchEvents(); };

    const heading = smartInfo?.summary
        ? smartInfo.summary
        : search
        ? `Results for "${search}"`
        : category
        ? `${CATEGORIES.find(c => c.value === category)?.label ?? category} Events`
        : "Upcoming Events";

    return (
        <section id="events" className="lk-events container">
            <h2 className="lk-section-title">Find something worth staying up for</h2>
            <div className="search-mode" role="group" aria-label="Search mode">
                <button
                    type="button" aria-pressed={!smart}
                    className={!smart ? "active" : ""} onClick={() => setSmart(false)}
                >
                    Keywords
                </button>
                <button
                    type="button" aria-pressed={smart}
                    className={smart ? "active" : ""} onClick={() => setSmart(true)}
                >
                    ✨ Plain English
                </button>
            </div>
            <form className="search-bar" onSubmit={onSearch}>
                <input
                    type="text"
                    aria-label={smart ? "Describe what you're looking for" : "Search events"}
                    placeholder={smart
                        ? "e.g. free tech workshops this weekend in Lalitpur"
                        : "Search events, locations, organizers…"}
                    value={search}
                    maxLength={200}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button type="submit" className="search-btn">{smart ? "Ask" : "Search"}</button>
            </form>
            {smartInfo?.fallback && (
                <p className="smart-note" role="status">{smartInfo.fallback} Showing keyword results instead.</p>
            )}
            {smartInfo?.relaxed?.length > 0 && (
                <p className="smart-note" role="status">
                    Nothing matched those exact topics, so here's everything else that fits.
                </p>
            )}
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

            <div className="section-header lk-events-header">
                <h3 className="section-title">
                    {heading}
                    {!loading && events.length > 0 && (
                        <span className="section-count">{events.length}</span>
                    )}
                </h3>
                {(search || category || smartInfo) && (
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
    );
}
