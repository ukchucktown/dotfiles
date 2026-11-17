# Neovim configuration

A small personal Neovim configuration using the native package manager introduced in
Neovim 0.12. It keeps the useful baseline from Kickstart.nvim without retaining the
Kickstart tutorial, repository, or optional examples.

## Requirements

- Neovim 0.12 or newer
- Git
- `rg` for Telescope live grep
- `make` for the Telescope FZF extension and LuaSnip's optional regex support

Mason installs `lua-language-server` and `stylua`.

## Layout

```text
init.lua
lua/
  config/
    autocmds.lua
    keymaps.lua
    options.lua
    reference_highlights.lua
    syntax_highlights.lua
  plugins/
    completion.lua
    editor.lua
    formatting.lua
    init.lua
    lsp.lua
    telescope.lua
    treesitter.lua
    ui.lua
```

`lua/plugins/init.lua` is the plugin inventory. The other plugin modules contain only
configuration for their named concern.

## Colors

Neovim uses its default colorscheme with true-color output disabled. Text and
syntax highlights use the active terminal palette, so Rex and Ghostty control
the colors. The editor uses the terminal foreground and background colors.
The status line has a continuous background from the terminal palette, with
colored mode and location labels. Explicit syntax colors distinguish comments,
constants, numbers, strings, types, parameters, and fields. Category assignments
stay consistent across terminal themes.

## Reference highlights

After a pause on a symbol, Neovim highlights its references. The filter skips
language keywords and built-in functions such as `require` and `print`.
Semantic tokens preserve local symbols that share built-in names. If semantic
tokens are unavailable, the filter uses Tree-sitter syntax captures.

## Plugin management

Inspect pending changes without network access:

```vim
:lua vim.pack.update(nil, { offline = true })
```

Update all plugins:

```vim
:lua vim.pack.update()
```

The generated `nvim-pack-lock.json` is tracked so every machine can resolve the same
plugin revisions.

## Main mappings

- `<leader>sf` — find files
- `<leader>sg` — live grep
- `<leader><leader>` — buffers
- `<leader>f` — format
- `<leader>q` — diagnostics
- `<C-h/j/k/l>` — move between windows
- `gr*` — LSP navigation and actions
- `]c` / `[c` — next/previous Git hunk

The leader key is Space.
