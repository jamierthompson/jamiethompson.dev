/**
 * The pure parts of the code-under-paint background (PaintBackground.astro):
 * which character each cell of the grid shows, and when the paint moves.
 */

/**
 * The characters the glyph atlas holds, 16 to a row in the atlas. Index 0 is
 * the space, which has no ink.
 */
export const GLYPHS =
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
export const ATLAS_COLUMNS = 16;
export const ATLAS_ROWS = Math.ceil(GLYPHS.length / ATLAS_COLUMNS);

/**
 * The characters the paint covers: letters and digits with a little of the
 * punctuation code is made of. No space, so every cell has ink and the paint
 * can show wherever it goes.
 */
const FILL = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}();=<>+-*/.:_",
].map((char) => GLYPHS.indexOf(char));

/** FILL as the glyph shader takes it: the sequence every cell steps through. */
export const SEQUENCE = Uint8Array.from(FILL);

/** A 32-bit mix: the same input always gives the same spread-out output. */
function mix(value: number): number {
  let h = value >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return (h ^ (h >>> 15)) >>> 0;
}

/**
 * Which glyph each cell shows: `columns` by `rows`, row-major from the top
 * left, every cell a character from FILL chosen by hashing the cell's
 * place with `seed`. The same seed always gives the same character at a
 * place, so a resize only adds cells at the edges instead of reshuffling
 * the lot.
 */
export function fillGlyphs(
  columns: number,
  rows: number,
  seed: number,
): Uint8Array {
  const cells = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    const rowHash = mix(seed ^ Math.imul(row + 1, 0x9e3779b1));
    for (let column = 0; column < columns; column++) {
      const h = mix(rowHash ^ Math.imul(column + 1, 0x85ebca77));
      cells[row * columns + column] = FILL[h % FILL.length] ?? 0;
    }
  }
  return cells;
}

/** Smoothstep from 0 to 1 over [0, 1]. */
const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * When the paint moves. It runs for `budget` seconds after the last touch,
 * then settles to a stop over `settle` seconds, and a touch while stopped
 * brings it back over `resume` seconds. `advance` returns how far the
 * paint's own clock moves this frame: the elapsed time scaled by `energy`,
 * so stopping and starting never jumps the paint.
 */
export class Budget {
  private clock = 0;
  private deadline: number;
  private resumedAt: number;

  constructor(
    private readonly budget = 180,
    private readonly settle = 8,
    private readonly resume = 3,
  ) {
    this.deadline = budget;
    this.resumedAt = -resume;
  }

  /** How much of its speed the paint has right now, 0 to 1. */
  get energy(): number {
    const settling = 1 - smooth((this.clock - this.deadline) / this.settle);
    const resuming = smooth((this.clock - this.resumedAt) / this.resume);
    return settling * resuming;
  }

  /** Settled and still: nothing needs drawing until a touch. */
  get calm(): boolean {
    return this.clock >= this.deadline + this.settle;
  }

  /** Someone is here: the budget starts over, and a calm paint wakes. */
  touch(): void {
    if (this.calm) this.resumedAt = this.clock;
    this.deadline = this.clock + this.budget;
  }

  /** `dt` seconds have passed; returns how far the paint's clock advances. */
  advance(dt: number): number {
    this.clock += dt;
    return dt * this.energy;
  }
}

/** How many taps and wakes the field shader takes; must match its arrays. */
export const TAP_SLOTS = 6;
export const WAKE_SLOTS = 32;
/** Seconds a tap's ripple and a wake's warmth last; must match the shader. */
export const TAP_LIFE = 3.6;
export const WAKE_LIFE = 2.4;

/** What the shader is handed each frame: the live taps and wakes, packed. */
export interface TouchFrame {
  now: number;
  tapCount: number;
  /** Per tap: x, y (CSS px), start time, force. A negative force is a heart. */
  taps: Float32Array;
  wakeCount: number;
  /** Per wake: x, y of the stretch's middle, its warmth now, 1 / reach². */
  wakes: Float32Array;
  /** Per wake: the stretch's direction (unit), half its length, unused. */
  ways: Float32Array;
}

interface Tap {
  x: number;
  y: number;
  at: number;
  force: number;
}

interface Wake extends Tap {
  dx: number;
  dy: number;
  half: number;
}

/**
 * What the pointer has done lately. A click is a tap: a ripple runs out from
 * it, and every third one is a heart. A moving pointer leaves wakes: short
 * stretches of its path that warm the air for a moment, the faster the
 * hand the warmer. Times are seconds on one clock, the caller's.
 */
export class Touches {
  private taps: Tap[] = [];
  private wakes: Wake[] = [];
  private tapsSoFar = 0;
  private last: { x: number; y: number; at: number } | undefined;
  private anchor: { x: number; y: number; at: number } | undefined;
  private speed = 0;

  constructor(
    private readonly heartEvery = 3,
    /** Pointer speeds, CSS px/s, below which a wake is nothing and above which it is full. */
    private readonly slow = 60,
    private readonly fast = 800,
  ) {}

  tap(x: number, y: number, at: number): void {
    this.tapsSoFar += 1;
    const heart = this.tapsSoFar % this.heartEvery === 0;
    this.taps = [
      ...this.taps.slice(1 - TAP_SLOTS),
      { x, y, at, force: heart ? -1.15 : 1 },
    ];
  }

  /** The pointer is at x, y. Returns whether that left a wake. */
  move(x: number, y: number, at: number): boolean {
    const last = this.last;
    this.last = { x, y, at };
    if (!last || !this.anchor || at - last.at > 0.25) {
      // A fresh start: nothing to measure speed against yet.
      this.anchor = this.last;
      this.speed = 0;
      return false;
    }
    const dt = Math.max(at - last.at, 1 / 240);
    const step = Math.hypot(x - last.x, y - last.y);
    // Speed is smoothed so one jittery event does not read as a flick.
    this.speed += (step / dt - this.speed) * Math.min(1, dt / 0.08);
    const span = Math.hypot(x - this.anchor.x, y - this.anchor.y);
    if (span < 18 || at - this.anchor.at < 0.035) return false;
    const force = smooth((this.speed - this.slow) / (this.fast - this.slow));
    const from = this.anchor;
    this.anchor = this.last;
    if (force < 0.04) return false;
    this.wakes = [
      ...this.wakes.slice(1 - WAKE_SLOTS),
      {
        x: (x + from.x) / 2,
        y: (y + from.y) / 2,
        at,
        // A long stroke warms more than a short one, up to a point.
        force: (force * span) / (span + 90),
        dx: (x - from.x) / span,
        dy: (y - from.y) / span,
        half: span / 2,
      },
    ];
    return true;
  }

  /** The pointer has left the page; the next move starts fresh. */
  leave(): void {
    this.last = undefined;
  }

  /** A ripple is running: frames are wanted as fast as they come. */
  rippling(now: number): boolean {
    return this.taps.some((tap) => now - tap.at < TAP_LIFE);
  }

  /** Something is still moving or glowing, so a frame is worth drawing. */
  busy(now: number): boolean {
    return (
      this.rippling(now) || this.wakes.some((wake) => now - wake.at < WAKE_LIFE)
    );
  }

  frame(now: number): TouchFrame {
    this.taps = this.taps.filter((tap) => now - tap.at < TAP_LIFE);
    this.wakes = this.wakes.filter((wake) => now - wake.at < WAKE_LIFE);
    const taps = new Float32Array(TAP_SLOTS * 4);
    this.taps.forEach((tap, i) =>
      taps.set([tap.x, tap.y, tap.at, tap.force], i * 4),
    );
    const wakes = new Float32Array(WAKE_SLOTS * 4);
    const ways = new Float32Array(WAKE_SLOTS * 4);
    let wakeCount = 0;
    for (const wake of this.wakes) {
      const age = Math.max(0, now - wake.at);
      // Warmth comes on in a blink and cools over the better part of a second.
      const warmth =
        wake.force * (1 - Math.exp(-age / 0.05)) * Math.exp(-age / 0.65);
      if (warmth < 0.002) continue;
      const reach = 50 + 40 * age; // and spreads as it cools
      wakes.set([wake.x, wake.y, warmth, 1 / (reach * reach)], wakeCount * 4);
      ways.set([wake.dx, wake.dy, wake.half, 0], wakeCount * 4);
      wakeCount += 1;
    }
    return { now, tapCount: this.taps.length, taps, wakeCount, wakes, ways };
  }
}

/**
 * The heart a ripple can take, as the field shader wants it: for each of
 * `bins` directions from its center (from 0 to 2π, x right, y up), how far
 * out the outline lies, with the farthest point at 1. A ripple's rings are
 * scaled copies of this about the click, as a circle's are about its
 * center. The outline comes from a polar curve whose origin is the notch,
 * so it is recentered on its bounding box first; any closed outline that
 * every ray from the center crosses once could go here instead.
 */
export function heartProfile(bins = 256): Float32Array {
  const samples = bins * 16;
  const outline: [number, number][] = [];
  for (let i = 0; i < samples; i++) {
    const angle = (i / samples) * 2 * Math.PI;
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    const r = (2 - 2 * s + (s * Math.sqrt(Math.abs(c))) / (s + 1.4)) / 2.6;
    outline.push([r * c, r * s]);
  }
  const xs = outline.map(([x]) => x);
  const ys = outline.map(([, y]) => y);
  const center = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
  const profile = new Float32Array(bins);
  for (const [x, y] of outline) {
    const dx = x - center[0]!;
    const dy = y - center[1]!;
    const turn = Math.atan2(dy, dx) / (2 * Math.PI);
    const bin = Math.round((turn + 1) * bins) % bins;
    profile[bin] = Math.max(profile[bin] ?? 0, Math.hypot(dx, dy));
  }
  // A direction the outline's samples skipped takes its neighbors' radius.
  for (let i = 0; i < bins; i++) {
    if (profile[i]! > 0) continue;
    let before = i;
    let after = i;
    while (profile[before]! === 0) before = (before - 1 + bins) % bins;
    while (profile[after]! === 0) after = (after + 1) % bins;
    profile[i] = (profile[before]! + profile[after]!) / 2;
  }
  const farthest = Math.max(...profile);
  for (let i = 0; i < bins; i++) profile[i] = profile[i]! / farthest;
  return profile;
}
