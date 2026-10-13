import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
export const ANCHOR = Symbol.for("shared-pi.expandable-region");
export class Heading {
  constructor(
    private text: string | (() => string),
    private padding = 1,
    private suffix = "",
  ) {}
  render(width: number): string[] {
    const padding = Math.min(this.padding, width);
    const available = Math.max(0, width - padding);
    const suffixWidth = visibleWidth(this.suffix);
    const value = typeof this.text === "function" ? this.text() : this.text;
    const text =
      this.suffix && available > suffixWidth + 8
        ? truncateToWidth(value, available - suffixWidth) + this.suffix
        : truncateToWidth(value + this.suffix, available);
    return [" ".repeat(padding) + text];
  }
  invalidate(): void {}
}

export class Guide {
  constructor(
    private child: any,
    private theme: any,
    private padding = 1,
    private gap = 1,
  ) {}
  render(width: number): string[] {
    const padding = Math.min(this.padding, Math.max(0, width - 1));
    const gap = Math.min(this.gap, Math.max(0, width - padding - 2));
    const prefix =
      " ".repeat(padding) + this.theme.fg("borderMuted", "│") + " ".repeat(gap);
    return this.child
      .render(Math.max(1, width - padding - 1 - gap))
      .map((line: string) => truncateToWidth(prefix + line, width));
  }
  invalidate(): void {
    this.child.invalidate();
  }
  handleMouse(event: any): any {
    return this.child.handleMouse?.({
      ...event,
      x: event.x - this.padding - 1 - this.gap,
      width: Math.max(1, event.width - this.padding - 1 - this.gap),
    });
  }
}

export function messageKey(message: any): string {
  return `${message.provider}/${message.model}/${message.timestamp}`;
}

export function thinkingRuns(message: any): number[][] {
  const runs: number[][] = [];
  let run: number[] = [];
  for (let i = 0; i <= message.content.length; i++) {
    if (message.content[i]?.type === "thinking") {
      run.push(i);
    } else if (run.length) {
      if (run.some((index) => message.content[index].thinking.trim()))
        runs.push(run);
      run = [];
    }
  }
  return runs;
}

export function concise(value: unknown): string {
  return typeof value === "string"
    ? value
        .replace(/[\x00-\x1f\x7f]/g, " ")
        .replace(/ +/g, " ")
        .trim()
    : "";
}
