# XDG base directories
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
export XDG_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"

# Homebrew and personal tools must be available before command-dependent
# configuration such as the manual-page renderer is selected.
typeset -gU path PATH
path=(
  "$HOME/.local/bin"
  /opt/homebrew/opt/python/libexec/bin
  /opt/homebrew/share/google-cloud-sdk/bin
  /opt/homebrew/opt/curl/bin
  /opt/homebrew/bin
  /opt/homebrew/sbin
  $path
)

# Preferred editor
export EDITOR="${EDITOR:-nvim}"
export VISUAL="${VISUAL:-nvim}"

# Prompt configuration stays in its existing tracked location.
export STARSHIP_CONFIG="$XDG_CONFIG_HOME/starship.toml"

# Keep c8ctl human-readable by default; use --json for structured output.
export C8CTL_OUTPUT_MODE=text

# Preserve ANSI colors and let less handle mouse-wheel scrolling. Three lines
# per wheel event keeps long manual pages controllable without feeling slow.
export LESS='-R --mouse --wheel-lines=3'

# Strip traditional overstrike backspaces before syntax-highlighting man pages.
if command -v col >/dev/null 2>&1 && command -v bat >/dev/null 2>&1; then
  export MANPAGER="sh -c 'col -bx | bat --color=always --theme=ansi -l man -p'"
elif command -v col >/dev/null 2>&1 && command -v batcat >/dev/null 2>&1; then
  export MANPAGER="sh -c 'col -bx | batcat --color=always --theme=ansi -l man -p'"
fi

# Keep GPG attached to the current terminal without warning in non-TTY shells.
if [[ -t 0 || -t 1 ]]; then
  export GPG_TTY="$(tty 2>/dev/null)"
fi

# Map file types to ANSI palette slots; Ghostty's active theme supplies the
# actual RGB values. This keeps eza colors identical inside and outside tmux.
export EZA_COLORS='di=1;36:ln=35:so=32:pi=33:ex=31:bd=34;46:cd=34;43:su=30;41:sg=30;46:tw=30;42:ow=30;43'
