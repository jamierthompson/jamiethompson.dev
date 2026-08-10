---
title: "A fixed list of assorted constants is a smell"
description: "A hand-picked fixture is a claim about a space, and it is usually wrong — it samples where the author thought to look. Any constant list needs a stated rule."
pubDate: 2026-08-07
---

A test fixture is a claim about a space, and a hand-picked one is usually wrong. Any constant list
needs a **stated selection rule** — "both APCA stressers, both gamut extremes, the fallback path"
is a fixture; "assorted" is a smell.

The word _assorted_ is the tell: it asserts coverage while naming no criterion. A hand-picked
fixture is selected by an author — human or AI agent, it makes no difference — who already holds a
mental model of the problem, so it samples the places they thought to look — which is why CI goes
green, and why green feels like proof. The values weren't chosen to pass, but they were chosen by
the same intuition that wrote the code, and they will agree with it. If the assertion is about all
inputs, sweep; if sweeping is too slow, sweep in one place and mark the fixed tests as examples,
not coverage.

A prompt is the same kind of claim: the cases you tried are the ones you thought to try, so
[[measure-dont-vibe-check|run it against a baseline]].

And verify the artifact, not the intermediate: the costliest version of this failure lived in the
gap between a solver's output (tested) and the rounded bytes that shipped (untested).

The fixture that claimed to span the color wheel — and the seventh hue that broke it — is worked
through in [Hand-picked test values only prove the cases you thought of](/essays/sweeps-vs-fixed-seeds/).
