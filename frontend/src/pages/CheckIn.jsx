import { useState } from "react";
import BackButton from "../components/BackButton";
import api from "../services/api";

function CheckIn() {
    const [ticketNumber, setTicketNumber] = useState("");
    const [result, setResult] = useState(null);   // { success: bool, data: {} }
    const [loading, setLoading] = useState(false);

    const handleCheckIn = async (e) => {
        e.preventDefault();
        if (!ticketNumber.trim()) return;
        setResult(null);
        setLoading(true);
        try {
            const res = await api.post("tickets/check-in/", {
                ticket_number: ticketNumber.trim(),
            });
            setResult({ success: true, data: res.data });
            setTicketNumber("");
        } catch (err) {
            const data = err.response?.data;
            setResult({
                success: false,
                message: data?.error || data?.detail || "Check-in failed.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container page">
            <BackButton />
            <div className="checkin-card">
                <h1 className="page-title" style={{ marginBottom: "6px" }}>Attendee Check-In</h1>
                <p className="page-subtitle">Scan or type a ticket number to check in.</p>

                <form onSubmit={handleCheckIn}>
                    <div className="form-group">
                        <label className="form-label">Ticket Number</label>
                        <input
                            className="form-input"
                            value={ticketNumber}
                            onChange={(e) => setTicketNumber(e.target.value)}
                            placeholder="e.g. EVT-A3B2C1D4E5"
                            style={{ fontFamily: "monospace", fontSize: "15px" }}
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn btn-primary btn-full btn-lg"
                        disabled={loading || !ticketNumber.trim()}
                    >
                        {loading ? "Checking in..." : "Check In"}
                    </button>
                </form>

                {result && (
                    <div className={`checkin-result ${result.success ? "success" : "error"}`}>
                        <div className="checkin-result-icon">
                            {result.success ? "✅" : "❌"}
                        </div>
                        <div className="checkin-result-title">
                            {result.success ? "Check-In Successful!" : "Check-In Failed"}
                        </div>
                        {result.success ? (
                            <div className="checkin-result-detail">
                                <strong>{result.data.attendee}</strong> checked in to{" "}
                                <strong>{result.data.event}</strong>
                                <br />
                                Ticket: <code>{result.data.ticket_number}</code>
                            </div>
                        ) : (
                            <div className="checkin-result-detail">{result.message}</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default CheckIn;
