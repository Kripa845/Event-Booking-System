import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import BackButton from "../components/BackButton";
import api, { getImageUrl } from "../services/api";
import { useAuth } from "../context/AuthContext";

function formatDate(d) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function EventDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        api.get(`events/${id}/`)
            .then((r) => setEvent(r.data))
            .catch(() => setError("Event not found."))
            .finally(() => setLoading(false));
    }, [id]);

    const handleBooking = async () => {
        if (!isAuthenticated) { navigate("/login"); return; }
        try {
            setBooking(true);
            setError("");
            await api.post("bookings/", { event: event.id });
            setSuccess("🎉 Booking confirmed! Check your tickets.");
            // Refresh available seats
            const r = await api.get(`events/${id}/`);
            setEvent(r.data);
        } catch (err) {
            setError(err.response?.data?.error || "Booking failed. Please try again.");
        } finally {
            setBooking(false);
        }
    };

    if (loading) return (
        <div className="spinner-wrap" style={{ minHeight: "60vh" }}>
            <div className="spinner" />
        </div>
    );

    if (!event) return (
        <div className="container page">
            <div className="empty-state">
                <div className="empty-state-icon">😕</div>
                <div className="empty-state-title">Event not found</div>
            </div>
        </div>
    );

    const soldOut = event.available_seats === 0;
    const isFree = Number(event.price) === 0;

    return (
        <div className="container event-detail-page">
            <BackButton />

            <div className="event-detail-layout">
                {/* Left column */}
                <div>
                    {(event.banner || event.image) && !imgError ? (
                        <img
                            className="event-detail-img"
                            src={getImageUrl(event.banner || event.image)}
                            alt={event.title}
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="event-detail-img">🎪</div>
                    )}

                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px", flexWrap: "wrap" }}>
                        <span className={`badge ${soldOut ? "badge-danger" : "badge-success"}`}>
                            {soldOut ? "Sold Out" : "Available"}
                        </span>
                        <span className="badge badge-muted">{event.status}</span>
                        {isFree && <span className="badge badge-primary">Free</span>}
                    </div>

                    <h1 className="event-detail-title">{event.title}</h1>

                    <div className="event-detail-info">
                        <div className="event-detail-info-row">📅 {formatDate(event.date)}</div>
                        <div className="event-detail-info-row">⏰ {event.start_time} – {event.end_time}</div>
                        <div className="event-detail-info-row">📍 {event.location}</div>
                        <div className="event-detail-info-row">👤 Organized by <strong style={{ marginLeft: 4 }}>{event.organizer_name}</strong></div>
                    </div>

                    <div className="divider" />

                    <h3 style={{ fontWeight: 700, marginBottom: "10px" }}>About this event</h3>
                    <p className="event-detail-desc">{event.description}</p>
                </div>

                {/* Right column — booking card */}
                <div>
                    <div className="booking-card">
                        <div className="booking-card-price">
                            {isFree ? "Free" : `NPR ${Number(event.price).toLocaleString()}`}
                            {!isFree && <span> / ticket</span>}
                        </div>
                        <div className="booking-card-seats">
                            {soldOut
                                ? "😔 No seats available"
                                : `🎟️ ${event.available_seats} of ${event.capacity} seats remaining`}
                        </div>

                        {success && <div className="alert alert-success">{success}</div>}
                        {error   && <div className="alert alert-error">{error}</div>}

                        {!success && (
                            soldOut ? (
                                <Link
                                    to={`/events/${event.id}/waitlist`}
                                    className="btn btn-outline btn-full"
                                    style={{ marginBottom: "10px" }}
                                >
                                    📋 Join Waitlist
                                </Link>
                            ) : (
                                <button
                                    className="btn btn-primary btn-full btn-lg"
                                    onClick={handleBooking}
                                    disabled={booking}
                                    style={{ marginBottom: "10px" }}
                                >
                                    {booking ? "Booking..." : isFree ? "Register Free" : "Book Ticket"}
                                </button>
                            )
                        )}

                        {success && (
                            <Link to="/my-tickets" className="btn btn-success btn-full">
                                View My Tickets →
                            </Link>
                        )}

                        <p className="booking-card-organizer">
                            Hosted by <strong>{event.organizer_name}</strong>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EventDetails;
