/**
 * Offline check-in: keep an event's ticket list on this device so the door
 * can keep scanning without internet, then upload the queued scans later.
 *
 * A "pack" lives in localStorage under eh-checkin:<eventId>:
 *   { event, generated_at, tickets: { [number]: { attendee, status, checked_in_at } },
 *     queue: [{ ticket_number, scanned_at }] }
 */
import api from "./api";

const KEY = (eventId) => `eh-checkin:${eventId}`;
const PREFIX = "eh-checkin:";

export function isNetworkError(err) {
    return !err?.response;
}

export function loadPack(eventId) {
    try {
        const raw = localStorage.getItem(KEY(eventId));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function savePack(pack) {
    localStorage.setItem(KEY(pack.event.id), JSON.stringify(pack));
    return pack;
}

/** Every downloaded pack's event, for picking an event while offline. */
export function savedEvents() {
    const events = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(PREFIX)) {
            const pack = loadPack(key.slice(PREFIX.length));
            if (pack) events.push(pack.event);
        }
    }
    return events;
}

/** Fetch the latest ticket list, keeping any scans still waiting to sync. */
export async function downloadPack(eventId) {
    const { data } = await api.get(`organizer/events/${eventId}/checkin-manifest/`);
    const old = loadPack(eventId);
    const queue = old?.queue ?? [];

    const tickets = {};
    for (const t of data.tickets) {
        tickets[t.ticket_number] = {
            attendee: t.attendee, status: t.status, checked_in_at: t.checked_in_at,
        };
    }
    // Scans made here but not yet uploaded still count as used on this device.
    for (const scan of queue) {
        if (tickets[scan.ticket_number]?.status === "VALID") {
            tickets[scan.ticket_number] = {
                ...tickets[scan.ticket_number], status: "USED", checked_in_at: scan.scanned_at,
            };
        }
    }
    return savePack({ event: data.event, generated_at: data.generated_at, tickets, queue });
}

/** Mark a ticket used in the local copy after a successful online check-in. */
export function markUsedLocally(eventId, ticketNumber, checkedInAt) {
    const pack = loadPack(eventId);
    if (!pack?.tickets[ticketNumber]) return;
    pack.tickets[ticketNumber] = { ...pack.tickets[ticketNumber], status: "USED", checked_in_at: checkedInAt };
    savePack(pack);
}

/**
 * Check a ticket in against the local copy only.
 * Returns { ok, attendee, message }.
 */
export function checkInOffline(eventId, ticketNumber) {
    const pack = loadPack(eventId);
    if (!pack) {
        return { ok: false, message: "You're offline and this event hasn't been downloaded for offline use." };
    }
    const ticket = pack.tickets[ticketNumber];
    if (!ticket) {
        return { ok: false, message: "This ticket isn't on the list for this event." };
    }
    if (ticket.status === "CANCELLED") {
        return { ok: false, attendee: ticket.attendee, message: "This ticket has been cancelled." };
    }
    if (ticket.status === "USED") {
        const at = ticket.checked_in_at
            ? ` at ${new Date(ticket.checked_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : "";
        return { ok: false, attendee: ticket.attendee, message: `Already checked in${at}.` };
    }

    const scannedAt = new Date().toISOString();
    pack.tickets[ticketNumber] = { ...ticket, status: "USED", checked_in_at: scannedAt };
    pack.queue.push({ ticket_number: ticketNumber, scanned_at: scannedAt });
    savePack(pack);
    return { ok: true, attendee: ticket.attendee };
}

/**
 * Upload queued scans. Returns { synced, conflicts } where conflicts are scans
 * the server refused (e.g. the same ticket was used at another door first).
 * On a network error the queue is left untouched and the error is thrown.
 */
export async function syncPack(eventId) {
    const pack = loadPack(eventId);
    if (!pack || pack.queue.length === 0) return { synced: 0, conflicts: [] };

    const sent = pack.queue.slice(0, 500);
    const { data } = await api.post("tickets/check-in/sync/", { event_id: Number(eventId), scans: sent });

    // Re-read in case more scans were queued while the request was in flight.
    const latest = loadPack(eventId);
    const sentNumbers = new Set(sent.map((s) => `${s.ticket_number}|${s.scanned_at}`));
    latest.queue = latest.queue.filter((s) => !sentNumbers.has(`${s.ticket_number}|${s.scanned_at}`));

    const conflicts = [];
    let synced = 0;
    for (const r of data.results) {
        const local = latest.tickets[r.ticket_number];
        if (r.result === "checked_in") {
            synced += 1;
            if (local) latest.tickets[r.ticket_number] = { ...local, status: "USED", checked_in_at: r.checked_in_at };
        } else {
            conflicts.push({ ticket_number: r.ticket_number, attendee: r.attendee || local?.attendee, message: r.message });
            if (local && r.result === "already_used") {
                latest.tickets[r.ticket_number] = { ...local, status: "USED", checked_in_at: r.checked_in_at };
            }
        }
    }
    savePack(latest);
    return { synced, conflicts };
}
