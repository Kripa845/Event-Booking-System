import * as NDC from "nepali-date-converter";

// The package is CommonJS; depending on the bundler the class is either the default export or nested in it.
const NepaliDate = typeof NDC.default === "function" ? NDC.default : NDC.default?.default;

/** "16:55:00" -> "4:55 PM" */
export function fmtTime(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "2026-08-27" -> "Bhadra 11, 2083" (or "भाद्र ११, २०८३" with lang "np"). Empty if out of range. */
export function fmtBs(isoDate, lang = "en") {
    if (!isoDate || !NepaliDate) return "";
    try {
        const [y, m, d] = String(isoDate).slice(0, 10).split("-").map(Number);
        return new NepaliDate(new Date(y, m - 1, d)).format("MMMM D, YYYY", lang);
    } catch {
        return "";
    }
}

/** "Today" / "Tomorrow" / "in 5 days" / "3 days ago" for a YYYY-MM-DD date. */
export function fromNow(isoDate) {
    if (!isoDate) return "";
    const [y, m, d] = String(isoDate).slice(0, 10).split("-").map(Number);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(y, m - 1, d) - today) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days === -1) return "Yesterday";
    return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** Local YYYY-MM-DD for today (for comparing with API dates). */
export function todayIso() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function greeting() {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function fmtDay(isoDate) {
    if (!isoDate) return "";
    const [y, m, d] = String(isoDate).slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
