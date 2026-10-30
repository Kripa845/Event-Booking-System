import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BackButton from "../components/BackButton";
import api, { getImageUrl } from "../services/api";
import WeatherCard from "../components/WeatherCard";
import { useLang } from "../context/LanguageContext";
import { loadTicketList, saveTicket, saveTicketList } from "../utils/offlineTickets";

function formatDate(d) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function TicketStatusBadge({ status }) {
    const map = {
        VALID:      "badge-success",
        USED:       "badge-primary",
        CANCELLED:  "badge-danger",
    };
    return <span className={`badge ${map[status] || "badge-muted"}`}>{status}</span>;
}

function MyTickets() {
    const { t } = useLang();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [transferFor, setTransferFor] = useState(null);   // ticket id with the form open
    const [transferEmail, setTransferEmail] = useState("");
    const [transferring, setTransferring] = useState(false);

    const fetchData = async () => {
        try {
            const res = await api.get("tickets/");
            const list = res.data.results ?? res.data;
            setTickets(list);
            // Save the list and every valid ticket (with its QR) for offline use at the door.
            saveTicketList(list);
            list.filter((t) => t.status === "VALID").forEach((t) => saveTicket(t, getImageUrl(t.qr_code)));
        } catch (err) {
            const saved = !err.response && loadTicketList();
            if (saved) {
                setTickets(saved);
                setNotice("You're offline. Showing the tickets saved on this device.");
            } else {
                setError("Failed to load tickets.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const cancelTicket = async (ticket) => {
        // ticket.booking_id is returned directly by the serializer
        if (!ticket.booking_id) { setError("Could not find booking to cancel."); return; }
        try {
            setCancelling(ticket.id);
            setError("");
            await api.post(`bookings/${ticket.booking_id}/cancel/`);
            await fetchData();
        } catch (err) {
            setError(err.response?.data?.error || "Cancellation failed.");
        } finally {
            setCancelling(null);
        }
    };

    const openTransfer = (ticket) => {
        setTransferFor(ticket.id);
        setTransferEmail("");
        setError("");
        setNotice("");
    };

    const sendTicket = async (e, ticket) => {
        e.preventDefault();
        setTransferring(true);
        setError("");
        try {
            const res = await api.post(`tickets/${ticket.id}/transfer/`, { email: transferEmail.trim() });
            setTransferFor(null);
            await fetchData();
            setNotice(res.data.message);
        } catch (err) {
            setError(err.response?.data?.error || "Transfer failed.");
        } finally {
            setTransferring(false);
        }
    };

    if (loading) return (
        <div className="spinner-wrap" style={{ minHeight: "60vh" }}>
            <div className="spinner" />
        </div>
    );

    return (
        <div className="container page">
            <BackButton />
            <div className="section-header">
                <div>
                    <h1 className="page-title">{t("tickets.title")}</h1>
                    <p className="page-subtitle">{t("tickets.subtitle")}</p>
                </div>
                <Link to="/" className="btn btn-outline">{t("tickets.browse")}</Link>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {notice && <div className="alert alert-success">{notice}</div>}

            {tickets.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🎟️</div>
                    <div className="empty-state-title">No tickets yet</div>
                    <div className="empty-state-text">
                        Browse events and book your first ticket.
                    </div>
                </div>
            ) : (
                <div className="tickets-grid">
                    {tickets.map((ticket) => (
                        <div key={ticket.id} className="ticket-card">
                            <div className="ticket-card-header">
                                <div className="ticket-card-event">{ticket.event_title}</div>
                                <div className="ticket-card-user">👤 {ticket.username}</div>
                                {ticket.transferred_from && (
                                    <div className="ticket-card-gift">🎁 Sent to you by {ticket.transferred_from}</div>
                                )}
                            </div>

                            <div className="ticket-card-body">
                                <div className="ticket-card-row">
                                    <span>Date</span>
                                    <span>{formatDate(ticket.event_date)}</span>
                                </div>
                                <div className="ticket-card-row">
                                    <span>Location</span>
                                    <span>{ticket.location}</span>
                                </div>
                                <hr className="ticket-divider" />
                                <div className="ticket-card-row">
                                    <span>Ticket ID</span>
                                    <span style={{ fontFamily: "monospace", fontSize: "12px" }}>
                                        {ticket.ticket_number}
                                    </span>
                                </div>
                                <div className="ticket-card-row">
                                    <span>Status</span>
                                    <TicketStatusBadge status={ticket.status} />
                                </div>
                                {ticket.is_outdoor && ticket.status === "VALID" && (
                                    <WeatherCard eventId={ticket.event_id} compact />
                                )}
                                {ticket.checked_in_at && (
                                    <div className="ticket-card-row">
                                        <span>Checked in</span>
                                        <span>{new Date(ticket.checked_in_at).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>

                            {ticket.qr_code && ticket.status !== "CANCELLED" && (
                                <div className="ticket-qr-wrap">
                                    <img
                                         src={getImageUrl(ticket.qr_code)}
                                        alt="QR Code"
                                    />
                                    <div className="ticket-qr-number">{ticket.ticket_number}</div>
                                    <Link to={`/my-tickets/${ticket.id}`} className="btn btn-primary btn-sm">
                                        🎟️ View &amp; save ticket
                                    </Link>
                                </div>
                            )}

                            {transferFor === ticket.id ? (
                                <form className="transfer-form" onSubmit={(e) => sendTicket(e, ticket)}>
                                    <label className="form-label" htmlFor={`transfer-${ticket.id}`}>
                                        Send this ticket to
                                    </label>
                                    <input
                                        id={`transfer-${ticket.id}`} type="email" required autoFocus
                                        className="form-input" placeholder="friend@example.com"
                                        value={transferEmail} onChange={(e) => setTransferEmail(e.target.value)}
                                    />
                                    <p className="form-hint">
                                        They need an EventHub account. Your QR code stops working and they get a
                                        new one, at the price you paid. No resale markups.
                                    </p>
                                    <div className="transfer-actions">
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTransferFor(null)}>
                                            Back
                                        </button>
                                        <button type="submit" className="btn btn-primary btn-sm" disabled={transferring}>
                                            {transferring ? "Sending…" : "Send ticket"}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="ticket-card-footer">
                                    {ticket.transferred_to
                                        ? <span className="badge badge-muted">Sent to {ticket.transferred_to}</span>
                                        : <TicketStatusBadge status={ticket.status} />}
                                    {ticket.status === "VALID" && (
                                        <div className="ticket-card-actions">
                                            <button className="btn btn-outline btn-sm" onClick={() => openTransfer(ticket)}>
                                                Transfer
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => cancelTicket(ticket)}
                                                disabled={cancelling === ticket.id}
                                                title="Your seat goes to the next person on the waitlist"
                                            >
                                                {cancelling === ticket.id ? "Cancelling..." : "Cancel"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default MyTickets;
