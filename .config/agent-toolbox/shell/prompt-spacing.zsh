# Shared prompt spacing for the MacBook and Agent Toolbox. Source this file
# after the selected prompt engine has initialized.

[[ -n "${_AGENT_PROMPT_SPACING_LOADED:-}" ]] && return
typeset -g _AGENT_PROMPT_SPACING_LOADED=1

# Keep the first prompt flush with terminal padding. After a command completes,
# add one separator row unless the command itself cleared the screen.
typeset -gi _prompt_separator_ready=0
typeset -gi _prompt_separator_skip=0

prompt_separator_preexec() {
  local -a command_words
  command_words=(${(z)1})
  if (( ${#command_words} == 1 )) && [[ "${command_words[1]}" == clear ]]; then
    _prompt_separator_skip=1
  elif (( ${#command_words} == 2 )) &&
       [[ "${command_words[1]}" == command && "${command_words[2]}" == clear ]]; then
    _prompt_separator_skip=1
  else
    _prompt_separator_skip=0
  fi
}

prompt_separator_precmd() {
  if (( !_prompt_separator_ready )); then
    _prompt_separator_ready=1
    return
  fi
  if (( _prompt_separator_skip )); then
    _prompt_separator_skip=0
    return
  fi
  print
}

autoload -Uz add-zsh-hook
add-zsh-hook preexec prompt_separator_preexec
add-zsh-hook precmd prompt_separator_precmd
