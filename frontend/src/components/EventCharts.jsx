import { useState } from "react";

const W = 640, H = 200;                       // SVG coordinate space (scales to the container)
const PAD = { top: 12, right: 8, bottom: 26, left: 34 };
const GAP = 2;                                // surface gap between neighbouring bars

/** Bar path with 4px rounded top corners, flat on the baseline. */
function barPath(x, y, w, base) {
    const r = Math.min(4, w / 2, base - y);
    return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`;
}

/** Single-series bar chart with a hover tooltip on every bar and a table view. */
function BarChart({ title, data, valueLabel }) {
    const [hover, setHover] = useState(null);
    if (data.length === 0) return null;

    const max = Math.max(1, ...data.map((d) => d.value));
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const base = PAD.top + plotH;
    const slot = plotW / data.length;
    const barW = Math.max(1, slot - GAP);
    const y = (v) => base - (v / max) * plotH;
    const every = Math.ceil(data.length / 7);   // show about 7 x-axis labels

    return (
        <figure className="chart">
            <figcaption className="chart-title">{title}</figcaption>
            <div className="chart-plot">
                <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, bar chart`}>
                    {/* recessive grid: max line and baseline */}
                    <line x1={PAD.left} x2={W - PAD.right} y1={y(max)} y2={y(max)} className="chart-grid" />
                    <line x1={PAD.left} x2={W - PAD.right} y1={base} y2={base} className="chart-axis" />
                    <text x={PAD.left - 6} y={y(max) + 4} textAnchor="end" className="chart-tick">{max}</text>
                    <text x={PAD.left - 6} y={base + 4} textAnchor="end" className="chart-tick">0</text>

                    {data.map((d, i) => {
                        const x = PAD.left + i * slot + GAP / 2;
                        return (
                            <g key={d.label}>
                                {d.value > 0 && (
                                    <path d={barPath(x, y(d.value), barW, base)}
                                        className={`chart-bar${hover === i ? " is-hover" : ""}`} />
                                )}
                                {i % every === 0 && (
                                    <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="chart-tick">{d.short}</text>
                                )}
                                {/* full-height hit target, bigger than the bar */}
                                <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent"
                                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
                            </g>
                        );
                    })}
                </svg>
                {hover !== null && (
                    <div className="chart-tooltip" style={{
                        left: `${((PAD.left + (hover + 0.5) * slot) / W) * 100}%`,
                        top: `${(y(data[hover].value) / H) * 100}%`,
                    }}>
                        <strong>{data[hover].value}</strong> {valueLabel}
                        <span>{data[hover].label}</span>
                    </div>
                )}
            </div>
            <details className="chart-table">
                <summary>Show as table</summary>
                <table>
                    <thead><tr><th>When</th><th>{valueLabel}</th></tr></thead>
                    <tbody>
                        {data.filter((d) => d.value > 0).map((d) => (
                            <tr key={d.label}><td>{d.label}</td><td>{d.value}</td></tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </figure>
    );
}

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Bookings made per day, from the first booking to the last, empty days included. */
function bookingsPerDay(attendees) {
    const dates = attendees.map((a) => new Date(a.booked_at)).filter((d) => !isNaN(d));
    if (dates.length === 0) return [];
    const counts = {};
    dates.forEach((d) => { counts[dayKey(d)] = (counts[dayKey(d)] || 0) + 1; });
    const start = new Date(Math.min(...dates)); start.setHours(0, 0, 0, 0);
    const end = new Date(Math.max(...dates)); end.setHours(0, 0, 0, 0);
    const out = [];
    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
        out.push({
            label: d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }),
            short: d.toLocaleDateString([], { month: "short", day: "numeric" }),
            value: counts[dayKey(d)] || 0,
        });
    }
    return out;
}

/** Arrivals per 15 minutes (local time), from the first entry to the last. */
function arrivalsPer15Min(entries) {
    const SLOT = 15 * 60 * 1000;
    const times = entries.map((e) => new Date(e.entered_at).getTime()).filter((t) => !isNaN(t));
    if (times.length === 0) return [];
    const first = Math.floor(Math.min(...times) / SLOT) * SLOT;
    const last = Math.floor(Math.max(...times) / SLOT) * SLOT;
    const counts = {};
    times.forEach((t) => { const k = Math.floor(t / SLOT) * SLOT; counts[k] = (counts[k] || 0) + 1; });
    const out = [];
    for (let t = first; t <= last; t += SLOT) {
        const time = new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        out.push({ label: `${time} – ${new Date(t + SLOT).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`, short: time, value: counts[t] || 0 });
    }
    return out;
}

/** Organizer analytics for one event, built from data the attendees page already loads. */
export default function EventCharts({ attendees, entries }) {
    const perDay = bookingsPerDay(attendees);
    const arrivals = arrivalsPer15Min(entries);
    if (perDay.length === 0 && arrivals.length === 0) return null;

    const peak = arrivals.reduce((best, d) => (d.value > (best?.value ?? 0) ? d : best), null);

    return (
        <section className="charts">
            <BarChart title="Bookings per day" data={perDay} valueLabel="bookings" />
            {arrivals.length > 0 && (
                <div>
                    <BarChart title="Arrivals every 15 minutes" data={arrivals} valueLabel="arrivals" />
                    {peak && <p className="chart-note">Busiest at the door: <strong>{peak.label}</strong> ({peak.value} arrivals).</p>}
                </div>
            )}
        </section>
    );
}
