# Better directory listings
if command -v eza >/dev/null 2>&1; then
  alias ls='eza'
  alias ll='eza -lh --git --no-user --no-time'
  alias la='eza -lah --git --no-user --no-time'
  alias tree="eza -a --tree --level=3 --ignore-glob='.git|.DS_Store'"
  alias dtree="eza -a --tree --level=3 --ignore-glob='.git|.DS_Store' -D"
  (( $+functions[compdef] )) && compdef eza=ls
fi

# Better core utilities
if command -v bat >/dev/null 2>&1; then
  alias cat='bat'
fi
if command -v rg >/dev/null 2>&1; then
  alias grep='rg --color=auto'
fi
alias diff='diff --color=auto'
alias df='df -h'

# Navigation
alias -- -='cd -'

# Manual pages
alias cman='_man_search --command'
alias tman='_man_search --topic'

# Editor
if command -v nvim >/dev/null 2>&1; then
  alias vim='nvim'
fi

# Git
alias glog='PAGER="less -F -X" git log'
alias gadog='PAGER="less -F -X" git log --all --decorate --oneline --graph'

# Kubernetes
alias k='kubectl'

# Local tools
alias gemini='NODE_OPTIONS="--no-deprecation" gemini'

# Render Markdown through the GitHub-style preview inside Ghostty. Zsh suffix
# aliases make a Markdown filename usable directly as a command.
if command -v md >/dev/null 2>&1; then
  alias -s md=md
  alias -s markdown=md
fi
