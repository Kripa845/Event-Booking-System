import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import BackButton from "../components/BackButton";
import api, { getImageUrl } from "../services/api";
import { fmtBs, fmtTime } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { downloadIcs } from "../utils/download";
import { EventMap, EventReviews, FollowButton } from "../components/EventExtras";
import WeatherCard from "../components/WeatherCard";

function formatDate(d) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function EventDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, isOrganizer } = useAuth();
    const { t } = useLang();

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [imgError, setImgError] = useState(false);
    const [promoInput, setPromoInput] = useState("");
    const [promo, setPromo] = useState(null);         // { code, percent_off, price } once applied
    const [promoError, setPromoError] = useState("");
    const [friendsText, setFriendsText] = useState(""); // friends' emails, comma or newline separated

    const friendEmails = friendsText.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);

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
            const res = await api.post("bookings/", {
                event: event.id,
                promo_code: promo?.code || "",
                friends: friendEmails,
            });
            if (res.data.payment) {
                // Paid order: send the signed form to eSewa. Seats are held while the user pays.
                payWithEsewa(res.data.payment);
                return;
            }
            const friends = res.data.friends || [];
            setSuccess(friends.length
                ? `🎉 Booked! Tickets for you and ${friends.join(", ")}.`
                : "🎉 Booking confirmed! Check your tickets.");
            // Refresh available seats
            const r = await api.get(`events/${id}/`);
            setEvent(r.data);
        } catch (err) {
            setError(err.response?.data?.error || "Booking failed. Please try again.");
        } finally {
            setBooking(false);
        }
    };

    // eSewa needs a real form POST (not an API call), so build one and submit it.
    const payWithEsewa = ({ url, fields }) => {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = url;
        Object.entries(fields).forEach(([name, value]) => {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            input.value = value;
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
    };

    const applyPromo = async () => {
        if (!isAuthenticated) { navigate("/login"); return; }
        setPromoError("");
        try {
            const res = await api.post(`events/${id}/promo-check/`, { code: promoInput, seats: 1 + friendEmails.length });
            setPromo(res.data);
        } catch (err) {
            setPromo(null);
            setPromoError(err.response?.data?.error || "Couldn't check that code.");
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
    const earlyBird = event.pricing?.tier === "EARLY_BIRD";
    const price = event.pricing?.price ?? event.price;

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
                        {event.is_outdoor && <span className="badge badge-muted">🌳 Outdoor</span>}
                    </div>

                    <h1 className="event-detail-title">{event.title}</h1>

                    <div className="event-detail-info">
                        <div className="event-detail-info-row">
                            📅 {formatDate(event.date)}
                            <span className="event-detail-bs">{fmtBs(event.date, "np")}</span>
                        </div>
                        {event.holidays?.length > 0 && (
                            <div className="event-detail-info-row event-holiday-note">
                                🎉 Happens during {event.holidays.join(" & ")}, so expect festive crowds and busy roads.
                            </div>
                        )}
                        <div className="event-detail-info-row">⏰ {fmtTime(event.start_time)} – {fmtTime(event.end_time)}</div>
                        <div className="event-detail-info-row">📍 {event.location}</div>
                        <div className="event-detail-info-row">👤 {t("event.organizedBy")} <strong style={{ marginLeft: 4 }}>{event.organizer_name}</strong><FollowButton organizerId={event.organizer} /></div>
                    </div>

                    <div className="divider" />

                    <h3 style={{ fontWeight: 700, marginBottom: "10px" }}>{t("event.about")}</h3>
                    <p className="event-detail-desc">{event.description}</p>

                    <EventMap event={event} />
                    <EventReviews eventId={event.id} />
                </div>

                {/* Right column — booking card */}
                <div>
                    <div className="booking-card">
                        {earlyBird && (
                            <div className="booking-early">
                                Early-bird price, {event.pricing.discount}% off.
                                Only {event.pricing.left_at_price} left before it goes up to
                                NPR {Number(event.price).toLocaleString()}.
                            </div>
                        )}
                        <div className="booking-card-price">
                            {isFree ? "Free" : `NPR ${Number(price).toLocaleString()}`}
                            {!isFree && <span> {t("event.perTicket")}</span>}
                            {earlyBird && <s className="booking-was">NPR {Number(event.price).toLocaleString()}</s>}
                        </div>
                        <div className="booking-card-seats">
                            {soldOut
                                ? t("event.noSeats")
                                : `🎟️ ${event.available_seats} ${t("event.of")} ${event.capacity} ${t("event.seatsRemaining")}`}
                        </div>

                        {success && <div className="alert alert-success">{success}</div>}
                        {error   && <div className="alert alert-error">{error}</div>}

                        {isOrganizer && (
                            <div className="alert alert-info">Organizer accounts can't book tickets.</div>
                        )}

                        {!success && !isOrganizer && !soldOut && !isFree && (
                            <div className="booking-extra">
                                <div className="booking-promo">
                                    <input
                                        aria-label="Promo code" placeholder="Promo code" maxLength={30}
                                        value={promoInput} onChange={(e) => { setPromoInput(e.target.value); setPromo(null); }}
                                    />
                                    <button type="button" className="btn btn-outline btn-sm" onClick={applyPromo} disabled={!promoInput.trim()}>
                                        Apply
                                    </button>
                                </div>
                                {promo && (
                                    <div className="booking-promo-ok">
                                        {promo.code}: {promo.percent_off}% off → NPR {Number(promo.price).toLocaleString()} per ticket
                                    </div>
                                )}
                                {promoError && <div className="booking-promo-err">{promoError}</div>}
                            </div>
                        )}

                        {!success && !isOrganizer && !soldOut && (
                            <details className="booking-friends">
                                <summary>Book for friends too</summary>
                                <textarea
                                    aria-label="Friends' emails" rows={2}
                                    placeholder="Friends' EventHub emails, separated by commas (up to 5)"
                                    value={friendsText} onChange={(e) => setFriendsText(e.target.value)}
                                />
                                {friendEmails.length > 0 && (
                                    <div className="booking-friends-note">
                                        {1 + friendEmails.length} tickets: you + {friendEmails.length} friend{friendEmails.length > 1 ? "s" : ""}.
                                        Each gets their own QR ticket.
                                    </div>
                                )}
                            </details>
                        )}

                        {!success && !isOrganizer && (
                            soldOut ? (
                                <Link
                                    to={`/events/${event.id}/waitlist`}
                                    className="btn btn-outline btn-full"
                                    style={{ marginBottom: "10px" }}
                                >
                                    {t("event.waitlist")}
                                </Link>
                            ) : (
                                <button
                                    className="btn btn-gold btn-full btn-lg"
                                    onClick={handleBooking}
                                    disabled={booking}
                                    style={{ marginBottom: "10px" }}
                                >
                                    {booking ? t("event.booking")
                                        : friendEmails.length ? `Book ${1 + friendEmails.length} tickets`
                                        : isFree ? t("event.registerFree") : `${t("event.book")} · eSewa`}
                                </button>
                            )
                        )}

                        {success && (
                            <Link to="/my-tickets" className="btn btn-success btn-full">
                                {t("event.viewTickets")}
                            </Link>
                        )}

                        <button
                            type="button" className="btn btn-ghost btn-sm btn-full"
                            onClick={() => downloadIcs({
                                id: event.id, title: event.title, date: event.date,
                                start: event.start_time, end: event.end_time,
                                location: event.venue ? `${event.venue}, ${event.location}` : event.location,
                                description: `EventHub: ${window.location.href}`,
                            })}
                        >
                            {t("event.calendar")}
                        </button>

                        <p className="booking-card-organizer">
                            Hosted by <strong>{event.organizer_name}</strong>
                        </p>
                    </div>
                    {event.is_outdoor && <WeatherCard eventId={event.id} />}
                </div>
            </div>
        </div>
    );
}

export default EventDetails;
