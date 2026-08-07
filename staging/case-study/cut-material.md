# Directing Agents — cut material worth publishing

Source material for the case study, cut from the old repo README during curation. Kept
because it's good, not because it fit there.

## The derivation timeline

Useful for "walk me through how this developed."

| When | What happened |
| --- | --- |
| Jun 21 (am) | `create-next-app`, autoformatter as commit #2, test runner as commit #3 — before any feature code |
| Jun 21 (14:34) | Five-lens architecture audit — independent drafts, devil's-advocate round, synthesis |
| Jun 21 (15:07–16:07) | CI gate, import-boundary lint, CSS-layer lint, key-drift stub |
| Jun 22 | Process docs + `AGENTS.md`. First hard rule: jsdom can't paint, so a green suite is not evidence a surface works |
| Jun 23 | First real agent-team run exposed three process gaps; the lead's run loop written as the fix |
| Jun 23–25 | `agent-team` skill validated by eval — 4 prompts, with-skill vs. baseline. Baseline scored parity and reasoned better in two ways; both became edits before merge |
| Jun 24 | One slice, two reviewers: primed one found nothing; unprimed one found a CI-breaking violation and an untested security boundary |
| Jun 25 | Adversarial QA becomes mandatory — and fails the same evening, this time in the author. Rule tightened from "fresh" to "no prior context" |
| Jun 26–27 | Worktree isolation fixed on the second attempt. ADR immutability rule retired five days after calling it "the one rule that keeps the log trustworthy" |
| Jun 30 | Decision log and session records retired, one reset commit |
| Jul 1–23 | The build-out |

## Why the lead never authors (fuller version)

Early leads orchestrated and authored at the same time, and the cost showed up as latency
in the conversation — a lead deep in a diff answers architecture questions badly, or
stalls. That's why the skill states the floor explicitly rather than letting
cost-efficiency arguments collapse it back down.

## The executable form of cite-don't-remember

Agents literally grep the installed docs:

```bash
grep -rniE 'cookies|async' \
  node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md
```

A verify-before-write table names each footgun *and* the authority containing the fact.
Two drafts once cited plausible-but-wrong doc paths; a debate round re-anchored each.

## Worktree isolation, why two tries

The ephemeral `isolation: "worktree"` spawn flag lands outside the repo root, which breaks
`acceptEdits` scope and turns every teammate edit into a permission prompt. In-root
worktrees made file conflicts structurally impossible *and* removed the prompts. General
lesson: the lead clears the path; the owner shouldn't babysit tool calls.

## The unresolved tension (raise it yourself)

Where the line falls between agents *proposing* and agents *verifying*. Started with
agents drafting designs (the five-lens audit); moved toward design happening in
conversation with the owner, agents verifying an emerging design. Current reconciliation:
`architect`/`devils-advocate` for architecture-class calls; product and interface design
stays owner-led. Not fully confident that line is right — say so, it's a good answer.

## Nothing is enforced by a hook

Every rule is held by discipline. The stated principle is *a skill teaches the how, a hook
enforces the rule* — only the first half is done. Roadmap item, and a governance essay
waiting to happen.

## Positioning hook — the Notion report

Notion's "The State of Global AI Transformation" (printed p.4, "Top findings"): the three
implementation strategies separating the most advanced organizations are integrating AI
into existing systems (+18 pp), building governance and oversight (+16 pp), and tracking
impact with defined metrics (+15 pp) — "nearly twice the size of any other implementation
difference measured." Training programs, written policies, and standardized tools don't
differentiate because everyone invests in them. The system's QA governance maps to the
second; the eval habit and the MCP-over-dev-history roadmap item map to the third — and
measurement at the individual-workflow level is the open flank and the writing niche.
