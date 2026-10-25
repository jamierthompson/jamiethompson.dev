/**
 * Where `components.json` tells the shadcn CLI to find `cn` (`aliases.utils`),
 * so components it adds import from here. The implementation is the `cn`
 * package; this re-export is the shape shadcn's own `migrate cn` leaves.
 */
export { cn } from "cn";
