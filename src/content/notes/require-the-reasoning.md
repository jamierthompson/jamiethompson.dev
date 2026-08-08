---
title: "Require the reasoning behind every solution"
description:
  "An agent will competently satisfy the goal you gave it — including routing around evidence that
  the goal is wrong. Only understanding the reasoning surfaces a premise that has expired."
pubDate: 2026-08-07
---

**The rule:** don't accept solutions — require the reasoning behind them, and keep re-interrogating
that reasoning as the project grows. Every decision you don't fully understand every aspect of —
including what it means for decisions not yet made — comes with what's actually wrong
in plain language, the fix and its trade-off, the alternatives considered (including doing
nothing), one stated recommendation, and the counter-argument to it at full strength.

The failure mode this guards against is narrow and uncomfortable: **an agent will find a way to
satisfy the goal you gave it — including routing around evidence that the goal is wrong.** Coding
agents implement the requirement, QA agents enforce it (see [[no-prior-context]]), and both grow
more confident as they go. Nothing in that loop is positioned to ask whether the requirement still
makes sense — once a guard is in the code, agents treat whatever it protects as set in stone,
which is exactly what they should do. So re-evaluation can only come from the person directing
the work, and a
decision that was right when it was made can quietly stop being right as the project outgrows it.

The counter-argument is the load-bearing part: against a sound-looking solution, the surface
objections run out fast, so a counter-argument argued at full strength has nowhere left to aim
but the premise. That is where an expired goal gets caught.

The defect that sat approved for 24 days under a requirement I wrote myself is worked through in
[My requirement was the bug and every AI agent served it faithfully](/essays/the-rule-that-was-wrong/).
