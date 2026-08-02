# Small, self-contained plugin loader based on radleylewis/zsh.
typeset -g ZPLUGINDIR="${ZDOTDIR:-$HOME/.config/zsh}/plugins"

_zplugin_load() {
  local owner="$1"
  local repository="$2"
  local entrypoint="${3:-${2}.plugin.zsh}"
  local plugin_path="$ZPLUGINDIR/$repository"

  if [[ ! -d "$plugin_path/.git" ]]; then
    mkdir -p "$ZPLUGINDIR"
    print -- "Installing Zsh plugin: $repository"
    git clone --depth=1 "https://github.com/$owner/$repository" "$plugin_path" || {
      print -u2 -- "zsh: failed to install plugin $repository"
      return 1
    }
  fi

  if [[ ! -r "$plugin_path/$entrypoint" ]]; then
    print -u2 -- "zsh: plugin entrypoint missing: $plugin_path/$entrypoint"
    return 1
  fi

  source "$plugin_path/$entrypoint"
}

zplugin-update() {
  local plugin_path
  for plugin_path in "$ZPLUGINDIR"/*(/N); do
    print -- "Updating ${plugin_path:t}..."
    git -C "$plugin_path" pull --ff-only
  done
}
