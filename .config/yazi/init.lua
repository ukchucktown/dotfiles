-- Keep directory icons, styled like their names, while hiding file icons.
function Entity:icon()
	if not self._file.cha.is_dir then
		return ""
	end

	local icon = th.icon:match(self._file, { hovered = self._file.is_hovered })
	return icon and icon.text .. " " or ""
end
