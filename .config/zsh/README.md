# Zsh configuration

A modular, XDG-based Zsh setup inspired by
[radleylewis/zsh](https://github.com/radleylewis/zsh), adapted to preserve this
dotfiles repository's existing tools and Starship prompt.

## Layout

| File | Purpose |
| --- | --- |
| `.zshenv` | XDG directories, editor, prompt path, and `PATH` |
| `.zshrc` | History, completion, module loading, and local integrations |
| `aliases.zsh` | Command, navigation, editor, Git, and local aliases |
| `bindings.zsh` | Autosuggestion, history, navigation, and FZF bindings |
| `fzf.zsh` | FZF defaults, previews, and file selection |
| `plugins.zsh` | Small clone/source/update plugin loader |
| `prompt.zsh` | Starship initialization |

The root `~/.zshenv` sets `ZDOTDIR=~/.config/zsh`. The existing
`~/.config/starship.toml` remains the prompt configuration and is not duplicated
inside this directory.

## Dependencies

Install the command-line dependencies on macOS with:

```sh
brew install zsh neovim eza bat fd fzf zoxide starship ripgrep
```

## Plugins

Plugins are cloned into `~/.config/zsh/plugins` when first needed. That directory
is ignored by Git.

| Plugin | Purpose |
| --- | --- |
| `fzf-tab` | Fuzzy completion menu |
| `zsh-autosuggestions` | Inline command suggestions |
| `zsh-history-substring-search` | Up/Down history filtering |
| `zsh-syntax-highlighting` | Command-line syntax feedback |

Update all installed plugins explicitly with:

```sh
zplugin-update
```

## Keybindings

| Key | Action |
| --- | --- |
| `Ctrl+R` | Fuzzy history search |
| `Ctrl+T` | Fuzzy file search, including hidden files |
| `Ctrl+F` | Fuzzy file search, excluding hidden files |
| `Ctrl+Left` / `Ctrl+Right` | Move backward/forward one word |
| `Right` | Accept the current autosuggestion |
| `Up` / `Down` | Search history by substring |
| `Ctrl+Backslash` | Toggle autosuggestions |

## Machine-local configuration

Machine-specific environment variables and credentials remain in
`~/.zshrc.local`. The file is sourced early and should not be committed.
