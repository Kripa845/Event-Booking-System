/**
 * Keep a copy of the user's tickets on this device so they open without internet.
 * Each ticket is stored with its QR code as an image (data URL).
 * Cleared on logout so the next person on a shared device can't see them.
 */
const LIST_KEY = "eh-tickets";
const TICKET_KEY = (id) => `eh-ticket:${id}`;

function read(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full or blocked: skip */ }
}

export const saveTicketList = (tickets) => write(LIST_KEY, tickets);
export const loadTicketList = () => read(LIST_KEY);
export const loadTicket = (id) => read(TICKET_KEY(id));

/** Save one ticket, embedding its QR image so it shows offline. */
export async function saveTicket(ticket, qrUrl) {
    let qrDataUrl = null;
    try {
        const blob = await (await fetch(qrUrl)).blob();
        qrDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch { /* keep the details even if the image can't be fetched */ }
    write(TICKET_KEY(ticket.id), { ticket, qrDataUrl, savedAt: new Date().toISOString() });
}

export function clearSavedTickets() {
    try {
        Object.keys(localStorage)
            .filter((k) => k === LIST_KEY || k.startsWith("eh-ticket:"))
            .forEach((k) => localStorage.removeItem(k));
    } catch { /* storage unavailable */ }
}
