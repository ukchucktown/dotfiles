require('gitsigns').setup {
  signs = {
    add = { text = '+' },
    change = { text = '~' },
    delete = { text = '_' },
    topdelete = { text = '‾' },
    changedelete = { text = '~' },
  },
  on_attach = function(bufnr)
    local gitsigns = require 'gitsigns'
    local function map(mode, lhs, rhs, desc, options)
      options = vim.tbl_extend('force', {
        buffer = bufnr,
        desc = desc,
      }, options or {})
      vim.keymap.set(mode, lhs, rhs, options)
    end

    map('n', ']c', function()
      if vim.wo.diff then return ']c' end
      vim.schedule(function() gitsigns.nav_hunk 'next' end)
      return '<Ignore>'
    end, 'Next Git hunk', { expr = true })

    map('n', '[c', function()
      if vim.wo.diff then return '[c' end
      vim.schedule(function() gitsigns.nav_hunk 'prev' end)
      return '<Ignore>'
    end, 'Previous Git hunk', { expr = true })

    map('n', '<leader>hp', gitsigns.preview_hunk, 'Preview Git hunk')
    map('n', '<leader>hb', gitsigns.blame_line, 'Blame line')
    map('n', '<leader>hd', gitsigns.diffthis, 'Diff against index')
    map('n', '<leader>hr', gitsigns.reset_hunk, 'Reset Git hunk')
    map('n', '<leader>hs', gitsigns.stage_hunk, 'Stage Git hunk')
  end,
}
