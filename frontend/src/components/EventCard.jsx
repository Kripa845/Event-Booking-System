import { useState } from "react";
import { Link } from "react-router-dom";
import { getImageUrl } from "../services/api";
import { fmtBs, fmtTime } from "../utils/format";
import { useLang } from "../context/LanguageContext";

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
    const earlyBird = event.pricing?.tier === "EARLY_BIRD";
    const price   = event.pricing?.price ?? event.price;
    const cat     = event.category || "OTHER";
    const emoji   = CAT_EMOJI[cat] || "🎪";
    const imgSrc  = getImageUrl(event.banner) || getImageUrl(event.image);
    const [imgError, setImgError] = useState(false);
    const { lang, t } = useLang();

    return (
        <div className="event-card">
            <div className="event-card-img">
                {imgSrc && !imgError ? (
                    <img
                        src={imgSrc}
                        alt={event.title}
                        loading="lazy"
                        onError={() => setImgError(true)}
                    />
                ) : emoji}
                <span className={`badge badge-cat-${cat} event-card-category`}>
                    {event.category_display || cat}
                </span>
            </div>

            <div className="event-card-body">
                <div className="event-card-title">{event.title}</div>
                <div className="event-card-meta">
                    <div className="event-card-meta-row">
                        <span className="event-card-meta-icon">📅</span>
                        <span>
                            {fmtDate(event.date)}
                            <span className="event-card-bs">{fmtBs(event.date, lang)}</span>
                        </span>
                    </div>
                    {event.holidays?.length > 0 && (
                        <div className="event-card-holiday">🎉 During {event.holidays.join(" & ")}</div>
                    )}
                    <div className="event-card-meta-row">
                        <span className="event-card-meta-icon">📍</span>
                        {event.venue ? `${event.venue}, ${event.location}` : event.location}
                    </div>
                    {event.start_time && (
                        <div className="event-card-meta-row">
                            <span className="event-card-meta-icon">⏰</span>
                            {fmtTime(event.start_time)}
                        </div>
                    )}
                </div>
            </div>

            <div className="event-card-footer">
                <div className="event-card-price-block">
                    <div className={`event-card-price${isFree ? " free" : ""}`}>
                        {isFree ? t("card.free") : `NPR ${Number(price).toLocaleString()}`}
                        {earlyBird && <s className="event-card-was">NPR {Number(event.price).toLocaleString()}</s>}
                    </div>
                    {earlyBird && !soldOut && (
                        <div className="event-card-early">{t("card.early")} · {event.pricing.left_at_price} {t("card.left")}</div>
                    )}
                    <div className={`event-card-seats${soldOut ? " sold-out" : ""}`}>
                        {soldOut ? t("card.soldOut") : `${event.available_seats} ${t("card.seatsLeft")}`}
                    </div>
                </div>
                <Link to={`/events/${event.id}`} className="btn btn-primary btn-sm">{t("card.view")}</Link>
            </div>
        </div>
    );
}
