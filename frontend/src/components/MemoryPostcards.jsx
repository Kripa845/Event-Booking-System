import { useEffect, useState } from "react";
import api from "../services/api";
import { fmtBs } from "../utils/format";
import "./MemoryPostcards.css";

const STAMP = {
    WORKSHOP: "🛠️", SEMINAR: "📚", HACKATHON: "🏆", CONCERT: "🎵",
    CONFERENCE: "🎙️", SPORTS: "⚽", FESTIVAL: "🎉", COMPETITION: "🥇",
    MEETUP: "☕", OTHER: "🎪",
};

const TILTS = [-2.5, 1.8, -1.2, 2.4, -1.8, 1.2];

function fmtDate(d) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StarRating({ value, onRate, label }) {
    const [hover, setHover] = useState(0);
    const shown = hover || value || 0;
    return (
        <div className="pc-stars" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n} type="button" role="radio" aria-checked={value === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    className={n <= shown ? "on" : ""}
                    onMouseEnter={() => setHover(n)}
                    onClick={() => onRate(n)}
                >
                    ★
                </button>
            ))}
        </div>
    );
}

/** A postcard for every event the user attended, each asking "How was it?". */
export default function MemoryPostcards() {
    const [cards, setCards] = useState(null);
    const [thanks, setThanks] = useState(null);   // event_id just rated
    const [drafts, setDrafts] = useState({});     // event_id -> comment being typed
    const [error, setError] = useState("");

    useEffect(() => {
        api.get("postcards/")
            .then((res) => setCards(res.data.postcards))
            .catch(() => setCards([]));
    }, []);

    const rate = async (eventId, rating, comment) => {
        setError("");
        const before = cards;
        const current = cards.find((c) => c.event_id === eventId);
        const text = comment ?? current?.comment ?? "";
        setCards(cards.map((c) => (c.event_id === eventId ? { ...c, rating, comment: text } : c)));
        try {
            await api.post(`postcards/${eventId}/rate/`, { rating, comment: text });
            setThanks(eventId);
        } catch (err) {
            setCards(before);
            setError(err.response?.data?.error || "Couldn't save your rating.");
        }
    };

    if (!cards || cards.length === 0) return null;
    const unrated = cards.filter((c) => !c.rating).length;

    return (
        <section className="pc-section">
            <div className="pc-head">
                <h2 className="section-title">Postcards from your nights</h2>
                <p className="pc-sub">
                    {unrated > 0
                        ? `${unrated} ${unrated === 1 ? "postcard is" : "postcards are"} waiting for a rating. Your ratings shape what we suggest next.`
                        : "All rated. Thanks! Your ratings shape what we suggest next."}
                </p>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="pc-row">
                {cards.map((c, i) => (
                    <article key={c.event_id} className="pc-card" style={{ "--tilt": `${TILTS[i % TILTS.length]}deg` }}>
                        <div className="pc-inner">
                            <div className="pc-msg">
                                <div className="pc-kicker">{fmtDate(c.date)}</div>
                                <h3>{c.title}</h3>
                                <p className="pc-where">{c.location}</p>
                                <div className="pc-ask">{c.rating ? "Your rating" : "How was it?"}</div>
                                <StarRating value={c.rating} onRate={(n) => rate(c.event_id, n)} label={`Rate ${c.title}`} />
                                {c.rating > 0 && (
                                    <form
                                        className="pc-comment"
                                        onSubmit={(e) => { e.preventDefault(); rate(c.event_id, c.rating, drafts[c.event_id] ?? c.comment); }}
                                    >
                                        <input
                                            aria-label={`Review of ${c.title}`} maxLength={500}
                                            placeholder="Add a short review (optional)"
                                            value={drafts[c.event_id] ?? c.comment ?? ""}
                                            onChange={(e) => setDrafts({ ...drafts, [c.event_id]: e.target.value })}
                                        />
                                        <button type="submit">Save</button>
                                    </form>
                                )}
                                {thanks === c.event_id && <div className="pc-thanks">Thanks! Noted.</div>}
                            </div>
                            <div className="pc-addr">
                                <div className="pc-stamp" aria-hidden="true">{STAMP[c.category] || "🎪"}</div>
                                <div className="pc-postmark" aria-hidden="true">
                                    {c.location.toUpperCase().slice(0, 12)}<br />{fmtBs(c.date).split(", ")[1] || ""}
                                </div>
                                <i /><i /><i />
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
