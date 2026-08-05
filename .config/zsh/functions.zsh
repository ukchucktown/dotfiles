# User-facing shell functions.

# Run Git commands against the dotfiles repository from any directory.
dotfiles() {
  git -C "$HOME/dotfiles" "$@"
}

# Select either an available command or an indexed manual topic with fzf.
_man_search() {
  (( $+commands[fzf] )) || {
    print -u2 -- 'man search: fzf is not installed'
    return 127
  }

  local mode="$1"
  local selected reference page section help_output help_status

  case "$mode" in
    -c|--command)
      selected=$(
        print -rl -- ${(ko)commands} |
          fzf --prompt='command man> '
      ) || return

      [[ -n "$selected" ]] || return

      if man -w "$selected" >/dev/null 2>&1; then
        man "$selected"
        return
      fi

      help_output=$(command "$selected" --help 2>&1)
      help_status=$?

      if (( help_status == 0 )) && [[ -n "$help_output" ]]; then
        print -r -- "$help_output" |
          sed -E \
            -e $'s/\e\\[[0-9;]*m//g' \
            -e $'s/^([[:space:]]{0,2}[^[:space:]].*:[[:space:]]*)$/\e[34m\\1\e[0m/' \
            -e $'s/^(([Uu]sage|USAGE):.*)$/\e[34m\\1\e[0m/' \
            -e $'s/^(━+[[:space:]].*[[:alpha:]].*[[:space:]]━+)$/\e[34m\\1\e[0m/' \
            -e $'s#(^|[^[:alnum:]_-])(-{1,2}[[:alpha:]][[:alnum:]_-]*)#\\1\e[33m\\2\e[0m#g' |
          less -R
        return
      fi

      print -u2 -- "No help available for command '$selected'."
      return 1
      ;;

    -t|--topic)
      selected=$(
        man -k . 2>/dev/null |
          fzf --prompt='man topic> '
      ) || return

      [[ -n "$selected" ]] || return

      reference=${selected%%[[:space:]]*}
      reference=${reference%,}
      page=${reference%%\(*}
      section=${reference#*\(}
      section=${section%\)}

      man "$section" "$page"
      ;;

    *)
      print -u2 -- 'usage: _man_search --command|--topic'
      return 2
      ;;
  esac
}
