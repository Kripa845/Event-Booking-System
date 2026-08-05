import { useEffect, useState } from "react";

import api from "../services/api";

function MyTickets() {

    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(null);
    const [error, setError] = useState("");

    const fetchTickets = async () => {

        try {

            const response = await api.get("tickets/");

            setTickets(response.data);

        } catch (error) {

            console.error(error);
            setError("Failed to load tickets.");

        } finally {

            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    const cancelTicket = async (ticket) => {

        try {

            setCancelling(ticket.id);
            setError("");

            await api.post(
                `bookings/${ticket.booking}/cancel/`
            );

            await fetchTickets();

        } catch (error) {

            console.error(error);

            setError(
                error.response?.data?.detail ||
                "Cancellation failed."
            );

        } finally {

            setCancelling(null);
        }
    };

    if (loading) {
        return <h2>Loading tickets...</h2>;
    }

    return (
        <main>

            <h1>My Tickets</h1>

            {error && (
                <p>{error}</p>
            )}

            {tickets.length === 0 ? (

                <p>
                    You don't have any tickets.
                </p>

            ) : (

                tickets.map((ticket) => (

                    <div
                        key={ticket.id}
                        className="event-card"
                    >

                        <h2>
                            {ticket.event_title}
                        </h2>

                        <p>
                            Ticket:
                            {" "}
                            {ticket.ticket_number}
                        </p>
                       {ticket.qr_code && (
        <img
            src={ticket.qr_code}
            alt="Ticket QR Code"
            width="200"
        />
    )}
                        <p>
                            Status:
                            {" "}
                            {ticket.status}
                        </p>

                        <p>
                            Check-in:
                            {" "}
                            {ticket.checked_in
                                ? "Checked In"
                                : "Not Checked In"}
                        </p>

                        {ticket.status === "CONFIRMED" && (
                            <button
                                onClick={() =>
                                    cancelTicket(ticket)
                                }
                                disabled={
                                    cancelling === ticket.id
                                }
                            >
                                {cancelling === ticket.id
                                    ? "Cancelling..."
                                    : "Cancel Ticket"}
                            </button>
                        )}

                    </div>

                ))

            )}

        </main>
    );
}

export default MyTickets;