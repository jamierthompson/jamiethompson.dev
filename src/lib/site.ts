/** The deployed origin. `astro.config.ts` and the external-link rule both read
 * it, so "is this link leaving the site?" can't disagree with `site`. */
export const SITE_URL = "https://jamiethompson.design";

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
  { href: "mailto:hello@jamiethompson.design", label: "Email" },
] as const;
