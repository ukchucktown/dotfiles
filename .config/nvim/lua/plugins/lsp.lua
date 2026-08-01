require('fidget').setup {}
require('mason').setup {}

local servers = {
  lua_ls = {
    on_init = function(client)
      client.server_capabilities.documentFormattingProvider = false

      if client.workspace_folders then
        local path = client.workspace_folders[1].name
        local has_luarc = vim.uv.fs_stat(path .. '/.luarc.json') or vim.uv.fs_stat(path .. '/.luarc.jsonc')
        if path ~= vim.fn.stdpath 'config' and has_luarc then return end
      end

      client.config.settings.Lua = vim.tbl_deep_extend('force', client.config.settings.Lua, {
        runtime = {
          version = 'LuaJIT',
          path = { 'lua/?.lua', 'lua/?/init.lua' },
        },
        workspace = {
          checkThirdParty = false,
          library = vim.tbl_extend('force', vim.api.nvim_get_runtime_file('', true), {
            '${3rd}/luv/library',
            '${3rd}/busted/library',
          }),
        },
      })
    end,
    settings = {
      Lua = {
        format = { enable = false },
      },
    },
  },
}

require('mason-lspconfig').setup {
  ensure_installed = vim.tbl_keys(servers),
  automatic_enable = false,
}
require('mason-tool-installer').setup {
  ensure_installed = {
    'lua-language-server',
    'stylua',
  },
}

local capabilities = require('blink.cmp').get_lsp_capabilities()
for name, config in pairs(servers) do
  config.capabilities = vim.tbl_deep_extend('force', capabilities, config.capabilities or {})
  vim.lsp.config(name, config)
  vim.lsp.enable(name)
end

local lsp_group = vim.api.nvim_create_augroup('user-lsp', { clear = true })
vim.api.nvim_create_autocmd('LspAttach', {
  group = lsp_group,
  callback = function(event)
    local builtin = require 'telescope.builtin'
    local function map(keys, action, desc, mode)
      vim.keymap.set(mode or 'n', keys, action, {
        buffer = event.buf,
        desc = 'LSP: ' .. desc,
      })
    end

    map('grn', vim.lsp.buf.rename, 'Rename')
    map('gra', vim.lsp.buf.code_action, 'Code action', { 'n', 'x' })
    map('grD', vim.lsp.buf.declaration, 'Go to declaration')
    map('grr', builtin.lsp_references, 'Go to references')
    map('gri', builtin.lsp_implementations, 'Go to implementation')
    map('grd', builtin.lsp_definitions, 'Go to definition')
    map('gO', builtin.lsp_document_symbols, 'Document symbols')
    map('gW', builtin.lsp_dynamic_workspace_symbols, 'Workspace symbols')
    map('grt', builtin.lsp_type_definitions, 'Go to type definition')

    local client = vim.lsp.get_client_by_id(event.data.client_id)
    if not client then return end

    if client:supports_method('textDocument/documentHighlight', event.buf) then
      vim.api.nvim_create_autocmd({ 'CursorHold', 'CursorHoldI' }, {
        group = lsp_group,
        buffer = event.buf,
        callback = vim.lsp.buf.document_highlight,
      })
      vim.api.nvim_create_autocmd({ 'CursorMoved', 'CursorMovedI' }, {
        group = lsp_group,
        buffer = event.buf,
        callback = vim.lsp.buf.clear_references,
      })
    end

    if client:supports_method('textDocument/inlayHint', event.buf) then
      map('<leader>th', function()
        local enabled = vim.lsp.inlay_hint.is_enabled { bufnr = event.buf }
        vim.lsp.inlay_hint.enable(not enabled, { bufnr = event.buf })
      end, 'Toggle inlay hints')
    end
  end,
})

vim.api.nvim_create_autocmd('LspDetach', {
  group = lsp_group,
  callback = function(event)
    vim.lsp.buf.clear_references()
    vim.api.nvim_clear_autocmds { group = lsp_group, buffer = event.buf }
  end,
})
