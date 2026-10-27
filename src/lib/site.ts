/** The deployed origin. `astro.config.ts` and the external-link rule both read
 * it, so "is this link leaving the site?" can't disagree with `site`. */
export const SITE_URL = "https://jamiethompson.dev";

/** Names the site in `<title>`, `og:site_name`, and the header. */
export const SITE_NAME = "Jamie Thompson";

/** The sections the header links to, in display order. */
export const NAV = [
  { href: "/projects/", label: "Projects" },
  { href: "/writing/", label: "Writing" },
] as const;

/** Where else to find me. Every href here leaves the site. */
export const CONTACT = [
  { href: "https://github.com/jamiethompsondesign", label: "GitHub" },
  {
    href: "https://www.linkedin.com/in/jamiethompsondesign",
    label: "LinkedIn",
  },
] as const;

/**
 * Whether the nav link `href` is the section `path` is in: its index or any
 * page under it. Compared by whole path segment, so the answer does not hang
 * on how either side spells its trailing slash — `/writing` is in the section
 * `/writing/` (Astro's default `trailingSlash: "ignore"` serves both), and
 * `/writing-x/` is not in `/writing`. The root only matches itself, or it
 * would claim every page.
 */
export function isCurrentSection(path: string, href: string): boolean {
  const section = href.replace(/\/+$/, "");
  if (section === "") return path === "/";
  return path === section || path.startsWith(`${section}/`);
}
