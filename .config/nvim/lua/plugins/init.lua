local function gh(repo) return 'https://github.com/' .. repo end

local function run_build(name, command, cwd)
  local result = vim.system(command, { cwd = cwd }):wait()
  if result.code == 0 then return end

  local stderr = result.stderr or ''
  local stdout = result.stdout or ''
  local output = stderr ~= '' and stderr or stdout
  if output == '' then output = 'No output from build command.' end
  vim.notify(('Build failed for %s:\n%s'):format(name, output), vim.log.levels.ERROR)
end

vim.api.nvim_create_autocmd('PackChanged', {
  group = vim.api.nvim_create_augroup('user-pack-builds', { clear = true }),
  callback = function(event)
    local name = event.data.spec.name
    local kind = event.data.kind
    if kind ~= 'install' and kind ~= 'update' then return end

    if name == 'telescope-fzf-native.nvim' and vim.fn.executable 'make' == 1 then
      run_build(name, { 'make' }, event.data.path)
    elseif name == 'LuaSnip' and vim.fn.has 'win32' ~= 1 and vim.fn.executable 'make' == 1 then
      run_build(name, { 'make', 'install_jsregexp' }, event.data.path)
    elseif name == 'nvim-treesitter' then
      if not event.data.active then vim.cmd.packadd 'nvim-treesitter' end
      vim.cmd 'TSUpdate'
    end
  end,
})

local specs = {
  gh 'NMAC427/guess-indent.nvim',
  gh 'lewis6991/gitsigns.nvim',
  gh 'folke/which-key.nvim',
  gh 'folke/tokyonight.nvim',
  gh 'folke/todo-comments.nvim',
  gh 'nvim-mini/mini.nvim',
  gh 'nvim-lua/plenary.nvim',
  gh 'nvim-telescope/telescope.nvim',
  gh 'nvim-telescope/telescope-ui-select.nvim',
  gh 'j-hui/fidget.nvim',
  gh 'neovim/nvim-lspconfig',
  gh 'mason-org/mason.nvim',
  gh 'mason-org/mason-lspconfig.nvim',
  gh 'WhoIsSethDaniel/mason-tool-installer.nvim',
  gh 'stevearc/conform.nvim',
  { src = gh 'L3MON4D3/LuaSnip', version = vim.version.range '2.*' },
  { src = gh 'saghen/blink.cmp', version = vim.version.range '1.*' },
  { src = gh 'nvim-treesitter/nvim-treesitter', version = 'main' },
}

if vim.fn.executable 'make' == 1 then table.insert(specs, gh 'nvim-telescope/telescope-fzf-native.nvim') end

vim.pack.add(specs)

require 'plugins.ui'
require 'plugins.editor'
require 'plugins.telescope'
require 'plugins.completion'
require 'plugins.lsp'
require 'plugins.formatting'
require 'plugins.treesitter'
