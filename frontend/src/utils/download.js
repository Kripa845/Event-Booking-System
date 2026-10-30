/** Save text as a file in the browser. */
function saveFile(text, filename, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Download rows as a CSV file that opens in Excel.
 * columns: [["Header", (row) => value], ...]
 */
export function downloadCsv(filename, columns, rows) {
    // Quote every cell and double any quotes inside it, so commas and newlines are safe.
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
        columns.map(([header]) => cell(header)).join(","),
        ...rows.map((row) => columns.map(([, get]) => cell(get(row))).join(",")),
    ];
    // The BOM makes Excel read Nepali/emoji text as UTF-8.
    saveFile("﻿" + lines.join("\r\n"), filename, "text/csv;charset=utf-8");
}

/**
 * Download an .ics file that adds the event to Google/Apple/Outlook calendars.
 * Times are "floating" (no time zone), so they show as the event's local time.
 */
export function downloadIcs({ id, title, date, start, end, location, description }) {
    const stamp = (d, t) => `${String(d).replaceAll("-", "")}T${String(t || "00:00").slice(0, 5).replace(":", "")}00`;
    const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
    const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//EventHub//EN",
        "BEGIN:VEVENT",
        `UID:eventhub-${id}@eventhub`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
        `DTSTART:${stamp(date, start)}`,
        `DTEND:${stamp(date, end || start)}`,
        `SUMMARY:${esc(title)}`,
        `LOCATION:${esc(location)}`,
        `DESCRIPTION:${esc(description)}`,
        "END:VEVENT",
        "END:VCALENDAR",
    ].join("\r\n");
    saveFile(ics, `${String(title).replace(/[^\w-]+/g, "-").slice(0, 40) || "event"}.ics`, "text/calendar");
}
