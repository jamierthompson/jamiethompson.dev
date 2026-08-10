---
title: "Four AI agents debated to a verdict and one measurement overturned it"
description: "Four AI agents drafted independently, cross-examined each other, and converged. A spike then tested the two facts the verdict rested on; both were false."
pubDate: 2026-08-07
---

> Four agents drafted independently, cross-examined each other, and converged on an answer. A
> spike then tested the two facts the answer rested on. **Both were false.** The verdict
> reversed, and the reasoning that pointed the wrong way was kept intact rather than rewritten.

For decisions that are expensive to reverse, [my agent workflow](/essays/directing-agents/) doesn't
ask one agent for an answer. It spawns several, each drafting a complete proposal through a
different professional lens before seeing the others', then has them cross-examine each other in
writing. The theory is that independent perspectives catch what a single context window can't.
This essay is the case study for what that theory misses, and for the least comfortable rule in the
system: **a debate produces a hypothesis, not a decision.** The decision comes after someone
measures.

---

## The setup

A shell-level theming question — where a site-wide brand color should be sourced from. Four
independent lenses, each drafting blind before seeing the others:

| Lens                 | Brief                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| **Architect**        | Abstraction altitude, coupling, where the branch belongs                  |
| **Sanity-model**     | The content model and the CMS↔code contract                               |
| **Framework-fit**    | What the _installed_ framework version actually sanctions                 |
| **Devil's advocate** | A standing seat, whose job is to argue the opposing case at full strength |

Round 1 was written in isolation. Round 2 was adversarial — each lens challenging, defending, or
conceding against the others in writing.

The debate converged on a code-config approach — source the brand from code rather than from the
CMS. The reasoning rested on two load-bearing claims: that the visual flash being fixed was a real
user-facing defect, and that a framework constraint made the alternative unworkable.

## The devil's advocate did its job first

Before the reversal, the devil's-advocate agent wrote the strongest possible case _against_ doing
anything at all — and it is worth reading because the agent argues, at full strength, for the
opposite of what it believed:

> ## 1. The "do nothing" case — at full strength
>
> - **Production build (`pnpm build && next start`), draft mode: ZERO unbranded frames.** […]
> - **Dev server: 1 unbranded frame (~14 ms).** Imperceptible, and it is a `next dev` artifact
>   […]
>
> […] "Leave it, ship features […]" is a defensible engineering call, and a junior reviewer who
> said "you're spending a debate + a refactor + test churn on a 14 ms dev-only frame" would not
> be wrong on the numbers.

Then it gave its own verdict against itself:

> **Why it does NOT hold (my honest verdict).** The "do nothing" case defends the _flash_. But
> the flash was never the real defect — it is a **symptom**. […] That is three `[D#]`s of scar
> tissue ([D9], [D11], [D16]) and a ~40-line load-bearing comment block (`layout.tsx:89-128`)
> standing guard over a **wrong shape**. […]
>
> **Verdict:** "do nothing" wins on _user impact_ and loses on _shape_. […] So: reject "do
> nothing," but **steal its discipline** — whatever we build must be _simpler_ than what's
> there, not a lateral move […].

The remarkable thing is what it surfaced in the course of losing: **production had zero unbranded
frames.** The flash was dev-only. The critic did not measure that itself — it **cited an existing
measurement** from an earlier spike commit, and pulled it into the argument where nobody had
weighted it. That is the thread that unraveled the verdict, and it surfaced because the seat's
rule is _every challenge must cite a source_.

## Then the spike ran

Rather than let predictions duel, the load-bearing claims were tested. The spike document is the
most self-critical artifact in the whole archive, because the agent that wrote it corrects
**itself** twice:

> Two passes: a first synchronous-shell spike, then — **prompted by the driver's question "did
> you test the _current_ implementation on prod+draft?"** — three **controls** (A/B/C) that
> **corrected two of my own conclusions.** Read the controls; they supersede the first pass
> where they conflict.
>
> **Control A — the current (unmodified) implementation on prod + draft. The baseline I'd
> skipped.**

And on the framework claim everyone had accepted:

> My first pass guessed the predicted error didn't fire because `VisualEditingControls` licenses
> the metadata read. **I tested that guess and it is wrong.** So **nothing** was licensing it —
> the existing comment's _"remove this boundary and `generateMetadata` throws…"_ is **not what
> happens.**

It also scoped its own refutation honestly instead of overclaiming:

> **Scope honestly:** Control C used a **synchronous** shell, so it isolates the **metadata**
> half. […] **I refute only the metadata half.** The deeper framework internals […] were not
> exhausted — **under draft everything renders dynamically, which likely explains it,** but I did
> not prove it.

## Both pillars fell

> The debate first reached a **code-config** verdict. Then the spike showed (a) the flash is
> **dev-only** — prod was already clean, and (b) the framework blocker **doesn't exist**; and
> the **islands** frame showed the shell brand is _editorial content, not a constant_, so the
> "wrong shape" premise dissolved. **Both pillars of the config verdict fell.**

The debate had been sound _on its premises_. The premises were wrong. Four capable agents
cross-examining each other did not overturn them, because **nobody ran the control** — the
current implementation, on a production build, under draft. They reasoned from a shared,
unverified starting point, and **adversarial debate sharpens reasoning without ever testing its
inputs.** The one measurement already in the room, cited by the critic, was not enough on its own to
move the verdict; it took someone going and running the missing test.

## What was kept

The synthesis document was not rewritten. It opens with the outcome and preserves the
superseded reasoning underneath it:

> Read `synthesis.md` §0 as the outcome; the round drafts and §1–§8 as the (sound, on its
> premises) reasoning that pointed the other way.

The wrong path is legible on purpose. The next person to ask this question needs to know it was
already argued well and still came out wrong — otherwise they will re-run the same debate and
reach the same doomed verdict.

## The mechanism that made it work

From the session's own method note:

> Lenses drafted blind, then debated via direct messaging; the lead **verified the load-bearing
> facts independently** and **fed them back** so the debate — and the reversal — ran on
> **measured ground truth, not inference.**

That is the actual job of the lead agent running the debate. Not adjudicating who argued best —
**finding the claim everyone is standing on and going to check it.**

The same move appears in another debate the same week, where two lenses had opposite predictions
about runtime behavior:

> The crux claims were **runtime-testable**, so rather than let the team duel over predictions,
> the lead reproduced real Draft Mode and tested. **ShellGuardian CORRECT, FrameworkFit REFUTED**
> **on the narrow claim** […] **But ShellGuardian also CORRECT that it's only half a fix.**

The adjudication is deliberately narrow — one lens refuted _on one claim_, while the lens that won
that point is told in the same breath that its own fix is incomplete. Two positions changed in
writing after that. One lens withdrew both its objection _and_ its own preferred fix.

---

## Three rules this produced

**A debate produces a hypothesis, not a decision.** Independent drafting plus adversarial
cross-examination is a superb way to enumerate options and find weak arguments. It is worthless
against a false shared premise — every participant inherits it. If a crux claim is testable,
test it before the debate converges, not after.

**Test the testable mid-debate.** Both reversals came from someone stopping the argument to run
an experiment. Predictions are cheap; controls are not. A swept test does the same to a hand-picked one:
six hues that looked like coverage were
[functionally the set of hues that pass](/essays/sweeps-vs-fixed-seeds/).

**Preserve the reasoning that lost.** A synthesis that quietly rewrites itself to match the
final answer destroys the only record of why the wrong answer was attractive — and the wrong
answer will be attractive again.

There is a fourth, harder one. **The critic that argues the opposing case at full strength will
surface the fact that undercuts your position** — here, "production had zero unbranded frames,"
carried into the argument by the very agent that went on to argue for changing things. It didn't
run that measurement; it went and found one, because the seat's binding rule is that every
challenge must cite a source. A devil's advocate that only performs skepticism never turns
anything up. The citation requirement is what makes the seat an instrument rather than an
obstacle.

---

The full record is public in the source repo's retired session archive: the four blind drafts,
both debate rounds, the spike's controls, and the synthesis that preserves the superseded
reasoning are at [`2026-06-26-shell-sourcing-islands`][record], and the draft-preview debate
quoted alongside it at [`2026-06-25-item-c-draft-preview-debate`][record2]. The `[D#]`
references are entries in the decision register retired with them ([`e7a7232`][tree]).

[record]: https://github.com/jamierthompson/digital-garden/tree/e7a7232/docs/sessions/2026-06-26-shell-sourcing-islands
[record2]: https://github.com/jamierthompson/digital-garden/tree/e7a7232/docs/sessions/2026-06-25-item-c-draft-preview-debate
[tree]: https://github.com/jamierthompson/digital-garden/tree/e7a7232/docs

The rule: [A debate produces a hypothesis rather than a decision](/notes/debate-produces-a-hypothesis/).
