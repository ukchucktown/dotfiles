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
| `functions.zsh` | User-facing shell functions, including the Yazi launcher |
| `plugins.zsh` | Small clone/source/update plugin loader |
| `prompt.zsh` | Starship initialization |

The root `~/.zshenv` sets `ZDOTDIR=~/.config/zsh`. The existing
`~/.config/starship.toml` remains the prompt configuration and is not duplicated
inside this directory.

## Dependencies

Install the command-line dependencies on macOS with:

```sh
brew install zsh neovim eza bat fd fzf zoxide starship ripgrep yazi
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
| `Ctrl+F` / `Right` | Move forward one character |
| `Option+Left` / `Option+Right` | Move backward/forward one word |
| `Ctrl+X`, then `Ctrl+E` | Edit the current command line in `$VISUAL` or `$EDITOR` |
| `Up` / `Down` | Search history by substring |
| `Ctrl+Backslash` | Toggle autosuggestions |

Run `y` to open Yazi and return the shell to the directory selected when Yazi
exits. Press `Q` inside Yazi to quit without changing the shell directory.

## Machine-local configuration

Machine-specific environment variables and credentials remain in
`~/.zshrc.local`. The file is sourced early and should not be committed.
