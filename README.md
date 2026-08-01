# Grant's dotfiles

Configuration shared between the personal macOS shell and Agent Toolbox. The
macOS shell uses the files at the repository root; the container uses the
smaller, host-independent package under `.config/agent-toolbox/shell`.

## macOS shell requirements

The following tools are needed to reproduce the shell and terminal appearance.
The shell discovers Homebrew in either standard macOS location, so the same
configuration works on Apple Silicon and Intel Macs.

| Tool | Why it is needed | Version tested here |
| --- | --- | --- |
| Zsh | Interactive shell | macOS system Zsh |
| Homebrew | Installs shell plugins and command-line tools | Current stable |
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
  tmux \
  fzf \
  fzf-tab \
  zsh-autosuggestions \
  zsh-syntax-highlighting

brew install --cask \
  ghostty \
  font-jetbrains-mono-nerd-font
```

On a new machine, install Oh My Zsh and Powerlevel10k before starting an
interactive shell with these dotfiles:

```sh
git clone https://github.com/ohmyzsh/ohmyzsh.git "$HOME/.oh-my-zsh"
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git \
  "$HOME/.oh-my-zsh/custom/themes/powerlevel10k"
```

## Optional host tools

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
| Docker Desktop | Runs Agent Sandbox |

Install the optional tools that are used on this Mac:

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

This Mac keeps its default AWS profile in that local file. API keys and other
credentials should be loaded there from a keychain or password manager, not
written directly into either file.

## Linking the configuration

Clone the private repository to `~/dotfiles`. Back up any existing targets,
then link the host entry points:

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
ln -s "$HOME/dotfiles/.config/agent-toolbox" "$HOME/.config/agent-toolbox"
```

The host `.tmux.conf` sources the shared tmux configuration from
`~/.config/agent-toolbox/shell/tmux.conf`. Agent Sandbox mounts that same file
at `/opt/agent-shell/tmux.conf`, which keeps both environments visually aligned.

## Machine-specific Agent Sandbox settings

Copy the tracked environment template to the ignored local configuration:

```sh
cp "$HOME/.config/agent-toolbox/agent-sandbox.env.example" \
  "$HOME/.config/agent-toolbox/agent-sandbox.env"
```

Then review the host UID, published SSH port, Mosh UDP range, timezone, and
network binding. The real `agent-sandbox.env` is intentionally ignored. The
version pins in its example describe tools installed inside the image; those
tools do not need to be installed directly on macOS.

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

## Files that affect the shell

- `.zshrc` — macOS-specific interactive shell and optional cloud tooling.
- `.p10k.zsh` — Powerlevel10k prompt.
- `.ghosttyrc` — Ghostty opacity helpers and key widgets.
- `.tmux.conf` — macOS tmux entry point.
- `.config/agent-toolbox/shell/tmux.conf` — shared tmux behavior and styling.
- `.config/agent-toolbox/shell/tmux-system-stats` — macOS/Linux CPU and memory
  status implementation using only operating-system utilities.
- `.config/agent-toolbox/shell/zshrc` — container-specific Zsh configuration;
  it intentionally excludes Homebrew, cloud profiles, and host mutation logic.

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
