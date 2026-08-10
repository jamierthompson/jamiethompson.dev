---
title: "My requirement was the bug and every AI agent served it faithfully"
description: "A QA agent filed a defect it couldn't test: a live test would hang the suite. That was my own requirement contradicting itself — and it had sat for 24 days."
pubDate: 2026-08-07
---

> On July 5 a QA agent reported three defects in the color engine. Two it pinned with failing
> tests. The third it filed as `it.skip`, with a reason: **a live test would hang the suite.**
>
> That was not a testing inconvenience. It was the engine's core promise contradicting itself in
> public. I read it, weighed the reasoning, and approved it — a defensible call for a young
> project. Then it sat unquestioned for another 24 days, because nothing in the process ever
> asked whether it should stay approved.

Every part of [the machinery I use to ship agent-written code](/essays/directing-agents/) did its
job here — the coding agents, and the adversarial QA that attacks what they build. The code in
question is a color engine: it takes whatever color an editor supplies and returns an accessible,
in-gamut palette. The failure was mine, and it's **the one failure the machinery cannot catch.**

The requirement was mine. I wanted the engine batteries-included, so I asked for `never throws` —
whatever an editor pastes, a usable palette comes back. Every agent that touched it afterward
served that goal faithfully, which is exactly the problem.

---

## The rule was mine, and it was load-bearing from day one

It went in on **June 21, 2026**, in the pre-build architecture audit — before a line of engine code
existed. From there it propagated into everything:

- `orientation.md` taught it in the four-point mental model an agent reads before touching
  anything: _"defensive — **never throws**."_
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

Put the skip next to the rule it was filed under and the contradiction is plain.

The promise was _this function always returns a usable value._ The finding was _here is an input for
which it never returns at all._ Not "returns the wrong thing" — **never returns**. A test can't be
written because there is no moment at which to make an assertion.

That is not a bug inside the design. **It is the design failing to be coherent.**

An engine that absorbs any input and always produces something cannot also be an engine that, on
some inputs, does not terminate — and the reason it couldn't terminate is that "any input" had
been taken literally enough to include values with no meaning. `Infinity` isn't a color. It isn't
even a wrong color.

The right question in July was: _what does it mean that we're defining behavior for inputs that
can't exist?_ The question the approval actually answered was narrower: _is this worth
over-building for, right now?_ And the lead's reasoning on that question was sound for a project
that young — we were still discovering what the engine would become, and not over-building was
the correct instinct. I read the skip, weighed that reasoning, and approved it.

Then we moved on. The project piled up complexity, and the decision — right at the time, no
longer right, and possibly never right — sat for **24 days**, **guarded by code that told every
agent it was settled.**

## What I understood 24 days later

What forced the question, 24 days on, was the same corner of the engine resurfacing — a bigger
project now, with more riding on the contract. This time I sat down with the engine's _contract_
rather than its bug list, and the rule came off. **"Never throws" is dead as an engine promise** — replaced by "always renders" as an
_application_ guarantee, and "deterministic, spec-faithful, fully receipted" as the engine's.

The realization was that **I didn't want a color engine that's a black box.**

A never-throws engine can't report that anything went wrong. Bad input and deliberate input produce the same shape of
output, so a caller can't distinguish a color the designer chose from one the engine silently
substituted. Batteries-included and opaque turned out to be the same property from two sides — and
I'd asked for the first without seeing the second.

The contract I actually want is three lanes under one rule, **nothing silent, ever**:

- **Contract violations** — NaN, non-finite channels, negative chroma — **throw a named error whose
  message teaches**: _"chroma −0.1 is negative, and chroma is an amount; if you meant the opposite
  hue, pass (0.1, H+180)."_ The `Infinity` case stops being a hang to sanitize and becomes a
  sentence explaining what you did wrong.
- **Untrusted input** — text from a CMS or a user — **returns null**. Expected-invalid isn't a
  violation. The _application_ owns fallback, and it's whole-value and **visible**, never a
  per-channel repair. The precedent is CSS, which drops an entire invalid declaration rather than
  fixing up one channel. **"Seeing the default theme _is_ the signal."**
- **Domain work** — gamut mapping, contrast solving — **succeeds with receipts as first-class
  output**: what moved, from what to what, by how much, which target cleared, what backed off and
  why.

The silent fallback was the feature. **In the new design it's the bug.**

---

## The lesson isn't about QA

It would be convenient to conclude that adversarial QA had a blind spot — it didn't. **The QA
agent surfaced the contradiction on the day it existed and documented why it couldn't be
tested.** The evidence was in the artifact, in plain language, 24 days before I fully understood
it. The rule that put [an unprimed reviewer in the room](/essays/the-qa-rule/) is worth having; this is
what it cannot reach.

The real failure mode is narrower and more uncomfortable:

> **An agent will find a way to satisfy the goal you gave it — including routing around evidence
> that the goal is wrong.**

`it.skip` with an honest reason _is_ a solution. It's a good one: it documents a real defect, keeps
the suite runnable, and doesn't fake a passing test. It solves "record this defect without hanging
CI" correctly. It just isn't an answer to "should this function accept `Infinity` at all," because
nobody asked that, so nobody answered it. The agent proposed a solution to the goal in front of it.
That is the job working as intended.

Nothing in the loop is positioned to ask whether the goal still makes sense. Coding agents
implement the requirement, QA agents enforce it, and both grow more confident as they go — and
once a guard is in the code, every agent treats whatever it protects as set in stone, **which is
exactly what they should do.** A decision the code has absorbed is never re-surfaced by the
agents building on top of it.

Re-opening it falls to the person directing the work — **me**.

And re-opening takes more than having understood a decision on the day it was made. I understood
this one; my reasons for approving it were sound. What I lacked was anything that would put the
decision back in front of me.

## What I changed

The reasoning I was given in July made sense at the time. What failed was that nothing ever interrogated it
again — so the change isn't a new gate or a new agent. It's what I ask for, and when. The
trigger isn't a decision's size or importance: **it's whether I fully understand it**, including
what it means for the decisions I haven't made yet. Any decision that fails that test now comes
back with:

- **What's actually wrong**, in plain language before the technical term
- **The fix, and the trade-off accepted** to get it
- **The alternatives considered**, including doing nothing
- **A recommendation**, stated as one — not a menu I'm left to arbitrate
- **The counter-argument** to that recommendation, argued at full strength

Not ceremony. The counter-argument is the part doing the real work: against a solution that looks
sound, the easy objections run out fast, and a counter-argument argued at full strength has
nowhere left to aim but the premise itself. The premise is exactly where this failure lived — a
goal that had stopped making sense, under a solution that served it well.

It also settled who I want across the table. The lead agent no longer writes code, even when the
task looks straightforward, because **I need a discussion partner more than I need another pair
of hands** — someone to ask for the pros and cons, the counter-opinion, the future-looking
questions about the parts whose implications I don't yet understand, while we build rather than
after a defect asks them for me. Those questions are the only re-evaluation a system like this
has, because the agents inside it are — correctly — busy treating settled decisions as settled.
Someone has to hold what the thing is _for_, and that can't be the same party that's busy
achieving it.

One gap remains: all of this still runs on me remembering to ask. Nothing puts an aging decision
back in front of me the way a failing test puts itself in front of an agent — **the questions have
a practice now, but no hook.**

## The honest version of the thesis

The thesis this system runs on is that an independent adversarial reviewer catches what the
author's confidence hid, and that it's worth the tokens. The other worked cases are the evidence
for it, and this case doesn't weaken it.

It completes it. The same machinery will just as faithfully help you build the wrong thing —
competently, with green checks that make you surer as you go. **The check on that failure isn't
another agent.** It's whether the person directing the work understands each decision well
enough to notice when the project has outgrown it. That's a discipline, not a process step — and
it's the part of this system I'd carry to any team, because it's the part that doesn't depend on
the agents at all.

[c99]: https://github.com/jamierthompson/digital-garden/commit/bfb9968b8dd12ebecbde17b1d9a76d36c2ceb56d

The practice: [Require the reasoning behind every solution](/notes/require-the-reasoning/).
