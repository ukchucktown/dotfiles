#!/bin/zsh

set -euo pipefail

typeset repository_root="${0:A:h:h}"
typeset socket_name="codex-status-width-test-$$"
trap 'tmux -L "$socket_name" kill-server 2>/dev/null || true' EXIT

tmux -L "$socket_name" -f /dev/null new-session -d -s width-test
tmux -L "$socket_name" source-file \
  "$repository_root/.config/agent-sandbox/shell/tmux.conf"

typeset status_left status_main status_right
status_left="$(tmux -L "$socket_name" show-options -gv status-left)"
status_main="$(tmux -L "$socket_name" show-options -gv 'status-format[0]')"
status_right="$(tmux -L "$socket_name" show-options -gv status-right)"

if [[ "$status_left" != *'#{E:@window-tabs-required-width}'* ]]; then
  print -u2 -- 'FAIL: compact status does not use the calculated tab width'
  exit 1
fi

if [[ "$status_main" != *'#{E:@window-tabs-required-width}'* ]]; then
  print -u2 -- 'FAIL: horizontal tabs do not use the calculated tab width'
  exit 1
fi

if [[ "$status_right" != *'#{R: ,#{@window-tabs-padding}}'* ]]; then
  print -u2 -- 'FAIL: CPU and memory status does not include configured padding'
  exit 1
fi

typeset padding required_before required_after_rename required_after_new
padding="$(tmux -L "$socket_name" show-options -gv @window-tabs-padding)"
if [[ "$padding" != 4 ]]; then
  print -u2 -- "FAIL: expected four columns of tab-to-stats padding, got $padding"
  exit 1
fi

required_before="$(
  tmux -L "$socket_name" display-message -p '#{E:@window-tabs-required-width}'
)"
tmux -L "$socket_name" set-window-option -t width-test: automatic-rename off
tmux -L "$socket_name" rename-window -t width-test: longer-window-name
required_after_rename="$(
  tmux -L "$socket_name" display-message -p '#{E:@window-tabs-required-width}'
)"

if (( required_after_rename - required_before != 15 )); then
  print -u2 -- 'FAIL: calculated width did not track a renamed window'
  exit 1
fi

tmux -L "$socket_name" new-window -d -t width-test: -n extra
required_after_new="$(
  tmux -L "$socket_name" display-message -p '#{E:@window-tabs-required-width}'
)"

if (( required_after_new - required_after_rename != 9 )); then
  print -u2 -- 'FAIL: calculated width did not include a new tab and separator'
  exit 1
fi

if [[ "$(tmux -L "$socket_name" display-message -p "#{e|<:$((required_after_new - 1)),$required_after_new}")" != 1 ||
      "$(tmux -L "$socket_name" display-message -p "#{e|>=:$required_after_new,$required_after_new}")" != 1 ]]; then
  print -u2 -- 'FAIL: calculated breakpoint does not switch at the fit boundary'
  exit 1
fi

print -- 'PASS: tmux status breakpoint tracks rendered tabs and preserves padding'
