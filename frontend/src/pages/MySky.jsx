import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import MemoryPostcards from "../components/MemoryPostcards";
import "./MySky.css";

const W = 1000;
const H = 560;

// Each category lives in its own patch of sky.
const CLUSTERS = {
    HACKATHON:   [170, 150],
    WORKSHOP:    [420, 110],
    CONCERT:     [700, 130],
    CONFERENCE:  [870, 280],
    SEMINAR:     [560, 290],
    MEETUP:      [130, 340],
    SPORTS:      [320, 420],
    COMPETITION: [520, 470],
    FESTIVAL:    [740, 440],
    OTHER:       [900, 480],
};

function seeded(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function fmtDate(d) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Place every star near its category's centre, spread out so they don't overlap. */
function layoutStars(stars) {
    const placed = [];
    for (const star of stars) {
        const [cx, cy] = CLUSTERS[star.category] || CLUSTERS.OTHER;
        const rand = seeded(star.event_id * 7919 + 17);
        let x = cx;
        let y = cy;
        for (let attempt = 0; attempt < 12; attempt++) {
            const angle = rand() * Math.PI * 2;
            const dist = 22 + rand() * 78;
            x = Math.min(W - 30, Math.max(30, cx + Math.cos(angle) * dist));
            y = Math.min(H - 60, Math.max(30, cy + Math.sin(angle) * dist * 0.75));
            const clash = placed.some((p) => Math.hypot(p.x - x, p.y - y) < 26);
            if (!clash) break;
        }
        // Bigger crowds make brighter stars.
        const r = 3.4 + Math.min(3.6, Math.log2(star.attendees + 1) * 0.7);
        placed.push({ ...star, x, y, r });
    }
    return placed;
}

function backgroundStars() {
    const rand = seeded(2026);
    return Array.from({ length: 170 }, () => ({
        x: rand() * W, y: rand() * H, r: 0.3 + rand() * 0.8, o: 0.15 + rand() * 0.45,
    }));
}

export default function MySky() {
    const { user } = useAuth();
    const svgRef = useRef(null);
    const [sky, setSky] = useState(null);
    const [error, setError] = useState("");
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        api.get("tickets/sky/")
            .then((res) => setSky(res.data))
            .catch(() => setError("Couldn't load your sky. Please try again."));
    }, []);

    const stars = useMemo(() => layoutStars(sky?.stars || []), [sky]);
    const dust = useMemo(backgroundStars, []);

    const lines = useMemo(() => {
        if (!sky) return [];
        return sky.constellations
            .map((c) => {
                const members = stars.filter((s) => s.category === c.category);
                if (members.length < 2) return null;
                const lowest = Math.max(...members.map((s) => s.y));
                const centre = members.reduce((sum, s) => sum + s.x, 0) / members.length;
                return { ...c, members, labelX: centre, labelY: Math.min(H - 40, lowest + 30) };
            })
            .filter(Boolean);
    }, [sky, stars]);

    const selectedStar = stars.find((s) => s.ticket_number === selected) || null;
    const selectedConst = selectedStar && sky.constellations.find((c) => c.category === selectedStar.category);

    const saveImage = () => {
        const svg = svgRef.current;
        if (!svg) return;
        const data = new XMLSerializer().serializeToString(svg);
        const url = URL.createObjectURL(new Blob([data], { type: "image/svg+xml;charset=utf-8" }));
        const img = new Image();
        img.onload = () => {
            const scale = 2;
            const canvas = document.createElement("canvas");
            canvas.width = W * scale;
            canvas.height = H * scale;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "my-eventhub-sky.png";
                a.click();
                URL.revokeObjectURL(a.href);
            });
        };
        img.src = url;
    };

    if (!sky && !error) return (
        <div className="spinner-wrap" style={{ minHeight: "60vh" }}>
            <div className="spinner" />
        </div>
    );

    const empty = sky && sky.stars.length === 0;
    const name = user?.username || "My";

    return (
        <div className="container page">
            <div className="section-header">
                <div>
                    <h1 className="page-title">Your Night Sky</h1>
                    <p className="page-subtitle">
                        Every event you attend lights a star. Attend {sky?.constellation_min ?? 3} of
                        the same kind and they join into a constellation.
                    </p>
                </div>
                {!empty && sky && (
                    <button className="btn btn-gold" onClick={saveImage}>⤓ Save as image</button>
                )}
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {sky && (
                <>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-card-label">Stars lit</div>
                            <div className="stat-card-value">{sky.stats.stars}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-label">Constellations</div>
                            <div className="stat-card-value">{sky.stats.constellations_formed}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-label">Kinds of events</div>
                            <div className="stat-card-value">{sky.stats.categories}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-label">First star</div>
                            <div className="stat-card-value sky-stat-date">
                                {sky.stats.first_event ? fmtDate(sky.stats.first_event) : "—"}
                            </div>
                        </div>
                    </div>

                    <div className="sky-layout">
                        <div className="sky-canvas">
                            <svg
                                ref={svgRef}
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox={`0 0 ${W} ${H}`}
                                role="img"
                                aria-label={`${name}'s night sky with ${sky.stats.stars} stars`}
                            >
                                <defs>
                                    <linearGradient id="sky-bg" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#0b1030" />
                                        <stop offset="65%" stopColor="#1b2150" />
                                        <stop offset="100%" stopColor="#2c3474" />
                                    </linearGradient>
                                    <radialGradient id="sky-glow">
                                        <stop offset="0%" stopColor="#fff6d6" stopOpacity="0.9" />
                                        <stop offset="100%" stopColor="#f9c74f" stopOpacity="0" />
                                    </radialGradient>
                                </defs>

                                <rect width={W} height={H} fill="url(#sky-bg)" />
                                {dust.map((d, i) => (
                                    <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#ffffff" opacity={d.o} />
                                ))}

                                {lines.map((c) => (
                                    <g key={c.category}>
                                        <polyline
                                            points={c.members.map((s) => `${s.x},${s.y}`).join(" ")}
                                            fill="none"
                                            stroke={c.formed ? "#f9c74f" : "#ffffff"}
                                            strokeOpacity={c.formed ? 0.75 : 0.3}
                                            strokeWidth={c.formed ? 1.6 : 1}
                                            strokeDasharray={c.formed ? undefined : "4 5"}
                                        />
                                        {c.formed && (
                                            <text
                                                x={c.labelX} y={c.labelY} textAnchor="middle"
                                                fill="#f9c74f" fontSize="17" fontStyle="italic"
                                                fontFamily="Georgia, 'Times New Roman', serif"
                                            >
                                                {c.name}
                                            </text>
                                        )}
                                    </g>
                                ))}

                                {stars.map((s) => (
                                    <g
                                        key={s.ticket_number}
                                        className={`sky-star${selected === s.ticket_number ? " is-selected" : ""}`}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`${s.title}, ${fmtDate(s.date)}`}
                                        onClick={() => setSelected(s.ticket_number)}
                                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(s.ticket_number)}
                                    >
                                        <circle cx={s.x} cy={s.y} r={s.r * 4.5} fill="url(#sky-glow)" opacity="0.6" />
                                        <circle cx={s.x} cy={s.y} r={s.r} fill="#fffaf0" />
                                        <path
                                            d={`M${s.x - s.r * 3} ${s.y}H${s.x + s.r * 3}M${s.x} ${s.y - s.r * 3}V${s.y + s.r * 3}`}
                                            stroke="#fffaf0" strokeWidth="0.8" strokeOpacity="0.7"
                                        />
                                        <circle cx={s.x} cy={s.y} r={16} fill="transparent" />
                                    </g>
                                ))}

                                <text
                                    x="24" y={H - 22} fill="#c9cdea" fontSize="15"
                                    fontFamily="Georgia, 'Times New Roman', serif"
                                >
                                    {name}'s sky · {sky.stats.stars} {sky.stats.stars === 1 ? "star" : "stars"} · EventHub
                                </text>
                            </svg>

                            {empty && (
                                <div className="sky-empty">
                                    <div className="sky-empty-title">Your sky is still dark</div>
                                    <p>Go to an event and get your ticket scanned at the door to light your first star.</p>
                                    <Link to="/" className="btn btn-gold">Find an event →</Link>
                                </div>
                            )}
                        </div>

                        <aside className="sky-side">
                            {selectedStar ? (
                                <div className="sky-detail card card-pad">
                                    <div className="sky-detail-kicker">
                                        {selectedConst?.formed ? selectedConst.name : selectedStar.category_display}
                                    </div>
                                    <h3 className="sky-detail-title">{selectedStar.title}</h3>
                                    <div className="sky-detail-meta">📅 {fmtDate(selectedStar.date)}</div>
                                    <div className="sky-detail-meta">📍 {selectedStar.location}</div>
                                    <div className="sky-detail-meta">👥 {selectedStar.attendees} people booked</div>
                                    <Link to={`/events/${selectedStar.event_id}`} className="btn btn-outline btn-sm" style={{ marginTop: 12 }}>
                                        View event
                                    </Link>
                                </div>
                            ) : !empty && (
                                <div className="sky-hint">Tap a star to see which event lit it.</div>
                            )}

                            {sky.constellations.length > 0 && (
                                <div className="card card-pad">
                                    <h3 className="sky-side-title">Constellations</h3>
                                    <ul className="sky-const-list">
                                        {sky.constellations.map((c) => (
                                            <li key={c.category}>
                                                <div className="sky-const-row">
                                                    <span className="sky-const-name">{c.name}</span>
                                                    {c.formed
                                                        ? <span className="badge badge-success">Formed</span>
                                                        : <span className="sky-const-need">{c.needed} more</span>}
                                                </div>
                                                <div className="sky-const-dots" aria-label={`${c.count} of ${sky.constellation_min}`}>
                                                    {Array.from({ length: Math.max(c.count, sky.constellation_min) }, (_, i) => (
                                                        <i key={i} className={i < c.count ? "lit" : ""} />
                                                    ))}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </aside>
                    </div>

                    <MemoryPostcards />
                </>
            )}
        </div>
    );
}
