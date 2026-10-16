import { describe, expect, it } from "vitest";
import {
  ATLAS_COLUMNS,
  ATLAS_ROWS,
  Budget,
  GLYPHS,
  TAP_LIFE,
  TAP_SLOTS,
  Touches,
  WAKE_LIFE,
  WAKE_SLOTS,
  fillGlyphs,
  heartProfile,
} from "./paint";

describe("GLYPHS", () => {
  it("starts with the space and fits the atlas", () => {
    expect(GLYPHS[0]).toBe(" ");
    expect(new Set(GLYPHS).size).toBe(GLYPHS.length);
    expect(GLYPHS.length).toBeLessThanOrEqual(ATLAS_COLUMNS * ATLAS_ROWS);
  });
});

describe("fillGlyphs", () => {
  it("puts ink in every cell", () => {
    const cells = fillGlyphs(40, 12, 1);
    expect(cells.length).toBe(480);
    expect([...cells].every((glyph) => GLYPHS[glyph] !== " ")).toBe(true);
  });

  it("is the same page for the same seed, and a cell keeps its character when the grid grows", () => {
    const small = fillGlyphs(10, 4, 7);
    const large = fillGlyphs(14, 6, 7);
    expect(fillGlyphs(10, 4, 7)).toEqual(small);
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 10; column++) {
        expect(large[row * 14 + column]).toBe(small[row * 10 + column]);
      }
    }
  });

  it("is a different page for a different seed, with a spread of characters", () => {
    const a = [...fillGlyphs(30, 10, 1)];
    const b = [...fillGlyphs(30, 10, 2)];
    expect(a).not.toEqual(b);
    expect(new Set(a).size).toBeGreaterThan(40);
  });
});

describe("Budget", () => {
  it("runs at full energy until the budget is spent, then settles", () => {
    const budget = new Budget(10, 2, 1);
    expect(budget.energy).toBe(1);
    expect(budget.advance(5)).toBe(5);
    expect(budget.energy).toBe(1);
    budget.advance(5);
    expect(budget.energy).toBe(1);
    budget.advance(1);
    expect(budget.energy).toBeGreaterThan(0);
    expect(budget.energy).toBeLessThan(1);
    expect(budget.calm).toBe(false);
    budget.advance(1);
    expect(budget.energy).toBe(0);
    expect(budget.calm).toBe(true);
    expect(budget.advance(1)).toBe(0);
  });

  it("a touch extends the budget before it is spent", () => {
    const budget = new Budget(10, 2, 1);
    budget.advance(8);
    budget.touch();
    budget.advance(8);
    expect(budget.energy).toBe(1);
  });

  it("a touch while calm brings the paint back over the resume time", () => {
    const budget = new Budget(10, 2, 1);
    budget.advance(12);
    expect(budget.calm).toBe(true);
    budget.touch();
    expect(budget.calm).toBe(false);
    expect(budget.energy).toBe(0);
    budget.advance(0.5);
    expect(budget.energy).toBeGreaterThan(0);
    expect(budget.energy).toBeLessThan(1);
    budget.advance(0.5);
    expect(budget.energy).toBe(1);
  });
});

describe("Touches", () => {
  it("keeps a tap for its life, and makes every third one a heart", () => {
    const touches = new Touches(3);
    touches.tap(10, 20, 0);
    touches.tap(30, 40, 1);
    touches.tap(50, 60, 2);
    const frame = touches.frame(2.5);
    expect(frame.tapCount).toBe(3);
    expect([...frame.taps.slice(0, 4)]).toEqual([10, 20, 0, 1]);
    expect(frame.taps[11]).toBeLessThan(0);
    expect(touches.rippling(2.5)).toBe(true);
    expect(touches.frame(TAP_LIFE + 1.5).tapCount).toBe(1);
    expect(touches.rippling(TAP_LIFE + 2.5)).toBe(false);
  });

  it("a slow pointer leaves no wake, a fast one does", () => {
    const slow = new Touches();
    let t = 0;
    for (let i = 0; i < 20; i++)
      expect(slow.move(i * 2, 0, (t += 0.05))).toBe(false);
    expect(slow.frame(t).wakeCount).toBe(0);

    const fast = new Touches();
    t = 0;
    let left = 0;
    for (let i = 0; i < 20; i++)
      if (fast.move(i * 20, 0, (t += 0.016))) left += 1;
    expect(left).toBeGreaterThan(0);
    const frame = fast.frame(t + 0.1);
    expect(frame.wakeCount).toBe(left);
    expect(frame.wakes[2]).toBeGreaterThan(0);
    expect(frame.ways[0]).toBeCloseTo(1);
    expect(frame.ways[1]).toBeCloseTo(0);
    expect(fast.busy(t + 0.1)).toBe(true);
    expect(fast.busy(t + WAKE_LIFE + 1)).toBe(false);
  });

  it("never hands the shader more than its slots", () => {
    const touches = new Touches();
    for (let i = 0; i < 20; i++) touches.tap(i, i, i * 0.01);
    expect(touches.frame(1).tapCount).toBe(TAP_SLOTS);
    let t = 0;
    for (let i = 0; i < 200; i++) touches.move(i * 30, 0, (t += 0.016));
    expect(touches.frame(t).wakeCount).toBeLessThanOrEqual(WAKE_SLOTS);
  });
});

describe("heartProfile", () => {
  const bins = 256;
  const profile = heartProfile(bins);
  const at = (turns: number) => profile[Math.round(turns * bins) % bins] ?? 0;

  it("has a radius in every direction, the farthest at 1", () => {
    expect(profile.length).toBe(bins);
    expect([...profile].every((r) => r > 0 && r <= 1)).toBe(true);
    expect(Math.max(...profile)).toBe(1);
  });

  it("is the same on its left and right", () => {
    for (let i = 0; i < bins; i++) {
      const mirrored = (bins / 2 - i + bins) % bins;
      expect(profile[i]).toBeCloseTo(profile[mirrored] ?? -1, 2);
    }
  });

  it("dips at the notch, straight up, between the two lobes", () => {
    expect(at(0.25)).toBeLessThan(at(0.25 + 0.06));
    expect(at(0.25)).toBeLessThan(at(0.25 - 0.06));
  });

  it("reaches as far up as down and as far left as right from its center", () => {
    const xs = [...profile].map(
      (r, i) => r * Math.cos((i / bins) * 2 * Math.PI),
    );
    const ys = [...profile].map(
      (r, i) => r * Math.sin((i / bins) * 2 * Math.PI),
    );
    expect(Math.max(...ys)).toBeCloseTo(-Math.min(...ys), 2);
    expect(Math.max(...xs)).toBeCloseTo(-Math.min(...xs), 2);
  });

  it("is centered on its box: the tip lies well out below, the notch nearer in above", () => {
    expect(at(0.75)).toBeGreaterThan(0.7);
    expect(at(0.25)).toBeLessThan(at(0.75));
  });
});
