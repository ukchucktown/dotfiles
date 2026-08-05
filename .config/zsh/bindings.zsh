# Keep the familiar Emacs-style keymap; zsh-vi-mode is intentionally omitted.
bindkey -e

# Edit the current command buffer in $VISUAL or $EDITOR with Ctrl+X, Ctrl+E.
autoload -Uz edit-command-line
zle -N edit-command-line
bindkey '^X^E' edit-command-line

# Preserve conventional forward-character navigation.
bindkey '^F' forward-char
bindkey '^[[C' forward-char
bindkey '^[OC' forward-char

# Search command history by substring with Up and Down.
bindkey '^[[A' history-substring-search-up
bindkey '^[[B' history-substring-search-down

# Toggle inline suggestions with Ctrl+Backslash.
bindkey '^\' autosuggest-toggle
