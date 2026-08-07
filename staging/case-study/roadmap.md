# Roadmap

These conventions aren't finished and won't be. Every rule here exists because something broke,
and things keep breaking — so the rules keep moving. This is where I think they go next.

## Next: make the history queryable

I have a journal entry per working day, PR bodies carrying QA logs, a retired decision register,
and a debate archive. It's a good record, and it's write-only. When an agent in a new repo asks
"have we hit this before?", the answer is sitting in markdown nobody reads — so I'm running
"cite, don't remember" against framework docs while running on memory about my own past
decisions.

The plan is a **local MCP server over that history**: search decisions, QA findings, and journal
entries; retrieve the reasoning behind a rule. Local-first, nothing leaving the machine. MCP
because the transport is the point — it makes the history available to any agent in any repo,
rather than to whichever project happens to hold the files. I've built one before
([`oklch-mcp`](https://github.com/jamierthompson/oklch-mcp)), so the plumbing is a known
quantity. The hard part will be retrieval quality: a tool that returns twelve loosely-related
chunks is worse than no tool, because it burns context and reads as authoritative.

## Also on my mind

**Enforcement.** Every rule here is held by discipline — an agent has to read it and choose to
honor it. A hook would hold them better than a document does.

**The gap I can't close alone.** This has only run solo, where I was both the standard and the
one enforcing it. It hasn't met other people with their own standards, or a shared `main` under
real load. Until it does, "transferable" is a hypothesis.
