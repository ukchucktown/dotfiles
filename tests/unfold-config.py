#!/usr/bin/env python3
"""Run scripts/unfold-config against a temporary home with a folded ~/.config."""

import os
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "scripts/unfold-config"


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def git(repo, *args):
    subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True)


def snapshot(root):
    """Record every path with its type and link target, so a test can detect any change."""
    entries = {}
    for directory, subdirectories, files in os.walk(root):
        for name in subdirectories + files:
            path = Path(directory, name)
            target = os.readlink(path) if path.is_symlink() else None
            entries[str(path.relative_to(root))] = (path.is_symlink(), path.is_dir(), target)
    return entries


def unfold(home, *args):
    return subprocess.run(
        [sys.executable, str(SCRIPT), f"--home={home}", f"--repo={home / 'dotfiles'}", *args],
        text=True,
        capture_output=True,
    )


def make_home(root):
    home = root / "home"
    repo = home / "dotfiles"
    write(repo / ".stow-local-ignore", "\\.git\n\\.gitignore\n^/scripts(/.*)?$\n^/\\.config/gh(/.*)?$\n")
    write(repo / ".gitignore", ".config/gh/hosts.yml\n")
    write(repo / ".config/app/settings.conf", "tracked\n")
    write(repo / ".config/gh/config.yml", "git_protocol: https\n")
    write(repo / ".tmux.conf", "set -g mouse on\n")
    git(repo, "init", "-q")
    git(repo, "add", ".")
    git(repo, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "-q", "-m", "init")

    # Application state that accumulated through the folded link.
    write(repo / ".config/app/state.json", "{}\n")
    write(repo / ".config/gh/hosts.yml", "token: secret\n")
    write(repo / ".config/newtool/data.txt", "data\n")
    (repo / ".config/newtool/latest").symlink_to("data.txt")
    write(home / ".agents/skills/x/SKILL.md", "skill\n")
    (repo / ".config/tool/skills").mkdir(parents=True)
    # The agent tool calculated this target from the physical location inside the checkout.
    (repo / ".config/tool/skills/x").symlink_to("../../../../.agents/skills/x")
    assert (repo / ".config/tool/skills/x/SKILL.md").exists()

    (home / ".config").symlink_to("dotfiles/.config")
    write(home / ".tmux.conf", "set -g mouse on\n")
    return home


def test_dry_run_changes_nothing(root):
    home = make_home(root / "dry")
    before = snapshot(home)
    result = unfold(home)
    assert result.returncode == 0, result.stderr
    assert "Dry run" in result.stdout
    assert snapshot(home) == before


def test_apply(root):
    home = make_home(root / "apply")
    repo = home / "dotfiles"
    result = unfold(home, "--apply")
    assert result.returncode == 0, result.stdout + result.stderr

    config = home / ".config"
    assert config.is_dir() and not config.is_symlink()
    assert (config / "app/settings.conf").is_symlink()
    assert (config / "app/settings.conf").resolve() == repo / ".config/app/settings.conf"
    assert (config / "app/state.json").read_text() == "{}\n"
    assert (config / "gh/hosts.yml").read_text() == "token: secret\n"
    assert not (config / "gh/config.yml").is_symlink()
    assert (config / "gh/config.yml").read_text() == "git_protocol: https\n"
    assert (config / "newtool/latest").read_text() == "data\n"
    assert (config / "tool/skills/x/SKILL.md").read_text() == "skill\n"
    assert (home / ".tmux.conf").is_symlink()
    assert (home / ".tmux.conf").resolve() == repo / ".tmux.conf"
    assert list((home / ".local/state/dotfiles").glob("unfold-config-*.tar.gz"))

    untracked = subprocess.run(
        ["git", "-C", str(repo), "status", "--porcelain", "--ignored"], text=True, capture_output=True
    ).stdout
    assert untracked == "", untracked

    again = unfold(home, "--apply")
    assert again.returncode == 0 and "Nothing to do" in again.stdout


def test_conflict_stops_before_changes(root):
    home = make_home(root / "conflict")
    write(home / ".tmux.conf", "a local change\n")
    before = snapshot(home)
    result = unfold(home, "--apply")
    assert result.returncode == 1
    assert ".tmux.conf" in result.stderr
    assert snapshot(home) == before


def main():
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory).resolve()
        for test in (test_dry_run_changes_nothing, test_apply, test_conflict_stops_before_changes):
            test(root)
            print(f"PASS: {test.__name__}")


if __name__ == "__main__":
    main()
