-- Requires the Lua parser and lua-language-server installed by the Neovim config.
-- Run with: nvim --headless -u NONE -i NONE -l tests/nvim-reference-highlights.lua
local root = vim.fn.fnamemodify(debug.getinfo(1, 'S').source:sub(2), ':p:h:h')
vim.opt.runtimepath:prepend(root .. '/.config/nvim')
local highlights = require 'config.reference_highlights'
local temporary = vim.fn.tempname()
vim.fn.mkdir(temporary, 'p')
local fixture = temporary .. '/symbols.lua'
vim.fn.writefile({
  "local mod = require 'example'",
  "require 'another'",
  'print(mod)',
  'print(mod)',
  'local count = 1',
  'count = count + 1',
  'local function greet() return count end',
  'greet()',
  'do',
  '  local require = function() return count end',
  '  require()',
  'end',
}, fixture)
vim.cmd.edit(fixture)
vim.bo.filetype = 'lua'
vim.treesitter.start(0, 'lua')
local server = vim.fn.stdpath 'data' .. '/mason/bin/lua-language-server'
assert(vim.fn.executable(server) == 1, 'Install lua-language-server before this test')
local id = vim.lsp.start {
  name = 'reference-highlights-test',
  cmd = { server, '--logpath=' .. temporary .. '/log', '--metapath=' .. temporary .. '/meta' },
  root_dir = temporary,
  settings = { Lua = { runtime = { version = 'LuaJIT' }, workspace = { checkThirdParty = false }, telemetry = { enable = false } } },
}
assert(id, 'Language server failed to start')
local ok, err = pcall(function()
  assert(
    vim.wait(10000, function()
      local client = vim.lsp.get_client_by_id(id)
      return client and client.initialized
    end, 25),
    'Language server initialization timed out'
  )
  vim.lsp.semantic_tokens.force_refresh(0)
  assert(vim.wait(10000, function() return #(vim.lsp.semantic_tokens.get_at_pos(0, 0, 12) or {}) > 0 end, 25), 'Semantic tokens unavailable')

  local ns = vim.api.nvim_create_namespace 'nvim.lsp.references'
  local function check(line, column, expected, label)
    vim.lsp.buf.clear_references()
    vim.api.nvim_win_set_cursor(0, { line, column })
    highlights.highlight()
    local present = vim.wait(expected and 3000 or 500, function() return #vim.api.nvim_buf_get_extmarks(0, ns, 0, -1, {}) > 0 end, 10)
    assert(present == expected, label .. (expected and ' lost reference highlights' or ' still receives reference highlights'))
    print('PASS: ' .. label)
  end
  check(1, 12, false, 'Built-in require')
  check(3, 0, false, 'Built-in print')
  check(6, 0, true, 'Project variable')
  check(8, 0, true, 'Project function')
  check(11, 2, true, 'Local function named require')
  check(5, 0, false, 'Language keyword')

  -- A language without semantic tokens still uses syntax classification.
  vim.lsp.semantic_tokens.enable(false, { bufnr = 0 })
  check(1, 12, false, 'Built-in require without semantic tokens')
  check(6, 0, true, 'Project variable without semantic tokens')
end)
local client = vim.lsp.get_client_by_id(id)
if client then client:stop(true) end
if not ok then error(err) end
vim.cmd 'qa!'
