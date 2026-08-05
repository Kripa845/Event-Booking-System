import { useState } from "react";
import { useParams } from "react-router-dom";

import api from "../services/api";

function Waitlist() {

    const { id } = useParams();

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const joinWaitlist = async () => {

        try {

            setLoading(true);
            setMessage("");
            setError("");

            await api.post(
                "waitlist/",
                {
                    event: id,
                }
            );

            setMessage(
                "You joined the waitlist successfully."
            );

        } catch (error) {

            console.error(error);

            setError(
                error.response?.data?.detail ||
                "Failed to join waitlist."
            );

        } finally {

            setLoading(false);
        }
    };

    return (
        <main>

            <h1>Join Waitlist</h1>

            {message && (
                <p>{message}</p>
            )}

            {error && (
                <p>{error}</p>
            )}

            <button
                onClick={joinWaitlist}
                disabled={loading}
            >
                {loading
                    ? "Joining..."
                    : "Join Waitlist"}
            </button>

        </main>
    );
}

export default Waitlist;