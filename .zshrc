# Compatibility entrypoint for tools that explicitly source ~/.zshrc.
# Interactive Zsh sessions use ZDOTDIR and load ~/.config/zsh/.zshrc directly.
if [[ -r "${XDG_CONFIG_HOME:-$HOME/.config}/zsh/.zshrc" ]]; then
  source "${XDG_CONFIG_HOME:-$HOME/.config}/zsh/.zshrc"
fi
