/**
 * Frontmatter dates parse as UTC midnight; formatting them in the build
 * machine's local timezone shifts the displayed day (a Chicago build shows
 * "August 6" for pubDate 2026-08-07). Pin display to UTC.
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The same day, short enough for a list: "Jul 11, 2030". */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
