# Grant's dotfiles

Configuration for a MacBook running Zsh and the host-side layer for
[Agent Toolbox](https://github.com/ukchucktown/agent-toolbox). Files at the
repository root configure the MacBook; `.config/agent-toolbox/shell` contains a
smaller Linux-compatible shell package mounted read-only into the container.

## How the configuration fits together

The MacBook and Agent Toolbox deliberately share presentation and interactive
behavior without pretending they are the same operating system:

| Concern | MacBook | Agent Toolbox container |
| --- | --- | --- |
| Zsh entry point | `~/.zshrc` | `/etc/agent-shell/.zshrc` |
| Private Zsh additions | `~/.zshrc.local` | `/opt/agent-shell/zshrc` |
| tmux entry point | `~/.tmux.conf` | `/etc/tmux.conf` |
| Shared tmux configuration | `~/.config/agent-toolbox/shell/tmux.conf` | `/opt/agent-shell/tmux.conf` |
| Prompt | `~/.p10k.zsh` | `/opt/agent-p10k.zsh` |
| Neovim configuration | `~/.config/nvim` | `/opt/agent-nvim` |
| Terminal rendering | Ghostty | The attaching terminal client |

The host keeps Homebrew, cloud profiles, credentials, and Ghostty mutation
logic out of the container package. The container package keeps Linux-specific
paths and GNU command behavior out of the MacBook configuration. Shared tmux,
Powerlevel10k, and Neovim files provide the consistent feel between them.

## MacBook running Zsh

### Requirements

The following tools are needed to reproduce the shell and terminal appearance.
The shell discovers Homebrew in either standard macOS location, so the same
configuration works on Apple Silicon and Intel Macs.

| Tool | Why it is needed | Version tested here |
| --- | --- | --- |
| Zsh | Interactive shell | System Zsh |
| Homebrew | Installs shell plugins and command-line tools | Current stable |
| GNU Stow | Links this repository into the home directory | 2.4.1 |
| Oh My Zsh | Plugin and theme loader | Git checkout |
| Powerlevel10k | Prompt used by `.p10k.zsh` | Git checkout |
| tmux | Sessions, windows, status bar, and scrollback | **3.7b** |
| fzf and fzf-tab | Interactive completion menu | 0.74.1 / 1.3.0 |
| zsh-autosuggestions | Inline command suggestions | 0.7.1 |
| zsh-syntax-highlighting | Command-line syntax colors | 0.8.0 |
| Ghostty | Terminal and quick terminal behavior | Current app release |
| Nerd Font | Icons in tmux and Powerlevel10k | JetBrains Mono or Agave |

tmux 3.7b is the compatibility baseline. The shared configuration uses newer
formatting and copy-mode options that tmux 3.3a does not support.

Install the Homebrew-managed requirements:

```sh
brew install \
  stow \
  tmux \
  fzf \
  fzf-tab \
  zsh-autosuggestions \
  zsh-syntax-highlighting

brew install --cask \
  ghostty \
  font-jetbrains-mono-nerd-font
```

On a new MacBook, install Oh My Zsh and Powerlevel10k before starting an
interactive Zsh session with these dotfiles:

```sh
git clone https://github.com/ohmyzsh/ohmyzsh.git "$HOME/.oh-my-zsh"
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git \
  "$HOME/.oh-my-zsh/custom/themes/powerlevel10k"
```

### Zsh startup behavior

The tracked `.zshrc`:

- Loads Powerlevel10k instant prompt before other startup work.
- Discovers Homebrew under either `/opt/homebrew` or `/usr/local`.
- Sources `~/.zshrc.local` before loading the prompt so local environment
  choices can appear in Powerlevel10k.
- Initializes Oh My Zsh with the Git and kubectl plugins.
- Loads fzf-tab after completion initialization, then loads autosuggestions and
  syntax highlighting in the order required by those plugins.
- Adds optional Homebrew Python, Google Cloud, and curl locations to `PATH`.
- Sets `JAVA_HOME` only when `/usr/libexec/java_home` succeeds.
- Updates the terminal title from the current directory after prompt startup.
- Loads Ghostty-only widgets from `~/.ghosttyrc` when that file exists.

### Terminal stack

Ghostty supplies the quick terminal, transparency, split dimming, padding, and
theme. tmux supplies persistent sessions and multiple named windows inside the
quick terminal, without plugins. Its shared configuration provides:

- One-based window and pane indexes.
- A two-row status area at the top with a muted full-width divider.
- Session or hostname context on the left and CPU/memory usage on the right.
- Gold active-window text and lavender inactive-window text.
- Content-sensitive automatic names such as `zsh` and `nvim`.
- A distinct command prompt, mouse support, and 100,000 lines of history.
- Copy-mode scrolling without the timestamp/position overlay or temporary
  `[tmux]` window rename.

tmux 3.7b is required because older releases do not understand every format and
copy-mode option used by this status line. Nerd Font support is required for
the terminal, CPU, memory, and divider glyphs.

### Optional host tools

The shell remains usable without these tools, but configuration is enabled for
them when installed:

| Tool | Configuration that uses it |
| --- | --- |
| `kubectl` | Oh My Zsh aliases and generated Zsh completion |
| AWS CLI | Profile selection may be set in the local-only `~/.zshrc.local` |
| Google Cloud CLI | Its Homebrew `bin` directory is added to `PATH` |
| Java | `JAVA_HOME` is populated with `/usr/libexec/java_home` |
| Homebrew curl | Preferred through the active Homebrew prefix |
| Homebrew Python | Unversioned `python`/`pip` through `python/libexec/bin` |
| Gemini CLI | The `gemini` alias suppresses Node deprecation warnings |
| GitHub CLI | GitHub command-line workflows |
| Herdr | Agent-oriented terminal multiplexer configuration |
| Docker Desktop | Runs Agent Toolbox |

Install the optional tools that are used on this MacBook:

```sh
brew install kubernetes-cli awscli curl python@3.14 openjdk gh herdr
brew install --cask gcloud-cli
```

Gemini CLI is Node-based and is intentionally not installed by the dotfiles.
Install it separately if the `gemini` alias is needed.

Machine-specific environment belongs in `~/.zshrc.local`, which is sourced by
`.zshrc` but lives outside this repository. For example:

```sh
export AWS_PROFILE="your-profile-name"
```

Each MacBook keeps its own default AWS profile in that local file. API keys and
other credentials should be loaded there from a keychain or password manager,
not written directly into either file.

## Linking the configuration

### GNU Stow (preferred)

This repository is a single Stow package rooted at the checkout itself. Clone
it to `~/dotfiles`, install GNU Stow, and make sure `~/.config` is a real
directory before linking:

```sh
git clone https://github.com/ukchucktown/dotfiles.git "$HOME/dotfiles"
brew install stow
mkdir -p "$HOME/.config"
cd "$HOME/dotfiles"
```

Back up or remove existing targets first. Preview the operation, then create
the links:

```sh
stow --simulate --verbose --target="$HOME" --no-folding .
stow --target="$HOME" --no-folding .
```

`--no-folding` is intentional. It creates links for the managed files instead
of replacing the whole `~/.config` directory with a link into the repository.
That keeps credentials, application databases, sockets, logs, and other local
state in the real home directory. The tracked `.stow-local-ignore` provides an
additional guard against linking known machine-local files from an older
checkout; Git and Stow use separate ignore files, so both must be updated when
an application introduces a new kind of generated state.

After pulling changes, preview and refresh the managed links with:

```sh
cd "$HOME/dotfiles"
git pull --ff-only
stow --simulate --verbose --target="$HOME" --no-folding --restow .
stow --target="$HOME" --no-folding --restow .
```

Older installations may have a folded `~/.config -> ~/dotfiles/.config`
link. That link continues to resolve the configuration, but it also causes
untracked application state to accumulate inside the checkout. Move that
local-only state into a real `~/.config` directory before switching the
installation to `--no-folding`; do not blindly run `--restow` over a folded
installation.

### Manual links

GNU Stow is optional. After backing up any existing targets, the host entry
points can be linked manually:

```sh
ln -s "$HOME/dotfiles/.zshrc" "$HOME/.zshrc"
ln -s "$HOME/dotfiles/.p10k.zsh" "$HOME/.p10k.zsh"
ln -s "$HOME/dotfiles/.tmux.conf" "$HOME/.tmux.conf"
ln -s "$HOME/dotfiles/.ghosttyrc" "$HOME/.ghosttyrc"
```

Prefer linking individual application directories into `~/.config` instead of
linking the entire directory. This keeps authentication and machine-generated
state out of the repository:

```sh
mkdir -p "$HOME/.config"
ln -s "$HOME/dotfiles/.config/ghostty" "$HOME/.config/ghostty"
ln -s "$HOME/dotfiles/.config/herdr" "$HOME/.config/herdr"
ln -s "$HOME/dotfiles/.config/nvim" "$HOME/.config/nvim"
ln -s "$HOME/dotfiles/.config/zed" "$HOME/.config/zed"
ln -s "$HOME/dotfiles/.config/agent-toolbox" "$HOME/.config/agent-toolbox"
```

The MacBook `.tmux.conf` sources the shared tmux configuration from
`~/.config/agent-toolbox/shell/tmux.conf`. Agent Toolbox mounts that same file
at `/opt/agent-shell/tmux.conf`, which keeps both environments visually aligned.

## Neovim

The tracked `.config/nvim` directory is a small native-package configuration
for Neovim 0.12 or newer. It keeps plugin declarations separate from settings
for completion, editing, formatting, LSP, Telescope, Tree-sitter, and UI. See
the dedicated [Neovim configuration guide](.config/nvim/README.md) for its
layout and key mappings.

The important portability choices are:

- Plugins use Neovim's built-in `vim.pack` instead of a bootstrap plugin
  manager.
- `nvim-pack-lock.json` is tracked, giving the MacBook and container the same
  plugin revisions.
- Mason installs `lua-language-server` and `stylua` into Neovim's data
  directory rather than the dotfiles repository.
- Telescope uses `rg` for live grep and builds its FZF extension with `make`.
- No user names, home-directory paths, credentials, or host-only runtime paths
  are stored in the Lua configuration.

Install the MacBook dependencies with:

```sh
brew install neovim ripgrep
```

Agent Toolbox already includes a pinned Neovim build, Tree-sitter CLI, `rg`,
and native build tools. The config directory is mounted read-only at
`/opt/agent-nvim`; only `nvim-pack-lock.json` is writable so deliberate plugin
updates can be shared back to the MacBook.

## Agent Toolbox

[Agent Toolbox](https://github.com/ukchucktown/agent-toolbox) is the public
container project. It builds a remote development host with Zsh, tmux, Mosh,
Herdr, Codex CLI, Claude Code, Node.js, Python, Java, Maven, Neovim, GitHub CLI,
Camunda tooling, and common command-line utilities. This repository
supplies user-specific configuration through explicit read-only mounts.

The split is intentional:

- The public repository owns the Dockerfile, launcher, security boundary,
  health checks, SSH/Mosh services, and pinned toolchain installation.
- This repository owns the prompt, terminal styling, tmux behavior, editor
  configuration, local ports, and the list of host directories agents may see.
- Credentials, agent histories, pairing state, and SSH host keys live in named
  Docker volumes or ignored local files—not in either Git repository.

The Docker service and volumes retain the historical `agent-sandbox` name so
existing installations can upgrade in place. Use the `./sandbox` launcher from
the Agent Toolbox checkout rather than invoking Compose directly.

### Local Agent Toolbox configuration

Copy the tracked environment template to the ignored local configuration:

```sh
cp "$HOME/.config/agent-toolbox/agent-sandbox.env.example" \
  "$HOME/.config/agent-toolbox/agent-sandbox.env"
```

Then review the host UID, published SSH port, Mosh UDP range, timezone, and
network binding. The real `agent-sandbox.env` is intentionally ignored. The
version pins in its example describe tools installed inside the image; those
tools do not need to be installed directly on the MacBook.

Copy `compose.mounts.yaml.example` to `compose.mounts.yaml`, then replace its
placeholder sources with absolute paths for that Mac. The launcher requires
absolute mount sources, so the real mount file is machine-local and ignored:

```sh
cp "$HOME/.config/agent-toolbox/compose.mounts.yaml.example" \
  "$HOME/.config/agent-toolbox/compose.mounts.yaml"
```

Router forwarding is only needed for the away configuration: TCP for SSH and
the locally configured UDP range for Mosh. Docker Desktop is the only host
requirement for the pinned container toolchain.

The mount configuration currently supports these responsibilities:

| Host source | Container target | Access |
| --- | --- | --- |
| Project checkout root | `/workspace` | Read-write |
| Agent shell package | `/opt/agent-shell` | Read-only |
| Powerlevel10k config | `/opt/agent-p10k.zsh` | Read-only |
| Neovim config | `/opt/agent-nvim` | Read-only, except its package lock |

Only mount directories that agents are allowed to read and modify. Agent
Toolbox intentionally does not mount the Docker socket, the rest of the home
directory, host SSH configuration, or system credential stores.

### Operating Agent Toolbox

From the public repository checkout:

```sh
./sandbox build          # Build pinned tools into the image
./sandbox up             # Create or update the running container
./sandbox status         # Check health, tools, SSH, and Moshi hooks
./sandbox shell          # Open a local shell in the container
./sandbox mount list     # Inspect the effective host mounts
./sandbox moshi-install  # Refresh Codex and Claude Moshi hooks
```

SSH is used for authentication and session startup. Mosh carries the roaming
interactive connection over the configured UDP range, which tolerates phone
sleep, network changes, and temporary loss of connectivity better than a plain
SSH terminal. tmux keeps shells and agents alive inside the container when the
client disconnects. Herdr is available as an alternative multiplexer, with its
portable UI settings stored in `.config/herdr/config.toml`.

Tool upgrades are deliberate: update pins in the ignored local environment
from the tracked example, then run `./sandbox build`, `./sandbox up`, and
`./sandbox moshi-install`. Do not remove the named Docker volumes unless the
persisted agent logins, histories, Moshi pairing, and SSH identity should also
be deleted.

## Dotfile reference

- `.zshrc` — macOS-specific interactive shell and optional cloud tooling.
- `.p10k.zsh` — Powerlevel10k prompt.
- `.ghosttyrc` — Ghostty opacity helpers and key widgets.
- `.tmux.conf` — macOS tmux entry point.
- `.config/agent-toolbox/shell/tmux.conf` — shared tmux behavior and styling.
- `.config/agent-toolbox/shell/tmux-system-stats` — macOS/Linux CPU and memory
  status implementation using only operating-system utilities.
- `.config/agent-toolbox/shell/zshrc` — container-specific Zsh configuration;
  it intentionally excludes Homebrew, cloud profiles, and host mutation logic.
- `.config/ghostty/config` and `.config/ghostty/themes` — Ghostty appearance,
  quick-terminal behavior, split presentation, and local themes.
- `.config/herdr/config.toml` — portable Herdr pane and tab-row behavior.
- `.config/nvim` — Neovim 0.12 configuration and pinned native package lock.
- `.config/agent-toolbox/*.example` — versioned templates for ignored,
  machine-local environment and mount settings.

## Authentication and generated state

Do not commit credentials or generated session state. The repository ignores
GitHub CLI credentials, Google Cloud state, Herdr logs/sockets/session data, and
macOS `.DS_Store` files. Review `git status` before every commit, especially
when adding a new application under `.config`.

API credentials must come from a keychain, password manager, or an untracked
local environment file. The tracked shell configuration and its history must
never export `OPENAI_API_KEY` or any other API token.

## Verification

After linking the files and installing dependencies:

```sh
exec zsh
tmux -V
tmux source-file "$HOME/.tmux.conf"
```

Confirm that `tmux -V` reports 3.7b or newer and that the terminal font renders
the CPU, memory, terminal, and divider glyphs correctly.
