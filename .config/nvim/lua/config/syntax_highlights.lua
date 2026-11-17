local M = {}

local function apply()
  local bright = vim.o.background == 'dark' and 8 or 0
  local colors = {
    Comment = 8,
    Constant = 1 + bright,
    Number = 3 + bright,
    String = 2 + bright,
    Identifier = 6 + bright,
    Function = 4 + bright,
    Statement = 5 + bright,
    Operator = 6 + bright,
    PreProc = 6 + bright,
    Type = 3 + bright,
    Special = 6 + bright,
    Delimiter = 8,
    ['@variable.parameter'] = 3 + bright,
    ['@variable.member'] = 6 + bright,
    ['@function.builtin'] = 6 + bright,
    ['@type.builtin'] = 6 + bright,
    ['@module'] = 6 + bright,
    ['@attribute'] = 5 + bright,
  }
  for name, color in pairs(colors) do
    vim.api.nvim_set_hl(0, name, { ctermfg = color })
  end
  vim.api.nvim_set_hl(0, 'Statement', { ctermfg = colors.Statement, cterm = { bold = true } })
end

function M.setup()
  -- The default theme omits terminal colors for several syntax categories.
  local group = vim.api.nvim_create_augroup('user-syntax-colors', { clear = true })
  vim.api.nvim_create_autocmd('ColorScheme', { group = group, callback = apply })
  vim.api.nvim_create_autocmd('OptionSet', { group = group, pattern = 'background', callback = apply })
  apply()
end

return M
