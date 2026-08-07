# I evaluated my own orchestration tool. It lost twice.

> A prompt or a skill is a system whose behavior you should **measure**, not vibe-check. So
> before the orchestration skill merged, I ran it against a baseline. It scored parity — and the
> baseline reasoned *better* in two specific ways. Both became edits before merge.

---

## What was under test

The `agent-team` skill packages the orchestration pattern — preflight, the staffing decision,
how to brief a teammate, how the lead curates history. The question:

> **Does a session *with* the skill produce a better team-lead orchestration plan than a session
> *without* it?** The unit under test is the **plan** — preflight, mode choice, verbatim spawn
> briefs, work split, close-the-loop — not an actually-run team.

The plan, not the run, because a subagent can't spawn a nested team, and the plan is what the
skill most directly shapes. That is a real limitation and it is stated up front rather than
discovered by a reader.

## Method

Four prompts, one per mode, each run twice — once with the skill, once without. Eight runs.

**The baseline had to be built carefully.** A project skill auto-loads into any spawned
subagent, which would have contaminated every baseline run:

> Because `.claude/skills/agent-team/` is a project skill, any spawned subagent would auto-load
> it — contaminating the baseline. So for the eval the live skill was **parked** out of
> `.claude/skills/` and a copy staged elsewhere; with-skill runs were pointed at the staged
> path, and the skill was **restored** afterward.

The prompts were written the way the repo owner would actually type them, not as clean test
inputs:

| Mode | Prompt |
|---|---|
| Decision | *"I'm torn on whether the OKLCH engine emits both light+dark via `light-dark()` or stores per-scheme tokens — this locks the engine signature for every project. Spin up a team to settle it properly."* |
| Review | *"Review PR #5 before I merge — I want security, test coverage, and our repo conventions all checked, not a single once-over."* |
| Debug | *"On `/work/<slug>` the brand color flashes the wrong hue for a split second on first paint then corrects. No idea if it's caching, `@layer` order, or hydration. Get to the bottom of it."* |
| Coding | *"Build the ProjectScope feature across the data layer, the component, and tests — split it up so we move fast."* |

### Two prompts were traps

> PR #5 **does not exist** in the repo (latest is #4, all merged), and the `/work/<slug>` route
> + OKLCH engine **aren't built yet**. A plan that spawns a team against a non-existent target
> is failing preflight.

This is the part I'd defend hardest. It is easy to write an eval where every input is valid and
every plan looks competent. Grading whether a plan *notices its target doesn't exist* tests
something a happy-path eval cannot: does the orchestrator check reality before spending money?

Both conditions caught both traps. That is the least interesting result and the most reassuring
one.

## The scorecard

| Mode | With skill | Baseline | Notes |
|---|:--:|:--:|---|
| Decision | **7/7** | — (lost) | Caught that an existing decision already covered this; reframed as reaffirm-vs-supersede. |
| Review | **7/7** | **7/7** | Both caught the PR-#5-doesn't-exist trap. Baseline *also* named an existing review orchestrator as a substitute and reasoned that review is convergent (no debate needed). |
| Debug | **6/6** | strong | Both caught the route-doesn't-exist trap. **Baseline made the sharper staffing call** — subagents for diagnosis, team for the fix. |
| Coding | **7/7** | — (lost) | Froze a contract up front to parallelize a dependency chain; verified file-disjointness. |

## The finding that mattered was about the baseline

> Because this repo's `working-with-agents.md` already encodes the whole pattern, a general
> agent that reads the handbook *also* scored ~7/7. So the skill's marginal lift is real but
> **modest** — and the baselines exposed two places the skill was actually **weaker**:
>
> 1. **It over-steered toward spawning a team.** The baseline debug plan made the sharper call —
>    read-only **subagents** for diagnosis, a **team only for a multi-file fix** — while the
>    with-skill plan spawned a 4-agent team for diagnosis.
> 2. **It missed the existing review orchestrator.** The baseline named the installed
>    `pr-review-toolkit:review-pr` skill as the ~80% substitute; the with-skill plan didn't.

Stated more bluntly in the findings file:

> **The baseline's instinct was the better one.**

and, closing the second point:

> The skill should make the agent *more* aware of existing tools, not less.

That is an uncomfortable result for something I'd just spent a day building. It is also the
only result that changed anything.

### Both losses became edits, before merge

**Loss 1 → phase-aware staffing.** A new rule in the skill:

> **Staffing can change by phase — re-run this test per phase; don't lock in "team" for the
> whole job.** The sharpest case is **debugging**: pure root-cause *diagnosis* is read-only and
> is often best as parallel **subagents**, while the **multi-file fix** afterward is a team.
> When a mode reference says "spawn N teammates," it assumes you've already passed this test
> *for that phase* — if a phase is read-only fan-out with no cross-talk, downgrade it to
> subagents and say so.

**Loss 2 → check the lighter options first.** A new callout in the review mode:

> Two installed capabilities already cover much of this — name them in your preflight and
> justify the team over them, don't silently skip them. If either fits, recommend it and stop.

Two days later a production session recorded the first rule paying for itself: *"the right shape
was a small team with a lead-fixed contract, not a big fan-out. Re-running the team-vs-solo test
per phase caught this."*

## What the eval could not establish

> **6 of 8 runs landed.** An Anthropic platform incident (elevated error rate, 2026-06-23
> ~14:19–14:53 UTC) killed two baseline subagents across two retries. The conclusions rest on
> the 4 with-skill plans + the 2 baseline pairs that completed; the decision/coding baseline
> deltas are **inferred, not measured**. Flagged rather than smoothed over.
>
> **Quantitative grading is assertion-pass-rate, judged by the lead from the verbatim plans** —
> not a token/latency benchmark (the incident made timing data unreliable).

And what was deliberately left undone:

> **No second eval round** was run: the edits are additive guardrails, and the platform incident
> made more subagent runs unreliable. The before/after for decision/coding baselines remains
> inferred.

Two of eight runs died. The honest options were to re-run until the numbers were clean, quietly
report the six that worked, or say which conclusions rest on inference. The third is the only
one that survives someone reading carefully.

## The verdict that shipped

> **Ship it.** After the iteration it is also honest about its own cost — it actively routes
> work to subagents, a single session, or an existing skill when those are the right tool, and
> only spawns a team when the cross-examination or parallel file-ownership genuinely earns the
> ~15× token premium.

(That "~15×" is my own error, preserved here because it's a quote. Anthropic's figure is 15× a
*chat* interaction and ~4× a *single agent* — see the README's cost note. The verdict holds; the
multiplier in it was inflated about fourfold.)

## Why I keep pointing at this one

The result is unflattering: a tool I built performed roughly at parity with no tool at all,
because the documentation it was distilled from was already doing the work. Two of eight runs
were lost to an outage. The clearest signal in the data was that my tool was **worse** than the
baseline in two specific ways.

That is what an eval is *for*. An eval that confirms the thing you already shipped taught you
nothing and cost you a day. The reason to run it before merge rather than after is that
before merge, a losing result is free.

The same discipline applies to anything LLM-shaped in a product: define the unit under test,
build a genuinely uncontaminated baseline, plant inputs where the correct answer is "stop, this
target doesn't exist," and publish the runs you lost.
