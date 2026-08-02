#!/bin/zsh

set -euo pipefail

typeset repository_root="${0:A:h:h}"
unset MANPAGER PAGER
export PATH='/usr/bin:/bin:/usr/sbin:/sbin'
source "${repository_root}/.config/zsh/.zshenv"

if [[ -z "${MANPAGER:-}" ]]; then
  print -u2 -- 'FAIL: MANPAGER is unset after a minimal-path shell startup'
  exit 1
fi

man zoxide | LC_ALL=C awk '
  BEGIN { RS = "\b" }
  END {
    count = NR - 1
    if (count > 0) {
      print "FAIL: man output contains " count " visible-overstrike backspaces" > "/dev/stderr"
      exit 1
    }
  }
'

typeset rendered_man_page
rendered_man_page="$(
  script -q /dev/null env \
    TERM=xterm-256color \
    BAT_PAGER=cat \
    man zoxide
)"

print -rn -- "${rendered_man_page}" | perl -ne '
  $colors += () = /\e\[[0-9;]*m/g;
  while (/\e\[((?:3|9)[0-7])m/g) {
    $ansi_foregrounds{$1} = 1;
  }
  END {
    if (!$colors) {
      print STDERR "FAIL: man output contains no ANSI color sequences\n";
      exit 1;
    }
    if (scalar(keys %ansi_foregrounds) < 2) {
      print STDERR "FAIL: man output does not use distinct terminal-theme colors\n";
      exit 1;
    }
    print "PASS: colored man output without visible-overstrike backspaces\n";
  }
'
