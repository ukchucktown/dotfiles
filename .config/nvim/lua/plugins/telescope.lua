local telescope = require 'telescope'
local builtin = require 'telescope.builtin'

telescope.setup {
  extensions = {
    ['ui-select'] = require('telescope.themes').get_dropdown(),
  },
}

pcall(telescope.load_extension, 'fzf')
pcall(telescope.load_extension, 'ui-select')

local map = vim.keymap.set
map('n', '<leader>sh', builtin.help_tags, { desc = 'Search help' })
map('n', '<leader>sk', builtin.keymaps, { desc = 'Search keymaps' })
map('n', '<leader>sf', builtin.find_files, { desc = 'Search files' })
map('n', '<leader>ss', builtin.builtin, { desc = 'Search Telescope pickers' })
map({ 'n', 'v' }, '<leader>sw', builtin.grep_string, { desc = 'Search current word' })
map('n', '<leader>sg', builtin.live_grep, { desc = 'Search by grep' })
map('n', '<leader>sd', builtin.diagnostics, { desc = 'Search diagnostics' })
map('n', '<leader>sr', builtin.resume, { desc = 'Resume search' })
map('n', '<leader>s.', builtin.oldfiles, { desc = 'Search recent files' })
map('n', '<leader>sc', builtin.commands, { desc = 'Search commands' })
map('n', '<leader><leader>', builtin.buffers, { desc = 'Search buffers' })

map(
  'n',
  '<leader>/',
  function()
    builtin.current_buffer_fuzzy_find(require('telescope.themes').get_dropdown {
      winblend = 10,
      previewer = false,
    })
  end,
  { desc = 'Search current buffer' }
)

map(
  'n',
  '<leader>s/',
  function()
    builtin.live_grep {
      grep_open_files = true,
      prompt_title = 'Live grep in open files',
    }
  end,
  { desc = 'Search open files' }
)

map('n', '<leader>sn', function() builtin.find_files { cwd = vim.fn.stdpath 'config' } end, { desc = 'Search Neovim config' })
