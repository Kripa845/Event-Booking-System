import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getImageUrl } from "../../services/api";
import EventCard from "../../components/EventCard";
import WeatherCard from "../../components/WeatherCard";
import { useAuth } from "../../context/AuthContext";
import { fmtBs, fmtDay, fmtTime, fromNow, greeting, todayIso } from "../../utils/format";
import "../Dashboard.css";

const list = (data) => (Array.isArray(data) ? data : data?.results ?? []);

function DateChip({ date }) {
    const [y, m, d] = String(date).split("-").map(Number);
    const month = new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short" });
    return <div className="dash-date"><b>{d}</b><span>{month}</span></div>;
}

export default function CustomerDashboard() {
    const { user } = useAuth();
    const [data, setData] = useState(null);

    useEffect(() => {
        Promise.allSettled([
            api.get("tickets/"),
            api.get("waitlist/"),
            api.get("recommendations/"),
            api.get("tickets/sky/"),
            api.get("postcards/"),
        ]).then(([tickets, waitlist, recs, sky, postcards]) => {
            const ok = (r) => (r.status === "fulfilled" ? r.value.data : null);
            setData({
                tickets: list(ok(tickets)),
                waitlist: list(ok(waitlist)).filter((w) => w.status === "WAITING"),
                recs: ok(recs)?.recommendations ?? [],
                sky: ok(sky),
                postcards: ok(postcards)?.postcards ?? [],
            });
        });
    }, []);

    if (!data) return (
        <div className="spinner-wrap" style={{ minHeight: "60vh" }}>
            <div className="spinner" />
        </div>
    );

    const today = todayIso();
    const upcoming = data.tickets
        .filter((t) => t.status === "VALID" && String(t.event_date) >= today)
        .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)));
    const next = upcoming[0];
    const later = upcoming.slice(1, 6);
    const unrated = data.postcards.filter((p) => !p.rating).length;
    const stars = data.sky?.stats?.stars ?? 0;
    const constellations = data.sky?.stats?.constellations_formed ?? 0;
    const name = user?.username || "there";

    return (
        <div className="container page dash">
            <header className="dash-hero">
                <div>
                    <div className="dash-hero-kicker">{fmtDay(today)} · {fmtBs(today)}</div>
                    <h1>{greeting()}, {name}</h1>
                    <p>
                        {next ? (
                            <>
                                You have <strong>{upcoming.length}</strong> upcoming{" "}
                                {upcoming.length === 1 ? "event" : "events"}. Next up is{" "}
                                <strong>{next.event_title}</strong>, {fromNow(next.event_date).toLowerCase()}.
                            </>
                        ) : (
                            "Nothing booked yet. Find something worth staying up for."
                        )}
                    </p>
                </div>
                <div className="dash-hero-actions">
                    <Link to="/" className="btn btn-gold">Browse events</Link>
                    <Link to="/my-tickets" className="btn btn-ghost-light">My tickets</Link>
                </div>
            </header>

            <section className="dash-kpis" aria-label="Your numbers">
                <div className="dash-kpi">
                    <div className="dash-kpi-label">Upcoming tickets</div>
                    <div className="dash-kpi-value">{upcoming.length}</div>
                </div>
                <div className="dash-kpi">
                    <div className="dash-kpi-label">Events attended</div>
                    <div className="dash-kpi-value">{stars}</div>
                    <div className="dash-kpi-sub">stars in your sky</div>
                </div>
                <div className="dash-kpi">
                    <div className="dash-kpi-label">Constellations</div>
                    <div className="dash-kpi-value">{constellations}</div>
                </div>
                <div className="dash-kpi">
                    <div className="dash-kpi-label">On waitlists</div>
                    <div className="dash-kpi-value">{data.waitlist.length}</div>
                </div>
            </section>

            <div className="dash-grid">
                <div className="dash-col">
                    <section aria-labelledby="next-title">
                        <div className="dash-card-head">
                            <h2 id="next-title" className="dash-card-title">Your next event</h2>
                            {next && <Link to="/my-tickets" className="dash-card-link">All tickets →</Link>}
                        </div>
                        {next ? (
                            <div className="spotlight">
                                <div className="spotlight-main">
                                    <span className="spotlight-when">⏳ {fromNow(next.event_date)}</span>
                                    <h3 className="spotlight-title">{next.event_title}</h3>
                                    <div className="spotlight-meta">
                                        <span>
                                            📅 {fmtDay(next.event_date)}
                                            {next.event_start_time && ` · ${fmtTime(next.event_start_time)}`}
                                            <span className="bs">{fmtBs(next.event_date, "np")}</span>
                                        </span>
                                        <span>📍 {next.location}</span>
                                    </div>
                                    {next.is_outdoor && <WeatherCard eventId={next.event_id} compact />}
                                    <div className="spotlight-actions">
                                        <Link to={`/events/${next.event_id}`} className="btn btn-primary btn-sm">Event details</Link>
                                        <Link to="/my-tickets" className="btn btn-outline btn-sm">Transfer or cancel</Link>
                                    </div>
                                </div>
                                {next.qr_code && (
                                    <div className="spotlight-stub">
                                        <img src={getImageUrl(next.qr_code)} alt={`QR code for ticket ${next.ticket_number}`} />
                                        <code>{next.ticket_number}</code>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="dash-card dash-empty">
                                No upcoming tickets. When you book something it'll show up here with its QR code.
                                <div><Link to="/" className="btn btn-gold btn-sm">Find an event</Link></div>
                            </div>
                        )}
                    </section>

                    {later.length > 0 && (
                        <section className="dash-card" aria-labelledby="later-title">
                            <div className="dash-card-head">
                                <h2 id="later-title" className="dash-card-title">Also coming up</h2>
                            </div>
                            <ul className="dash-list">
                                {later.map((t) => (
                                    <li key={t.id} className="dash-row">
                                        <DateChip date={t.event_date} />
                                        <div className="dash-row-main">
                                            <Link to={`/events/${t.event_id}`} className="dash-row-title">{t.event_title}</Link>
                                            <div className="dash-row-sub">📍 {t.location}</div>
                                        </div>
                                        <div className="dash-row-side">{fromNow(t.event_date)}</div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                <aside className="dash-col">
                    <section className="dash-card" aria-labelledby="wait-title">
                        <div className="dash-card-head">
                            <h2 id="wait-title" className="dash-card-title">Waitlists</h2>
                        </div>
                        {data.waitlist.length ? (
                            <ul className="dash-list">
                                {data.waitlist.map((w) => (
                                    <li key={w.id} className="dash-row">
                                        <div className="dash-row-main">
                                            <Link to={`/events/${w.event}`} className="dash-row-title">{w.event_title}</Link>
                                            <div className="dash-row-sub">{w.event_date && fmtDay(w.event_date)}</div>
                                        </div>
                                        <div className="dash-row-side">
                                            <strong>#{w.place_in_line}</strong> in line
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="dash-empty">
                                You're not waiting on anything. If an event sells out, join its waitlist and
                                you'll get a seat automatically when one opens.
                            </p>
                        )}
                    </section>

                    {unrated > 0 && (
                        <div className="side-note">
                            <span className="side-note-icon" aria-hidden="true">💌</span>
                            <div>
                                <h3>{unrated} {unrated === 1 ? "postcard" : "postcards"} to rate</h3>
                                <p>Tell us how your recent events went. It shapes what we suggest next.</p>
                                <Link to="/my-sky">Rate them →</Link>
                            </div>
                        </div>
                    )}

                    <div className="side-note">
                        <span className="side-note-icon" aria-hidden="true">✨</span>
                        <div>
                            <h3>Your night sky</h3>
                            <p>
                                {stars
                                    ? `${stars} ${stars === 1 ? "star" : "stars"} lit${constellations ? ` and ${constellations} ${constellations === 1 ? "constellation" : "constellations"} formed` : ""}. Every event you attend adds a star.`
                                    : "Still dark. Attend an event and get your ticket scanned to light your first star."}
                            </p>
                            <Link to="/my-sky">Open my sky →</Link>
                        </div>
                    </div>
                </aside>
            </div>

            {data.recs.length > 0 && (
                <section aria-labelledby="recs-title">
                    <div className="dash-card-head">
                        <h2 id="recs-title" className="dash-card-title">
                            {stars || upcoming.length ? "Picked for you" : "Popular right now"}
                        </h2>
                        <Link to="/" className="dash-card-link">Browse all events →</Link>
                    </div>
                    <div className="events-grid">
                        {data.recs.slice(0, 3).map((e) => <EventCard key={e.id} event={e} />)}
                    </div>
                </section>
            )}
        </div>
    );
}
