// Tiny local-date helpers for the data layer only (UI formatting lives in lib/core/dates.mjs).

/** 'YYYY-MM-DD' for now in the given IANA time zone. */
export function todayIn(timeZone = 'Europe/Berlin', now: Date = new Date()): string {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    } catch {
        return now.toISOString().slice(0, 10);
    }
}
