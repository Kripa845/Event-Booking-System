import { useId, useMemo } from "react";

/* Hand-drawn style SVG illustrations for the night-sky landing page.
   Everything is generated from a fixed seed so it looks the same on every render. */

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

export function Starfield({ count = 140, seed = 3, className = "" }) {
    const stars = useMemo(() => {
        const rand = seeded(seed);
        return Array.from({ length: count }, (_, i) => ({
            x: rand() * 100,
            y: rand() * 100,
            r: 0.4 + rand() * 1.1,
            o: 0.35 + rand() * 0.65,
            twinkle: i % 7 === 0,
            delay: rand() * 4,
        }));
    }, [count, seed]);

    return (
        <svg className={className} width="100%" height="100%" aria-hidden="true">
            {stars.map((s, i) => (
                <circle
                    key={i}
                    cx={`${s.x}%`} cy={`${s.y}%`} r={s.r}
                    fill="#fff" opacity={s.o}
                    className={s.twinkle ? "lk-twinkle" : undefined}
                    style={s.twinkle ? { animationDelay: `${s.delay}s` } : undefined}
                />
            ))}
        </svg>
    );
}

export function Constellation({ points, className = "", style }) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const w = Math.max(...xs) + 8;
    const h = Math.max(...ys) + 8;
    return (
        <svg className={className} style={style} viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
            <polyline
                points={points.map((p) => p.join(",")).join(" ")}
                fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1"
            />
            {points.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={i % 3 === 0 ? 2.6 : 1.8} fill="#fff" />
            ))}
        </svg>
    );
}

export function PaperPlane({ className = "", size = 64 }) {
    return (
        <svg className={className} width={size} height={size * 0.7} viewBox="0 0 100 70" aria-hidden="true">
            <path d="M2 34 L98 2 L44 44 Z" fill="#ffffff" />
            <path d="M44 44 L98 2 L56 66 Z" fill="#dfe3f7" />
            <path d="M44 44 L50 60 L56 66 Z" fill="#b9bfe3" />
        </svg>
    );
}

/** A bank of puffy clouds. Billows rise from the bottom; the base is solid. */
export function CloudBank({
    className = "", seed = 7, tone = "light", height = 320, edges = true,
    width = 1440,                     // a wider canvas = smaller-looking clouds
    only = ["back", "mid", "front"],  // which layers to draw
}) {
    const id = useId().replace(/:/g, "");
    const palette = tone === "light"
        ? { back: ["#c9cde8", "#9aa1cc"], mid: ["#e4e6f5", "#b7bcdf"], front: ["#ffffff", "#d3d6ee"], base: "#eceefa" }
        : { back: ["#262d63", "#141a45"], mid: ["#1e2558", "#11163d"], front: ["#1a2050", "#0f1433"], base: "#0f1433" };

    // Each layer is many overlapping circles filled with ONE shared vertical
    // gradient, so they merge into a single soft silhouette instead of bubbles.
    const allLayers = useMemo(() => {
        const rand = seeded(seed);
        const row = (step, jitter, baseY, yJitter, r0, rJitter) => {
            const out = [];
            for (let x = -80; x < width + 100; x += step + rand() * jitter) {
                out.push({ cx: x, cy: baseY + rand() * yJitter, r: r0 + rand() * rJitter });
            }
            return out;
        };
        const back  = row(60, 50, height - 150, 60, 50, 45);
        const mid   = row(50, 40, height - 95, 45, 40, 38);
        const front = row(42, 34, height - 45, 30, 32, 30);
        if (edges) {
            back.push(
                { cx: 20, cy: height - 250, r: 95 }, { cx: 110, cy: height - 200, r: 80 },
                { cx: width - 20, cy: height - 260, r: 100 }, { cx: width - 110, cy: height - 205, r: 85 },
            );
            mid.push(
                { cx: 60, cy: height - 170, r: 85 }, { cx: 170, cy: height - 130, r: 70 },
                { cx: width - 60, cy: height - 175, r: 90 }, { cx: width - 170, cy: height - 130, r: 72 },
            );
        }
        return [["back", back], ["mid", mid], ["front", front]];
    }, [seed, height, edges, width]);
    const layers = allLayers.filter(([name]) => only.includes(name));

    return (
        <svg
            className={className} viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMax slice" aria-hidden="true"
        >
            <defs>
                {layers.map(([name]) => (
                    <linearGradient
                        key={name} id={`${name}${id}`}
                        gradientUnits="userSpaceOnUse" x1="0" y1={height * 0.25} x2="0" y2={height}
                    >
                        <stop offset="0%" stopColor={palette[name][0]} />
                        <stop offset="100%" stopColor={palette[name][1]} />
                    </linearGradient>
                ))}
                <filter id={`soft${id}`} x="-5%" y="-5%" width="110%" height="110%">
                    <feGaussianBlur stdDeviation="1.6" />
                </filter>
            </defs>
            {layers.map(([name, circles]) => (
                <g key={name} fill={`url(#${name}${id})`} filter={`url(#soft${id})`}>
                    {circles.map((c, i) => <circle key={i} {...c} />)}
                </g>
            ))}
            <rect x="0" y={height - 30} width={width} height="30" fill={palette.base} />
        </svg>
    );
}

export function Moon({ size = 64 }) {
    const id = useId().replace(/:/g, "");
    return (
        <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
            <defs>
                <radialGradient id={`m${id}`} cx="35%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#a9b0d6" />
                </radialGradient>
            </defs>
            <circle cx="32" cy="32" r="26" fill={`url(#m${id})`} />
            <circle cx="24" cy="26" r="4" fill="#c3c8e4" opacity=".7" />
            <circle cx="38" cy="38" r="6" fill="#c3c8e4" opacity=".6" />
            <circle cx="40" cy="22" r="2.5" fill="#c3c8e4" opacity=".7" />
        </svg>
    );
}

/** Decorative QR-style pattern (not a scannable code). */
export function QrPattern({ size = 120, seed = 11, color = "#141a3d" }) {
    const n = 21;
    const cells = useMemo(() => {
        const rand = seeded(seed);
        const inFinder = (x, y) =>
            (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
        const out = [];
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                if (!inFinder(x, y) && rand() > 0.52) out.push([x, y]);
            }
        }
        return out;
    }, [seed]);

    const finder = (x, y) => (
        <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="7" height="7" fill={color} />
            <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
            <rect x={x + 2} y={y + 2} width="3" height="3" fill={color} />
        </g>
    );

    return (
        <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" aria-hidden="true">
            <rect width={n} height={n} fill="#fff" />
            {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} />)}
            {finder(0, 0)}
            {finder(n - 7, 0)}
            {finder(0, n - 7)}
        </svg>
    );
}

export function LockArt({ size = 84 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 84 84" fill="none" stroke="#e7e9f7" strokeWidth="2" aria-hidden="true">
            <path d="M26 36 V26 a16 16 0 0 1 32 0 V36" />
            <rect x="18" y="36" width="48" height="38" rx="6" />
            <circle cx="42" cy="52" r="5" />
            <path d="M42 57 V64" />
            <path d="M8 18 l3 0 M9.5 16.5 l0 3 M74 12 l4 0 M76 10 l0 4 M72 70 l3 0 M73.5 68.5 l0 3" stroke="#f9c74f" />
        </svg>
    );
}

export function StarMap({ size = 120 }) {
    return (
        <svg width={size} height={size * 0.8} viewBox="0 0 120 96" fill="none" aria-hidden="true">
            <path d="M6 14 L40 6 L78 16 L114 8 L110 84 L74 90 L38 82 L4 88 Z" stroke="#e7e9f7" strokeWidth="2" strokeLinejoin="round" />
            <path d="M40 6 L38 82 M78 16 L74 90" stroke="#e7e9f7" strokeWidth="1" opacity=".5" />
            <polyline points="22,30 46,40 60,30 84,50 98,36" stroke="#f9c74f" strokeWidth="1.2" />
            <polyline points="46,40 52,66 84,50" stroke="#f9c74f" strokeWidth="1.2" />
            {[[22, 30], [46, 40], [60, 30], [84, 50], [98, 36], [52, 66]].map(([x, y]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="2.4" fill="#fff" />
            ))}
        </svg>
    );
}
