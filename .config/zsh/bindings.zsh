# Keep the familiar Emacs-style keymap; zsh-vi-mode is intentionally omitted.
bindkey -e

# Edit the current command buffer in $VISUAL or $EDITOR with Ctrl+X, Ctrl+E.
autoload -Uz edit-command-line
zle -N edit-command-line
bindkey '^X^E' edit-command-line

# Accept the current autosuggestion with Right Arrow.
bindkey '^[[C' autosuggest-accept
bindkey '^[OC' autosuggest-accept

# Search command history by substring with Up and Down.
bindkey '^[[A' history-substring-search-up
bindkey '^[[B' history-substring-search-down

# Select a non-hidden file with Ctrl+F.
bindkey '^F' _fzf_file_no_hidden

# Toggle inline suggestions with Ctrl+Backslash.
bindkey '^\' autosuggest-toggle
