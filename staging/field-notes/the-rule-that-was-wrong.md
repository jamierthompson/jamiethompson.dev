# The test that couldn't be written

> On July 5 a QA agent reported three defects in the color engine. Two it pinned with failing
> tests. The third it filed as `it.skip`, with a reason: **a live test would hang the suite.**
>
> That was not a testing inconvenience. It was the engine's core promise contradicting itself in
> public, and I approved past it. It took me another 24 days to understand what I'd read.

The requirement was mine. I wanted the engine batteries-included, so I asked for `never throws` —
whatever an editor pastes, a usable palette comes back. Every agent that touched it afterward
served that goal faithfully, which is exactly the problem.

---

## The rule was mine, and it was load-bearing from day one

It went in on **2026-06-21**, in the pre-build architecture audit — before a line of engine code
existed. From there it propagated into everything:

- `orientation.md` taught it in the four-point mental model an agent reads before touching
  anything: *"defensive — **never throws**."*
- `testing.md` named it as something adversarial QA should probe.
- The `oklch-engine-reviewer` agent carried it as standing check five, closing with **"If tests
  don't cover these, that's a finding."**

So for five weeks it wasn't an opinion. It was the spec, enforced by a reviewer with its own tool
allowlist, taught to every incoming agent.

## The agents did their job

QA hunted violations and found real ones. On **July 5**, recorded in the fix's own commit body
([`bfb9968`][c99] — plain text there; code spans and emphasis added here for readability):

> `solveForeground({ chroma: Infinity })` threw RangeError (`chromaBackoff` grew its candidate array
> Infinity − 0.02 → Infinity until V8 died) and `gamutMap` / `buildRamp({ C: Infinity })` **never
> terminated** (the binary search's `hi` stayed Infinity, so `mid = (lo + hi) / 2` never shrank) —
> all on the public low-level surface documented pure/deterministic/**never-throws** (#99).

The agent documented all three findings honestly. Two became `it.fails` probes. The third couldn't
be tested live at all, so it wrote:

> `gamutMap`/`buildRamp` infinite-loop on it (**`it.skip` — a live test would hang the suite**).

That is good work. It found the defect, proved what it could, refused to fake what it couldn't, and
said why. The fix that followed sanitized non-finite chroma at the input boundary and flipped every
probe green. Nothing in that loop was sloppy.

## What I actually read, and what it meant

Read the skip against the rule it was filed under.

The promise was *this function always returns a usable value.* The finding was *here is an input for
which it never returns at all.* Not "returns the wrong thing" — **never returns**. A test can't be
written because there is no moment at which to make an assertion.

That is not a bug inside the design. It is the design failing to be coherent. An engine that
absorbs any input and always produces something cannot also be an engine that, on some inputs, does
not terminate — and the reason it couldn't terminate is that "any input" had been taken literally
enough to include values with no meaning. `Infinity` isn't a color. It isn't even a wrong color.

The right question in July was: *what does it mean that we're defining behavior for inputs that
can't exist?* The question I asked was closer to: *is this fixed and is the gate green?*

I approved the skip. It sat for **24 days**.

## What I understood 24 days later

Planning a public rebuild, the rule came off:

> Serializers are strict (non-finite input throws — it's a bug, say so); the old "collapse
> non-finite to 0" rule is dead; **"never throws" is dead as an engine promise**, replaced by
> "always renders" as an *app* guarantee and "deterministic, spec-faithful, fully receipted" as the
> engine's.

The realization was that **I didn't want a color engine that's a black box.** A never-throws engine
can't report that anything went wrong. Bad input and deliberate input produce the same shape of
output, so a caller can't distinguish a color the designer chose from one the engine silently
substituted. Batteries-included and opaque turned out to be the same property from two sides — and
I'd asked for the first without seeing the second.

The replacement is three lanes under one rule, **nothing silent, ever**:

- **Contract violations** — NaN, non-finite channels, negative chroma — **throw a named error whose
  message teaches**: *"chroma −0.1 is negative, and chroma is an amount; if you meant the opposite
  hue, pass (0.1, H+180)."* The `Infinity` case stops being a hang to sanitize and becomes a
  sentence explaining what you did wrong.
- **Untrusted input** — text from a CMS or a user — **returns null**. Expected-invalid isn't a
  violation. The *application* owns fallback, and it's whole-value and **visible**, never a
  per-channel repair. The precedent is CSS, which drops an entire invalid declaration rather than
  fixing up one channel. **"Seeing the default theme *is* the signal."**
- **Domain work** — gamut mapping, contrast solving — **succeeds with receipts as first-class
  output**: what moved, from what to what, by how much, which target cleared, what backed off and
  why.

The silent fallback was the feature. In the new design it's the bug.

---

## The lesson, which is not about QA

It would be convenient to conclude that adversarial QA has a blind spot. It doesn't, here. **The QA
agent surfaced the contradiction on the day it existed and wrote down exactly why it couldn't be
tested.** The evidence was in the artifact, in plain language, 24 days before I understood it.

The real failure mode is narrower and more uncomfortable:

> **An agent will find a way to satisfy the goal you gave it — including routing around evidence
> that the goal is wrong.**

`it.skip` with an honest reason *is* a solution. It's a good one: it documents a real defect, keeps
the suite runnable, and doesn't fake a passing test. It solves "record this defect without hanging
CI" correctly. It just isn't an answer to "should this function accept `Infinity` at all," because
nobody asked that, so nobody answered it. The agent proposed a solution to the goal in front of it.
That is the job working as intended.

Nothing in the loop is positioned to ask whether the goal still makes sense. Coding agents implement
the requirement, QA agents enforce it, and both grow more confident as they go. The owner is the
only participant who can notice that the requirement has stopped making sense — and the owner can
only notice by **understanding each decision well enough to see what it implies downstream.** I
wasn't doing that in early July. I was checking whether things were fixed.

## What I changed

I stopped accepting solutions and started requiring the reasoning behind them. Every decision of
consequence now comes with:

- **What's actually wrong**, in plain language before the technical term
- **The fix, and the trade-off accepted** to get it
- **The alternatives considered**, including doing nothing
- **A recommendation**, stated as one — not a menu I'm left to arbitrate
- **The counter-argument** to that recommendation, argued at full strength

Not ceremony. It's the only mechanism I've found that surfaces "this solves the stated goal, and the
stated goal is now wrong" — because a real counter-argument has to reach for the premise once the
surface objections are gone.

This is also why design decisions stay with me rather than being delegated. I used to justify that
as *agents drafting blind to owner intent optimize for the wrong thing.* The truer version: **an
agent optimizes for the goal it was given, competently, right up to and past the point where the
goal stops being right.** Someone has to hold what the thing is *for*, and that can't be the same
party that's busy achieving it.

The same shape shows up on a shorter timescale elsewhere in the project — a brief that said "sweep X
for Y" where Y didn't exist and was shared infrastructure:

> The failure mode of a wrong brief isn't disobedience, it's **competent execution of the wrong
> instruction.**

That one was caught in an hour by a read-only audit running in parallel. This one took 38 days,
because there was no parallel audit of the premise — only of the work.

## The honest version of the thesis

An independent adversarial reviewer catches what the author's confidence hid, and it's worth the
tokens. The rest of this repo is the evidence for that.

It will also faithfully help you build the wrong thing, and it will do so competently, and its
green checks will make you more sure. The check on that isn't another agent. It's whether the person
directing understood the decision well enough to see where it leads — which is a discipline, not a
process step, and it's the one I'd take to any team.

[c99]: https://github.com/jamierthompson/digital-garden/commit/bfb9968b8dd12ebecbde17b1d9a76d36c2ceb56d
