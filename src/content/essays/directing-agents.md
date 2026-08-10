---
title: "Directing AI agents: how I ship production code I didn't write"
description: "Shipping agent-written code is a structure problem, not a prompting one: a lead that never authors, unprimed reviewers, and measurement over confidence."
pubDate: 2026-08-08
---

I don't write most of the code I ship. Agents do. I read every change before it merges, and I own
the architecture and every design call behind it. What makes that work isn't better prompting —
it's a division of labor with a hard separation between building and checking.

A coding agent will hand you work that passes lint, passes types, passes the tests it wrote, and
builds clean — and is still wrong at the edges. It optimizes for "make it work," so it tests the
path it just built and not the malformed input, the empty state, the error route, or the second
color scheme. **The failures look like success:** every one of them is green, so no gate flags
them and no dashboard shows them.

That is a structure problem, and prompting doesn't solve structure problems. What follows is the
structure I use instead — three commitments, each with published evidence — and the case that
they come down to the same two capabilities that separate mature AI practice at any scale:
governance and measurement.

## The system

Four roles.

- **Me.** I decide what gets built and why, and nothing merges that I haven't read. Product and
  interface design stay here — an agent drafting blind to intent optimizes confidently for the
  wrong thing.
- **A lead agent**, my conversation partner. It never writes feature code: it writes the briefs,
  spawns the workers, keeps state in files rather than context windows, assembles the finished
  slices, and runs the full gate over the result.
- **A coder agent** per slice, in its own context window, working from the files it owns and
  nothing else.
- **A QA agent** per coder, which receives the finished diff and the original requirements —
  nothing else — and tries to break it.

QA proves each defect with a failing test; the coder fixes it; QA re-checks. When the assembled
result is green, it becomes a pull request with the QA log in the body, and it merges after I've
read it. On the month-long build this system was designed against, 112 of 144 merged pull
requests carry that log. The complete working rules — briefing, staffing, handoffs, gates — are
public at
[agent-conventions](https://github.com/jamierthompson/agent-conventions), with
[`docs/agent-workflow.md`](https://github.com/jamierthompson/agent-conventions/blob/main/docs/agent-workflow.md)
as the load-bearing file.

## The builder never checks its own work

The first commitment: every slice is attacked by a reviewer with **no prior context of the
work** — not merely "not the author." A teammate that helped design or debate a slice reviews it
against intent it already agreed with, so it is disqualified even though it didn't type the
code. The lead makes this structural rather than aspirational: it hands the reviewer the
finished diff and the original requirements, and the rationale stops there. Priming isn't
something the reviewer resists; it's something the handoff makes unavailable.

What that separation catches, on the record:

- **A contrast failure no gate could see.** Two CSS custom properties resolved to nothing and
  fell through to defaults, dropping a badge to 1.54:1 in light and 1.87:1 in dark — failing
  WCAG AA in both schemes while every check stayed green.
  [PR #14](https://github.com/jamierthompson/digital-garden/pull/14) logs it, re-verified after
  the fix at 11.35:1 and 9.43:1.
- **Guard tests that proved nothing.** A label rename left five tests asserting against the old
  word; all five passed regardless of behavior. The reviewer proved it by sabotaging the target
  and watching seven tests fail across five surfaces.
- **A documented tool that never existed.** An agent had written a plausible lint command into
  the docs, and every agent after it read that as fact. The fix was to build it for real.

The exact wording of the rule is load-bearing.
[Briefing your AI reviewer turns it into a second author](/essays/the-qa-rule/) traces it from
"fresh reviewer" to "no prior context" and shows what each tightening caught — including a
ship-blocking regression sitting behind a fully green gate.

## No claim of consequence survives on confidence

The second commitment: when a decision rests on a testable fact, someone runs the test before
the decision lands.

The sharpest demonstration is a design debate in which four agents drafted independently,
cross-examined each other, and converged — soundly, on their premises — on the wrong answer. A
spike then tested the two facts the verdict rested on and refuted both.
[Four AI agents debated to a verdict and one measurement overturned it](/essays/the-reversal/)
is the full record, including why the reasoning that lost was preserved.

The same commitment applies to my own tooling. Before the orchestration skill merged, I
[evaluated it against an uncontaminated baseline](/essays/agent-team-skill-eval/) — four
prompts, two carrying deliberate traps. It scored parity, and the baseline reasoned better in
two specific ways; both losses became edits before the merge. And when a test suite's
hand-picked fixtures claimed coverage they didn't have,
[a swept replacement](/essays/sweeps-vs-fixed-seeds/) — 190,000 combinations, then an
independent 359,040 — found the accessibility defect the fixtures never could.

Even staffing decisions run on published data rather than instinct. Anthropic's figures put a
single agent at roughly 4× the tokens of a chat interaction and a multi-agent system at about
15× ([source](https://www.anthropic.com/engineering/multi-agent-research-system)), so the full
multi-agent pattern is reserved for the decisions that earn it, and staffing is re-chosen per
phase rather than locked in per project.

## The goal stays with me

The third commitment is the uncomfortable one: an agent can't be accountable for what the work
is _for_.

> An agent will find a way to satisfy the goal you gave it — including routing around evidence
> that the goal is wrong.

I watched this happen at full length. I asked for a color engine that never throws — batteries
included, always returns something usable — and every agent that touched it served that goal
faithfully. When QA found an input on which a function never returned at all and filed it
honestly as untestable, I read it, weighed the lead's reasoning, and approved it — a defensible
call for a project that young, still discovering what it would become: don't over-build. The
failure was quieter than a rubber stamp. The project grew, complexity piled on, and the
decision's premises expired without anyone noticing — because once a guard is in the code,
agents treat whatever it protects as settled, and they should. No agent re-opens a decision the
code has absorbed. Re-evaluating it was mine to do, and for 24 days nothing in my process made
me do it.
[My requirement was the bug and every AI agent served it faithfully](/essays/the-rule-that-was-wrong/)
is the full case.

This is also part of why the lead agent never writes code, even when a task looks straightforward:
I need a discussion partner more than I need another pair of hands. Design decisions stay with me,
and every decision I don't fully understand every aspect of — including what it means for
decisions not yet made — comes back with its reasoning, not just its diff: what's wrong in plain
language, the fix and the trade-off it accepts, the alternatives considered, one stated
recommendation, and the strongest counter-argument to it. And I ask more than I used to — for pros
and cons, for the future-looking implications I don't yet understand, for the counter-opinion. The
counter-argument is the load-bearing part: against a sound solution the surface objections run out
fast, so a full-strength counter-argument ends up aimed at the premise — and premises are what
expire.

## The limits I know about

The system is held by discipline, and discipline has a record. I've skipped my own QA rule twice
and caught it once — the miss is public:
[PR #26](https://github.com/jamierthompson/digital-garden/pull/26) merged the same day the rule
became mandatory, and its body says the QA pass _"was **not** run on this PR (session is
ending)."_ **Writing a rule down is not the same as holding it at 9pm.**

Early on I also over-staffed — multi-agent spend on read-only fan-out with nothing to
cross-examine — until the per-phase staffing test made the cost visible before the spend instead
of after.

The re-evaluation of settled decisions has the same shape: it runs on me remembering to ask.
There is no hook yet that resurfaces an early call when the project outgrows it — nothing puts an
aging decision in front of me the way a failing test puts itself in front of an agent.

And the system has only run solo, where I am both the standard and its enforcer. It hasn't met
another engineer's standards, or a shared `main` under real load. Until it does, "transferable"
is a hypothesis, and I state it as one.

## Governance and measurement

Notion's
["The Great Renovation"](https://www.notion.com/resources/inside-the-ai-transformation) — a
survey of more than 6,000 AI decision-makers and users across ten global markets — found three
implementation strategies separating the most advanced organizations from everyone else:
integrating AI into existing systems (+18 pp), building governance and oversight (+16 pp), and
tracking impact with defined metrics (+15 pp). The gaps are nearly twice the size of any other
difference measured. Training programs, written policies, and standardized tools don't
differentiate, because everyone invests in them.

The three commitments above are those two differentiators at the scale of one engineer.
Separating building from checking is governance — oversight built into the structure of the
work, not asserted over it afterward. Evals, sweeps, and QA logs are measurement — the
difference between believing a system works and being able to show it. Neither is a tooling
purchase. Both are practices, and they compound.

---

The system is in use now. The conventions are public at
[agent-conventions](https://github.com/jamierthompson/agent-conventions), improved in the open.
The build they were forged on is archived — it was the lab, not the product — but its evidence
record stays public at [digital-garden](https://github.com/jamierthompson/digital-garden):
every pull request, every QA log, checkable rather than take-my-word-for-it. This site is built
the same way, with [notes](/notes/) taking one idea at a time and [essays](/essays/) making the
longer arguments.
