import { useEffect, useRef, useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";

const COOLDOWN_MS = 2000;

// Friendly text for the camera problems people actually hit.
const CAMERA_ERRORS = {
    "permission-denied": "Camera access was blocked. Allow the camera in your browser settings, or type the ticket number instead.",
    "no-camera": "No camera was found on this device. Type the ticket number instead.",
    "in-use": "The camera is being used by another app. Close it and try again, or type the ticket number.",
    "insecure-context": "The camera only works over HTTPS (or on localhost). Type the ticket number instead.",
    unsupported: "This browser can't use the camera for scanning. Type the ticket number instead.",
};

/**
 * Camera QR scanner. Calls onCode(text) once per scan, then pauses for
 * COOLDOWN_MS so one QR held in front of the camera never sends twice.
 * The camera turns off when this component unmounts.
 */
function CameraScanner({ onCode, busy, onError }) {
    const [cooling, setCooling] = useState(false);
    // Refs, not state: onScan can fire again before React re-renders.
    const lockedRef = useRef(false);
    const timerRef = useRef(null);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const handleScan = (codes) => {
        const value = codes[0]?.rawValue?.trim();
        if (!value || lockedRef.current || busy) return;

        lockedRef.current = true;
        setCooling(true);
        onCode(value);

        timerRef.current = setTimeout(() => {
            lockedRef.current = false;
            setCooling(false);
        }, COOLDOWN_MS);
    };

    const handleError = (err) => {
        onError(CAMERA_ERRORS[err?.kind] || "Couldn't start the camera. Type the ticket number instead.");
    };

    return (
        <div className="camera-scanner">
            <Scanner
                onScan={handleScan}
                onError={handleError}
                formats={["qr_code"]}
                // Rear camera on phones; laptops just use what they have.
                constraints={{ facingMode: "environment" }}
                paused={cooling || busy}
                // Let the same QR be read again after the pause, so a
                // second scan shows "already used" instead of nothing.
                allowMultiple
                scanDelay={COOLDOWN_MS}
                sound={false}
            />
            <p className="camera-scanner-hint">
                {busy ? "Checking…" : cooling ? "Got it, ready again in a moment…" : "Point the camera at the ticket's QR code."}
            </p>
        </div>
    );
}

export default CameraScanner;
