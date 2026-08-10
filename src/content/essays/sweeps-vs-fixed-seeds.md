---
title: "Hand-picked test values only prove the cases you thought of"
description: 'A test fixture labeled "assorted seed hues spanning the wheel" held six values, all passing. A seventh — ten degrees from one already in the list — failed the suite''s own tolerance. Why fixed fixtures flatter the code they test, and what a 190,000-combination sweep found instead.'
pubDate: 2026-08-07
---

> A test file declared its constants as _"Assorted seed hues spanning the wheel, incl. the
> yellow/cyan stressers."_ Six numbers. Every one passed. Adding a seventh — **ten degrees away
> from one already in the list** — broke the suite's own tolerance.
>
> The fixture wasn't sampling the wheel. It was, functionally, the set of hues that pass.

This is a worked case from [Directing AI agents](/essays/directing-agents/), the system I use to ship
production code written by coding agents. The code under test is a color engine that solves
palettes against accessibility-contrast targets, and an independent QA pass noticed something
unsettling about its test suite: **it was green, and it was lying.** This is the case about **what a
test's inputs are actually proving** — the quiet assumption underneath every fixed fixture that the
handful of values you chose stand in for the space you didn't.

---

## The fixture

The file was `packages/oklch/src/gamut.test.ts`, and line 7 had sat unchanged for weeks:

```ts
/** Assorted seed hues spanning the wheel, incl. the yellow/cyan stressers. */
const HUES = [29, 110, 145, 195, 260, 330];
```

The comment reads like diligence: the values cover the whole wheel, and the known hard cases are
included. For weeks I had no reason to doubt it — six varied-looking numbers under a confident
comment are exactly what thoroughness looks like. But six points across 360 degrees is one sample
every 60 degrees, and everything the comment promises lives in the gaps.

Every test in the file ran `it.each(HUES)`. The one carrying the most weight asserted that gamut
mapping reduces chroma while **holding lightness**:

```ts
const out = gamutMap({ L: 0.6, C: 0.4, H }, "srgb");
expect(inGamut(out, "srgb")).toBe(true);
expect(out.L).toBeCloseTo(0.6, 2); // L is held; only chroma reduces
```

## The seventh hue

The experiment that broke the spell was simple: keep the suite's own six hues
and add one more. The QA agent picked **250** — an ordinary blue, ten degrees from 260, which
passes comfortably.

```
✓ hue 29    ✓ hue 110   ✓ hue 145   ✓ hue 195   ✓ hue 260   ✓ hue 330
× hue 250

AssertionError: expected 0.6071104243926799 to be close to 0.6,
received difference is 0.007110424392679948, but expected 0.005
```

The lightness drift is 0.0071 against a 0.005 tolerance — small, real, and entirely invisible to a
suite that never asked. Nothing about hue 250 is exotic. It was simply not one of the six.

## Nobody cheated

That is the unsettling part. The array and its comment were written by a coding agent, and the
comment is not a lie — it is what the agent sincerely believed the array did. Nothing here is
special to AI, though: a hand-picked fixture, whether a person picks the values or an agent does,
is chosen by an author who already holds a mental model of the problem, so it samples the places
they thought to look. That is why it goes green, and why green feels like proof. The array's true
function was narrower than its comment: it was the set of values under which the assertion holds.

The QA agent that found it put it plainly:

> **Hand-picked test constants hide bugs:** the old suite's six hues were, functionally, the hues
> that pass (adding hue 250 broke its own tolerance). New suites sweep; a fixed list of "assorted"
> constants is a smell.

**"A fixed list of 'assorted' constants is a smell"** is the rule worth carrying away.
The word _assorted_ is the tell — it asserts coverage while naming no criterion. A list justified by
a stated rule ("both APCA stressers, both gamut extremes, the fallback path") is a different thing
from a list justified by the word _assorted_.

## The same failure, four weeks earlier, at higher stakes

The pattern had already cost a P0 once. On July 1, 2026, QA found that every contrast-solved color
landed _exactly_ on its accessibility floor and then got rounded to four decimals on the way into
the stylesheet — so **~42% of shipped color pairs sat microscopically below the floor they were
engineered to meet.** Every test passed, because every test measured the solver's output rather than
the bytes that shipped.

The fix was correct. But its commit also asserted that a _different_ path, one it hadn't touched,
was already safe — on the evidence of a five-seed test. A second QA agent swept 190,000
combinations and found a P0 sitting on exactly that path, in **greens and cyans**, hues the five
seeds never visited. The coding agent owned the correction in its own commit body — "my" here is
the agent, writing before I merged it ([`732c0d4`][c2]):

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

## The fixture was hiding more than one bug

The seventh hue was only the opening find. The reviewing agent kept going — checking the module
against the specification and an independent implementation instead of sampling it — and its
July 29 report turned up:

- **A basis bug making wide-gamut output duller than narrow.** Clipped Display-P3 channels were
  measured through the _sRGB_ perceptual basis, so P3 came out **less saturated than sRGB at 45% of
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
  bounded clear-on-overflow — and held. Worth reusing _if_ profiling justifies a cache at all, which
  is a separate decision and shouldn't be assumed.

Five findings and one acquittal — and the acquittal matters, because a review that only ever
confirms damage isn't reviewing, it's demolishing. Recording what survived is what makes the
findings credible.

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

[c2]: https://github.com/jamierthompson/digital-garden/commit/732c0d4

The fixture never lied. It answered exactly the questions it was given — honestly, six at a time,
for weeks — because that is all a green suite ever does. The fix was never a better list of hues.
It was **taking the choice of questions away from the intuition that wrote the answers**: a
generated sweep with a stated selection rule, and a reviewing agent with no stake in the outcome. The rule
this case distilled is
[A fixed list of assorted constants is a smell](/notes/assorted-is-a-smell/); the system that put
that reviewer in the room is [Directing AI agents](/essays/directing-agents/).
