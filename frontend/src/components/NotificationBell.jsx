import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";

const POLL_MS = 30000;

function timeAgo(iso) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Bell icon with an unread count; opening it shows the latest notifications. */
function NotificationBell() {
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);

    const load = useCallback(() => {
        api.get("notifications/")
            .then((res) => {
                setItems(res.data.results);
                setUnread(res.data.unread);
            })
            .catch(() => { /* not critical; try again on the next poll */ });
    }, []);

    // Check now, every 30 seconds, and whenever the tab comes back into focus.
    useEffect(() => {
        load();
        const timer = setInterval(load, POLL_MS);
        window.addEventListener("focus", load);
        return () => {
            clearInterval(timer);
            window.removeEventListener("focus", load);
        };
    }, [load]);

    // Close when clicking anywhere outside the dropdown.
    useEffect(() => {
        if (!open) return;
        const close = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);

    const toggle = () => {
        const next = !open;
        setOpen(next);
        // Opening the list counts as reading it. Items keep their "new" dot until next load.
        if (next && unread > 0) {
            setUnread(0);
            api.post("notifications/read/").catch(() => {});
        }
    };

    return (
        <div className="notif" ref={boxRef}>
            <button
                type="button" className="notif-btn" onClick={toggle}
                aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
                aria-expanded={open}
            >
                🔔
                {unread > 0 && <span className="notif-count">{unread > 9 ? "9+" : unread}</span>}
            </button>

            {open && (
                <div className="notif-panel" role="dialog" aria-label="Notifications">
                    <div className="notif-head">Notifications</div>
                    {items.length === 0 ? (
                        <div className="notif-empty">Nothing yet. We'll let you know when something happens.</div>
                    ) : (
                        <ul className="notif-list">
                            {items.map((n) => (
                                <li key={n.id} className={n.read ? "" : "is-new"}>
                                    <div className="notif-title">{n.title}</div>
                                    <div className="notif-msg">{n.message}</div>
                                    <div className="notif-time">{timeAgo(n.created_at)}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

export default NotificationBell;
