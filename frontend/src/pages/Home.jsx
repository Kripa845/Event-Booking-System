import { useState } from "react";
import EventBrowser from "../components/EventBrowser";
import TicketIcon from "../components/TicketIcon";
import {
    CloudBank, Constellation, LockArt, Moon, PaperPlane, QrPattern, StarMap, Starfield,
} from "../components/NightSky";
import "./Home.css";

const CAT_EMOJI = {
    WORKSHOP: "🛠️", SEMINAR: "📚", HACKATHON: "🏆", CONCERT: "🎵",
    CONFERENCE: "🎙️", SPORTS: "⚽", FESTIVAL: "🎉", COMPETITION: "🥇",
    MEETUP: "☕", OTHER: "🎪",
};

const FEATURES = [
    {
        title: "Smart Waitlists",
        text: "Sold out? Join the line and you're booked automatically the moment a seat opens up.",
    },
    {
        title: "Picked For You",
        text: "Recommendations that learn from the events you book, so the good ones find you.",
    },
    {
        title: "Turnout Forecasts",
        text: "Organizers see who's likely to show up before the doors even open.",
    },
];

const STEPS = [
    { stamp: "🔍", title: "Find your night", text: "Browse workshops, concerts and meetups near you." },
    { stamp: "🎟️", title: "Book in a tap", text: "Reserve your seat in seconds, free or paid." },
    { stamp: "📱", title: "Get your QR ticket", text: "It lives in My Tickets, ready on any screen." },
    { stamp: "✅", title: "Scan in at the door", text: "One quick scan and you're in. See you there." },
];

function fmtDate(d) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AppPreview({ events }) {
    const rows = events.slice(0, 3);
    return (
        <div className="lk-window">
            <div className="lk-window-bar">
                <span className="lk-window-logo"><TicketIcon size={14} /></span>
                <span className="lk-window-title">EventHub / My Tickets</span>
                <span className="lk-window-dots"><i /><i /><i /></span>
            </div>
            <div className="lk-window-body">
                <aside className="lk-window-side">
                    <div className="lk-side-item active">Upcoming</div>
                    <div className="lk-side-label">Lists</div>
                    <div className="lk-side-item">Waitlist</div>
                    <div className="lk-side-item">Past events</div>
                </aside>
                <div className="lk-window-main">
                    <div className="lk-window-hint">Your upcoming events</div>
                    {rows.length === 0
                        ? [0, 1, 2].map((i) => <div key={i} className="lk-row lk-row-skeleton" />)
                        : rows.map((e) => (
                            <div key={e.id} className="lk-row">
                                <span className="lk-row-avatar">{CAT_EMOJI[e.category] || "🎪"}</span>
                                <div className="lk-row-text">
                                    <div className="lk-row-title">{e.title}</div>
                                    <div className="lk-row-meta">{fmtDate(e.date)} · {e.location}</div>
                                </div>
                                <span className="lk-row-chip">Ticket ready ✓</span>
                            </div>
                        ))}
                    <div className="lk-window-input">Search events…</div>
                </div>
            </div>
        </div>
    );
}

function PhoneTicket({ event }) {
    return (
        <div className="lk-phone">
            <div className="lk-phone-notch" />
            <div className="lk-phone-label">Admit one</div>
            <div className="lk-phone-qr"><QrPattern size={104} /></div>
            <div className="lk-phone-title">{event?.title || "Your next event"}</div>
            <div className="lk-phone-meta">{event ? fmtDate(event.date) : "Scan at the door"}</div>
        </div>
    );
}

export default function Home() {
    const [events,   setEvents]   = useState([]);

    return (
        <main className="lk">
            {/* ── Hero ── */}
            <section className="lk-hero">
                <Starfield className="lk-stars" />
                <Constellation
                    className="lk-constellation"
                    style={{ top: "9%", left: "12%" }}
                    points={[[4, 60], [40, 40], [70, 52], [110, 18], [150, 30], [190, 6]]}
                />
                <Constellation
                    className="lk-constellation"
                    style={{ top: "38%", right: "6%" }}
                    points={[[4, 50], [36, 26], [72, 40], [96, 8], [130, 22]]}
                />
                <PaperPlane className="lk-plane lk-plane-1" size={70} />
                <PaperPlane className="lk-plane lk-plane-2" size={56} />
                <PaperPlane className="lk-plane lk-plane-3" size={46} />

                <div className="lk-hero-copy">
                    <h1 className="lk-title">
                        Every great night<br />starts with a ticket.
                    </h1>
                    <a href="#events" className="lk-cta">Explore events →</a>
                </div>

                <PhoneTicket event={events[0]} />

                <div className="lk-hero-stage">
                    <AppPreview events={events} />
                </div>

                <CloudBank className="lk-hero-clouds" seed={4} />

                <p className="lk-caption lk-caption-left">
                    Thoughtful booking meets<br />instant QR tickets.
                </p>
                <div className="lk-caption lk-caption-right">
                    <Moon size={56} />
                    <span>Built for Nepal's<br />event scene</span>
                </div>
            </section>

            {/* ── Events ── */}
            <EventBrowser onEventsChange={setEvents} />

            {/* ── Features ── */}
            <section className="lk-features container">
                <div className="lk-feature-grid">
                    {FEATURES.map((f) => (
                        <div key={f.title} className="lk-feature">
                            <h3 className="lk-feature-title">{f.title}</h3>
                            <p className="lk-feature-text">{f.text}</p>
                        </div>
                    ))}
                </div>

                <div className="lk-sync">
                    <div className="lk-sync-copy">
                        <h3 className="lk-feature-title lk-sync-title">Your Ticket,<br />On Every Screen</h3>
                        <p className="lk-feature-text">
                            Your QR ticket waits in My Tickets on your phone or laptop.
                            Organizers scan it at the door in a second.
                        </p>
                    </div>
                    <div className="lk-sync-art">
                        <Starfield className="lk-stars" count={50} seed={9} />
                        <div className="lk-skyline" aria-hidden="true">
                            {[38, 62, 46, 80, 54, 70, 42, 90, 58, 48, 74, 40, 66, 52].map((h, i) => (
                                <span key={i} style={{ height: `${h}%` }} />
                            ))}
                        </div>
                        <CloudBank className="lk-sync-clouds" seed={12} height={200} edges={false} />
                        <div className="lk-device lk-device-phone"><QrPattern size={46} seed={5} /></div>
                        <div className="lk-device lk-device-laptop">
                            <div className="lk-laptop-screen"><QrPattern size={58} seed={5} /></div>
                            <div className="lk-laptop-base" />
                        </div>
                        <svg className="lk-sync-arrows" viewBox="0 0 400 200" aria-hidden="true">
                            <path d="M110 70 Q200 10 290 70" />
                            <path d="M290 130 Q200 190 110 130" />
                        </svg>
                    </div>
                </div>
            </section>

            {/* ── Secure tickets band ── */}
            <section className="lk-vault">
                <Starfield className="lk-stars" count={40} seed={21} />
                <div className="lk-vault-inner container">
                    <LockArt />
                    <div className="lk-vault-copy">
                        <h2 className="lk-vault-title">One Ticket. One Scan. No Copies.</h2>
                        <p>
                            Every ticket gets its own code, and it can only be checked in once,
                            so a screenshot passed around won't get anyone else through the door.
                        </p>
                    </div>
                    <StarMap />
                </div>
            </section>

            {/* ── How it works (postcards) ── */}
            <section className="lk-postcards">
                <h2 className="lk-section-title">How it works</h2>
                <div className="lk-postcard-row">
                    {STEPS.map((s, i) => (
                        <article key={s.title} className="lk-postcard" style={{ "--tilt": `${[-3, 2, -1.5, 3][i]}deg` }}>
                            <div className="lk-postcard-inner">
                                <div className="lk-postcard-msg">
                                    <div className="lk-postcard-step">Step {i + 1}</div>
                                    <h3>{s.title}</h3>
                                    <p>{s.text}</p>
                                </div>
                                <div className="lk-postcard-addr">
                                    <div className="lk-stamp">{s.stamp}</div>
                                    <div className="lk-postmark">EVENTHUB<br />NEPAL</div>
                                    <i /><i /><i />
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

        </main>
    );
}
