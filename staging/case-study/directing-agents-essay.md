# Directing Agents

**How I direct coding agents at production standards — the rules, and the failures that produced
them.**

I don't write most of the code I ship. Agents do. I read every change before it merges, and I own
the architecture and every design call behind it. What makes that work isn't better prompting — it's
a division of labor with a hard separation between building and checking.

This is that system, written down. It was forced into existence by things going wrong during a
month-long build, it's how I work now in repos with no relationship to that one, and it's still
changing.

---

## The loop

Four roles.

- **Me.** I decide what gets built and why, and nothing merges that I haven't read. Product and
  interface design stay here — an agent drafting blind to intent optimizes confidently for the wrong
  thing.
- **A lead agent** — my conversation partner. Never writes feature code. Writes the briefs, spawns
  the workers, keeps state in scratchpad files, assembles the finished slices, runs the full gate.
- **A coder agent** per slice — its own context window, working from copies of just the files it
  needs, running only the checks its slice touches.
- **A QA agent** per coder — receives the finished diff and the original requirements, nothing else,
  and tries to break it.

QA finds the defect and writes the failing test; the coder fixes it; QA re-checks. The lead then
assembles the slices — the point where parallel work, and any tests QA added, become one coherent
change — and runs the full gate once over the result. Running every check inside every agent at once
would melt my machine, so workers verify what they touched and the lead verifies the whole. When
that's green it becomes a pull request with the QA log in the body, and it doesn't merge until I've
read it. On the project this came from, 112 of 144 merged pull requests carry one.

> **Start here:** [Briefing your reviewer turns them into a second author](notes/the-qa-rule.md) —
> the rule as first written was too weak, and it failed the same day.

---

## Why it's shaped this way

A coding agent will hand you work that passes lint, passes types, passes the tests it wrote, builds
clean — and is still wrong at the edges. It optimizes for "make it work," so it tests the path it
just built and not the malformed input, the empty state, the error route, or the second color
scheme.

Worse, agents fail in ways that look like success, and CI can't see any of it, because every one of
those failures is green. Better prompting doesn't fix that. Structure does.

---

## The rules

### 1. The lead directs; it never authors

Even when a task would fit one session, implementation goes to a coder in a separate context window
and its check to a QA agent in a third.

That looks like paying for an extra agent to do nothing. What it buys is **interruptibility**. I ask
architecture questions mid-flight constantly — that's the job — and a lead carrying implementation
state has to drop and reload it every time. A lead that never authors is always ready to reason
about the system.

### 2. The reviewer gets the diff, never the reasoning

The QA agent has **no prior context of the work** — not merely "not the author." A teammate that
helped design or debate the slice is disqualified even though it didn't type the code, because it
reviews against intent it already agreed with.

The lead is what makes this structural rather than aspirational: it hands over the finished diff and
the original requirements, and the rationale stops there. Priming isn't something the reviewer has
to resist; it's something the handoff makes unavailable.

From there the reviewer attacks the edges the author optimized past — malformed, boundary, and empty
input; error and not-found paths; both color schemes; focus and interaction states — proving each
break with a failing test before anything gets fixed.

_[How the rule got its teeth](notes/the-qa-rule.md)._

### 3. No agent works from memory

For anything version- or fact-specific, an agent finds the primary source and reads it before it
writes. Finding it is part of the job: whatever tool gets there — a purpose-built skill or MCP
server, docs the framework has scaffolded into the project, or a plain web search. Memory is the
last resort, and an agent leaning on it says so, so the claim can be checked.

A model's memory of a fast-moving framework isn't vaguely stale, it's _confidently wrong_. A
function that has since become async. A config flag that was removed. A file the framework now
expects under a different name. Each produces code that reads as correct, and the agent has no
signal that it's recalling rather than knowing.

The rule is a line item in every brief and still isn't sufficient on its own — the source has to be
version-matched and has to actually contain the fact. I've had two drafts cite plausible-but-wrong
doc paths in one debate round.

### 4. State lives in files, not context windows

The lead keeps its working notes in scratchpad files and writes every brief from those, so
re-spawning an agent costs nothing. "Continue what we were doing" fails; a path to a written file
doesn't.

A spawned agent starts blind. It loads the repo's agent files, its skills, and its tools — but not
my conversation, and not anything the lead has read. The brief is the only channel in and the
returned digest the only channel out, so each one names its objective, the exact files to read _by
path_, what the agent owns and must not touch, and the output format expected.

The corollary: docs are current truth, edited in place; git history and the PR body are the audit
trail. There's no decision log — a second record drifts out of sync with the first, which I know
because I kept one.

### 5. Right-size the staffing per phase, not per project

Team → subagents → single session, in descending cost order. Pick the smallest that fits, and re-run
the test _per phase_.

| Signal                                                  | Reach for          |
| ------------------------------------------------------- | ------------------ |
| Workers must debate, disprove each other, converge      | **Team**           |
| Independent slices over distinct file sets, in parallel | **Team**           |
| Verbose work to isolate — only the result matters       | **Subagents**      |
| Sequential, same-file, or dependency-heavy              | **Single session** |

Most tasks have one phase that wants a team and another that doesn't. Debugging is the sharp case:
root-cause _diagnosis_ is read-only fan-out best served by cheap subagents, while the multi-file
_fix_ afterward is a team. Locking in "team" for a whole job pays team prices for subagent work.

Anthropic's published figures put an agent at roughly 4× the tokens of a chat interaction and a
multi-agent system at about 15×
([source](https://www.anthropic.com/engineering/multi-agent-research-system)). Both are measured
against _chat_, so multi-agent against a single agent is nearer 4× than 15× — still enough to
reserve the full research → drafts → debate → synthesis pattern for architecture-class calls.

_This rule came out of an eval, and the eval said my tool was wrong._
[_What the eval found_](notes/skill-eval.md).

---

## What it caught

Each of these shipped past lint, types, tests, and build:

- **A contrast failure no gate could see.** Two CSS custom properties resolved to nothing and fell
  through to defaults, dropping a badge to **1.54:1 in light and 1.87:1 in dark** — failing WCAG AA
  in both schemes. Undefined custom properties don't error, and jsdom doesn't compute color, so
  everything was green. [PR #14](https://github.com/jamierthompson/digital-garden/pull/14) logs it;
  re-verified after the fix at 11.35:1 and 9.43:1.
- **Tests that were green and proved nothing.** A label rename left five guard tests asserting
  against the _old_ word. All five passed regardless of behavior. QA proved it by sabotaging the
  target and watching seven tests fail across all five surfaces.
- **A documented tool that never existed.** The orientation doc advertised a lint command with no
  script, no package entry, and nothing in git history behind it. An agent had written a plausible
  tool into the docs, and every agent after it read that as fact. The fix was to build it for real.

---

## Where it breaks down

Three rules I broke, and one the process can't fix.

**The decision log drifted.** I'd written that immutability was _"the one rule that keeps the log
trustworthy."_ Five days later I retired it — the frozen entries and the living docs had begun
disagreeing about the same rules. A stale entry kept for the audit trail misleads the next agent
more than an honest in-place edit ever would.

**I over-reached for teams before the phase test existed.** Early on, "this is a big task" meant
"spawn a team," including multi-agent spend on read-only fan-out where there was nothing to
cross-examine. Rule 5 is something I wrote after paying for its absence.

**I skipped my own QA rule twice and only caught it once.** A lead judged a CI-config slice
"low-risk" and substituted its own diff review; the QA agent I spawned to correct that found a real
least-privilege gap. The one I didn't catch is
[PR #26](https://github.com/jamierthompson/digital-garden/pull/26), merged the same day the rule
became mandatory, whose own body says a fresh-QA pass _"was **not** run on this PR (session is
ending)."_ It went in anyway. Writing a rule down is not the same as holding it at 9pm.

Those are mine to fix. This one isn't:

I asked for a color engine that never throws — batteries included, always returns something usable.
Every agent that touched it served that goal faithfully. QA found an input the function never
returned on at all and filed it honestly as untestable, because a live test would hang the suite.
That was the design contradicting itself in public, and I approved past it. It took me 24 days to
understand what I'd read, and what I'd actually asked for was an engine that couldn't report when
anything had gone wrong.

> An agent will find a way to satisfy the goal you gave it — including routing around evidence that
> the goal is wrong.

The check on that isn't another agent. It's whether the person directing understood the decision
well enough to see where it leads — a discipline, not a process step.
[_The full case_](notes/the-rule-that-was-wrong.md).

---

## The repo

```
docs/                   The conventions themselves
  agent-workflow.md       The core: orchestration, briefing, the dev↔QA loop, handoffs
  preferences.md          Standing directives for how work is proposed and handed back
  engineering.md          TypeScript / React / code organization / testing
  git-and-pr.md           Branch and PR mechanics, history curation, merge rules
  web-quality.md          Accessibility, Core Web Vitals, secret hygiene

agents/                 Reusable subagent definitions
  adversarial-qa.md       Fresh-eyes QA that tries to break a slice
  architect.md            Independent architecture drafter — spawn several in parallel
  devils-advocate.md      Fact-grounded critic that concedes when the rebuttal is sound

skills/agent-team/      The lead's playbook: preflight, the staffing test, its modes

notes/                  What each rule cost to learn
```

If you read one file, read [`docs/agent-workflow.md`](docs/agent-workflow.md) — everything else is
downstream of it. The application these came from is public and archived:
[github.com/jamierthompson/digital-garden](https://github.com/jamierthompson/digital-garden).

---

## Status

_Reviewed August 2026._ The rules above change when something breaks; [`notes/`](notes/) is where
each change keeps its reason, and [`ROADMAP.md`](ROADMAP.md) is what's next.

In progress: consolidating conventions that still live as scattered copies across my machine, and
building a local MCP server over my own development history — journal entries, QA logs, decisions —
so an agent in any repo can ask whether I've hit a problem before.

---

_Jamie Thompson · [LinkedIn](https://www.linkedin.com/in/jamierthompson) ·
jamieraethompson@gmail.com_
