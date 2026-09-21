#!/usr/bin/env zsh
set -eu

repository_root=${0:A:h:h}
test_home=$(mktemp -d)
trap 'rm -rf "$test_home"' EXIT HUP INT TERM

mkdir -p "$test_home/.agents" "$test_home/.codex" "$test_home/.claude" \
  "$test_home/.copilot"
print 'runtime state' >"$test_home/.agents/state.jsonl"
print 'runtime state' >"$test_home/.codex/session.jsonl"
print 'runtime state' >"$test_home/.claude/history.jsonl"
print 'runtime state' >"$test_home/.copilot/session.jsonl"

stow --dir="$repository_root" --target="$test_home" --no-folding .

[[ -d "$test_home/.agents" && ! -L "$test_home/.agents" ]]
[[ -d "$test_home/.codex" && ! -L "$test_home/.codex" ]]
[[ -d "$test_home/.claude" && ! -L "$test_home/.claude" ]]
[[ -d "$test_home/.copilot" && ! -L "$test_home/.copilot" ]]
[[ -L "$test_home/.agents/AGENTS.md" ]]
[[ -L "$test_home/.codex/AGENTS.md" ]]
[[ -L "$test_home/.claude/CLAUDE.md" ]]
[[ -L "$test_home/.copilot/copilot-instructions.md" ]]
cmp -s "$test_home/.agents/AGENTS.md" "$test_home/.codex/AGENTS.md"
cmp -s "$test_home/.agents/AGENTS.md" "$test_home/.claude/CLAUDE.md"
cmp -s "$test_home/.agents/AGENTS.md" \
  "$test_home/.copilot/copilot-instructions.md"
[[ $(<"$test_home/.agents/state.jsonl") == 'runtime state' ]]
[[ $(<"$test_home/.codex/session.jsonl") == 'runtime state' ]]
[[ $(<"$test_home/.claude/history.jsonl") == 'runtime state' ]]
[[ $(<"$test_home/.copilot/session.jsonl") == 'runtime state' ]]

print 'agent instruction link tests passed'
