import type { ReactNode } from "react";

/**
 * The pieces of the two state diagrams: a pill for a state, an arrow for a
 * transition. Drawn in SVG so the layout is exact at every width, colored
 * with the site's tokens so both schemes work.
 */

const CHAR = 7.3;
const PAD = 24;

export const nodeWidth = (label: string) => label.length * CHAR + PAD;

export function Node({
  x,
  y,
  label,
  active,
}: {
  x: number;
  y: number;
  label: string;
  active?: boolean;
}) {
  const width = nodeWidth(label);
  return (
    <g data-active={active || undefined} className="group">
      <rect
        x={x - width / 2}
        y={y - 14}
        width={width}
        height={28}
        rx={14}
        className="fill-background stroke-border transition-colors group-data-active:fill-foreground group-data-active:stroke-foreground"
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        className="fill-foreground font-mono text-[12px] transition-colors group-data-active:fill-background"
      >
        {label}
      </text>
    </g>
  );
}

export function Edge({ d, marker }: { d: string; marker: string }) {
  return (
    <path
      d={d}
      fill="none"
      className="stroke-muted-foreground"
      strokeWidth={1.25}
      markerEnd={`url(#${marker})`}
    />
  );
}

export function Label({
  x,
  y,
  children,
  anchor = "middle",
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      className="fill-muted-foreground text-[11px]"
      style={{ paintOrder: "stroke" }}
    >
      {children}
    </text>
  );
}

export function RowLabel({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  return (
    <text x={x} y={y} className="fill-muted-foreground text-[11px]">
      {children}
    </text>
  );
}

export function Arrowhead({ id }: { id: string }) {
  return (
    <defs>
      <marker
        id={id}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M0 0L10 5L0 10z" className="fill-muted-foreground" />
      </marker>
    </defs>
  );
}
