import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../services/api";

/**
 * eSewa sends the user back here:
 *  /payment/esewa/success?data=...  -> ask the backend to verify and confirm the order
 *  /payment/esewa/failure?uuid=...  -> release the held seats
 */
function PaymentResult({ outcome }) {
    const { search } = useLocation();
    const [state, setState] = useState({ loading: true });
    const sent = useRef(false);   // StrictMode runs effects twice in development; only call once

    useEffect(() => {
        if (sent.current) return;
        sent.current = true;
        const params = new URLSearchParams(search);

        const request = outcome === "success"
            ? api.post("payments/esewa/verify/", { data: params.get("data") || "" })
            : api.post(`payments/${params.get("uuid")}/cancel/`);

        request
            .then((res) => setState({ ok: outcome === "success", data: res.data }))
            .catch((err) => setState({ ok: false, error: err.response?.data?.error || "Something went wrong." }));
    }, [outcome, search]);

    if (state.loading) {
        return (
            <div className="spinner-wrap" style={{ minHeight: "60vh", flexDirection: "column", gap: 14 }}>
                <div className="spinner" />
                <p style={{ color: "var(--text-2)" }}>{outcome === "success" ? "Confirming your payment…" : "Cancelling…"}</p>
            </div>
        );
    }

    return (
        <div className="container page" style={{ maxWidth: 560 }}>
            <div className={`checkin-result ${state.ok ? "success" : "error"}`}>
                <div className="checkin-result-icon">{state.ok ? "🎉" : outcome === "success" ? "⚠️" : "↩️"}</div>
                <div className="checkin-result-title">
                    {state.ok ? "Payment successful!" : outcome === "success" ? "We couldn't confirm the payment" : "Payment cancelled"}
                </div>
                <div className="checkin-result-detail">
                    {state.ok ? (
                        <>
                            Your tickets for <strong>{state.data.event}</strong> are ready.<br />
                            Paid NPR {Number(state.data.amount).toLocaleString()} · eSewa ref <code>{state.data.ref_id}</code>
                        </>
                    ) : state.error ? state.error : "No money was taken and your seat was released."}
                </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
                {state.ok
                    ? <Link to="/my-tickets" className="btn btn-primary">View my tickets</Link>
                    : <Link to={state.data?.event_id ? `/events/${state.data.event_id}` : "/"} className="btn btn-primary">Back to events</Link>}
            </div>
        </div>
    );
}

export default PaymentResult;
