local M = {}

local function ignored()
  local cursor = vim.api.nvim_win_get_cursor(0)
  local row, column = cursor[1] - 1, cursor[2]
  local tokens = vim.lsp.semantic_tokens.get_at_pos(0, row, column) or {}
  if #tokens > 0 then
    for _, token in ipairs(tokens) do
      if token.type == 'keyword' or token.modifiers.defaultLibrary then return true end
    end
    -- Semantic tokens distinguish local symbols that shadow built-in names.
    return false
  end

  for _, capture in ipairs(vim.treesitter.get_captures_at_pos(0, row, column)) do
    local name = capture.capture
    if name == 'keyword' or name:match '^keyword%.' or name:match '%.builtin$' then return true end
  end
  return false
end

function M.highlight()
  vim.lsp.buf.clear_references()
  if not ignored() then vim.lsp.buf.document_highlight() end
end

return M
