---
title: "A prompt is a system you measure rather than vibe-check"
description:
  "Before a skill or prompt merges, run it against an uncontaminated baseline, plant inputs where
  the right answer is 'stop', and publish the runs you lost."
pubDate: 2026-08-07
---

Anything LLM-shaped — a skill, a prompt, an orchestration pattern — is a system whose behavior you
**measure before it merges**, against a baseline that has genuinely never seen it.

Three parts carry the weight. The baseline must be **uncontaminated** — a project skill auto-loads
into spawned subagents, so an honest baseline means parking the thing under test where no run can
absorb it. The inputs must include **traps** — targets that don't exist, where the correct plan is
"stop, check reality before spending money"; a happy-path eval grades competence at plans that
should never run. And the losing runs get **published**, not re-rolled until the numbers come out
clean.

The reason to run it before merge rather than after: before merge, a losing result is free — it
becomes an edit instead of a retraction. An eval that confirms what you already shipped taught you
nothing and cost you a day.

The eval that produced this rule scored my own tool at parity with no tool at all — and the
baseline beat it twice. Both losses became edits before merge. The full run is at
[I evaluated my own AI agent orchestration tool and it lost twice](/essays/agent-team-skill-eval/).
