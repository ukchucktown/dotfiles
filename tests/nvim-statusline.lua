-- Run with: nvim --headless -u NONE -i NONE -l tests/nvim-statusline.lua
local root = vim.fn.fnamemodify(debug.getinfo(1, 'S').source:sub(2), ':p:h:h')
for _, path in ipairs(vim.fn.glob(vim.fn.stdpath 'data' .. '/site/pack/core/opt/*', false, true)) do
  vim.opt.runtimepath:append(path)
end

vim.g.have_nerd_font = false
vim.o.termguicolors = false
vim.o.laststatus = 2
vim.api.nvim_buf_set_name(0, '/tmp/statusline-example.lua')
vim.bo.filetype = 'lua'
vim.g.actual_curwin = vim.api.nvim_get_current_win()
dofile(root .. '/.config/nvim/lua/plugins/ui.lua')

local function check()
  assert(not vim.o.termguicolors, 'Status line enabled fixed RGB colors')
  local mode_groups = {
    'MiniStatuslineModeNormal',
    'MiniStatuslineModeInsert',
    'MiniStatuslineModeVisual',
    'MiniStatuslineModeReplace',
    'MiniStatuslineModeCommand',
    'MiniStatuslineModeOther',
  }
  local backgrounds = {}
  for _, name in ipairs(mode_groups) do
    local hl = vim.api.nvim_get_hl(0, { name = name, link = false })
    assert(hl.ctermfg ~= nil and hl.ctermbg ~= nil, name .. ' lost its colored mode label')
    assert(hl.ctermfg < 16 and hl.ctermbg < 16, name .. ' bypasses the terminal palette')
    assert(hl.cterm and hl.cterm.nocombine, name .. ' inherits base status line formatting')
    assert(hl.cterm and hl.cterm.bold, name .. ' lost its bold mode label')
    assert(not backgrounds[hl.ctermbg], name .. ' has no distinct mode color')
    backgrounds[hl.ctermbg] = true
  end
  local filename = vim.api.nvim_get_hl(0, { name = 'MiniStatuslineFilename', link = false })
  local attributes = filename.cterm or {}
  assert(attributes.nocombine, 'Filename inherits reverse video from the base status line')
  assert(not attributes.bold and not attributes.underline and not attributes.reverse, 'Filename gained emphasis from the default theme')
  assert(filename.ctermbg ~= nil and filename.ctermbg < 16, 'Status line background disappears behind the filename')
  for _, name in ipairs { 'MiniStatuslineDevinfo', 'MiniStatuslineFileinfo' } do
    local hl = vim.api.nvim_get_hl(0, { name = name, link = false })
    assert(hl.ctermbg ~= nil, name .. ' lost its section background')
    assert(hl.cterm and hl.cterm.nocombine, name .. ' inherits base status line formatting')
    assert(hl.ctermbg < 16, name .. ' bypasses the terminal palette')
    assert(hl.ctermbg == filename.ctermbg, name .. ' interrupts the continuous status line background')
  end
  local rendered = vim.api.nvim_eval_statusline(MiniStatusline.active(), { maxwidth = 160 })
  assert(rendered.str:find('statusline-example.lua', 1, true), 'Filename section disappeared')
  assert(rendered.str:match 'lua%s+%d+:%d+%s*$', 'File type or location section disappeared')
  assert(MiniStatusline.section_location() == '%2l:%-2v', 'Location formatting changed')
  return rendered.str
end

local content
for _, background in ipairs { 'dark', 'light' } do
  vim.o.background = background
  local current = check()
  content = content or current
  assert(current == content, 'Background change altered status line content')
  vim.cmd.colorscheme 'default'
  assert(check() == content, 'Colorscheme reload altered status line content')
  print('PASS: ' .. background .. ' status line retains terminal colors, section formatting, and content')
end
vim.cmd 'qa!'
