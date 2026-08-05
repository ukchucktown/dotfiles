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
  export FZF_DEFAULT_COMMAND='fd --type f --hidden --strip-cwd-prefix --exclude .git'
  export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
  export FZF_ALT_C_COMMAND='fd --type=d --hidden --strip-cwd-prefix --exclude .git'
fi

export FZF_DEFAULT_OPTS='
  --height=60%
  --layout=reverse
  --border=rounded
  --prompt="  "
  --pointer="▌ "
  --scrollbar="┃│"
  --color="fg:#e0def4,fg+:#ffffff,bg+:#484e5b,hl:#89bcef,hl+:#82d6d6,pointer:#5fb3b3,scrollbar:#5fb3b3,preview-scrollbar:#6699cc,border:#2b2e48"
  --preview-window=right:65%:wrap:border-left
'

if command -v bat >/dev/null 2>&1; then
  export _FZF_PREVIEW_CMD='bat --color=always --style=plain,numbers --line-range=:500 {}'
else
  export _FZF_PREVIEW_CMD='sed -n "1,500p" {}'
fi
export FZF_CTRL_T_OPTS="--preview '$_FZF_PREVIEW_CMD'"
