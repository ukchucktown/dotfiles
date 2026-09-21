#!/usr/bin/env zsh
set -eu

repository_root=${0:A:h:h}
test_home=$(mktemp -d)
trap 'rm -rf "$test_home"' EXIT HUP INT TERM

mkdir -p "$test_home/.codex" "$test_home/.claude"
print 'runtime state' >"$test_home/.codex/session.jsonl"
print 'runtime state' >"$test_home/.claude/history.jsonl"

stow --dir="$repository_root" --target="$test_home" --no-folding .

[[ -d "$test_home/.codex" && ! -L "$test_home/.codex" ]]
[[ -d "$test_home/.claude" && ! -L "$test_home/.claude" ]]
[[ -L "$test_home/.codex/AGENTS.md" ]]
[[ -L "$test_home/.claude/CLAUDE.md" ]]
[[ $(<"$test_home/.codex/session.jsonl") == 'runtime state' ]]
[[ $(<"$test_home/.claude/history.jsonl") == 'runtime state' ]]

print 'agent instruction link tests passed'
