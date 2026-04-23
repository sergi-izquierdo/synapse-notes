// Relative-time formatter built on Intl.RelativeTimeFormat (native, no
// library dep). Buckets: minute / hour / day / month / year. For very
// recent dates (< 1 min) returns a literal "ara" / "now" / "ahora".
export function formatRelative(
    date: Date | string,
    locale: "en" | "es" | "ca" = "ca",
): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60_000);

    if (Math.abs(diffMin) < 1) {
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
