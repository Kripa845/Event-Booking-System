import { useCallback, useEffect, useRef, useState } from "react";
import BackButton from "../components/BackButton";
import CameraScanner from "../components/CameraScanner";
import api from "../services/api";
import {
    checkInOffline, downloadPack, isNetworkError, loadPack, markUsedLocally, savedEvents, syncPack,
} from "../services/offlineCheckin";

const EVENT_KEY = "eh-checkin-event";

function timeAgo(iso) {
    if (!iso) return "";
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function entryTime(iso) {
    return new Date(iso || Date.now()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Turn a failed live check-in into the message shown to the organizer.
function errorMessage(data) {
    if (data?.code === "already_used" && data.checked_in_at) {
        const at = new Date(data.checked_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        return `Already checked in at ${at}.`;
    }
    return data?.error || data?.detail || "Check-in failed.";
}

function CheckIn() {
    const inputRef = useRef(null);
    const [online, setOnline] = useState(navigator.onLine);
    const [events, setEvents] = useState([]);
    const [eventId, setEventId] = useState(() => {
        try { return localStorage.getItem(EVENT_KEY) || ""; } catch { return ""; }
    });
    const [pack, setPack] = useState(null);
    const [ticketNumber, setTicketNumber] = useState("");
    const [result, setResult] = useState(null);   // { success, offline?, data?, message? }
    const [loading, setLoading] = useState(false);
    const [packBusy, setPackBusy] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncNote, setSyncNote] = useState(null); // { synced, conflicts } | { error }
    const [mode, setMode] = useState("manual");     // "manual" | "camera"
    const [cameraError, setCameraError] = useState(null);

    const refreshPack = useCallback(() => setPack(eventId ? loadPack(eventId) : null), [eventId]);

    // Online/offline indicator
    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener("online", up);
        window.addEventListener("offline", down);
        return () => {
            window.removeEventListener("online", up);
            window.removeEventListener("offline", down);
        };
    }, []);

    // Events this organizer can check in to (falls back to downloaded ones when offline)
    useEffect(() => {
        api.get("organizer/events/")
            .then((res) => setEvents(res.data))
            .catch(() => setEvents(savedEvents()));
    }, []);

    useEffect(() => {
        if (!eventId && events.length) {
            const today = new Date().toISOString().slice(0, 10);
            const upcoming = [...events]
                .filter((e) => String(e.date) >= today)
                .sort((a, b) => String(a.date).localeCompare(String(b.date)));
            setEventId(String((upcoming[0] || events[0]).id));
        }
    }, [events, eventId]);

    useEffect(() => {
        try { if (eventId) localStorage.setItem(EVENT_KEY, eventId); } catch { /* storage unavailable */ }
        refreshPack();
        setResult(null);
        setSyncNote(null);
    }, [eventId, refreshPack]);

    const sync = useCallback(async () => {
        if (!eventId || !loadPack(eventId)?.queue.length) return;
        setSyncing(true);
        try {
            setSyncNote(await syncPack(eventId));
        } catch (err) {
            if (isNetworkError(err)) setOnline(false);
            else setSyncNote({ error: err.response?.data?.error || "Sync failed." });
        } finally {
            setSyncing(false);
            refreshPack();
        }
    }, [eventId, refreshPack]);

    // Upload queued scans as soon as we're back online
    useEffect(() => {
        if (online) sync();
    }, [online, sync]);

    const handleDownload = async () => {
        setPackBusy(true);
        try {
            await downloadPack(eventId);
            refreshPack();
        } catch (err) {
            setResult({
                success: false,
                message: isNetworkError(err)
                    ? "Can't download while offline."
                    : err.response?.data?.error || "Download failed.",
            });
        } finally {
            setPackBusy(false);
        }
    };

    const runOffline = (number) => {
        const r = checkInOffline(eventId, number);
        refreshPack();
        setResult(r.ok
            ? { success: true, offline: true, data: { attendee: r.attendee, ticket_number: number, checked_in_at: new Date().toISOString() } }
            : { success: false, message: r.message, attendee: r.attendee });
        if (r.ok) setTicketNumber("");
    };

    // One path for every check-in: typed, hardware scanner, or camera.
    const submitNumber = async (number) => {
        if (!number || !eventId) return;
        setResult(null);

        if (!online) {
            runOffline(number);
            inputRef.current?.focus();
            return;
        }

        setLoading(true);
        try {
            const res = await api.post("tickets/check-in/", { ticket_number: number, event_id: Number(eventId) });
            setResult({ success: true, data: res.data });
            markUsedLocally(eventId, number, res.data.checked_in_at);
            refreshPack();
            setTicketNumber("");
        } catch (err) {
            if (isNetworkError(err)) {
                // The connection dropped mid-scan: fall back to the offline list.
                setOnline(false);
                runOffline(number);
            } else {
                const data = err.response?.data;
                setResult({ success: false, message: errorMessage(data), attendee: data?.attendee });
            }
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleCheckIn = (e) => {
        e.preventDefault();
        submitNumber(ticketNumber.trim());
    };

    const switchMode = (next) => {
        setMode(next);
        setCameraError(null);
        setResult(null);
    };

    // Camera failed to start: explain why and go back to typing.
    const handleCameraError = (message) => {
        setMode("manual");
        setCameraError(message);
    };

    const tickets = pack ? Object.values(pack.tickets) : [];
    const checkedIn = tickets.filter((t) => t.status === "USED").length;
    const active = tickets.filter((t) => t.status !== "CANCELLED").length;
    const pending = pack?.queue.length ?? 0;
    const selectedEvent = events.find((ev) => String(ev.id) === eventId) || pack?.event;

    return (
        <div className="container page">
            <BackButton />
            <div className="checkin-card">
                <div className="checkin-head">
                    <div>
                        <h1 className="page-title" style={{ marginBottom: "6px" }}>Attendee Check-In</h1>
                        <p className="page-subtitle">Scan or type a ticket number to check in.</p>
                    </div>
                    <span className={`net-pill ${online ? "is-online" : "is-offline"}`} role="status">
                        <i /> {online ? "Online" : "Offline"}
                    </span>
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="checkin-event">Event</label>
                    <select
                        id="checkin-event" className="form-select"
                        value={eventId} onChange={(e) => setEventId(e.target.value)}
                    >
                        {!eventId && <option value="">Choose an event…</option>}
                        {events.map((ev) => (
                            <option key={ev.id} value={ev.id}>{ev.title} · {ev.date}</option>
                        ))}
                        {selectedEvent && !events.some((ev) => String(ev.id) === eventId) && (
                            <option value={eventId}>{selectedEvent.title}</option>
                        )}
                    </select>
                </div>

                {eventId && (
                    <div className={`offline-pack${pack ? " is-ready" : ""}`}>
                        <div className="offline-pack-text">
                            {pack ? (
                                <>
                                    <strong>Ready for offline</strong>
                                    <span>
                                        {checkedIn} of {active} checked in · list updated {timeAgo(pack.generated_at)}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <strong>Not saved for offline</strong>
                                    <span>Download the ticket list so check-in keeps working if the internet drops.</span>
                                </>
                            )}
                        </div>
                        <button
                            type="button" className="btn btn-outline btn-sm"
                            onClick={handleDownload} disabled={packBusy || !online}
                        >
                            {packBusy ? "Saving…" : pack ? "Refresh list" : "Download for offline"}
                        </button>
                    </div>
                )}

                {pending > 0 && (
                    <div className="sync-bar">
                        <span>
                            <strong>{pending}</strong> {pending === 1 ? "scan" : "scans"} saved on this device, waiting to sync
                        </span>
                        <button type="button" className="btn btn-primary btn-sm" onClick={sync} disabled={!online || syncing}>
                            {syncing ? "Syncing…" : online ? "Sync now" : "Will sync when online"}
                        </button>
                    </div>
                )}

                <div className="checkin-mode" role="tablist" aria-label="How to check in">
                    <button
                        type="button" role="tab" aria-selected={mode === "camera"}
                        className={mode === "camera" ? "is-active" : ""}
                        onClick={() => switchMode("camera")}
                    >
                        Camera
                    </button>
                    <button
                        type="button" role="tab" aria-selected={mode === "manual"}
                        className={mode === "manual" ? "is-active" : ""}
                        onClick={() => switchMode("manual")}
                    >
                        Manual entry
                    </button>
                </div>

                {cameraError && <div className="alert alert-warning" style={{ marginBottom: 16 }}>{cameraError}</div>}

                {mode === "camera" ? (
                    eventId ? (
                        // Unmounting this (switching mode or leaving the page) turns the camera off.
                        <CameraScanner onCode={submitNumber} busy={loading} onError={handleCameraError} />
                    ) : (
                        <div className="alert alert-warning">Choose an event before scanning.</div>
                    )
                ) : (
                    <form onSubmit={handleCheckIn}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="ticket-number">Ticket Number</label>
                            <input
                                id="ticket-number" ref={inputRef} autoFocus autoComplete="off"
                                className="form-input"
                                value={ticketNumber}
                                onChange={(e) => setTicketNumber(e.target.value)}
                                placeholder="e.g. EVT-A3B2C1D4E5"
                                style={{ fontFamily: "monospace", fontSize: "15px" }}
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary btn-full btn-lg"
                            disabled={loading || !ticketNumber.trim() || !eventId}
                        >
                            {loading ? "Checking in..." : "Check In"}
                        </button>
                    </form>
                )}

                {result && (
                    <div className={`checkin-result ${result.success ? "success" : "error"}`} role="status">
                        <div className="checkin-result-icon">
                            {result.success ? "🎉" : "❌"}
                        </div>
                        <div className="checkin-result-title">
                            {result.success
                                ? result.offline ? "Welcome! (saved offline)" : "Welcome!"
                                : "Check-In Failed"}
                        </div>
                        {result.success ? (
                            <div className="checkin-result-detail">
                                <span className="checkin-result-name">{result.data.attendee}</span>
                                {result.data.event ? <>Enjoy <strong>{result.data.event}</strong>!</> : "Enjoy the event!"}
                                <br />
                                Entry recorded at <strong>{entryTime(result.data.checked_in_at)}</strong> · Ticket <code>{result.data.ticket_number}</code>
                                {result.offline && <><br />This will sync automatically when you're back online.</>}
                            </div>
                        ) : (
                            <div className="checkin-result-detail">
                                {result.attendee && <><strong>{result.attendee}</strong>: </>}
                                {result.message}
                            </div>
                        )}
                    </div>
                )}

                {syncNote && (
                    syncNote.error ? (
                        <div className="alert alert-error" style={{ marginTop: 16 }}>{syncNote.error}</div>
                    ) : (
                        <div className={`alert ${syncNote.conflicts.length ? "alert-warning" : "alert-success"}`} style={{ marginTop: 16 }}>
                            Synced {syncNote.synced} offline {syncNote.synced === 1 ? "scan" : "scans"}.
                            {syncNote.conflicts.length > 0 && (
                                <>
                                    {" "}{syncNote.conflicts.length} need a look:
                                    <ul className="sync-conflicts">
                                        {syncNote.conflicts.map((c) => (
                                            <li key={c.ticket_number}>
                                                <code>{c.ticket_number}</code>
                                                {c.attendee && <> ({c.attendee})</>}: {c.message}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

export default CheckIn;
