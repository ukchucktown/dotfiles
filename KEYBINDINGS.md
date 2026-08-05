# Zsh Keybinding Cheat Sheet

This is a snapshot of the active `main` ZLE keymap produced by a fresh
interactive Zsh on August 3, 2026:

```sh
bindkey -M main
```

The configuration selects Emacs mode with `bindkey -e`, so `main` currently
points to the `emacs` keymap. Plugin updates or configuration changes can alter
this output.

## How to read the sequences

- `^A` means the single control byte produced by `Ctrl+A`, not the two printed
  characters `^` and `A`.
- `^[` means Escape (`ESC`, byte `0x1b`). Ghostty has
  `macos-option-as-alt=true`, so `^[f` can be entered as `Option+F`. The
  portable equivalent is `Esc`, release it, then press `F`.
- `^[[` is `ESC [` and begins a CSI terminal sequence. Arrow keys and other
  terminal features usually send these sequences for you.
- `^[O` begins an SS3 sequence. The arrow-key bindings using it are alternate
  forms sent while the terminal is in application-cursor mode.
- `\xNN` shows the underlying byte in hexadecimal. Sequences containing
  several bytes show one `\xNN` for each byte.
- A comma in the **Press** column means press the keys in sequence. A plus sign
  means hold them together.
- Rows containing several bindings are aliases for the same widget.

## Direct control keys

| `bindkey` sequence | Bytes | Press | ZLE widget | What it does |
|---|---|---|---|---|
| `^@` | `\x00` | `Ctrl+Space` | `set-mark-command` | Set the mark at the cursor so text between the mark and cursor can be treated as a region. |
| `^A` | `\x01` | `Ctrl+A` | `beginning-of-line` | Move to the beginning of the current input line. |
| `^B` | `\x02` | `Ctrl+B` | `backward-char` | Move left one character. |
| `^D` | `\x04` | `Ctrl+D` | `delete-char-or-list` | Delete the character under the cursor; at the end of the line, list possible completions. |
| `^E` | `\x05` | `Ctrl+E` | `end-of-line` | Move to the end of the current input line. |
| `^F` | `\x06` | `Ctrl+F` | `forward-char` | Move right one character. |
| `^G` | `\x07` | `Ctrl+G` | `send-break` | Abort the current ZLE operation and return to normal command-line editing. |
| `^H` | `\x08` | `Ctrl+H` | `backward-delete-char` | Delete the character before the cursor. This is the historical Backspace control code. |
| `^I` | `\x09` | `Tab` or `Ctrl+I` | `fzf-tab-complete` | Open fzf-tab completion for the current word. |
| `^J`, `^M` | `\x0a`, `\x0d` | `Ctrl+J`, `Return` | `accept-line` | Submit and execute the current command line. |
| `^K` | `\x0b` | `Ctrl+K` | `kill-line` | Cut from the cursor to the end of the line into the kill ring. |
| `^L` | `\x0c` | `Ctrl+L` | `clear-screen` | Clear and redraw the terminal while preserving the current input. |
| `^N` | `\x0e` | `Ctrl+N` | `down-line-or-history` | Move down a display line, or move to the next history entry. |
| `^O` | `\x0f` | `Ctrl+O` | `accept-line-and-down-history` | Execute the current line, then load the following history entry. |
| `^P` | `\x10` | `Ctrl+P` | `up-line-or-history` | Move up a display line, or move to the previous history entry. |
| `^Q` | `\x11` | `Ctrl+Q` | `push-line` | Save and clear the current buffer; restore it the next time ZLE starts. |
| `^R` | `\x12` | `Ctrl+R` | `fzf-history-widget` | Open fuzzy command-history search and insert the selected entry. |
| `^S` | `\x13` | `Ctrl+S` | `history-incremental-search-forward` | Search forward through history as you type. Terminal flow control can intercept this if `stty ixon` is enabled. |
| `^T` | `\x14` | `Ctrl+T` | `fzf-file-widget` | Open fzf's file picker and insert the selected path. Your fzf command includes hidden files. |
| `^U` | `\x15` | `Ctrl+U` | `kill-whole-line` | Cut the entire command buffer into the kill ring. |
| `^V` | `\x16` | `Ctrl+V` | `quoted-insert` | Insert the next key literally instead of executing its binding. |
| `^W` | `\x17` | `Ctrl+W` | `backward-kill-word` | Cut the word before the cursor into the kill ring. |
| `^Y` | `\x19` | `Ctrl+Y` | `yank` | Paste the most recently killed text. |
| `^\\` | `\x1c` | `Ctrl+Backslash` | `autosuggest-toggle` | Toggle inline zsh-autosuggestions on or off. |
| `^_` | `\x1f` | `Ctrl+_` (usually `Ctrl+Shift+-`) | `undo` | Undo the most recent edit to the command buffer. |
| `^?` | `\x7f` | `Backspace` | `backward-delete-char` | Delete the character before the cursor. This is the DEL form normally sent by Backspace. |

## Ctrl+X prefix bindings

These are two-step chords. For example, `^X^E` means `Ctrl+X`, followed by
`Ctrl+E`.

| `bindkey` sequence | Bytes | Press | ZLE widget | What it does |
|---|---|---|---|---|
| `^X^B` | `\x18\x02` | `Ctrl+X`, `Ctrl+B` | `vi-match-bracket` | Move to the bracket matching the one under the cursor. |
| `^X^E` | `\x18\x05` | `Ctrl+X`, `Ctrl+E` | `edit-command-line` | Open the complete command buffer in `$VISUAL` or `$EDITOR`, then return the edited text to ZLE. |
| `^X^F` | `\x18\x06` | `Ctrl+X`, `Ctrl+F` | `vi-find-next-char` | Read one more character and move to its next occurrence on the line. |
| `^X^J` | `\x18\x0a` | `Ctrl+X`, `Ctrl+J` | `vi-join` | Join the current line with the next line in multiline input. |
| `^X^K` | `\x18\x0b` | `Ctrl+X`, `Ctrl+K` | `kill-buffer` | Cut and clear the complete command buffer. |
| `^X^N` | `\x18\x0e` | `Ctrl+X`, `Ctrl+N` | `infer-next-history` | Find a history line matching the current line and load the entry that followed it. |
| `^X^O` | `\x18\x0f` | `Ctrl+X`, `Ctrl+O` | `overwrite-mode` | Toggle between inserting characters and overwriting characters under the cursor. |
| `^X^U`, `^Xu` | `\x18\x15`, `\x18\x75` | `Ctrl+X`, `Ctrl+U`; or `Ctrl+X`, `U` | `undo` | Undo the most recent edit. |
| `^X^V` | `\x18\x16` | `Ctrl+X`, `Ctrl+V` | `vi-cmd-mode` | Switch temporarily to the `vicmd` keymap. |
| `^X^X` | `\x18\x18` | `Ctrl+X`, `Ctrl+X` | `exchange-point-and-mark` | Swap the cursor and mark positions and activate the region between them. |
| `^X*` | `\x18\x2a` | `Ctrl+X`, `*` | `expand-word` | Replace the current word with the result of shell expansion. |
| `^X.` | `\x18\x2e` | `Ctrl+X`, `.` | `fzf-tab-debug` | Run one fzf-tab completion with tracing and leave its diagnostic log in a temporary file. |
| `^X=` | `\x18\x3d` | `Ctrl+X`, `=` | `what-cursor-position` | Show the cursor position and the character/byte under it. |
| `^XG`, `^Xg` | `\x18\x47`, `\x18\x67` | `Ctrl+X`, `Shift+G`; or `Ctrl+X`, `G` | `list-expand` | List how the current word would expand without replacing it. |
| `^Xr` | `\x18\x72` | `Ctrl+X`, `R` | `history-incremental-search-backward` | Search backward through history as you type. |
| `^Xs` | `\x18\x73` | `Ctrl+X`, `S` | `history-incremental-search-forward` | Search forward through history as you type. |

## Option/Meta bindings

The **Press** column uses Ghostty's Option-as-Alt behavior. You can always use
`Esc`, followed by the indicated key, if an Option chord is intercepted by
macOS or another application.

| `bindkey` sequence | Bytes | Press in Ghostty | ZLE widget | What it does |
|---|---|---|---|---|
| `^[^D` | `\x1b\x04` | `Option+Ctrl+D` | `list-choices` | List possible completions for the current word. |
| `^[^G` | `\x1b\x07` | `Option+Ctrl+G` | `send-break` | Abort the current ZLE operation. |
| `^[^H`, `^[^?` | `\x1b\x08`, `\x1b\x7f` | `Option+Ctrl+H`; or `Option+Backspace` | `backward-kill-word` | Cut the word before the cursor. |
| `^[^I`, `^[^J`, `^[^M` | `\x1b\x09`, `\x1b\x0a`, `\x1b\x0d` | `Esc`, then `Ctrl+I`, `Ctrl+J`, or `Ctrl+M` | `self-insert-unmeta` | Strip the Meta prefix and insert the underlying control character literally; `Ctrl+M` is converted to `Ctrl+J`. |
| `^[^L` | `\x1b\x0c` | `Option+Ctrl+L` | `clear-screen` | Clear and redraw the terminal while preserving the current input. |
| `^[^_` | `\x1b\x1f` | `Esc`, then `Ctrl+_` | `copy-prev-word` | Duplicate the word immediately to the left of the cursor. |
| `^[ `, `^[!` | `\x1b\x20`, `\x1b\x21` | `Option+Space`; or `Option+Shift+1` | `expand-history` | Expand history references such as `!!` in the current buffer. |
| `^[\"` | `\x1b\x22` | `Option+Shift+'` | `quote-region` | Shell-quote the text between the mark and cursor. |
| `^[\$`, `^[S`, `^[s` | `\x1b\x24`, `\x1b\x53`, `\x1b\x73` | `Option+Shift+4`; `Option+Shift+S`; or `Option+S` | `spell-word` | Check and offer a correction for the word under the cursor. |
| `^['` | `\x1b\x27` | `Option+'` | `quote-line` | Shell-quote the complete command line. |
| `^[-` | `\x1b\x2d` | `Option+-` | `neg-argument` | Negate the numeric argument used by the next widget. |
| `^[.`, `^[_` | `\x1b\x2e`, `\x1b\x5f` | `Option+.`; or `Option+Shift+-` | `insert-last-word` | Insert the final word from the previous history entry; repeat to walk backward through history. |
| `^[0` through `^[9` | `\x1b\x30` through `\x1b\x39` | `Option+0` through `Option+9` | `digit-argument` | Build a numeric argument for the next widget, such as a repeat count. |
| `^[<` | `\x1b\x3c` | `Option+Shift+,` | `beginning-of-buffer-or-history` | Move to the start of a multiline buffer, or to the oldest history entry. |
| `^[>` | `\x1b\x3e` | `Option+Shift+.` | `end-of-buffer-or-history` | Move to the end of a multiline buffer, or to the newest history entry. |
| `^[?` | `\x1b\x3f` | `Option+Shift+/` | `which-command` | Run `which-command`/`whence` for the command currently in the buffer, then restore the buffer. |
| `^[A`, `^[a` | `\x1b\x41`, `\x1b\x61` | `Option+Shift+A`; or `Option+A` | `accept-and-hold` | Execute the buffer and keep a copy ready for the next prompt. |
| `^[B`, `^[b` | `\x1b\x42`, `\x1b\x62` | `Option+Shift+B`; or `Option+B` | `backward-word` | Move backward one word. |
| `^[C` | `\x1b\x43` | `Option+Shift+C` | `capitalize-word` | Capitalize the current or following word. |
| `^[D`, `^[d` | `\x1b\x44`, `\x1b\x64` | `Option+Shift+D`; or `Option+D` | `kill-word` | Cut from the cursor through the end of the current or next word. |
| `^[F`, `^[f` | `\x1b\x46`, `\x1b\x66` | `Option+Shift+F`; or `Option+F` | `forward-word` | Move forward one word. |
| `^[G`, `^[g` | `\x1b\x47`, `\x1b\x67` | `Option+Shift+G`; or `Option+G` | `get-line` | Pop a previously saved line from ZLE's buffer stack. |
| `^[H`, `^[h` | `\x1b\x48`, `\x1b\x68` | `Option+Shift+H`; or `Option+H` | `run-help` | Show contextual help/man-page information for the command under the cursor. |
| `^[L`, `^[l` | `\x1b\x4c`, `\x1b\x6c` | `Option+Shift+L`; or `Option+L` | `down-case-word` | Convert the current or following word to lowercase. |
| `^[N`, `^[n` | `\x1b\x4e`, `\x1b\x6e` | `Option+Shift+N`; or `Option+N` | `history-search-forward` | Search forward for a history entry beginning with the text before the cursor. |
| `^[P`, `^[p` | `\x1b\x50`, `\x1b\x70` | `Option+Shift+P`; or `Option+P` | `history-search-backward` | Search backward for a history entry beginning with the text before the cursor. |
| `^[Q`, `^[q` | `\x1b\x51`, `\x1b\x71` | `Option+Shift+Q`; or `Option+Q` | `push-line` | Save and clear the current buffer, restoring it the next time ZLE starts. |
| `^[T`, `^[t` | `\x1b\x54`, `\x1b\x74` | `Option+Shift+T`; or `Option+T` | `transpose-words` | Swap the current word with the preceding word. |
| `^[U`, `^[u` | `\x1b\x55`, `\x1b\x75` | `Option+Shift+U`; or `Option+U` | `up-case-word` | Convert the current or following word to uppercase. |
| `^[W`, `^[w` | `\x1b\x57`, `\x1b\x77` | `Option+Shift+W`; or `Option+W` | `copy-region-as-kill` | Copy, without deleting, the text between the mark and cursor into the kill ring. |
| `^[c` | `\x1b\x63` | `Option+C` | `fzf-cd-widget` | Fuzzy-select a directory and immediately change the shell to that directory. |
| `^[x` | `\x1b\x78` | `Option+X` | `execute-named-cmd` | Prompt for the name of any ZLE widget and execute it. |
| `^[y` | `\x1b\x79` | `Option+Y` | `yank-pop` | After a yank, replace it with the previous entry in the kill ring. |
| `^[z` | `\x1b\x7a` | `Option+Z` | `execute-last-named-cmd` | Repeat the last widget invoked with `execute-named-cmd`. |
| <code>^[&#124;</code> | `\x1b\x7c` | `Option+Shift+Backslash` | `vi-goto-column` | Move to the column given by the current numeric argument. |

## Terminal-generated sequences

These bindings are generally produced by Ghostty or a terminal mode. Do not
type their bytes one at a time unless you are deliberately testing a sequence.

| `bindkey` sequence | Bytes | Actual action | ZLE widget | What it does |
|---|---|---|---|---|
| `^[OA` | `\x1bOA` | `Up Arrow` in application-cursor mode | `up-line-or-history` | Move up a display line or to the previous history entry. |
| `^[OB` | `\x1bOB` | `Down Arrow` in application-cursor mode | `down-line-or-history` | Move down a display line or to the next history entry. |
| `^[OC` | `\x1bOC` | `Right Arrow` in application-cursor mode | `forward-char` | Move right one character. |
| `^[OD` | `\x1bOD` | `Left Arrow` in application-cursor mode | `backward-char` | Move left one character. |
| `^[[200~` | `\x1b[200~` | Paste text, usually with `Cmd+V` | `bracketed-paste` | Insert pasted text as one protected paste operation instead of interpreting it as keystrokes. |
| `^[[201~` | `\x1b[201~` | `Cmd+Shift+=` | `ghostty_opacity_up` | Increase Ghostty background opacity by `0.05` and display the new value. |
| `^[[202~` | `\x1b[202~` | `Cmd+Shift+-` | `ghostty_opacity_down` | Decrease Ghostty background opacity by `0.05` and display the new value. |
| `^[[A` | `\x1b[A` | `Up Arrow` | `history-substring-search-up` | Search backward for a history entry containing the current text. |
| `^[[B` | `\x1b[B` | `Down Arrow` | `history-substring-search-down` | Search forward for a history entry containing the current text. |
| `^[[C` | `\x1b[C` | `Right Arrow` | `forward-char` | Move right one character. |
| `^[[D` | `\x1b[D` | `Left Arrow` | `backward-char` | Move left one character. |

## Character ranges

| `bindkey` sequence | Bytes | Press | ZLE widget | What it does |
|---|---|---|---|---|
| `" "-"~"` | `\x20` through `\x7e` | Any ordinary printable ASCII key | `self-insert` | Insert the typed character into the command buffer. |
| `"\M-^@"-"\M-^?"` | `\x80` through `\xff` | A terminal/input method emitting a high-bit byte | `self-insert` | Insert the byte literally. Modern UTF-8 text normally arrives as multibyte input handled by Zsh rather than as a hand-typed Meta chord. |

## Complete raw `bindkey -M main` snapshot

This appendix preserves the exact output used to build the tables above.

```text
"^@" set-mark-command
"^A" beginning-of-line
"^B" backward-char
"^D" delete-char-or-list
"^E" end-of-line
"^F" forward-char
"^G" send-break
"^H" backward-delete-char
"^I" fzf-tab-complete
"^J" accept-line
"^K" kill-line
"^L" clear-screen
"^M" accept-line
"^N" down-line-or-history
"^O" accept-line-and-down-history
"^P" up-line-or-history
"^Q" push-line
"^R" fzf-history-widget
"^S" history-incremental-search-forward
"^T" fzf-file-widget
"^U" kill-whole-line
"^V" quoted-insert
"^W" backward-kill-word
"^X^B" vi-match-bracket
"^X^E" edit-command-line
"^X^F" vi-find-next-char
"^X^J" vi-join
"^X^K" kill-buffer
"^X^N" infer-next-history
"^X^O" overwrite-mode
"^X^U" undo
"^X^V" vi-cmd-mode
"^X^X" exchange-point-and-mark
"^X*" expand-word
"^X." fzf-tab-debug
"^X=" what-cursor-position
"^XG" list-expand
"^Xg" list-expand
"^Xr" history-incremental-search-backward
"^Xs" history-incremental-search-forward
"^Xu" undo
"^Y" yank
"^[^D" list-choices
"^[^G" send-break
"^[^H" backward-kill-word
"^[^I" self-insert-unmeta
"^[^J" self-insert-unmeta
"^[^L" clear-screen
"^[^M" self-insert-unmeta
"^[^_" copy-prev-word
"^[ " expand-history
"^[!" expand-history
"^[\"" quote-region
"^[\$" spell-word
"^['" quote-line
"^[-" neg-argument
"^[." insert-last-word
"^[0" digit-argument
"^[1" digit-argument
"^[2" digit-argument
"^[3" digit-argument
"^[4" digit-argument
"^[5" digit-argument
"^[6" digit-argument
"^[7" digit-argument
"^[8" digit-argument
"^[9" digit-argument
"^[<" beginning-of-buffer-or-history
"^[>" end-of-buffer-or-history
"^[?" which-command
"^[A" accept-and-hold
"^[B" backward-word
"^[C" capitalize-word
"^[D" kill-word
"^[F" forward-word
"^[G" get-line
"^[H" run-help
"^[L" down-case-word
"^[N" history-search-forward
"^[OA" up-line-or-history
"^[OB" down-line-or-history
"^[OC" forward-char
"^[OD" backward-char
"^[P" history-search-backward
"^[Q" push-line
"^[S" spell-word
"^[T" transpose-words
"^[U" up-case-word
"^[W" copy-region-as-kill
"^[[200~" bracketed-paste
"^[[201~" ghostty_opacity_up
"^[[202~" ghostty_opacity_down
"^[[A" history-substring-search-up
"^[[B" history-substring-search-down
"^[[C" forward-char
"^[[D" backward-char
"^[_" insert-last-word
"^[a" accept-and-hold
"^[b" backward-word
"^[c" fzf-cd-widget
"^[d" kill-word
"^[f" forward-word
"^[g" get-line
"^[h" run-help
"^[l" down-case-word
"^[n" history-search-forward
"^[p" history-search-backward
"^[q" push-line
"^[s" spell-word
"^[t" transpose-words
"^[u" up-case-word
"^[w" copy-region-as-kill
"^[x" execute-named-cmd
"^[y" yank-pop
"^[z" execute-last-named-cmd
"^[|" vi-goto-column
"^[^?" backward-kill-word
"^\\\\" autosuggest-toggle
"^_" undo
" "-"~" self-insert
"^?" backward-delete-char
"\M-^@"-"\M-^?" self-insert
```

## Refreshing this sheet

To inspect the current active keymap at any time:

```sh
bindkey -M main
```

To identify an unknown key sequence, start a raw reader, press the key, and
then press `Ctrl+D`:

```sh
od -An -tx1
```

For ZLE's authoritative widget descriptions, run:

```sh
man zshzle
```
