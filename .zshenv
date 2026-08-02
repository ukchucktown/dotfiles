# Bootstrap Zsh into the XDG-based configuration directory.
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export ZDOTDIR="$XDG_CONFIG_HOME/zsh"

# Zsh does not restart its startup-file search after ZDOTDIR changes, so load
# the real environment file explicitly on the first shell in a process tree.
if [[ -r "$ZDOTDIR/.zshenv" ]]; then
  source "$ZDOTDIR/.zshenv"
fi
