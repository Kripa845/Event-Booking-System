import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BackButton from "../components/BackButton";
import api from "../services/api";

function Waitlist() {
    const { id } = useParams();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [joined, setJoined] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        api.get(`events/${id}/`)
            .then((r) => setEvent(r.data))
            .catch(() => {});
    }, [id]);

    const joinWaitlist = async () => {
        try {
            setLoading(true);
            setError("");
            await api.post("waitlist/", { event: id });
            setJoined(true);
        } catch (err) {
            setError(
                err.response?.data?.error ||
                err.response?.data?.detail ||
                "Failed to join waitlist."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container page">
            <BackButton />
            <div className="waitlist-card">
                <div className="waitlist-icon">📋</div>
                <h1 className="waitlist-title">
                    {joined ? "You're on the waitlist!" : "Join the Waitlist"}
                </h1>
                {event && (
                    <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--primary)", marginBottom: "8px" }}>
                        {event.title}
                    </p>
                )}
                <p className="waitlist-desc">
                    {joined
                        ? "We'll notify you as soon as a seat opens up. You can manage your waitlist entries in your profile."
                        : "This event is sold out. Join the waitlist and we'll let you know if a seat becomes available."}
                </p>

                {error && <div className="alert alert-error">{error}</div>}

                {!joined ? (
                    <button
                        className="btn btn-primary btn-lg btn-full"
                        onClick={joinWaitlist}
                        disabled={loading}
                    >
                        {loading ? "Joining..." : "Join Waitlist"}
                    </button>
                ) : (
                    <Link to="/" className="btn btn-outline btn-full">
                        Browse More Events
                    </Link>
                )}

                <div style={{ marginTop: "16px" }}>
                    <Link to={`/events/${id}`} className="btn btn-ghost btn-sm">
                        ← Back to event
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Waitlist;
