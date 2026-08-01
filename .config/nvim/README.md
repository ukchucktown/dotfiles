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
