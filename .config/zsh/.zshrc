# Modular interactive Zsh configuration.
[[ -o interactive ]] || return

# Machine-specific environment and credentials stay outside version control.
if [[ -r "$HOME/.zshrc.local" ]]; then
  source "$HOME/.zshrc.local"
fi

# History
HISTFILE="$XDG_STATE_HOME/zsh/history"
HISTSIZE=100000
SAVEHIST=100000

setopt APPEND_HISTORY
setopt SHARE_HISTORY
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_SPACE
setopt HIST_EXPIRE_DUPS_FIRST
setopt HIST_FIND_NO_DUPS

# Shell behavior
setopt AUTOCD
setopt NOBEEP
setopt NUMERIC_GLOB_SORT

# Completion must be initialized before fzf-tab and aliases that use compdef.
autoload -Uz compinit
compinit -d "$XDG_CACHE_HOME/zsh/zcompdump"
zmodload zsh/complist

zstyle ':completion:*:descriptions' format '[%d]'
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' menu no
zstyle ':fzf-tab:*' fzf-flags --preview-window=down:40%:wrap
zstyle ':fzf-tab:*' fzf-preview 'printf "%s\n" "$desc"'

# Navigation
if command -v zoxide >/dev/null 2>&1; then
  eval "$(zoxide init zsh)"
fi

# Core modules. Plugin order matters: fzf-tab follows compinit, while syntax
# highlighting is loaded at the very end of this file.
source "$ZDOTDIR/fzf.zsh"
source "$ZDOTDIR/aliases.zsh"
source "$ZDOTDIR/plugins.zsh"

export ZSH_AUTOSUGGEST_MANUAL_REBIND=1
export ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=110'

_zplugin_load Aloxaf fzf-tab fzf-tab.plugin.zsh
_zplugin_load zsh-users zsh-autosuggestions zsh-autosuggestions.zsh
_zplugin_load zsh-users zsh-history-substring-search zsh-history-substring-search.zsh

if [[ -o zle ]]; then
  source "$ZDOTDIR/bindings.zsh"
fi

# Native command completions replace the corresponding Oh My Zsh plugins.
if command -v kubectl >/dev/null 2>&1; then
  source <(kubectl completion zsh)
fi

source "$ZDOTDIR/prompt.zsh"

# Keep the terminal tab title synchronized with the current directory.
set_tab_title() {
  if [[ "$PWD" == "$HOME" ]]; then
    print -n -- $'\e]0;~\a'
  else
    print -n -- $'\e]0;'"$PWD"$'\a'
  fi
}

set_tab_title_precmd() {
  set_tab_title
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd set_tab_title_precmd

if [[ -r "$HOME/.config/agent-toolbox/shell/prompt-spacing.zsh" ]]; then
  source "$HOME/.config/agent-toolbox/shell/prompt-spacing.zsh"
fi

# Set JAVA_HOME quietly when a Java installation is available.
if [[ -x /usr/libexec/java_home ]]; then
  java_home="$(/usr/libexec/java_home 2>/dev/null)" && export JAVA_HOME="$java_home"
  unset java_home
fi

if [[ -r "$HOME/.ghosttyrc" ]]; then
  source "$HOME/.ghosttyrc"
fi

# Suppress the prompt end-of-line marker.
export PROMPT_EOL_MARK=''

# Syntax highlighting must be sourced after all widgets and bindings.
_zplugin_load zsh-users zsh-syntax-highlighting zsh-syntax-highlighting.zsh
ZSH_HIGHLIGHT_STYLES[path]='none'
ZSH_HIGHLIGHT_STYLES[path_prefix]='none'
ZSH_HIGHLIGHT_STYLES[globbing]='none'
