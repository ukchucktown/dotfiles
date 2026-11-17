require('guess-indent').setup {}

require('which-key').setup {
  delay = 0,
  icons = { mappings = vim.g.have_nerd_font },
  spec = {
    { '<leader>s', group = 'Search', mode = { 'n', 'v' } },
    { '<leader>t', group = 'Toggle' },
    { '<leader>h', group = 'Git hunk', mode = { 'n', 'v' } },
    { 'gr', group = 'LSP actions', mode = 'n' },
  },
}

vim.cmd.colorscheme 'default'

require('todo-comments').setup { signs = false }

require('mini.ai').setup {
  mappings = {
    around_next = 'aa',
    inside_next = 'ii',
  },
  n_lines = 500,
}
require('mini.surround').setup()
require('mini.indentscope').setup {}

local statusline = require 'mini.statusline'
statusline.setup { use_icons = vim.g.have_nerd_font }
statusline.section_location = function() return '%2l:%-2v' end

local function statusline_highlights()
  local light = vim.o.background == 'light'
  local mode_colors = { Normal = 4, Insert = 2, Visual = 5, Replace = 1, Command = 3, Other = 6 }
  for mode, color in pairs(mode_colors) do
    vim.api.nvim_set_hl(0, 'MiniStatuslineMode' .. mode, {
      ctermfg = light and 15 or 0,
      ctermbg = color,
      cterm = { bold = true, nocombine = true },
    })
  end

  local section = { ctermfg = light and 0 or 7, ctermbg = light and 7 or 0, cterm = { nocombine = true } }
  vim.api.nvim_set_hl(0, 'MiniStatuslineDevinfo', section)
  vim.api.nvim_set_hl(0, 'MiniStatuslineFileinfo', section)
  vim.api.nvim_set_hl(0, 'MiniStatuslineFilename', section)
  vim.api.nvim_set_hl(0, 'MiniStatuslineInactive', { ctermfg = 8, ctermbg = section.ctermbg, cterm = { nocombine = true } })
end

-- The default mini.statusline links lack terminal colors for some sections.
local statusline_group = vim.api.nvim_create_augroup('user-statusline-colors', { clear = true })
vim.api.nvim_create_autocmd('ColorScheme', {
  group = statusline_group,
  callback = statusline_highlights,
})
vim.api.nvim_create_autocmd('OptionSet', {
  group = statusline_group,
  pattern = 'background',
  callback = statusline_highlights,
})
statusline_highlights()
