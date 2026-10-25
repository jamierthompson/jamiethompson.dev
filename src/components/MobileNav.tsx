import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NAV, SITE_NAME, isCurrentSection } from "@/lib/site";

/**
 * The navigation below `md`: a menu button that opens a full-screen sheet
 * with the section links and, slotted in as `children`, the scheme toggle.
 * shadcn's Sheet over Radix Dialog, so focus containment, Escape, the scroll
 * lock and the inert page behind it come from the primitive.
 */
interface Props {
  /** `Astro.url.pathname`, for marking the current section. */
  currentPath: string;
  children?: ReactNode;
}

/** Tailwind's `md` breakpoint, where the inline nav takes over. */
const INLINE_NAV = "(min-width: 48rem)";

export function MobileNav({ currentPath, children }: Props) {
  const [open, setOpen] = useState(false);

  // Grown past the breakpoint with the sheet open, the inline nav has taken
  // over and the sheet would be a second, invisible one.
  useEffect(() => {
    const inlineNav = matchMedia(INLINE_NAV);
    const close = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    inlineNav.addEventListener("change", close);
    return () => inlineNav.removeEventListener("change", close);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open navigation">
          <Menu aria-hidden="true" className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className="w-full gap-0 border-l-0 shadow-none sm:max-w-none"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-14 items-center justify-between border-b px-gutter">
          <a href="/" className="font-medium tracking-tight">
            {SITE_NAME}
          </a>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close navigation">
              <X aria-hidden="true" className="size-5" />
            </Button>
          </SheetClose>
        </div>

        <nav aria-label="Site" className="px-gutter pt-6">
          <ul>
            {NAV.map(({ href, label }) => (
              <li key={href}>
                <a
                  href={href}
                  aria-current={
                    isCurrentSection(currentPath, href) ? "page" : undefined
                  }
                  className="block py-3 text-3xl font-medium tracking-tight text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto border-t px-gutter py-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
