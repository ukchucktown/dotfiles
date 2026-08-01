# Machine-specific environment, credentials, and prompt selection live here.
# Keep this file quiet during startup so Powerlevel10k instant prompt can work.
if [[ -r "$HOME/.zshrc.local" ]]; then
  source "$HOME/.zshrc.local"
fi

# Powerlevel10k remains the default. Set DOTFILES_PROMPT=starship in
# ~/.zshrc.local to try Starship without removing the existing prompt.
typeset -g DOTFILES_PROMPT="${DOTFILES_PROMPT:-p10k}"
case "$DOTFILES_PROMPT" in
  p10k|starship) ;;
  *)
    print -u2 -- "dotfiles: unknown DOTFILES_PROMPT '$DOTFILES_PROMPT'; using p10k"
    DOTFILES_PROMPT=p10k
    ;;
esac

# Enable Powerlevel10k instant prompt only when Powerlevel10k is selected.
if [[ "$DOTFILES_PROMPT" == p10k ]] &&
   [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# Setup Homebrew early so brew-installed plugins are available. Check both
# standard macOS locations so the same file works on Apple Silicon and Intel.
typeset _dotfiles_brew="$(command -v brew 2>/dev/null)"
if [[ -z "$_dotfiles_brew" ]]; then
  for _dotfiles_brew_candidate in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    if [[ -x "$_dotfiles_brew_candidate" ]]; then
      _dotfiles_brew="$_dotfiles_brew_candidate"
      break
    fi
  done
fi
if [[ -n "$_dotfiles_brew" ]]; then
  eval "$("$_dotfiles_brew" shellenv)"
fi
typeset _dotfiles_brew_prefix="${HOMEBREW_PREFIX:-}"

# OMZ Home directory
export OMZ_HOME="$HOME/.oh-my-zsh"

# Customization
DISABLE_MAGIC_FUNCTIONS="true"
DISABLE_AUTO_UPDATE="true"
ZSH_AUTOSUGGEST_MANUAL_REBIND=1

# Setup plugins and source startup files. Starship owns the prompt when selected,
# so Oh My Zsh must not load a theme in that mode.
if [[ "$DOTFILES_PROMPT" == p10k ]]; then
  ZSH_THEME="powerlevel10k/powerlevel10k"
else
  ZSH_THEME=""
fi
plugins=(git kubectl)
source $OMZ_HOME/oh-my-zsh.sh

# fzf-tab must load after completion is initialized and before widget-wrapping plugins.
if [[ -r "$_dotfiles_brew_prefix/opt/fzf-tab/share/fzf-tab/fzf-tab.zsh" ]]; then
  source "$_dotfiles_brew_prefix/opt/fzf-tab/share/fzf-tab/fzf-tab.zsh"
fi

zstyle ':completion:*:descriptions' format '[%d]'
zstyle ':completion:*' menu no
zstyle ':fzf-tab:*' fzf-flags --preview-window=down:40%:wrap
zstyle ':fzf-tab:*' fzf-preview 'printf "%s\n" "$desc"'

# Load Homebrew-installed zsh plugins explicitly so Oh My Zsh doesn't need local copies.
if [[ -r "$_dotfiles_brew_prefix/opt/zsh-autosuggestions/share/zsh-autosuggestions/zsh-autosuggestions.zsh" ]]; then
  source "$_dotfiles_brew_prefix/opt/zsh-autosuggestions/share/zsh-autosuggestions/zsh-autosuggestions.zsh"
fi

if [[ "$DOTFILES_PROMPT" == p10k ]]; then
  if [[ -r "$HOME/.p10k.zsh" ]]; then
    source "$HOME/.p10k.zsh"
  else
    print -u2 -- "dotfiles: p10k selected but ~/.p10k.zsh is unavailable"
  fi
elif command -v starship >/dev/null 2>&1; then
  eval "$(starship init zsh)"
else
  print -u2 -- "dotfiles: starship selected but the starship command is unavailable"
  PROMPT='%F{76}❯%f '
fi

# Key bindings
bindkey '^[[C' autosuggest-accept
bindkey '^[OC' autosuggest-accept

# Change foreground color for zsh-autosuggestions
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=110'

# Alias definitions
#alias python='python3'
#alias pip='python -m pip'

alias gemini='NODE_OPTIONS="--no-deprecation" gemini'

# Setup kubectl completion
if command -v kubectl &> /dev/null; then
  source <(kubectl completion zsh)
fi

zstyle ':completion:*' menu select
zmodload zsh/complist

# Shell functions
function set_tab_title {
  if [[ "$PWD" == "$HOME" ]]; then
    echo -ne "\033]0;~\007"
  else
    echo -ne "\033]0;${PWD}\007"
  fi
}

# Skip the first precmd run so terminal title output doesn't trip p10k instant prompt.
typeset -gi _set_tab_title_ready=0
set_tab_title_precmd() {
  if (( !_set_tab_title_ready )); then
    _set_tab_title_ready=1
    return
  fi
  set_tab_title
}

autoload -U add-zsh-hook
add-zsh-hook precmd set_tab_title_precmd

if [[ -r "$HOME/.config/agent-toolbox/shell/prompt-spacing.zsh" ]]; then
  source "$HOME/.config/agent-toolbox/shell/prompt-spacing.zsh"
fi

# Set JAVA_HOME without emitting startup warnings when Java is unavailable.
if [[ -x /usr/libexec/java_home ]]; then
  java_home="$('/usr/libexec/java_home' 2>/dev/null)" && export JAVA_HOME="$java_home"
  unset java_home
fi

# Path updates. Missing optional Homebrew packages leave harmless entries that
# become active when the corresponding package is installed.
path=("$HOME/.local/bin" $path)
if [[ -n "$_dotfiles_brew_prefix" ]]; then
  path=(
    "$_dotfiles_brew_prefix/opt/python/libexec/bin"
    "$_dotfiles_brew_prefix/share/google-cloud-sdk/bin"
    "$_dotfiles_brew_prefix/opt/curl/bin"
    $path
  )
fi
typeset -U path

# Load Ghostty-specific shell helpers from a separate stow-managed file.
if [[ -r "$HOME/.ghosttyrc" ]]; then
  source "$HOME/.ghosttyrc"
fi

# zsh-syntax-highlighting must be sourced at the end of .zshrc.
if [[ -r "$_dotfiles_brew_prefix/opt/zsh-syntax-highlighting/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh" ]]; then
  source "$_dotfiles_brew_prefix/opt/zsh-syntax-highlighting/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
fi

unset _dotfiles_brew _dotfiles_brew_candidate _dotfiles_brew_prefix

# remove underline on paths
ZSH_HIGHLIGHT_STYLES[path]='none'
# optional: also remove underline on directories / globbing / unknown tokens
ZSH_HIGHLIGHT_STYLES[path_prefix]='none'
ZSH_HIGHLIGHT_STYLES[globbing]='none'

# suppress prompt EOL mark
export PROMPT_EOL_MARK=''
