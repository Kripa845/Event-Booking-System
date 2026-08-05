import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

function EventDetails() {

    const { id } = useParams();
    const navigate = useNavigate();

    const { isAuthenticated } = useAuth();

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {

        const fetchEvent = async () => {

            try {

                const response = await api.get(
                    `events/${id}/`
                );

                setEvent(response.data);

            } catch (error) {

                console.error(error);

                setError("Event not found.");

            } finally {

                setLoading(false);
            }
        };

        fetchEvent();

    }, [id]);

    const handleBooking = async () => {

        if (!isAuthenticated) {

            navigate("/login");

            return;
        }

        try {

            setBooking(true);
            setError("");

            const response = await api.post(
                "bookings/",
                {
                    event: event.id,
                }
            );

            console.log(
                "Booking created:",
                response.data
            );

            navigate("/my-tickets");

        } catch (error) {

            console.error(error);

            setError(
                error.response?.data?.detail ||
                "Booking failed."
            );

        } finally {

            setBooking(false);
        }
    };

    if (loading) {
        return <h2>Loading...</h2>;
    }

    if (!event) {
        return <h2>{error}</h2>;
    }

    return (
        <main>

            <h1>{event.title}</h1>

            <p>{event.description}</p>

            <p>
                📅 {event.date}
            </p>

            <p>
                ⏰ {event.start_time} -
                {" "}
                {event.end_time}
            </p>

            <p>
                📍 {event.location}
            </p>

            <p>
                💰 NPR {event.price}
            </p>

            <p>
                🎟️ {event.available_seats}
                {" "}
                seats available
            </p>

            {error && (
                <p>{error}</p>
            )}
          {event.available_seats > 0 ? (
            <button
                onClick={handleBooking}
                disabled={
                    booking} 
                    >
                    
                
            
                {booking
                    ? "Booking..."
                    : "Book Ticket"}
            </button>
                ) : (
       <Link to={`/events/${event.id}/waitlist`}>
        Join Waitlist
    </Link>
      
)}
</main>
    )}
 export default EventDetails;