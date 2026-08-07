# Staging — source material and where it lands

Material carried over from earlier repos, being edited into publishable entries. Nothing in
this directory ships; it disappears when the port is done.

## The content model (decided 2026-08-07)

Three types, three jobs — size and job decide where a piece goes, never taste:

| Type | Job | Shape |
| --- | --- | --- |
| **Experiment** (`src/content/experiments/`) | A thing built/tested in public. Hypothesis up front, data as it accrues, outcome when concluded. | Living page; `status: active \| concluded`, `started`, `repo`, `hypothesis` frontmatter. |
| **Note** (`src/content/notes/`) | One atomic lesson/rule/observation, written the day it lands. | Short — a few hundred words. Heavily `[[wikilinked]]`. |
| **Essay** (`src/content/essays/`) | Narrative: case studies, arguments, synthesis. | Long-form, rare, deliberate. Cites notes and experiments. |

The pipeline: do the work → note the lesson (minutes) → experiment page accumulates data
(ongoing) → essay synthesizes (occasionally).

## Destination map

| Staged file | Destination |
| --- | --- |
| `field-notes/the-qa-rule.md` | ✅ Ported: essay at `essays/the-qa-rule.md` + rule-note at `notes/no-prior-context.md` |
| `field-notes/skill-eval.md` | Essay (worked-case series) + a short rule-note carrying its lesson |
| `field-notes/the-reversal.md` | Essay (worked-case series) + rule-note |
| `field-notes/the-rule-that-was-wrong.md` | Essay (worked-case series) + rule-note |
| `field-notes/test-data-chosen-to-pass.md` | Essay (worked-case series) + rule-note |
| `field-notes/README.md` | Its per-case hooks become the essays' `description` frontmatter; then delete |
| `case-study/directing-agents-essay.md` | The flagship essay "Directing Agents" — links the worked-case series |
| `case-study/cut-material.md` | Source material for the flagship essay and for future notes; the Notion-report positioning belongs in the flagship |
| `case-study/roadmap.md` | Seeds for experiment pages (hooks enforcement, MCP-over-dev-history) and the flagship's closing section |

Every ported word passes through Jamie's review before it publishes — porting is drafting,
not copying, and the worked cases keep their original prose unless Jamie edits it.
