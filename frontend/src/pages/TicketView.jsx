import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BackButton from "../components/BackButton";
import TicketIcon from "../components/TicketIcon";
import api, { getImageUrl } from "../services/api";
import { fmtBs, fmtTime } from "../utils/format";
import "./TicketView.css";

function longDate(d) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function priceLabel(p) {
    if (p === null || p === undefined) return null;
    return Number(p) === 0 ? "Free" : `NPR ${Number(p).toLocaleString()}`;
}

function TicketView() {
    const { id } = useParams();
    const sheetRef = useRef(null);   // the area that gets saved as image / PDF
    const [ticket, setTicket] = useState(null);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(null);   // "png" | "pdf" | null

    useEffect(() => {
        api.get(`tickets/${id}/`)
            .then((res) => setTicket(res.data))
            .catch(() => setError("Ticket not found."));
    }, [id]);

    // Draws the ticket (including the QR image) into a PNG.
    // The libraries are loaded only when needed, so they don't slow down other pages.
    const renderPng = async () => {
        const { toPng } = await import("html-to-image");
        return toPng(sheetRef.current, { pixelRatio: 2, cacheBust: true });
    };

    const download = (dataUrl, filename) => {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = filename;
        a.click();
    };

    const saveImage = async () => {
        setSaving("png");
        setError("");
        try {
            download(await renderPng(), `EventHub-${ticket.ticket_number}.png`);
        } catch {
            setError("Couldn't create the image. Please try again.");
        } finally {
            setSaving(null);
        }
    };

    const savePdf = async () => {
        setSaving("pdf");
        setError("");
        try {
            const png = await renderPng();
            const { jsPDF } = await import("jspdf");
            const { offsetWidth: w, offsetHeight: h } = sheetRef.current;

            // Fit the ticket inside an A4 page with a margin, keeping its shape.
            const pdf = new jsPDF({ orientation: w > h ? "landscape" : "portrait", unit: "mm", format: "a4" });
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const scale = Math.min((pageW - 20) / w, (pageH - 20) / h);
            const imgW = w * scale;
            const imgH = h * scale;
            pdf.addImage(png, "PNG", (pageW - imgW) / 2, 15, imgW, imgH);
            pdf.save(`EventHub-${ticket.ticket_number}.pdf`);
        } catch {
            setError("Couldn't create the PDF. Please try again.");
        } finally {
            setSaving(null);
        }
    };

    if (error && !ticket) {
        return (
            <div className="container page">
                <BackButton />
                <div className="alert alert-error">{error}</div>
                <Link to="/my-tickets" className="btn btn-outline">Back to My Tickets</Link>
            </div>
        );
    }

    if (!ticket) return (
        <div className="spinner-wrap" style={{ minHeight: "60vh" }}>
            <div className="spinner" />
        </div>
    );

    const cancelled = ticket.status === "CANCELLED";
    const place = ticket.venue ? `${ticket.venue}, ${ticket.location}` : ticket.location;
    const price = priceLabel(ticket.price_paid);

    return (
        <div className="container page tv">
            <BackButton />

            <div className="tv-sheet" ref={sheetRef}>
                <article className={`tv-ticket${cancelled ? " is-cancelled" : ""}`}>
                    <div className="tv-main">
                        <div className="tv-brand">
                            <TicketIcon size={16} /> EventHub
                            <span className="tv-admit">Admit one</span>
                        </div>

                        <h1 className="tv-title">{ticket.event_title}</h1>

                        <dl className="tv-details">
                            <div>
                                <dt>Date</dt>
                                <dd>
                                    {longDate(ticket.event_date)}
                                    <span className="tv-sub">{fmtBs(ticket.event_date)}</span>
                                </dd>
                            </div>
                            <div>
                                <dt>Time</dt>
                                <dd>
                                    {fmtTime(ticket.event_start_time)}
                                    {ticket.event_end_time && <> – {fmtTime(ticket.event_end_time)}</>}
                                </dd>
                            </div>
                            <div className="tv-wide">
                                <dt>Venue</dt>
                                <dd>{place}</dd>
                            </div>
                            <div>
                                <dt>Ticket holder</dt>
                                <dd>{ticket.username}</dd>
                            </div>
                            {price && (
                                <div>
                                    <dt>Price</dt>
                                    <dd>{price}</dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    <div className="tv-stub">
                        {cancelled ? (
                            <div className="tv-void">This ticket is no longer valid</div>
                        ) : (
                            <>
                                <div className="tv-qr">
                                    <img src={getImageUrl(ticket.qr_code)} alt={`QR code for ${ticket.ticket_number}`} crossOrigin="anonymous" />
                                </div>
                                <div className="tv-number">{ticket.ticket_number}</div>
                                <div className="tv-hint">Show this code at the entrance</div>
                            </>
                        )}
                    </div>

                    {ticket.status !== "VALID" && (
                        <div className="tv-stamp">{cancelled ? "Cancelled" : "Used"}</div>
                    )}
                </article>
            </div>

            {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

            {!cancelled && (
                <div className="tv-actions">
                    <button className="btn btn-primary" onClick={saveImage} disabled={!!saving}>
                        {saving === "png" ? "Saving…" : "Save as image"}
                    </button>
                    <button className="btn btn-outline" onClick={savePdf} disabled={!!saving}>
                        {saving === "pdf" ? "Saving…" : "Save as PDF"}
                    </button>
                </div>
            )}
        </div>
    );
}

export default TicketView;
