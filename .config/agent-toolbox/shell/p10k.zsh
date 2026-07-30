# Start from Powerlevel10k's lean preset, which is also the basis of the local
# Ghostty prompt, then retain the familiar two-line, transient prompt shape.
source "${ZSH_CUSTOM}/themes/powerlevel10k/config/p10k-lean.zsh"

typeset -g POWERLEVEL9K_MODE=nerdfont-v3
typeset -g POWERLEVEL9K_ICON_PADDING=none
typeset -g POWERLEVEL9K_BACKGROUND=
typeset -g POWERLEVEL9K_LEFT_PROMPT_ELEMENTS=(
  dir
  vcs
  newline
  prompt_char
)
typeset -g POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS=(
  status
  background_jobs
  context
  newline
)
typeset -g POWERLEVEL9K_PROMPT_ADD_NEWLINE=true
typeset -g POWERLEVEL9K_TRANSIENT_PROMPT=always
typeset -g POWERLEVEL9K_INSTANT_PROMPT=verbose
typeset -g POWERLEVEL9K_CONTEXT_{DEFAULT,SUDO}_{CONTENT,VISUAL_IDENTIFIER}_EXPANSION=

(( ${+functions[p10k]} )) && p10k reload
