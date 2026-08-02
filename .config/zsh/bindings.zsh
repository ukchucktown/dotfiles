# Keep the familiar Emacs-style keymap; zsh-vi-mode is intentionally omitted.
bindkey -e

# Accept the current autosuggestion with Right Arrow.
bindkey '^[[C' autosuggest-accept
bindkey '^[OC' autosuggest-accept

# Move by word with Ctrl+Left and Ctrl+Right.
bindkey '^[[1;5C' forward-word
bindkey '^[[1;5D' backward-word

# Search command history by substring with Up and Down.
bindkey '^[[A' history-substring-search-up
bindkey '^[[B' history-substring-search-down

# Select a non-hidden file with Ctrl+F.
bindkey '^F' _fzf_file_no_hidden

# Toggle inline suggestions with Ctrl+Backslash.
bindkey '^\' autosuggest-toggle
