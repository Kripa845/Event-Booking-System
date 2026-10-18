import { useEffect, useState } from "react";
import api from "../services/api";

const ICON = { rain: "🌧️", storm: "⛈️", heat: "🥵", showers: "🌦️" };

function fmtDay(d) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Forecast for an event's day. `compact` renders a one-line alert (only when
 * there's something to warn about); otherwise a full card.
 */
export default function WeatherCard({ eventId, compact = false }) {
    const [wx, setWx] = useState(null);

    useEffect(() => {
        let alive = true;
        api.get(`events/${eventId}/weather/`)
            .then((res) => alive && setWx(res.data))
            .catch(() => alive && setWx(null));
        return () => { alive = false; };
    }, [eventId]);

    if (!wx) return null;

    if (compact) {
        if (!wx.available || !wx.alert) return null;
        return (
            <div className={`wx-line wx-${wx.alert}`}>
                {ICON[wx.alert]} {wx.summary}, {wx.rain_chance}% rain · {wx.advice}
            </div>
        );
    }

    if (!wx.available) {
        if (wx.reason !== "too_far") return null;
        return (
            <div className="wx-card">
                <div className="wx-head">🌤️ Weather on the day</div>
                <p className="wx-note">The forecast shows up here from {fmtDay(wx.available_from)}.</p>
            </div>
        );
    }

    return (
        <div className={`wx-card${wx.alert ? ` wx-${wx.alert}` : ""}`}>
            <div className="wx-head">{ICON[wx.alert] || "🌤️"} Weather on the day</div>
            <div className="wx-main">
                <span className="wx-temp">{Math.round(wx.temp_max)}°</span>
                <span className="wx-low">/ {Math.round(wx.temp_min)}°</span>
                <span className="wx-summary">{wx.summary}</span>
            </div>
            <div className="wx-chance">{wx.rain_chance}% chance of rain · forecast for {wx.place}</div>
            <p className="wx-advice">{wx.advice}</p>
        </div>
    );
}
