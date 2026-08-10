import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";
import { SITE_URL } from "./site";

/**
 * The external-link rule. Two surfaces apply it — the rehype plugin below for
 * markdown, `ExternalLink.astro` for templates, because rehype can't see
 * `.astro` files — and `isExternalHref` is the only gate on either.
 *
 * The whole contract is `data-external`, the hook the icon in `Base.astro`
 * draws from. No `target`, so no change of context to warn about (WCAG 2.2
 * 3.2.5) and nothing for a `rel="noopener"` to protect.
 */

const SCHEME_PATTERN = /^([a-zA-Z][a-zA-Z\d+\-.]*):/;
const WEB_SCHEMES: string[] = ["http", "https"];
const MAIL_SCHEMES: string[] = ["mailto"];
const SITE_ORIGIN = new URL(SITE_URL).origin;

/**
 * Root-relative paths, fragments, and same-origin absolute URLs stay put; a
 * `mailto:` leaves.
 */
export function isExternalHref(href: string): boolean {
  const trimmed = href.trim();
  const scheme = SCHEME_PATTERN.exec(trimmed)?.[1].toLowerCase();
  if (scheme !== undefined && MAIL_SCHEMES.includes(scheme)) return true;

  let url: URL;
  try {
    // The base is what makes the answer match the address bar: it supplies the
    // scheme for `//example.com`, and it lets the parser reach an authority
    // written behind a backslash — `/\evil.com` is `https://evil.com/`, since
    // WHATWG treats `\` as `/` after a special scheme.
    url = new URL(trimmed, SITE_URL);
  } catch {
    return false;
  }
  // `url.protocol` is normalized lowercase and keeps its trailing colon.
  if (!WEB_SCHEMES.includes(url.protocol.slice(0, -1))) return false;
  return url.origin !== SITE_ORIGIN;
}

export function rehypeMarkExternalLinks() {
  return (tree: Root): void => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;
      const { href } = node.properties;
      if (typeof href !== "string" || !isExternalHref(href)) return;
      // `dataExternal` is the hast property name for the `data-external`
      // attribute the icon keys on; hast-util-to-html serializes it back.
      node.properties.dataExternal = "";
    });
  };
}
