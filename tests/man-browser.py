#!/usr/bin/env python3
"""Exercise cman and tman with the real fzf UI in an isolated tmux server."""
import os
import re
from pathlib import Path
import shlex
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]


class BrowserTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="cman-test-")
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)
        self.socket = str(self.directory / "tmux.sock")
        (self.directory / "functions.zsh").symlink_to(ROOT / ".config/zsh/functions.zsh")
        npm = self.directory / "npm"
        npm.write_text('''#!/bin/sh
if [ "$1" = help ]; then
  [ "$3" = --viewer=man ] && [ "$PAGER" = cat ] && [ "$MANPAGER" = cat ] || exit 1
  [ "${CMAN_NO_MANUAL:-}" = 1 ] && exit 1
  printf 'Complete npm help\\n'
  printf 'A description with enough words to cross the narrow preview boundary and retain COMPLETE_DESCRIPTION_END.\\n'
  i=1
  while [ "$i" -le 60 ]; do
    printf 'Manual line %s\\n' "$i"
    i=$((i + 1))
  done
elif [ "$1" = update ]; then
  printf 'Update packages\\n\\nUsage:\\nnpm update [<pkg>...]\\n\\nOptions:\\n  --global\\n    An abbreviated description\\n'
else
  printf 'All commands:\\n    update, version\\n\\n'
  exit 1
fi
''')
        npm.chmod(0o755)
        self.env = dict(os.environ, PATH=f"{self.directory}:{os.environ['PATH']}",
                        ZDOTDIR=str(self.directory), TERM="xterm-256color",
                        FZF_DEFAULT_OPTS="--layout=reverse --height=100%",
                        FZF_DEFAULT_OPTS_FILE="", SHELL="/bin/zsh")

    def shell(self, command, **extra):
        return subprocess.check_output(
            ["zsh", "-fc", 'source "$ZDOTDIR/functions.zsh"; ' + command],
            env=dict(self.env, **extra), text=True)

    def tmux(self, *args, check=True):
        return subprocess.run(["tmux", "-S", self.socket, *args],
                              text=True, capture_output=True, check=check).stdout

    def screen(self):
        return self.tmux("capture-pane", "-p", "-t", "browser")

    def wait_for(self, predicate):
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            screen = self.screen()
            if predicate(screen):
                return screen
            time.sleep(0.05)
        self.fail("Terminal state did not match expectation:\n" + screen)

    def start_terminal(self, expression):
        command = "exec env " + " ".join(
            shlex.quote(f"{key}={self.env[key]}") for key in
            ("PATH", "ZDOTDIR", "TERM", "FZF_DEFAULT_OPTS", "FZF_DEFAULT_OPTS_FILE", "SHELL"))
        command += " zsh -fc " + shlex.quote(
            'source "$ZDOTDIR/functions.zsh"; ' + expression)
        self.tmux("-f", "/dev/null", "new-session", "-d", "-s", "browser",
                  "-x", "100", "-y", "28", command)
        self.addCleanup(lambda: self.tmux("kill-server", check=False))

    def start_browser(self):
        self.start_terminal("_man_search --command npm")
        self.wait_for(lambda s: "Commands >" in s and "update" in s)
        self.tmux("send-keys", "-t", "browser", "update")
        self.wait_for(lambda s: "Commands > update" in s)
        self.tmux("send-keys", "-t", "browser", "Enter")
        self.wait_for(lambda s: "Go to parent command" in s)


class CmanTest(BrowserTestCase):
    def test_complete_npm_descriptions(self):
        self.assertIn("COMPLETE_DESCRIPTION_END", self.shell("_man_help_preview update npm"))

    def test_missing_manual_falls_back_to_short_help(self):
        self.assertIn("An abbreviated description", self.shell(
            "_man_help_preview update npm", CMAN_NO_MANUAL="1"))

    def test_tab_and_arrow_navigation(self):
        self.start_browser()
        self.wait_for(lambda s: "Commands • ACTIVE" in s and "Help • ACTIVE" not in s)
        self.tmux("send-keys", "-t", "browser", "Tab")
        self.wait_for(lambda s: "Help >" in s and "Help • ACTIVE" in s
                      and "Commands • ACTIVE" not in s)
        self.wait_for(lambda s: re.search(r"(?<!\d)1/\d+", s))
        self.tmux("send-keys", "-t", "browser", "Down")
        self.wait_for(lambda s: re.search(r"(?<!\d)2/\d+", s))
        self.tmux("send-keys", "-t", "browser", "Tab")
        self.wait_for(lambda s: "Commands >" in s and "Commands • ACTIVE" in s
                      and "Help • ACTIVE" not in s)
        self.tmux("send-keys", "-t", "browser", "BTab")
        self.wait_for(lambda s: "Help >" in s and "Help • ACTIVE" in s
                      and "Commands • ACTIVE" not in s)

    def test_callbacks_use_zsh_without_inheriting_shell(self):
        self.env["SHELL"] = "/bin/false"
        self.start_browser()
        self.tmux("send-keys", "-t", "browser", "Tab")
        self.wait_for(lambda s: "Help >" in s and "COMPLETE_DESCRIPTION_END" in s)

    def test_preview_wrap_and_toggle(self):
        self.start_browser()
        self.wait_for(lambda s: "COMPLETE_DESCRIPTION_END" in s)
        self.tmux("send-keys", "-t", "browser", "Tab", "C-w")
        self.wait_for(lambda s: "Help >" in s and "COMPLETE_DESCRIPTION_END" not in s)
        self.tmux("send-keys", "-t", "browser", "C-w")
        self.wait_for(lambda s: "COMPLETE_DESCRIPTION_END" in s)



class TmanTest(BrowserTestCase):
    def setUp(self):
        super().setUp()
        (self.directory / "topics").write_text(
            "alpha(1), alias(1) - A long topic description that wraps across the topic pane and retains TOPIC_DESCRIPTION_END\n"
            "beta (3) - A Linux-style topic\n"
            "gamma, alias (5) - A Linux-style alias list\n")
        man = self.directory / "man"
        man.write_text('''#!/bin/sh
if [ "$1" = -k ]; then
  cat "$ZDOTDIR/topics"
  exit
fi
if [ "${MANPAGER:-}" != cat ]; then
  printf '%s\n' "$@" > "$ZDOTDIR/man-opened"
fi
printf 'Manual for %s in section %s\n' "$2" "$1"
printf 'A manual description that wraps across the preview pane and preserves every word including MANUAL_DESCRIPTION_END.\n'
i=1
while [ "$i" -le 60 ]; do
  printf 'Manual line %s\n' "$i"
  i=$((i + 1))
done
''')
        man.chmod(0o755)

    def start_topics(self):
        self.start_terminal("_man_search --topic; read -r")
        self.wait_for(lambda s: "Topics • ACTIVE" in s and "MANUAL_DESCRIPTION_END" in s)

    def test_topic_formats(self):
        rows = self.shell('cat "$ZDOTDIR/topics" | _man_topic_candidates').splitlines()
        self.assertEqual([row.split("\t")[:2] for row in rows],
                         [["alpha", "1"], ["beta", "3"], ["gamma", "5"]])

    def test_focus_scroll_and_wrap(self):
        self.start_topics()
        self.wait_for(lambda s: "TOPIC_DESCRIPTION_END" in s)
        self.tmux("send-keys", "-t", "browser", "Tab")
        self.wait_for(lambda s: "Help • ACTIVE" in s and "Topics • ACTIVE" not in s)
        self.tmux("send-keys", "-t", "browser", "Down")
        self.wait_for(lambda s: re.search(r"(?<!\d)2/\d+", s))
        self.tmux("send-keys", "-t", "browser", "Home", "C-w")
        self.wait_for(lambda s: "MANUAL_DESCRIPTION_END" not in s)
        self.tmux("send-keys", "-t", "browser", "C-w")
        self.wait_for(lambda s: "MANUAL_DESCRIPTION_END" in s)
        self.tmux("send-keys", "-t", "browser", "BTab")
        self.wait_for(lambda s: "Topics • ACTIVE" in s and "Help • ACTIVE" not in s)

    def test_enter_opens_correct_section(self):
        self.start_topics()
        self.tmux("send-keys", "-t", "browser", "beta")
        self.wait_for(lambda s: "Manual for beta in section 3" in s)
        self.tmux("send-keys", "-t", "browser", "Enter")
        opened = self.directory / "man-opened"
        self.wait_for(lambda _: opened.exists())
        self.assertEqual(opened.read_text().splitlines(), ["3", "beta"])

    def test_escape_does_not_open_manual(self):
        self.start_topics()
        self.tmux("send-keys", "-t", "browser", "Escape")
        self.wait_for(lambda s: "Topics • ACTIVE" not in s)
        self.assertFalse((self.directory / "man-opened").exists())


if __name__ == "__main__":
    unittest.main()
