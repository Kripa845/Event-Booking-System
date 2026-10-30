import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getImageUrl } from "../services/api";
import WeatherCard from "../components/WeatherCard";
import EventBrowser from "../components/EventBrowser";
import { useAuth } from "../context/AuthContext";
import { fmtBs, fmtDay, fmtTime, fromNow, greeting, todayIso } from "../utils/format";
import "./Dashboard.css";

const STATUS_BADGE = {
    DRAFT:     "badge-warning",
    PUBLISHED: "badge-success",
    SOLD_OUT:  "badge-danger",
    STARTED:   "badge-primary",
    COMPLETED: "badge-muted",
    CANCELLED: "badge-danger",
};

const npr = (n) => `NPR ${Number(n || 0).toLocaleString()}`;

function SeatMeter({ sold, capacity }) {
    const pct = capacity ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;
    return (
        <div>
            <div
                className="meter" role="meter" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={sold}
                aria-label={`${sold} of ${capacity} seats sold`} title={`${sold} of ${capacity} seats sold (${pct}%)`}
            >
                <span style={{ width: `${pct}%` }} />
            </div>
            <div className="meter-label">
                <span><strong>{sold}</strong> / {capacity}</span>
                <span>{pct}%</span>
            </div>
        </div>
    );
}

function classify(events, today) {
    const isPast = (e) => String(e.date) < today || ["COMPLETED", "CANCELLED"].includes(e.status);
    return {
        upcoming: events
            .filter((e) => !isPast(e) && e.status !== "DRAFT")
            .sort((a, b) => String(a.date).localeCompare(String(b.date))),
        drafts: events.filter((e) => e.status === "DRAFT" && !isPast(e)),
        past: events.filter(isPast).sort((a, b) => String(b.date).localeCompare(String(a.date))),
    };
}

/** Things worth the organizer's attention, most urgent first. */
function attentionItems(groups, today) {
    const items = [];
    for (const e of groups.drafts) {
        items.push({ id: `draft-${e.id}`, icon: "📝", event: e, kind: "draft",
            text: <><strong>{e.title}</strong> is still a draft, so nobody can book it yet.</> });
    }
    for (const e of groups.upcoming) {
        const days = Math.round((new Date(e.date) - new Date(today)) / 86400000);
        const pct = e.capacity ? e.tickets_sold / e.capacity : 1;
        if (e.available_seats === 0 && e.waitlist > 0) {
            items.push({ id: `wait-${e.id}`, icon: "🔥", event: e,
                text: <><strong>{e.title}</strong> is sold out with <strong>{e.waitlist}</strong> on the waitlist. Could you add seats?</> });
        } else if (days <= 14 && pct < 0.3) {
            items.push({ id: `low-${e.id}`, icon: "📉", event: e,
                text: <><strong>{e.title}</strong> is {Math.round(pct * 100)}% sold and {days === 0 ? "happens today" : `${days} days away`}. An early-bird price or a share could help.</> });
        }
    }
    return items;
}

function OrganizerDashboard() {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [tab, setTab] = useState("upcoming");
    const [turnout, setTurnout] = useState(null);

    useEffect(() => {
        api.get("organizer/events/")
            .then((r) => setEvents(r.data))
            .catch(() => setError("Failed to load dashboard."))
            .finally(() => setLoading(false));
    }, []);

    const today = todayIso();
    const groups = classify(events, today);
    const next = groups.upcoming[0];

    useEffect(() => {
        if (!next) return;
        api.get(`organizer/events/${next.id}/turnout/`)
            .then((r) => setTurnout(r.data))
            .catch(() => setTurnout(null));
    }, [next?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const updateStatus = async (eventId, status, confirmText) => {
        if (confirmText && !window.confirm(confirmText)) return;
        try {
            await api.patch(`events/${eventId}/`, { status });
            setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, status } : e)));
        } catch {
            setError(`Couldn't update the event.`);
        }
    };

    // Copy an event as a new draft, then show it in the Drafts tab.
    const duplicateEvent = async (eventId) => {
        try {
            await api.post(`events/${eventId}/duplicate/`);
            const r = await api.get("organizer/events/");
            setEvents(r.data);
            setTab("drafts");
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.detail || "Couldn't duplicate the event.");
        }
    };

    const deleteEvent = async (eventId) => {
        if (!window.confirm("Delete this event permanently? This cannot be undone.")) return;
        try {
            await api.delete(`events/${eventId}/`);
            setEvents((prev) => prev.filter((e) => e.id !== eventId));
        } catch (err) {
            setError(err.response?.data?.error || "Failed to delete event.");
        }
    };

    if (loading) return (
        <div className="spinner-wrap" style={{ minHeight: "60vh" }}>
            <div className="spinner" />
        </div>
    );

    const sold = events.reduce((s, e) => s + e.tickets_sold, 0);
    const revenue = events.reduce((s, e) => s + Number(e.revenue || 0), 0);
    const pastSold = groups.past.reduce((s, e) => s + e.tickets_sold, 0);
    const pastIn = groups.past.reduce((s, e) => s + e.checked_in, 0);
    const checkinRate = pastSold ? Math.round((pastIn / pastSold) * 100) : null;
    const rated = events.filter((e) => e.ratings);
    const ratingCount = rated.reduce((s, e) => s + e.ratings, 0);
    const avgRating = ratingCount
        ? (rated.reduce((s, e) => s + e.avg_rating * e.ratings, 0) / ratingCount).toFixed(1)
        : null;
    const attention = attentionItems(groups, today);
    const shown = groups[tab];

    return (
        <>
        <div className="container page dash">
            <header className="dash-hero">
                <div>
                    <div className="dash-hero-kicker">{fmtDay(today)} · {fmtBs(today)}</div>
                    <h1>{greeting()}, {user?.username || "organizer"}</h1>
                    <p>
                        {groups.upcoming.length
                            ? <><strong>{groups.upcoming.length}</strong> {groups.upcoming.length === 1 ? "event" : "events"} coming up and <strong>{sold}</strong> tickets sold so far.</>
                            : "No events coming up. Create one and start selling tickets."}
                    </p>
                </div>
                <div className="dash-hero-actions">
                    <Link to="/organizer/create-event" className="btn btn-gold">+ Create event</Link>
                    <Link to="/check-in" className="btn btn-ghost-light">Open check-in</Link>
                </div>
            </header>

            {error && <div className="alert alert-error">{error}</div>}

            <section className="dash-kpis" aria-label="Your numbers">
                <div className="dash-kpi">
                    <div className="dash-kpi-label">Upcoming events</div>
                    <div className="dash-kpi-value">{groups.upcoming.length}</div>
                    {groups.drafts.length > 0 && <div className="dash-kpi-sub">+ {groups.drafts.length} draft{groups.drafts.length === 1 ? "" : "s"}</div>}
                </div>
                <div className="dash-kpi">
                    <div className="dash-kpi-label">Tickets sold</div>
                    <div className="dash-kpi-value">{sold.toLocaleString()}</div>
                </div>
                <div className="dash-kpi">
                    <div className="dash-kpi-label">Revenue</div>
                    <div className="dash-kpi-value">{npr(revenue)}</div>
                </div>
                <div className="dash-kpi">
                    <div className="dash-kpi-label">Show-up rate</div>
                    <div className="dash-kpi-value">{checkinRate === null ? "—" : `${checkinRate}%`}</div>
                    <div className="dash-kpi-sub">{checkinRate === null ? "after your first event" : "checked in at past events"}</div>
                </div>
                <div className="dash-kpi">
                    <div className="dash-kpi-label">Average rating</div>
                    <div className="dash-kpi-value">{avgRating ? `${avgRating}★` : "—"}</div>
                    <div className="dash-kpi-sub">{ratingCount ? `from ${ratingCount} postcard${ratingCount === 1 ? "" : "s"}` : "no ratings yet"}</div>
                </div>
            </section>

            <div className="dash-grid">
                <section aria-labelledby="next-title">
                    <div className="dash-card-head">
                        <h2 id="next-title" className="dash-card-title">Next event</h2>
                    </div>
                    {next ? (
                        <div className="spotlight">
                            <div className="spotlight-main">
                                <span className="spotlight-when">⏳ {fromNow(next.date)}</span>
                                <h3 className="spotlight-title">{next.title}</h3>
                                <div className="spotlight-meta">
                                    <span>
                                        📅 {fmtDay(next.date)}{next.start_time && ` · ${fmtTime(next.start_time)}`}
                                        <span className="bs">{fmtBs(next.date, "np")}</span>
                                    </span>
                                    <span>📍 {next.location}</span>
                                </div>
                                <div style={{ marginTop: 16 }}>
                                    <SeatMeter sold={next.tickets_sold} capacity={next.capacity} />
                                </div>
                                {turnout && turnout.confirmed > 0 && (
                                    <p className="dash-row-sub" style={{ marginTop: 10 }}>
                                        Expected turnout: about <strong>{turnout.expected_attendees}</strong> of {turnout.confirmed}{" "}
                                        ({Math.round(turnout.expected_show_rate * 100)}%)
                                        {next.waitlist > 0 && ` · ${next.waitlist} on the waitlist`}
                                    </p>
                                )}
                                {next.is_outdoor && <WeatherCard eventId={next.id} compact />}
                                <div className="spotlight-actions">
                                    <Link to={`/organizer/events/${next.id}/attendees`} className="btn btn-primary btn-sm">Attendees & forecast</Link>
                                    <Link to="/check-in" className="btn btn-outline btn-sm">Check-in</Link>
                                    <Link to={`/events/${next.id}`} className="btn btn-ghost btn-sm">Public page</Link>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="dash-card dash-empty">
                            Nothing scheduled. Your next published event will show up here with live sales.
                            <div><Link to="/organizer/create-event" className="btn btn-gold btn-sm">Create an event</Link></div>
                        </div>
                    )}
                </section>

                <section className="dash-card" aria-labelledby="attn-title">
                    <div className="dash-card-head">
                        <h2 id="attn-title" className="dash-card-title">Needs attention</h2>
                    </div>
                    {attention.length ? (
                        <ul className="attention">
                            {attention.map((item) => (
                                <li key={item.id}>
                                    <span className="attention-icon" aria-hidden="true">{item.icon}</span>
                                    <span>{item.text}</span>
                                    {item.kind === "draft" && (
                                        <button className="btn btn-success btn-xs" onClick={() => updateStatus(item.event.id, "PUBLISHED")}>
                                            Publish
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="dash-empty">All good. Nothing needs you right now. ✨</p>
                    )}
                </section>
            </div>

            <section aria-labelledby="events-title">
                <div className="dash-card-head">
                    <h2 id="events-title" className="dash-card-title">Your events</h2>
                    <div className="dash-tabs" role="tablist">
                        {[["upcoming", "Upcoming"], ["drafts", "Drafts"], ["past", "Past"]].map(([key, label]) => (
                            <button
                                key={key} role="tab" aria-selected={tab === key}
                                className={tab === key ? "active" : ""} onClick={() => setTab(key)}
                            >
                                {label}<span>{groups[key].length}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {shown.length === 0 ? (
                    <div className="dash-card dash-empty">
                        {tab === "drafts" ? "No drafts." : tab === "past" ? "No past events yet." : "No upcoming events."}
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table className="dash-table">
                            <thead>
                                <tr>
                                    <th>Event</th>
                                    <th>Status</th>
                                    <th>Seats sold</th>
                                    <th>{tab === "past" ? "Showed up" : "Waitlist"}</th>
                                    <th>Revenue</th>
                                    <th>Rating</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map((e) => (
                                    <tr key={e.id}>
                                        <td>
                                            <div className="event-cell">
                                                {e.banner || e.image
                                                    ? <img src={getImageUrl(e.banner || e.image)} alt="" />
                                                    : <span className="event-thumb" aria-hidden="true" />}
                                                <div>
                                                    <div className="event-cell-title">{e.title}</div>
                                                    <div className="event-cell-sub">{fmtDay(e.date)} · {fromNow(e.date)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><span className={`badge ${STATUS_BADGE[e.status] || "badge-muted"}`}>{e.status.replace("_", " ")}</span></td>
                                        <td><SeatMeter sold={e.tickets_sold} capacity={e.capacity} /></td>
                                        <td>
                                            {tab === "past"
                                                ? (e.tickets_sold ? `${e.checked_in} (${Math.round((e.checked_in / e.tickets_sold) * 100)}%)` : "—")
                                                : e.waitlist}
                                        </td>
                                        <td>{npr(e.revenue)}</td>
                                        <td>{e.avg_rating ? `${e.avg_rating}★ (${e.ratings})` : "—"}</td>
                                        <td>
                                            <div className="table-actions">
                                                <Link to={`/organizer/events/${e.id}/attendees`} className="btn btn-outline btn-xs">Attendees</Link>
                                                {e.status === "DRAFT" && (
                                                    <button className="btn btn-success btn-xs" onClick={() => updateStatus(e.id, "PUBLISHED")}>Publish</button>
                                                )}
                                                {!["CANCELLED", "COMPLETED"].includes(e.status) && tab !== "past" && (
                                                    <button
                                                        className="btn btn-danger btn-xs"
                                                        onClick={() => updateStatus(e.id, "CANCELLED", "Cancel this event? Ticket holders won't be able to attend.")}
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                                <button className="btn btn-ghost btn-xs" onClick={() => duplicateEvent(e.id)} title="Copy as a new draft">
                                                    Duplicate
                                                </button>
                                                <button className="btn btn-ghost btn-xs" style={{ color: "var(--danger)" }} onClick={() => deleteEvent(e.id)}>
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>

        {/* Same events section as the landing page (organizers can browse, not book). */}
        <EventBrowser />
        </>
    );
}

export default OrganizerDashboard;
