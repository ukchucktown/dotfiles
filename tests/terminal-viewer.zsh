#!/bin/zsh

set -euo pipefail

typeset repository_root="${0:A:h:h}"
typeset test_root
test_root="$(mktemp -d)"
trap 'rm -rf -- "$test_root"' EXIT

mkdir -p "$test_root/mock" "$test_root/.local/bin"
ln -s /usr/bin/true "$test_root/mock/node"
ln -s /bin/echo "$test_root/.local/bin/terminal-browser"

typeset output
output="$(
  ZDOTDIR="$test_root/mock" \
    HOME="$test_root" \
    PATH="$test_root/mock:/usr/bin:/bin" \
    "$repository_root/.local/bin/terminal-viewer" open http://127.0.0.1:1234/
)"

typeset expected='open http://127.0.0.1:1234/ --partition=terminal-viewer --presentation'
if [[ "$output" != "$expected" ]]; then
  print -u2 -- "FAIL: terminal-viewer invoked terminal-browser as: $output"
  exit 1
fi

print -- 'PASS: terminal-viewer enables transparent presentation mode'
