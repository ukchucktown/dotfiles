# Lightweight SDLC

Lightweight SDLC means that every implementation task has a GitHub issue before
code changes start.

- Read-only questions, reviews, and investigations do not require an issue.
- If the user supplies an issue number, use that issue.
- If the user requests implementation without an issue number, search for one
  clear matching open issue. Reuse that issue, or create a new issue when no
  clear match exists. The implementation request authorizes issue creation, so
  do not request separate approval.
- After the issue exists, use the `gh-issue` start or resume workflow. Let that
  workflow create or attach the linked branch and worktree.
- Do not create an implementation branch or worktree directly with Git or
  Supacode.

## Skill updates

Use the manager that manages the installed skill.

- When `npx skills` manages the skill, run `npx skills update <skill> --global
  --yes` for a global installation or `npx skills update <skill> --project
  --yes` for a project installation.
- When another manager manages the installation, use that manager's update
  command.
- Inspect the installation metadata only when the manager or the scope is
  unknown.

# Reporting style — chat replies to me

**Scope.** This section governs what you say to me in conversation. It does not govern prose you write into a file for someone else to read — issues, PRs, commit messages, specs, docs, runbooks. Those follow First Read (the output style, or the `first-read` skill). Where the two disagree, First Read wins for the file and this section wins for the chat. The two rules marked **[both]** below apply in either place.

Be concise. Cut preamble, hedging, restatements of my question, announcements of what you're about to say, and closing summaries of what you just said. Telegraphic phrasing and dropped articles are fine *here* — First Read forbids both in a deliverable, and that is not a contradiction, it is the scope split.

Concision means cutting redundancy, never cutting meaning. Specifically:

- **Every finding carries its "so what."** A bare label is half the information — say what breaks, or why it matters. Not `uname + case, no Windows branch` but `uname + case with no Windows branch — on PowerShell uname doesn't exist, so the whole block falls through silently`.
- **Gloss jargon and repo shorthand on first use in a response.** One clause is enough: "process substitution `< <(...)`, a bash-only construct that PowerShell has no equivalent for".
- **Keep the subject when it's ambiguous which thing you mean.** Dropping articles is fine; dropping antecedents is not.
- **Assume I may not know the technical detail.** If a claim rests on a non-obvious mechanism, state the mechanism in a sentence instead of expecting me to infer it.
- **[both] Define labels you invent, where you introduce them.** Any term that came from you rather than from the codebase or the field needs a one-line definition on first use — including in a heading. If I'd have to read your whole answer to work out what a label means, it isn't a label yet.
- **[both] State the axis of any ranking, grouping, or numbered taxonomy.** "Tier 1 / Tier 2", "high / low priority", "Group A / B" all imply an ordering I can't verify without knowing what's being ordered — severity? detection? effort? Name it, and say so explicitly when it *isn't* severity, since that's what I'll assume. Prefer a descriptive name over a number when one exists.

When the material is dense and you're unsure, add the clause. I'd rather read one extra sentence than re-read a table three times. If a full explanation would genuinely run long, give me the short version plus an offer to expand — don't silently compress it into something I have to decode.

# Artifacts and deliverables

Applies to any file you write for someone else to read. First Read governs how that prose reads. This section governs whether it is true. The two are independent: a document can pass every First Read rule and still be wrong, because well-formed and false looks exactly like well-formed and correct.

- **Every number, path, and line reference is copied or computed, never recalled.** It comes from tool output in this session, or from a command you just ran. Do not type a figure from memory, from your own earlier prose, or from a summary you wrote upstream in the same conversation.
- **Derived numbers are where the errors live.** Totals, row counts, "N units", "about half", percentages, anything summarizing a list. Measured values you copied once are usually fine. Re-derive every aggregate with a tool right before you deliver, and make the parts reconcile against the total.
- **Generate roll-up labels, do not write them.** If a table row says "seven units with one finding each", that "seven" is a computed value. Count it with a tool, the same as the total.
- **A clean lint is not a correctness check.** No prose or style tool can see a false fact. Run the factual pass separately, and never offer a lint pass as evidence the content is right.
- **Say what you verified and how.** Name the numbers you re-derived and mark any figure that is an estimate. If you could not verify something, say so where you state it, not in a footnote.

# graphify

- **graphify** (`~/.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

# Agent skills

Configuration for the engineering skills (`/triage`, `/to-tickets`, `/to-spec`, `/wayfinder`, `/domain-modeling`, `/grill-with-docs`, `/improve-codebase-architecture`). These files are global and uncommitted. A project's own `CLAUDE.md` or `AGENTS.md` overrides them.

## Issue tracker

Issues live in the repo's GitHub Issues, reached through the `gh` CLI. See `~/.claude/docs/agents/issue-tracker.md`.

## Triage labels

The five canonical roles map to identically named labels, with per-repo deviations in a second table. See `~/.claude/docs/agents/triage-labels.md`.

## Domain docs

Single-context: one `CONTEXT.md` at the repo root plus `docs/adr/`. See `~/.claude/docs/agents/domain.md`.
