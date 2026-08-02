# Let Starship own the entire prompt, including virtual-environment display.
export VIRTUAL_ENV_DISABLE_PROMPT=1
typeset -g FUNCNEST=100

if command -v starship >/dev/null 2>&1; then
  eval "$(starship init zsh)"
else
  print -u2 -- 'zsh: starship is unavailable; using a minimal prompt'
  PROMPT='%F{76}❯%f '
fi
