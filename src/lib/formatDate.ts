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
