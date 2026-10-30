import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

/** OpenStreetMap of the event's town, plus a Google Maps link for exact directions. */
export function EventMap({ event }) {
    const [spot, setSpot] = useState(null);

    useEffect(() => {
        api.get(`events/${event.id}/map/`).then((r) => setSpot(r.data)).catch(() => setSpot(null));
    }, [event.id]);

    const query = encodeURIComponent([event.venue, event.location, "Nepal"].filter(Boolean).join(", "));
    const directions = `https://www.google.com/maps/search/?api=1&query=${query}`;

    if (!spot?.available) {
        return (
            <a className="btn btn-outline btn-sm" href={directions} target="_blank" rel="noreferrer" style={{ marginTop: 16 }}>
                🗺️ Open in Google Maps
            </a>
        );
    }

    const d = 0.02;   // about 2 km around the point
    const bbox = [spot.lon - d, spot.lat - d, spot.lon + d, spot.lat + d].join(",");
    return (
        <section className="event-map">
            <h3 className="section-title">Where</h3>
            <iframe
                title={`Map of ${spot.place}`}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${spot.lat},${spot.lon}`}
                loading="lazy"
            />
            <div className="event-map-foot">
                <span>Approximate area: {spot.place}</span>
                <a href={directions} target="_blank" rel="noreferrer">Directions in Google Maps →</a>
            </div>
        </section>
    );
}

/** Follow / unfollow the organizer (customers only). */
export function FollowButton({ organizerId }) {
    const { isAuthenticated, isCustomer } = useAuth();
    const [state, setState] = useState(null);   // { following, followers }

    useEffect(() => {
        if (!isAuthenticated || !isCustomer || !organizerId) return;
        api.get(`organizers/${organizerId}/follow/`).then((r) => setState(r.data)).catch(() => {});
    }, [isAuthenticated, isCustomer, organizerId]);

    if (!state) return null;

    const toggle = async () => {
        const res = state.following
            ? await api.delete(`organizers/${organizerId}/follow/`)
            : await api.post(`organizers/${organizerId}/follow/`);
        setState(res.data);
    };

    return (
        <button type="button" className={`btn btn-xs ${state.following ? "btn-outline" : "btn-primary"}`} onClick={toggle}
            title="Get notified when this organizer publishes a new event" style={{ marginLeft: 10 }}>
            {state.following ? "✓ Following" : "+ Follow"}
            {state.followers > 0 && <span style={{ opacity: 0.7 }}> · {state.followers}</span>}
        </button>
    );
}

/** Average rating and written reviews for an event. */
export function EventReviews({ eventId }) {
    const [data, setData] = useState(null);

    useEffect(() => {
        api.get(`events/${eventId}/reviews/`).then((r) => setData(r.data)).catch(() => setData(null));
    }, [eventId]);

    if (!data || data.ratings === 0) return null;

    return (
        <section className="event-reviews">
            <h3 className="section-title">
                Reviews <span className="section-count">{data.avg_rating}★ · {data.ratings}</span>
            </h3>
            {data.reviews.length === 0 ? (
                <p className="event-reviews-empty">{data.ratings} rating{data.ratings === 1 ? "" : "s"}, no written reviews yet.</p>
            ) : (
                <ul>
                    {data.reviews.map((r, i) => (
                        <li key={i}>
                            <div className="event-review-head">
                                <strong>{r.username}</strong>
                                <span aria-label={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                            </div>
                            <p>{r.comment}</p>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
