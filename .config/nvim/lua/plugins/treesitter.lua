local treesitter = require 'nvim-treesitter'
local parsers = {
  'bash',
  'c',
  'diff',
  'html',
  'lua',
  'luadoc',
  'markdown',
  'markdown_inline',
  'query',
  'vim',
  'vimdoc',
}

treesitter.install(parsers)

local function attach(bufnr, language)
  if not vim.treesitter.language.add(language) then return end

  vim.treesitter.start(bufnr, language)
  if vim.treesitter.query.get(language, 'indents') then vim.bo[bufnr].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()" end
end

local available = treesitter.get_available()
vim.api.nvim_create_autocmd('FileType', {
  group = vim.api.nvim_create_augroup('user-treesitter', { clear = true }),
  callback = function(event)
    local language = vim.treesitter.language.get_lang(event.match)
    if not language then return end

    local installed = treesitter.get_installed 'parsers'
    if vim.tbl_contains(installed, language) then
      attach(event.buf, language)
    elseif vim.tbl_contains(available, language) then
      treesitter.install(language):await(function() attach(event.buf, language) end)
    else
      attach(event.buf, language)
    end
  end,
})
