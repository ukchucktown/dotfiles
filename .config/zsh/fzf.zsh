# Homebrew fzf integration (Apple Silicon and Intel).
for fzf_prefix in /opt/homebrew/opt/fzf /usr/local/opt/fzf; do
  if [[ -o zle && -r "$fzf_prefix/shell/key-bindings.zsh" ]]; then
    source "$fzf_prefix/shell/key-bindings.zsh"
  fi
  if [[ -o zle && -r "$fzf_prefix/shell/completion.zsh" ]]; then
    source "$fzf_prefix/shell/completion.zsh"
  fi
done
unset fzf_prefix

if command -v fd >/dev/null 2>&1; then
  export FZF_DEFAULT_COMMAND='fd --type f --hidden --strip-cwd-prefix'
  export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
fi

export FZF_DEFAULT_OPTS='
  --height=60%
  --layout=reverse
  --border=rounded
  --prompt="  "
  --pointer="  "
  --preview-window=right:65%:wrap:border-left
'

if command -v bat >/dev/null 2>&1; then
  export _FZF_PREVIEW_CMD='bat --color=always --style=plain,numbers --line-range=:500 {}'
else
  export _FZF_PREVIEW_CMD='sed -n "1,500p" {}'
fi
export FZF_CTRL_T_OPTS="--preview '$_FZF_PREVIEW_CMD'"

_fzf_file_no_hidden() {
  local cmd result
  cmd="${FZF_DEFAULT_COMMAND/--hidden /}"
  result=$(eval "${cmd:-find . -type f}" | fzf --preview "$_FZF_PREVIEW_CMD") \
    && LBUFFER+="$result"
  zle reset-prompt
}
if [[ -o zle ]]; then
  zle -N _fzf_file_no_hidden
fi
