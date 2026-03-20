# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# OMZ Home directory
export OMZ_HOME="$HOME/.oh-my-zsh"

# Customization
DISABLE_MAGIC_FUNCTIONS="true"
DISABLE_AUTO_UPDATE="true"
ZSH_AUTOSUGGEST_MANUAL_REBIND=1

# Setup plugins and source startup files
ZSH_THEME="powerlevel10k/powerlevel10k"
plugins=(git zsh-autosuggestions zsh-syntax-highlighting)
source $OMZ_HOME/oh-my-zsh.sh
source ~/.p10k.zsh

# Key bindings
bindkey '^[[C' autosuggest-accept
bindkey '^[OC' autosuggest-accept

# Change foreground color for zsh-autosuggestions
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=110'

# remove underline on paths
ZSH_HIGHLIGHT_STYLES[path]='none'
# optional: also remove underline on directories / globbing / unknown tokens
ZSH_HIGHLIGHT_STYLES[path_prefix]='none'
ZSH_HIGHLIGHT_STYLES[globbing]='none'

#  Setup brew environment
eval "$(/opt/homebrew/bin/brew shellenv)"

# Alias definitions
#alias python='/opt/homebrew/bin/python3'
#alias pip='python -m pip'

alias gemini='NODE_OPTIONS="--no-deprecation" gemini'

# Shell functions
c8run () {
  (cd /opt/c8run && ./c8run "$@")
}

function set_tab_title {
  if [[ "$PWD" == "$HOME" ]]; then
    echo -ne "\033]0;~\007"
  else
    echo -ne "\033]0;${PWD}\007"
  fi
}

autoload -U add-zsh-hook
add-zsh-hook precmd set_tab_title

# Set JAVA_HOME
export JAVA_HOME=`/usr/libexec/java_home`

# Prefer brew curl over the system default
export PATH="/opt/homebrew/opt/curl/bin:$PATH"

# --- Ghostty opacity nudge helpers -----------------------------------------

_ghostty_cfg="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config"

ghostty_opacity_get() {
  # Read current opacity from config; fall back to 0.90
  awk '
    /^[[:space:]]*background-opacity[[:space:]]*=/ {
      v=$0
      sub(/.*=/, "", v)
      gsub(/[[:space:]]/, "", v)
      if (v == "") v = 0.90
      printf "%.2f\n", v
      found=1
      exit
    }
    END { if (!found) printf "%.2f\n", 0.90 }
  ' "$_ghostty_cfg"
}

ghostty_opacity_nudge() {
  local delta="$1"  # e.g. 0.05 or -0.05
  local tmp="${_ghostty_cfg}.tmp.$$"

  # Ensure file exists
  mkdir -p "${_ghostty_cfg:h}"
  [[ -f "$_ghostty_cfg" ]] || printf "background-opacity=0.90\n" >"$_ghostty_cfg"

  # Update (clamp to [0.05, 1.0], step to 2 decimals)
  awk -v d="$delta" '
    BEGIN { updated=0 }
    /^[[:space:]]*background-opacity[[:space:]]*=/ {
      # grab number after "="
      v=$0
      sub(/.*=/, "", v)
      gsub(/[[:space:]]/, "", v)
      if (v == "") v = 0.90

      nv = v + d
      if (nv > 1.00) nv = 1.00
      if (nv < 0.05) nv = 0.05

      printf "background-opacity=%.2f\n", nv
      updated=1
      next
    }
    { print }
    END {
      if (!updated) {
        # if the setting was not present, append it
        printf "background-opacity=%.2f\n", (0.90 + d)
      }
    }
  ' "$_ghostty_cfg" > "$tmp" && mv "$tmp" "$_ghostty_cfg"

  # Defensive: establish a baseline if one hasn't been set yet
  [[ -n "${_ghostty_opacity_base:-}" ]] || ghostty_opacity_set_base

  _ghostty_opacity_last="$(ghostty_opacity_get)"
  _ghostty_opacity_diff="$(awk -v n="$_ghostty_opacity_last" -v b="$_ghostty_opacity_base" 'BEGIN { printf "%+.2f", n - b }')"
}

ghostty_opacity_up()   { ghostty_opacity_nudge  0.05; zle -M "Ghostty opacity ${_ghostty_opacity_last} (Δ ${_ghostty_opacity_diff} since baseline; now reload config)"; }
ghostty_opacity_down() { ghostty_opacity_nudge -0.05; zle -M "Ghostty opacity ${_ghostty_opacity_last} (Δ ${_ghostty_opacity_diff} since baseline; now reload config)"; }
ghostty_select_command_line() {
  zle beginning-of-line
  zle set-mark-command
  zle end-of-line
}

zle -N ghostty_opacity_up
zle -N ghostty_opacity_down
zle -N ghostty_select_command_line

# Bind the escape sequences Ghostty sends:
bindkey -M emacs $'\e[201~' ghostty_opacity_up
bindkey -M emacs $'\e[202~' ghostty_opacity_down
bindkey -M viins $'\e[201~' ghostty_opacity_up
bindkey -M viins $'\e[202~' ghostty_opacity_down

# Capture baseline opacity at shell load (used for Δ since last reload)
mkdir -p "${_ghostty_cfg:h}"
[[ -f "$_ghostty_cfg" ]] || printf "background-opacity=0.90\n" >"$_ghostty_cfg"
ghostty_opacity_set_base() {
  _ghostty_opacity_base="$(ghostty_opacity_get)"
  _ghostty_opacity_last="$_ghostty_opacity_base"
  _ghostty_opacity_diff="+0.00"
}
ghostty_opacity_set_base

# OpenAPI Key
