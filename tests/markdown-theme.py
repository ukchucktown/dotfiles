#!/usr/bin/env python3
"""Exercise md through a real PTY, including OSC replies and terminal cleanup.

Pass --mdterm /path/to/mdterm to also check the actual preview HTML.
"""
import argparse
import json
import os
from pathlib import Path
import pty
import select
import signal
import subprocess
import tempfile
import termios
import time

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--mdterm', type=Path)
options = parser.parse_args()


def check(name, expected, reply=None, environment=None, status=0):
    with tempfile.TemporaryDirectory() as temporary:
        base = Path(temporary)
        binaries = base / '.local/bin'
        binaries.mkdir(parents=True)
        fixture = base / 'sample with spaces.md'
        fixture.write_text('# Heading\n\nReadable body and `code`.\n\n> A quote\n\n'
                           '| Name | Value |\n| --- | --- |\n| Test | Text |\n\n'
                           '```js\nconst value = 1;\n```\n\n```mermaid\ngraph LR\nA --> B\n```\n')
        if options.mdterm:
            (binaries / 'mdterm').symlink_to(options.mdterm.resolve())
            viewer = binaries / 'terminal-viewer'
            viewer.write_text('#!/bin/zsh\ncurl -fsS "$2" > "$MD_TEST_OUTPUT"\n')
            viewer.chmod(0o755)
        else:
            renderer = binaries / 'mdterm'
            renderer.write_text('#!/usr/bin/env node\nrequire("node:fs").writeFileSync('
                                'process.env.MD_TEST_OUTPUT, JSON.stringify(process.argv.slice(2)));\n')
            renderer.chmod(0o755)
        output_file = base / 'output'
        pid, terminal = pty.fork()
        if pid == 0:
            env = os.environ.copy()
            for key in ['MD_THEME', 'COLORFGBG']:
                env.pop(key, None)
            env.update(HOME=str(base), ZDOTDIR=str(base), MD_TEST_OUTPUT=str(output_file))
            env.update(environment or {})
            os.execve(str(ROOT / '.local/bin/md'), ['md', str(fixture)], env)
        captured = b''
        queried = False
        done = False
        try:
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                if select.select([terminal], [], [], .05)[0]:
                    try:
                        captured += os.read(terminal, 65536)
                    except OSError:
                        pass
                    if not queried and b'\x1b]11;?\x07' in captured:
                        queried = True
                        if reply:
                            # Separate writes also exercise a split OSC response.
                            for part in [reply[:9], reply[9:]]:
                                os.write(terminal, part)
                child, result = os.waitpid(pid, os.WNOHANG)
                if child:
                    done = True
                    break
            assert done, f'{name}: viewer did not finish within five seconds'
            assert os.waitstatus_to_exitcode(result) == status, (name, captured)
            flags = termios.tcgetattr(terminal)[3]
            assert flags & termios.ICANON and flags & termios.ECHO, f'{name}: terminal left in raw mode'
            if status:
                assert not output_file.exists(), f'{name}: launched viewer after failure'
            else:
                output = output_file.read_text()
                if options.mdterm:
                    foreground = '#1f2328' if expected == 'light' else '#f0f6fc'
                    assert f'color-scheme: {expected}' in output, name
                    assert f'color: {foreground}' in output, name
                    assert f'github-markdown-{expected}.min.css' in output, name
                    highlight = 'github.min.css' if expected == 'light' else 'github-dark.min.css'
                    assert f'styles/{highlight}' in output, name
                    diagram = 'default' if expected == 'light' else 'dark'
                    assert f"theme: '{diagram}'" in output, name
                else:
                    assert json.loads(output) == ['--theme', expected, '--preview', '--viewer',
                                                  str(binaries/'terminal-viewer'), '--', str(fixture)], (name, output, captured)
            if environment and environment.get('MD_THEME') in ['light', 'dark', 'invalid']:
                assert not queried, f'{name}: explicit theme queried the terminal'
            print(f'PASS: {name}')
        finally:
            if not done:
                os.kill(pid, signal.SIGKILL)
                os.waitpid(pid, 0)
            os.close(terminal)


check('white terminal overrides stale dark environment', 'light',
      b'\x1b]11;rgb:ffff/ffff/ffff\x1b\\', {'COLORFGBG': '15;0'})
check('dark terminal overrides stale light environment', 'dark',
      b'\x1b]11;rgb:10/12/18\x07', {'COLORFGBG': '0;15'})
check('tinted light terminal', 'light', b'\x1b]11;rgb:eee/ddd/ccc\x07')
check('unanswered query uses COLORFGBG', 'light', environment={'COLORFGBG': '0;15'})
check('malformed reply uses COLORFGBG', 'light', b'\x1b]11;rgb:bad/reply\x07', {'COLORFGBG': '0;7'})
check('unknown terminal keeps dark default', 'dark')
check('manual light theme', 'light', environment={'MD_THEME': 'light'})
check('manual dark theme', 'dark', environment={'MD_THEME': 'dark', 'COLORFGBG': '0;15'})
check('invalid override fails before launch', None, environment={'MD_THEME': 'invalid'}, status=2)
check('Ctrl-C cancels before launch and restores terminal', None, b'\x03', status=130)

for color, expected in [('0;15', 'light'), ('15;0', 'dark'), ('invalid', 'dark')]:
    env = os.environ.copy()
    env.update(MD_THEME='auto', COLORFGBG=color)
    result = subprocess.run(['node', str(ROOT/'.local/share/terminal-viewer/markdown-theme.mjs')],
                            env=env, start_new_session=True, capture_output=True, text=True,
                            timeout=2, check=True)
    assert result.stdout.strip() == expected, result
print('PASS: no controlling terminal uses the environment or dark default')
