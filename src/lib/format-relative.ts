// Relative-time formatter built on Intl.RelativeTimeFormat (native, no
// library dep). Buckets: minute / hour / day / month / year. For very
// recent dates (< 1 min) returns a literal "ara" / "now" / "ahora".
//
// Notes can only exist in the past (they're rows that already got
// inserted), so a positive diff means server/client clock skew — not
// a future timestamp. We clamp positive diffs to 0 so the label never
// renders future-tense ("d'aquí a 2 minuts") on a just-created note.
export function formatRelative(
    date: Date | string,
    locale: "en" | "es" | "ca" = "ca",
): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const rawMs = d.getTime() - now.getTime();
    const diffMs = rawMs > 0 ? 0 : rawMs;
    const diffMin = Math.round(diffMs / 60_000);

    if (diffMin >= 0) {
        return locale === "en" ? "now" : locale === "es" ? "ahora" : "ara";
    }

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

    if (Math.abs(diffMin) < 60) {
        return rtf.format(diffMin, "minute");
    }
    const diffHours = Math.round(diffMin / 60);
    if (Math.abs(diffHours) < 24) {
        return rtf.format(diffHours, "hour");
    }
    const diffDays = Math.round(diffHours / 24);
    if (Math.abs(diffDays) < 30) {
        return rtf.format(diffDays, "day");
    }
    const diffMonths = Math.round(diffDays / 30);
    if (Math.abs(diffMonths) < 12) {
        return rtf.format(diffMonths, "month");
    }
    const diffYears = Math.round(diffMonths / 12);
    return rtf.format(diffYears, "year");
}

// DD/MM/YYYY HH:MM — fixed EU-style format, locale-independent because
// the 24h clock and day-first order are what Sergi (and the app's
// CA/ES audience) use regardless of language. Zero-padded so the mono
// footer column stays tidy.
export function formatDateTime(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}
