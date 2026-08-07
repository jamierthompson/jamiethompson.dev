---
title: "Your reviewer must have no prior context of the work"
description:
  "'Fresh' is the floor; 'no prior context' is the standard. Context is not neutral — briefing a
  reviewer turns them into a second author."
pubDate: 2026-08-07
---

**The rule:** before a slice enters a pull request, a fresh agent with **no prior context of the
work** tries to break it. It is briefed on the requirements and the diff — never the design
rationale.

"Fresh, never the author" sounds sufficient. It failed within hours of being written: a reviewer
that has absorbed the diagnosis and the fix rationale is primed to confirm. It inherits the
author's mental model, including the author's blind spot, and reviews the code against intent it
already agreed with. Priming doesn't just bias the conclusion — it narrows the search.

The rule holds structurally, not by discipline: the coder never briefs its own reviewer. The lead
writes the QA brief from the diff and the requirements alone, so the priming is unavailable
rather than resisted.

The two failures that produced this rule — one in the reviewer's seat, one in the author's — are
worked through in [Briefing your reviewer turns them into a second
author](/essays/the-qa-rule/).
