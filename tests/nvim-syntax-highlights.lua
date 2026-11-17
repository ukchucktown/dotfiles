-- Requires the Lua and TSX parsers installed by the Neovim config.
-- Run with: nvim --headless -u NONE -i NONE -l tests/nvim-syntax-highlights.lua
local root = vim.fn.fnamemodify(debug.getinfo(1, 'S').source:sub(2), ':p:h:h')
vim.opt.runtimepath:prepend(root .. '/.config/nvim')
for _, path in ipairs(vim.fn.glob(vim.fn.stdpath 'data' .. '/site/pack/core/opt/*', false, true)) do
  vim.opt.runtimepath:append(path)
end
vim.opt.runtimepath:append(vim.fn.stdpath 'data' .. '/site/pack/core/opt/nvim-treesitter/runtime')
vim.o.termguicolors = false
vim.g.have_nerd_font = false
dofile(root .. '/.config/nvim/lua/plugins/ui.lua')

local function check()
  local groups = { 'Comment', 'Constant', 'Number', 'String', 'Type', 'Statement', 'Function', '@variable.parameter', '@variable.member', '@function.builtin' }
  local colors = {}
  for _, name in ipairs(groups) do
    local hl = vim.api.nvim_get_hl(0, { name = name, link = false })
    assert(hl.ctermfg ~= nil, name .. ' has no syntax color')
    assert(hl.ctermfg < 16, name .. ' bypasses the terminal theme palette')
    assert(hl.ctermbg == nil, name .. ' overrides the terminal background')
    colors[hl.ctermfg] = true
  end
  assert(vim.tbl_count(colors) >= 6, 'Syntax categories collapse to too few colors')
  local func = vim.api.nvim_get_hl(0, { name = 'Function', link = false })
  local builtin = vim.api.nvim_get_hl(0, { name = '@function.builtin', link = false })
  assert(func.ctermfg ~= builtin.ctermfg, 'Built-in and project functions lost their distinction')
  local normal = vim.api.nvim_get_hl(0, { name = 'Normal', link = false })
  assert(normal.ctermfg == nil and normal.ctermbg == nil, 'Editor no longer uses the terminal defaults')
  assert(not vim.o.termguicolors, 'Syntax highlights enabled fixed RGB output')
end
for _, background in ipairs { 'dark', 'light' } do
  vim.o.background = background
  check()
  vim.cmd.colorscheme 'default'
  check()
  print('PASS: ' .. background .. ' syntax categories retain distinct terminal colors after reload')
end

vim.api.nvim_buf_set_lines(0, 0, -1, false, {
  '-- comment',
  'local VALUE = 42',
  'local function greet(name)',
  "  return name .. 'hello'",
  'end',
  'local config = { enabled = true }',
  'print(config.enabled)',
})
vim.bo.filetype = 'lua'
vim.treesitter.start(0, 'lua')
vim.treesitter.get_parser(0, 'lua'):parse()
local samples = {
  { 0, 3, 'comment' },
  { 1, 6, 'constant' },
  { 1, 14, 'number' },
  { 2, 15, 'function' },
  { 2, 21, 'variable.parameter' },
  { 3, 18, 'string' },
  { 6, 0, 'function.builtin' },
  { 6, 13, 'variable.member' },
}
for _, sample in ipairs(samples) do
  local captures = vim.treesitter.get_captures_at_pos(0, sample[1], sample[2])
  local found = false
  for _, capture in ipairs(captures) do
    if capture.capture == sample[3] then
      local hl = vim.api.nvim_get_hl(0, { name = '@' .. capture.capture, link = false })
      assert(hl.ctermfg ~= nil, capture.capture .. ' parses correctly but renders without a syntax color')
      found = true
    end
  end
  assert(found, 'Fixture did not exercise ' .. sample[3])
end
print 'PASS: real Lua syntax captures resolve to terminal colors'
local tsx = {
  'type Props = { value: number }',
  'function Card(props: Props) {',
  '  return <div title="Hello">{props.value + 42}</div>',
  '}',
}
vim.api.nvim_buf_set_lines(0, 0, -1, false, tsx)
vim.bo.filetype = 'typescriptreact'
vim.treesitter.start(0, 'tsx')
vim.treesitter.get_parser(0, 'tsx'):parse()
local tsx_samples = {
  { 1, 'Props', 'type' },
  { 1, 'number', 'type.builtin' },
  { 2, 'Card', 'function' },
  { 2, 'props', 'variable.parameter' },
  { 3, 'value', 'variable.member' },
  { 3, 'div', 'tag.builtin' },
  { 3, 'title', 'tag.attribute' },
  { 3, 'Hello', 'string' },
  { 3, '42', 'number' },
}
for _, sample in ipairs(tsx_samples) do
  local column = assert(tsx[sample[1]]:find(sample[2], 1, true)) - 1
  local found = false
  for _, capture in ipairs(vim.treesitter.get_captures_at_pos(0, sample[1] - 1, column)) do
    if capture.capture == sample[3] then
      local hl = vim.api.nvim_get_hl(0, { name = '@' .. capture.capture, link = false })
      assert(hl.ctermfg ~= nil, capture.capture .. ' parses correctly but renders without a syntax color')
      found = true
    end
  end
  assert(found, 'TSX fixture did not exercise ' .. sample[3])
end
print 'PASS: real TSX syntax captures resolve to terminal colors'
vim.cmd 'qa!'
