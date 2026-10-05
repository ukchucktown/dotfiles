#!/usr/bin/env zsh
set -eu

repository_root=${0:A:h:h}
stub_dir=$(mktemp -d)
trap 'rm -rf "$stub_dir"' EXIT HUP INT TERM

# A stub records the arguments that the wrapper passes to the real command.
print -r -- '#!/bin/sh
printf "%s\n" "$*"' >"$stub_dir/copilot"
chmod +x "$stub_dir/copilot"
path=("$stub_dir" $path)

unset COPILOT_REASONING_EFFORT
source "$repository_root/.config/zsh/aliases.zsh"

[[ $(copilot) == '--reasoning-effort high' ]]
[[ $(copilot -p hello) == '--reasoning-effort high -p hello' ]]
[[ $(COPILOT_REASONING_EFFORT=medium copilot) == '--reasoning-effort medium' ]]
[[ $(copilot --reasoning-effort low) == '--reasoning-effort low' ]]
[[ $(copilot --reasoning-effort=max -p hi) == '--reasoning-effort=max -p hi' ]]

print 'copilot reasoning effort tests passed'
