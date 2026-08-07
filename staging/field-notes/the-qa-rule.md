# Briefing your reviewer turns them into a second author

**The rule:** before a slice enters a pull request, a fresh agent with **no prior context of the
work** tries to break it.

Those five words — _no prior context of the work_ — weren't in the first version. The first
version said "a fresh agent, never the one that wrote it," which sounds sufficient. It failed
within hours, and how it failed is the most useful thing I learned that month.

The premise underneath it: a green gate proves the author's intent, not the work's correctness.
Unit tests run in jsdom, and jsdom doesn't paint — it measures nothing about focus visibility,
tap-target size, layout shift, or paint timing. Build-green plus test-green is not evidence that
a surface works. Something has to actually try to break it.

---

## The accident

One slice, two reviewers, back to back. Not designed as a comparison — I judged the first pass
inadequate and re-ran it.

The first reviewer was **primed**. It was handed the design rationale, the binding decisions, and
"the gate is green," and it did a static read of the diff. The session record's own account:

> it ran no scenarios and confirmed the design rather than attacking it. That is a code review,
> not QA.

The second was unprimed and told to break it, with a live browser against a running dev server.
It found two things.

The first was a formatting violation sitting in a committed file. The local gate would have
caught it — the author had run the new test file through `pnpm test` and never through
`format:check`, then reported the slice green. A gate you run two steps of is not a gate; it's a
self-report with a command attached.

The second was a missing test on a security boundary. A client factory was supposed to throw when
its read token was absent, and that throw is the guarantee the draft-content path leans on — no
token means fail loud, not silently serve published content instead. Nothing tested it. The
unprimed reviewer pinned all three branches.

Same slice, minutes apart. One confirmed the design and found nothing. The other found a broken
gate discipline and an untested security guarantee.

It also modelled the honesty the rule needs. What it couldn't verify, it refused to fake — it
flagged the draft happy-path as untestable in that environment rather than reporting it clean.

## Then the same failure showed up one seat over

Hours after I made the rule mandatory, a draft-preview fix went through it. This time the primed
party wasn't the reviewer. It was the author.

The author had declared the fix verified: the brand tokens appeared in the dev-server HTML, so
the brand was applied. The unprimed QA agent opened with:

> ❌ **DOES NOT HOLD UP — ship-blocking regression**

The mechanism it found: React 19 de-dupes hoisted stylesheets by `href` and keeps the first one
committed. A Suspense fallback and the real component both resolved to the same `href`, so during
prerender the fallback's placeholder palette committed first and the real brand was dropped. The
gate was fully green. The author's own regression test passed.

In the same pass it found that the guard test protecting the fix **could not fail**. The test
asserted `/<Suspense\b/.test(source)` against raw file source — and the load-bearing comment in
that file contains the literal text `<Suspense>` three times. It was matching the comment, not
the JSX. It proved this rather than asserting it: delete the real element, keep the comment, and
the test stays 3/3 green while ESLint flags the now-unused import as a warning only, so the whole
gate stays green.

The author didn't miss this through carelessness. It missed it because it was checking for what
it expected to find. It verified _presence_ of the brand tokens; the defect was that they were
present and the fallback still won.

## Why "fresh" wasn't enough

A fresh agent that has absorbed the diagnosis, the design debate, and the fix rationale is
**primed to confirm**. It inherits the author's mental model, including the author's blind spot.
It reviews the code against intent it has already agreed with.

The tightened rule:

> the QA agent must have **no prior context of the work under review**. It is briefed only on the
> **requirements** and the **artifact** (the diff), then told to break it. "Fresh / not the
> author" is the floor; **no prior context** is the standard: a teammate that helped design or
> debate the slice is **disqualified** as its QA even though it didn't type the code.

The detail that convinced me: the QA agent that caught the regression chose its own verification
method — computed style on a clean production build, in a detached worktree on a separate port,
torn down afterward. Nobody told it to. It reached for the right method precisely _because_ it
hadn't been told what to expect. Priming doesn't just bias the conclusion; it narrows the search.

Context is not neutral. Telling a reviewer _why_ you did something converts them into a second
author.

## The handoff is what enforces it

This only holds because the coder never briefs its own reviewer. The lead agent owns the handoff:
it takes the finished diff and the original requirements and writes the QA brief from those
alone. The debate, the diagnosis, the "here's why I went this way" — all of it stops at the lead.

That's the part that makes the rule structural rather than aspirational. Priming isn't something
the QA agent has to resist. It's something the orchestration makes unavailable.

## Three things I had to learn separately

**A lead review is a complement, not a substitute.** On one session a lead judged a CI-config
slice "low-risk, unexecutable" and swapped its own diff review in for the QA pass. The QA agent I
then spawned found a real least-privilege gap.

**Presence is not application.** Verify the computed effect, not the presence of the input. This
is the specific shape the author's error took, and it recurs.

**A worktree can mask a bug that ships from a clean checkout.** One defect refused to reproduce
inside a git worktree because the bundler's chunk emission order is environment-sensitive. A
worktree isolates _editing_. Final verification belongs on a clean checkout, in CI, or on the
live deploy.

## What it looks like once it's routine

A few weeks in, [PR #325][pr325] carries a QA log that does four things worth naming.

It caught a defect that was **invisible that day**. Two surfaces derived the same value from
different places, and at that moment both happened to produce the same result — so nothing looked
wrong anywhere. Changing the shared default later would have silently de-synced one surface from
the other. No test suite finds that. A reader asking "what happens when these diverge?" does.

QA **wrote the failing tests first**, as acceptance criteria, before the author fixed anything.

The re-check **mutation-tested its own guards**: it reintroduced the defect verbatim and confirmed
six tests went red. A guard that has never been seen to fail is not yet a guard.

And it recorded two observations it explicitly did not ask anyone to act on — a reviewer
confident enough to separate findings from noise.

---

## Dev-done is not done

This is an agent workflow, but it's modelled on something that already works. On a team, a slice
that passes my own checks is developer-done, not review-done. It goes to a QA teammate who wasn't
in the design conversation, and it goes to them for exactly this reason: a reviewer who helped
shape a change reviews it against intent they already agreed with. That's not an AI problem.
Agents just make it fast and legible enough to watch happen.

A primed reviewer and an unprimed one read the same slice minutes apart and produced "confirmed
the design" and "a broken gate plus an untested security guarantee." The next day the same
pattern turned up in the author's seat. Two demonstrations, two shapes.

The source repo's pull requests and commit history are at
[github.com/jamierthompson/digital-garden][repo]. The decision and session records quoted here
were retired from `main` on 2026-06-30; read them at [`e7a7232`][retired].

[pr325]: https://github.com/jamierthompson/digital-garden/pull/325
[repo]: https://github.com/jamierthompson/digital-garden
[retired]: https://github.com/jamierthompson/digital-garden/tree/e7a7232/docs
