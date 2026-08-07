# The six hues that pass

> A test file declared its constants as *"Assorted seed hues spanning the wheel, incl. the
> yellow/cyan stressers."* Six numbers. Every one passed. Adding a seventh — **ten degrees away
> from one already in the list** — broke the suite's own tolerance.
>
> The fixture wasn't sampling the wheel. It was, functionally, the set of hues that pass.

This is the case about **what a test's inputs are actually proving**. The other cases here concern
who reviews and when; this one is about the quiet assumption underneath every fixed fixture — that
the handful of values you chose stand in for the space you didn't.

You can reproduce it in about a minute. Instructions at the bottom.

---

## The fixture

`packages/oklch/src/gamut.test.ts`, line 7 of the file, unchanged for weeks:

```ts
/** Assorted seed hues spanning the wheel, incl. the yellow/cyan stressers. */
const HUES = [29, 110, 145, 195, 260, 330];
```

Read the doc comment against the array. It claims two things: that the values **span the wheel**,
and that they include the known **hard cases**. Both sound like diligence. Six points across 360
degrees is one sample every 60 degrees, and the gaps are where the assertion lives.

Every test in that file runs `it.each(HUES)`. The load-bearing assertion is that gamut mapping
reduces chroma while **holding lightness**:

```ts
const out = gamutMap({ L: 0.6, C: 0.4, H }, "srgb");
expect(inGamut(out, "srgb")).toBe(true);
expect(out.L).toBeCloseTo(0.6, 2);   // L is held; only chroma reduces
```

## What happens when you add one hue

Running the suite's own six, plus **250**:

```
✓ hue 29    ✓ hue 110   ✓ hue 145   ✓ hue 195   ✓ hue 260   ✓ hue 330
× hue 250

AssertionError: expected 0.6071104243926799 to be close to 0.6,
received difference is 0.007110424392679948, but expected 0.005
```

Six pass. The seventh fails, and it sits **ten degrees from 260**, which passes comfortably. The
lightness drift is 0.0071 against a 0.005 tolerance — small, real, and entirely invisible to a suite
that never asked.

Nothing about hue 250 is exotic. It is an ordinary blue. It was simply not one of the six.

## Why this is the sharpest version of the lesson

A hand-picked fixture is selected by someone who already has a mental model of the problem. It
samples the places they thought to look — which is why it goes green, which is why it feels like
proof. The comment above the array is not a lie; it is what the author sincerely believed the array
did. The array's actual function was narrower: it was the set of values under which the assertion
holds.

The QA pass that found this put it plainly:

> **Hand-picked test constants hide bugs:** the old suite's six hues were, functionally, the hues
> that pass (adding hue 250 broke its own tolerance). New suites sweep; a fixed list of "assorted"
> constants is a smell.

**"A fixed list of 'assorted' constants is a smell"** is the rule worth carrying out of this repo.
The word *assorted* is the tell — it asserts coverage while naming no criterion. A list justified by
a stated rule ("both APCA stressers, both gamut extremes, the fallback path") is a different thing
from a list justified by the word *assorted*.

## The same failure, three weeks earlier, at higher stakes

The pattern had already cost a P0 once. On 2026-07-01, QA found that every contrast-solved color
landed *exactly* on its accessibility floor and then got rounded to four decimals on the way into
the stylesheet — so **~42% of shipped color pairs sat microscopically below the floor they were
engineered to meet.** Every test passed, because every test measured the solver's output rather than
the bytes that shipped.

The fix was correct. But its commit also asserted that a *different* path, one it hadn't touched,
was already safe — on the evidence of a five-seed test. A second QA pass swept 190,000 combinations
and found a P0 sitting on exactly that path, in **greens and cyans**, hues the five seeds never
visited. The correction is in the author's own commit body ([`732c0d4`][c2]):

> **Adversarial QA (190k-combo sweep) caught a P0 the first commit's own test missed** […] ~15
> seeds across greens/cyans/blues, both gamuts/schemes, on WCAG and APCA. Exactly the class #79
> exists to kill, on the path the first commit skipped. My initial "accent path already carries
> enough margin" claim was wrong — **a fixed 5-seed test never hit the edge.**

Five fixed seeds were replaced with a generated 9-hue × 3-lightness × 2-chroma sweep plus QA's exact
edge cases, and re-verified against an independent **359,040-combination sweep: zero violations**.
The reasoning was written into the test file, where the next person will trip over it:

```ts
// A generated hue × L × chroma sweep, NOT a handful of fixed seeds — the accent fill /
// accent-foreground path solves on a discrete-L scan whose floor-hugging edge only shows under a
// real sweep (a fixed-seed list silently misses it).
```

## What a genuinely adversarial pass turns up

For contrast, here is the rest of what the 2026-07-29 review of that same gamut module found, once
it stopped sampling and started checking against the specification and an independent
implementation:

- **A basis bug making wide-gamut output duller than narrow.** Clipped Display-P3 channels were
  measured through the *sRGB* perceptual basis, so P3 came out **less saturated than sRGB at 45% of
  sampled points, worst case 2.25×** — the opposite of what a wider gamut is for. The invariant
  nobody had written down (P3 ≥ sRGB) is now a swept test.
- **It wasn't the specified algorithm.** The search stopped at the first sub-threshold midpoint; CSS
  Color 4 continues upward, with a pre-loop check and an early return the transcription omitted.
- **Negative chroma passed straight through** the in-gamut fast path, where the spec clamps it at
  parse time.
- **Perceptual claims were being checked non-perceptually.** "Lightness and hue hold" is only
  meaningful within the just-noticeable difference — at near-zero chroma, large hue swings are
  invisible, and a per-channel epsilon is worthless at mid-gray while being a full JND near black.
- **One design survived.** The memoization was attacked six ways — fresh-copy-out, alpha-free keys,
  bounded clear-on-overflow — and held. Worth reusing *if* profiling justifies a cache at all, which
  is a separate decision and shouldn't be assumed.

Five findings and one acquittal. Note the last one: a review that only ever confirms damage isn't
reviewing, it's demolishing. Recording what survived is what makes the findings credible.

---

## Three rules

**A fixture is a claim about a space, and it is usually wrong.** Six hues do not span a wheel; five
seeds do not span a color space. If the assertion is about all inputs, sweep. If sweeping is too
slow, sweep in one place and say in the fixed tests that they are examples, not coverage.

**"Assorted" is a smell.** Any constant list needs a stated selection rule. If the only justification
is that the values look varied, they were chosen by the same intuition that wrote the code — and
they will agree with it.

**Verify the artifact, not the intermediate.** The contrast bug lived entirely in the gap between
the solver's output and the rounded literal that reached the browser. Everything measured the
former. Ask what your tests measure versus what actually ships; the difference is where this class
of bug lives.

---

## Reproduce it

```bash
git clone https://github.com/jamierthompson/digital-garden && cd digital-garden && pnpm install
```

Add `250` to the `HUES` array in `packages/oklch/src/gamut.test.ts`, then:

```bash
npx vitest run packages/oklch/src/gamut.test.ts
```

The six original hues pass; 250 fails on `expect(out.L).toBeCloseTo(0.6, 2)` with a lightness of
`0.6071104243926799`. Verified on 2026-08-06 against the repository's final commit.

[c2]: https://github.com/jamierthompson/digital-garden/commit/732c0d4aab2b96306bc7b0cb66f90e0ceb37eab2
