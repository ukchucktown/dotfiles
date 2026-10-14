import {
  Container,
  CURSOR_MARKER,
  stripTerminalSequences,
  truncateToWidth,
  visibleWidth,
  sliceByColumn,
} from "@earendil-works/pi-tui";

export function fillRow(line: string, width: number): string {
  let clipped = truncateToWidth(line, width, "");
  if (line.includes(CURSOR_MARKER) && !clipped.includes(CURSOR_MARKER)) {
    const column = Math.max(0, width - 1);
    clipped =
      sliceByColumn(clipped, 0, column) +
      CURSOR_MARKER +
      sliceByColumn(clipped, column, 1);
  }
  return clipped + " ".repeat(Math.max(0, width - visibleWidth(clipped)));
}
export function selectedRow(line: string, width: number, theme: any): string {
  return theme.bg(
    "selectedBg",
    theme.bold(
      theme.fg(
        "text",
        fillRow(
          stripTerminalSequences(line).replace(/^(\s*)[→›❯](?=\s)/, "$1›"),
          width,
        ),
      ),
    ),
  );
}
export function promptRow(line: string, width: number, theme: any): string {
  return theme.bg(
    "userMessageBg",
    fillRow(line.replace(/^(\s*)>(?=\s)/, "$1›"), width),
  );
}

// Transform only presentation. Each output row maps back to the native row so
// clicks still reach the original input, settings list, or nested submenu.
export function pickerRows(
  native: string[],
  width: number,
  theme: any,
  searchRow = -1,
) {
  const markerLine = native.find((line) =>
    /^\s*[→›❯]\s/.test(stripTerminalSequences(line)),
  );
  const inputPadding = markerLine
    ? stripTerminalSequences(markerLine).match(/^(\s*)/)![1].length
    : 0;
  const rows: string[] = [];
  const map: Array<number | undefined> = [];
  for (let i = 0; i < native.length; i++) {
    const plain = stripTerminalSequences(native[i]);
    if (i === searchRow || /^[─━═]+$/.test(plain.trim())) continue;
    rows.push(
      /^\s*[→›❯]\s/.test(plain)
        ? selectedRow(native[i], width, theme)
        : truncateToWidth(native[i], width, ""),
    );
    map.push(i);
  }
  while (rows.length && !stripTerminalSequences(rows[0]).trim()) {
    rows.shift();
    map.shift();
  }
  while (rows.length && !stripTerminalSequences(rows.at(-1)!).trim()) {
    rows.pop();
    map.pop();
  }
  if (searchRow >= 0) {
    rows.push(
      promptRow("", width, theme),
      promptRow(" ".repeat(inputPadding) + native[searchRow], width, theme),
      promptRow("", width, theme),
    );
    map.push(undefined, searchRow, undefined);
  }
  return { rows, map, inputPadding };
}

export class PickerLayout extends Container {
  private map: Array<number | undefined> = [];
  private nativeHeight = 0;
  private searchRow = -1;
  private inputPadding = 0;
  constructor(
    private native: any,
    private theme: () => any,
  ) {
    super();
    this.addChild(native);
  }
  render(width: number): string[] {
    const native = this.native.render(width);
    this.nativeHeight = native.length;
    // Focused native search fields emit the hardware cursor marker. Prefer the
    // direct searchInput's layout when present, including before focus is set.
    let searchRow = native.findIndex((line: string) =>
      line.includes(CURSOR_MARKER),
    );
    if (this.native.searchInput && this.native.mouseLayout) {
      let offset = 0;
      for (const child of this.native.mouseLayout.children) {
        if (child.component === this.native.searchInput) {
          searchRow = offset;
          break;
        }
        offset += child.height;
      }
    }
    if (
      searchRow >= 0 &&
      this.native.searchInput?.focused &&
      !native[searchRow].includes(CURSOR_MARKER)
    ) {
      native[searchRow] = CURSOR_MARKER + native[searchRow];
    }
    const layout = pickerRows(native, width, this.theme(), searchRow);
    this.map = layout.map;
    this.searchRow = searchRow;
    this.inputPadding = layout.inputPadding;
    return layout.rows;
  }
  handleMouse(event: any): any {
    const y = this.map[event.y];
    if (y === undefined) return undefined;
    return this.native.handleMouse?.({
      ...event,
      y,
      x: event.x - (y === this.searchRow ? this.inputPadding : 0),
      height: this.nativeHeight,
    });
  }
}
