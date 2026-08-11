import { useState } from "react";
import { Link } from "react-router-dom";
import { getImageUrl } from "../services/api";

const CAT_EMOJI = {
    WORKSHOP: "🛠️", SEMINAR: "📚", HACKATHON: "🏆", CONCERT: "🎵",
    CONFERENCE: "🎙️", SPORTS: "⚽", FESTIVAL: "🎉", COMPETITION: "🥇",
    MEETUP: "☕", OTHER: "🎪",
};

function fmtDate(d) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EventCard({ event }) {
    const soldOut = event.available_seats === 0;
    const isFree  = Number(event.price) === 0;
    const cat     = event.category || "OTHER";
    const emoji   = CAT_EMOJI[cat] || "🎪";
    const imgSrc  = getImageUrl(event.banner) || getImageUrl(event.image);
    const [imgError, setImgError] = useState(false);

    return (
        <div className="event-card">
            {imgSrc && !imgError ? (
                <img
                    className="event-card-img"
                    src={imgSrc}
                    alt={event.title}
                    style={{ display: "block" }}
                    onError={() => setImgError(true)}
                />
            ) : (
                <div className="event-card-img">
                    {emoji}
                    <span className={`badge badge-cat-${cat} event-card-category`}>
                        {event.category_display || cat}
                    </span>
                </div>
            )}
            {imgSrc && !imgError && (
                <div style={{ padding: "10px 16px 0" }}>
                    <span className={`badge badge-cat-${cat}`}>
                        {event.category_display || cat}
                    </span>
                </div>
            )}

            <div className="event-card-body">
                <div className="event-card-title">{event.title}</div>
                <div className="event-card-meta">
                    <div className="event-card-meta-row">
                        <span className="event-card-meta-icon">📅</span>
                        {fmtDate(event.date)}
                    </div>
                    <div className="event-card-meta-row">
                        <span className="event-card-meta-icon">📍</span>
                        {event.venue ? `${event.venue}, ${event.location}` : event.location}
                    </div>
                    {event.start_time && (
                        <div className="event-card-meta-row">
                            <span className="event-card-meta-icon">⏰</span>
                            {event.start_time}
                        </div>
                    )}
                </div>
            </div>

            <div className="event-card-footer">
                <div className="event-card-price-block">
                    <div className={`event-card-price${isFree ? " free" : ""}`}>
                        {isFree ? "Free" : `NPR ${Number(event.price).toLocaleString()}`}
                    </div>
                    <div className={`event-card-seats${soldOut ? " sold-out" : ""}`}>
                        {soldOut ? "Sold Out" : `${event.available_seats} seats left`}
                    </div>
                </div>
                <Link to={`/events/${event.id}`} className="btn btn-primary btn-sm">View →</Link>
            </div>
        </div>
    );
}
