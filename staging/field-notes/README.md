# Evidence

Worked cases from the project the conventions came from. Each quotes the primary material —
decision records, QA verdicts, eval scorecards, spike findings — rather than summarizing it.

| | What it shows |
| --- | --- |
| [**The QA rule, and how it got its teeth**](the-qa-rule.md) | The rule was written and failed the same day. A briefed-but-fresh reviewer confirmed a design and found nothing; an unbriefed one found a ship-blocking regression behind a fully green gate — and a guard test structurally incapable of failing. |
| [**I evaluated my own orchestration tool. It lost twice.**](skill-eval.md) | With-skill vs. an uncontaminated baseline, four prompts, two carrying deliberate traps. The baseline beat the skill in two specific ways; both losses became edits before merge. Two runs died to an outage and are reported as inferred, not measured. |
| [**The debate reached a verdict. Then a measurement destroyed it.**](the-reversal.md) | Four agents drafted blind and converged. A spike tested the two facts the verdict rested on; both were false. The verdict reversed and the losing reasoning was preserved on purpose. |
| [**The test that couldn't be written**](the-rule-that-was-wrong.md) | A QA agent reported a defect it couldn't test, because a live test would hang the suite. That was the design contradicting itself — under a requirement the owner had asked for. Approved past, understood 24 days later. The agent solved the goal it was given; nobody asked whether the goal was still right. |
| [**The six hues that pass**](test-data-chosen-to-pass.md) | A fixture declaring itself *"assorted seed hues spanning the wheel"* held six numbers, all of which passed. Adding a seventh — ten degrees from one already in the list — broke the suite's own tolerance. Reproducible in a minute. |

The source repository is public. The pull requests and commit history are at
[github.com/jamierthompson/digital-garden](https://github.com/jamierthompson/digital-garden); the
decision register and session records were retired from `main` on 2026-06-30, so read those at the
last commit that carried them — **[`https://github.com/jamierthompson/digital-garden/tree/e7a7232/docs`](https://github.com/jamierthompson/digital-garden/tree/e7a7232/docs)** (`e7a7232`).
