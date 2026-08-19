# User-facing shell functions.

# Run Git commands against the dotfiles repository from any directory.
dotfiles() {
  git -C "$HOME/dotfiles" "$@"
}

# Launch Yazi and follow its final directory when it exits. Pressing `Q` in
# Yazi skips the directory change; the usual `q` applies it.
y() {
  if (( ! $+commands[yazi] )); then
    print -u2 -- 'y: yazi is not installed'
    return 127
  fi

  local cwd tmp yazi_status
  tmp="$(mktemp -t yazi-cwd.XXXXXX)" || return

  command yazi "$@" --cwd-file="$tmp"
  yazi_status=$?

  if [[ -r "$tmp" ]]; then
    IFS= read -r -d '' cwd < "$tmp"
  fi
  command rm -f -- "$tmp"

  if [[ -n "$cwd" && "$cwd" != "$PWD" && -d "$cwd" ]]; then
    builtin cd -- "$cwd"
  fi

  return "$yazi_status"
}

if (( $+functions[compdef] )); then
  if [[ -n "${_comps[yazi]:-}" ]]; then
    compdef "${_comps[yazi]}" y
  else
    compdef _files y
  fi
fi

# Capture help without allowing commands such as Git to launch their own pager.
_man_help_capture() {
  local executable="${1:t}"
  local -i help_status

  PAGER=cat MANPAGER=cat GIT_PAGER=cat command "$@" --help 2>&1
  help_status=$?

  # npm prints valid top-level help but exits 1 when no command was supplied.
  [[ "$executable" == npm && $# == 1 && $help_status == 1 ]] && return 0
  return "$help_status"
}

_man_help_colorize() {
  sed -E \
    -e $'s/\e\\[[0-9;]*m//g' \
    -e $'s/^([[:space:]]{0,2}[^[:space:]].*:[[:space:]]*)$/\e[34m\\1\e[0m/' \
    -e $'s/^(([Uu]sage|USAGE):.*)$/\e[34m\\1\e[0m/' \
    -e $'s/^(━+[[:space:]].*[[:alpha:]].*[[:space:]]━+)$/\e[34m\\1\e[0m/' \
    -e $'s#(^|[^[:alnum:]_-])(-{1,2}[[:alpha:]][[:alnum:]_-]*)#\\1\e[33m\\2\e[0m#g'
}

# Extract browsable children from the current help page. Most tools use a
# Cobra-style command table; npm uses a comma-separated top-level list and
# Usage lines for nested commands, while c8ctl also exposes resource tables.
_man_help_subcommands() {
  local executable="${1:t}"
  local -i include_resources=0
  shift

  if [[ "$executable" == npm ]]; then
    LC_ALL=C awk -v path_depth="$#" '
      /^All commands:$/ {
        in_all_commands = 1
        next
      }

      in_all_commands {
        line = $0
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)

        if (line == "") {
          if (saw_all_command) {
            in_all_commands = 0
          }
          next
        }

        count = split(line, commands, /,[[:space:]]*/)
        for (i = 1; i <= count; i++) {
          name = commands[i]
          gsub(/^[[:space:]]+|[[:space:]]+$/, "", name)
          if (name ~ /^[[:alnum:]][[:alnum:]_-]*$/ && !seen[name]++) {
            printf "%s\t%s\n", name, "npm " name " --help"
            saw_all_command = 1
          }
        }
        next
      }

      /^Usage:$/ {
        in_usage = 1
        next
      }

      in_usage && /^npm[[:space:]]/ {
        usage_count++
        usage[usage_count] = $0
        next
      }

      in_usage && usage_count && !/^npm[[:space:]]/ {
        in_usage = 0
      }

      END {
        if (saw_all_command) {
          exit
        }

        child_field = path_depth + 2
        for (i = 1; i <= usage_count; i++) {
          field_count = split(usage[i], fields, /[[:space:]]+/)
          if (field_count < child_field) {
            continue
          }

          name = fields[child_field]
          if (name !~ /^[[:alnum:]][[:alnum:]_-]*$/ || seen[name]++) {
            continue
          }

          description = usage[i]
          sub(/^npm[[:space:]]+/, "", description)
          printf "%s\t%s\n", name, description
        }
      }
    '
    return
  fi

  [[ "$executable" == c8ctl ]] && include_resources=1
  LC_ALL=C awk -v include_resources="$include_resources" '
    /^(Commands|Subcommands|[^[:space:]].*[[:space:]]Commands([[:space:]]+\([^)]*\))?):$/ {
      in_commands = 1
      in_resources = 0
      next
    }

    include_resources && /^(Resources|Resources and their available flags):$/ {
      in_commands = 0
      in_resources = 1
      next
    }

    (in_commands || in_resources) && /^  [[:alnum:]][[:alnum:]_-]*([[:space:]]|$)/ {
      line = $0
      sub(/^[[:space:]]+/, "", line)
      name = line
      sub(/[[:space:]].*$/, "", name)
      description = line
      sub(/^[^[:space:]]+[[:space:]]*/, "", description)

      if (!seen[name]++) {
        printf "%s\t%s\n", name, description
      }
      next
    }

    (in_commands || in_resources) && /^[^[:space:]]/ {
      in_commands = 0
      in_resources = 0
    }
  '
}

# Render the help page associated with an fzf browser row. The first argument
# is ".", "..", or a child command; the remaining arguments are the current
# command path.
_man_help_preview() {
  local action="$1" executable="$2"
  shift 2

  local -a command_path=("$@")
  case "$action" in
    .) ;;
    ..) (( ${#command_path} )) && command_path[-1]=() ;;
    *) command_path+=("$action") ;;
  esac

  _man_help_capture "$executable" "${command_path[@]}" | _man_help_colorize
}

# Browse a command's help tree without leaving the terminal. Each level shows
# its children in fzf and previews the focused child's complete help page.
_man_help_browser() {
  local executable="$1"
  shift

  local -a command_path=("$@")
  local -a browser_bindings
  local help_output parent_help_output help_status subcommands candidates formatted_candidates selected
  local action path_part candidate_line candidate_name candidate_description formatted_line
  local invocation functions_file preview_script preview_command zsh_command wrap_sign
  local -i candidate_name_width

  functions_file="${ZDOTDIR:-$HOME/.config/zsh}/functions.zsh"
  preview_script='source "$1"; shift; _man_help_preview "$@"'
  zsh_command="${commands[zsh]:-zsh}"

  while true; do
    help_output=$(_man_help_capture "$executable" "${command_path[@]}")
    help_status=$?
    if (( help_status != 0 )) || [[ -z "$help_output" ]]; then
      invocation="${(j: :)${:-$executable $command_path}}"
      print -u2 -- "No help available for command '$invocation'."
      return 1
    fi

    if [[ "${executable:t}" != npm && -n "$parent_help_output" && "$help_output" == "$parent_help_output" ]]; then
      subcommands=''
    else
      subcommands=$(print -r -- "$help_output" | _man_help_subcommands "$executable" "${command_path[@]}")
    fi
    invocation="${(j: :)${:-$executable $command_path}}"

    candidates=$'.\tOpen current help in pager'
    browser_bindings=(
      --bind='ctrl-w:toggle-wrap-word'
      --bind='tab:transform:[[ "$FZF_PROMPT" == "Commands > " ]] && printf "change-prompt(Help > )+disable-search" || printf "change-prompt(Commands > )+enable-search"'
      --bind='up:transform:[[ "$FZF_PROMPT" == "Help > " ]] && printf preview-up || printf up'
      --bind='down:transform:[[ "$FZF_PROMPT" == "Help > " ]] && printf preview-down || printf down'
      --bind='pgup:transform:[[ "$FZF_PROMPT" == "Help > " ]] && printf preview-page-up || printf page-up'
      --bind='pgdn:transform:[[ "$FZF_PROMPT" == "Help > " ]] && printf preview-page-down || printf page-down'
      --bind='home:transform:[[ "$FZF_PROMPT" == "Help > " ]] && printf preview-top || printf first'
      --bind='end:transform:[[ "$FZF_PROMPT" == "Help > " ]] && printf preview-bottom || printf last'
    )
    if (( ${#command_path} )); then
      candidates+=$'\n..\tGo to parent command'
      browser_bindings+=(--bind='left:clear-query+pos(2)+accept')
    fi
    if [[ -n "$subcommands" ]]; then
      candidates+=$'\n'"$subcommands"
    fi

    candidate_name_width=0
    for candidate_line in "${(@f)candidates}"; do
      candidate_name=${candidate_line%%$'\t'*}
      (( ${#candidate_name} > candidate_name_width )) &&
        candidate_name_width=${#candidate_name}
    done

    formatted_candidates=''
    for candidate_line in "${(@f)candidates}"; do
      candidate_name=${candidate_line%%$'\t'*}
      candidate_description=${candidate_line#*$'\t'}
      printf -v formatted_line '%s\t%-*s  %s' \
        "$candidate_name" \
        "$candidate_name_width" \
        "$candidate_name" \
        "$candidate_description"
      [[ -n "$formatted_candidates" ]] && formatted_candidates+=$'\n'
      formatted_candidates+="$formatted_line"
    done
    printf -v wrap_sign '%*s  ' "$candidate_name_width" ''

    preview_command="${(q)zsh_command} -fc ${(q)preview_script} cman-preview ${(q)functions_file} {1} ${(q)executable}"
    for path_part in "${command_path[@]}"; do
      preview_command+=" ${(q)path_part}"
    done

    selected=$(
      print -r -- "$formatted_candidates" |
        fzf \
          --ansi \
          --no-multi \
          --delimiter=$'\t' \
          --with-nth=2 \
          --wrap=word \
          --wrap-sign="$wrap_sign" \
          --prompt='Commands > ' \
          --header="$invocation  •  Tab: switch pane  •  Enter: descend/open  •  Left/..: parent  •  Ctrl-W: wrap  •  Esc: quit" \
          --preview="$preview_command" \
          --preview-window='right:50%:wrap:border-left' \
          --preview-wrap-sign='↳ ' \
          "${browser_bindings[@]}"
    ) || return

    action=${selected%%$'\t'*}
    case "$action" in
      .)
        print -r -- "$help_output" | _man_help_colorize | less -R
        ;;
      ..)
        (( ${#command_path} )) && command_path[-1]=()
        parent_help_output=''
        ;;
      *)
        parent_help_output="$help_output"
        command_path+=("$action")
        ;;
    esac
  done
}

# Select an available command or manual topic with fzf. Command arguments can
# also be supplied directly to start at a nested point in its help tree.
_man_search() {
  local mode="$1"
  shift

  local selected reference page section help_output help_status invocation subcommands
  local -a command_args

  case "$mode" in
    -c|--command)
      if (( $# )); then
        selected="$1"
        shift
        command_args=("$@")
      else
        (( $+commands[fzf] )) || {
          print -u2 -- 'man search: fzf is not installed'
          return 127
        }

        selected=$(
          print -rl -- ${(ko)commands} |
            fzf --prompt='command man> '
        ) || return
      fi

      [[ -n "$selected" ]] || return
      invocation="$selected"
      (( ${#command_args} )) && invocation+=" ${(j: :)command_args}"

      help_output=$(_man_help_capture "$selected" "${command_args[@]}")
      help_status=$?
      if (( help_status == 0 )) && [[ -n "$help_output" ]]; then
        subcommands=$(print -r -- "$help_output" | _man_help_subcommands "$selected" "${command_args[@]}")
        if [[ -n "$subcommands" ]] && (( $+commands[fzf] )); then
          _man_help_browser "$selected" "${command_args[@]}"
          return
        fi
      fi

      if (( ! ${#command_args} )) && man -w "$selected" >/dev/null 2>&1; then
        man "$selected"
        return
      fi

      if (( help_status == 0 )) && [[ -n "$help_output" ]]; then
        print -r -- "$help_output" | _man_help_colorize | less -R
        return
      fi

      print -u2 -- "No help available for command '$invocation'."
      return 1
      ;;

    -t|--topic)
      (( $+commands[fzf] )) || {
        print -u2 -- 'man search: fzf is not installed'
        return 127
      }

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
      print -u2 -- 'usage: _man_search --command [command [subcommand ...]]|--topic'
      return 2
      ;;
  esac
}
