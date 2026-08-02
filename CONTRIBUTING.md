# Contributing

Thanks for helping make this terminal environment easier to understand, adopt,
and maintain.

## Good contributions

- Portability improvements for macOS, Linux, or Agent Toolbox.
- Clearer setup, troubleshooting, and component-adoption documentation.
- Shell changes that preserve fast startup and framework-free plugin loading.
- Safer defaults for credentials, mounts, remote access, and generated state.
- Focused tests for behavior that can regress across tool upgrades.

For major changes, open an issue first so the intended workflow and portability
tradeoffs can be discussed before implementation.

## Keep personal state out

Never submit API keys, credentials, shell history, private hostnames, cloud
profiles, project paths, or application databases. Machine-specific values
belong in ignored local files such as `~/.zshrc.local` and
`~/.config/agent-toolbox/agent-sandbox.env`.

If a contribution adds a generated file or application directory, update both
`.gitignore` and `.stow-local-ignore` when appropriate.

## Validate a change

Run the checks that match the files you changed:

```sh
zsh -n .zshenv .zshrc .config/zsh/*.zsh .config/zsh/.zshenv .config/zsh/.zshrc
zsh tests/manpager.zsh

target="$(mktemp -d)"
mkdir -p "$target/.config"
stow --simulate --verbose --target="$target" --no-folding .
```

Also start a fresh Zsh session and verify any visual change in Ghostty, tmux,
and a plain terminal session where applicable.

## Pull requests

Keep each pull request focused, explain the user-visible effect, and update the
README when setup or behavior changes. Preserve upstream attribution for color
themes or other adapted material.
