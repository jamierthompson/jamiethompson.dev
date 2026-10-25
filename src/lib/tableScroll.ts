import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

/**
 * Wraps every markdown table in a box that scrolls sideways, so a table wider
 * than the column scrolls on its own instead of widening the page. The box,
 * not the table, is the scroller: `display: block` on a `<table>` would do it
 * with no wrapper, but it costs the table its semantics in some screen
 * readers (Safari/VoiceOver among them).
 *
 * The box can be focused so a keyboard can scroll it (WCAG 2.1.1), which
 * makes it a stop in the tab order — so it is a named region, and announces
 * itself when reached, rather than an anonymous one.
 */
export const TABLE_SCROLL_CLASS = "table-scroll";

export function rehypeScrollTables() {
  return (tree: Root): void => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "table" || parent === undefined) return;
      if (index === undefined) return;
      if (
        parent.type === "element" &&
        (parent.properties.className as string[] | undefined)?.includes(
          TABLE_SCROLL_CLASS,
        )
      ) {
        return;
      }
      const box: Element = {
        type: "element",
        tagName: "div",
        properties: {
          className: [TABLE_SCROLL_CLASS],
          role: "region",
          ariaLabel: "Table",
          tabIndex: 0,
        },
        children: [node],
      };
      parent.children[index] = box;
    });
  };
}
