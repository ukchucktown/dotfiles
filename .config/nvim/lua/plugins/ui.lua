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

require('tokyonight').setup {
  transparent = true,
  styles = {
    comments = { italic = false },
    sidebars = 'transparent',
    floats = 'transparent',
  },
  on_highlights = function(highlights, colors)
    local transparent_groups = {
      'Normal',
      'NormalNC',
      'NormalFloat',
      'FloatBorder',
      'FloatTitle',
      'SignColumn',
      'FoldColumn',
      'MsgArea',
      'StatusLine',
      'StatusLineNC',
      'TabLineFill',
      'WinSeparator',
    }

    for _, group in ipairs(transparent_groups) do
      highlights[group] = vim.tbl_extend('force', highlights[group] or {}, { bg = colors.none })
    end
  end,
}
vim.cmd.colorscheme 'tokyonight-night'

require('todo-comments').setup { signs = false }

require('mini.ai').setup {
  mappings = {
    around_next = 'aa',
    inside_next = 'ii',
  },
  n_lines = 500,
}
require('mini.surround').setup()

local statusline = require 'mini.statusline'
statusline.setup { use_icons = vim.g.have_nerd_font }
statusline.section_location = function() return '%2l:%-2v' end
