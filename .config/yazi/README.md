# Yazi configuration

This configuration keeps Yazi aligned with the rest of the terminal setup:

- `theme.toml` uses the active Subliminal Nightfall colors from Ghostty and
  leaves the application background transparent.
- `init.lua` disables file and directory icons in Yazi's manager panes.
- `yazi.toml` uses natural, directory-first sorting and a compact size column.
- `keymap.toml` extends the built-in keymap with `g r` for `~/dotfiles`,
  `g w` for `~/Github`, and `e` to edit the hovered file in `$EDITOR`.
- Enter previews Markdown files in the terminal. Press `q` to return to Yazi,
  `e` to edit one in Neovim, or `O`/Shift-Enter to choose between the viewer
  and editor interactively.
- The `y` function in `~/.config/zsh/functions.zsh` launches Yazi and changes
  the shell to Yazi's final directory when it exits. Use `Q` instead of `q` to
  leave the shell directory unchanged.

Yazi already maps `h/j/k/l` and the arrow keys for navigation. Its built-in
`z` and `Z` commands use FZF and zoxide, matching the shell's navigation tools.
Press `F1` or `~` inside Yazi for the complete keymap.

The file-manager core works with the tools in the tracked `Brewfile`. Markdown
preview is an optional integration that additionally requires Node.js,
`mdterm`, and `terminal-browser`; the repository tracks the `md` and
`terminal-viewer` adapters but does not install those three dependencies. Use
`e` to edit Markdown when the preview tools are absent.

Other optional Yazi preview helpers such as FFmpeg, 7-Zip, Poppler, resvg, and
ImageMagick can be installed separately when those file formats are needed.
Camunda artifact actions are intentionally kept in the separately cloned
[`dotfiles-camunda`](https://github.com/ukchucktown/dotfiles-camunda) add-on.
