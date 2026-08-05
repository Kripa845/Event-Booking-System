import { useState } from "react";
import api from "../services/api";

function CheckIn() {

    const [ticketNumber, setTicketNumber] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const handleCheckIn = async (e) => {

        e.preventDefault();

        setMessage("");
        setError("");

        try {

            const response = await api.post(
                "tickets/check-in/",
                {
                    ticket_number: ticketNumber,
                }
            );

            setMessage(response.data.detail);

            setTicketNumber("");

        } catch (error) {

            setError(
                error.response?.data?.detail ||
                "Check-in failed."
            );
        }
    };

    return (
        <main>

            <h1>Check In Attendee</h1>

            <form onSubmit={handleCheckIn}>

                <input
                    value={ticketNumber}
                    onChange={(e) =>
                        setTicketNumber(e.target.value)
                    }
                    placeholder="Scan or enter ticket number"
                />

                <button type="submit">
                    Check In
                </button>

            </form>

            {message && (
                <p>{message}</p>
            )}

            {error && (
                <p>{error}</p>
            )}

        </main>
    );
}

export default CheckIn;