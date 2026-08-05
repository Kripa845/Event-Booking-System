import { Link } from "react-router-dom";

function EventCard({ event }) {
    return (
        <div className="event-card">

            <h2>{event.title}</h2>

            <p>{event.description}</p>

            <p>📅 {event.date}</p>

            <p>📍 {event.location}</p>

            <p>💰 NPR {event.price}</p>

            <p>
                🎟️ {event.available_seats} seats available
            </p>

            <Link to={`/events/${event.id}`}>
                View Event
            </Link>

        </div>
    );
}

export default EventCard;