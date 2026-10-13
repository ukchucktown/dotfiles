import { keyText, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  Container,
  Text,
  truncateToWidth,
  visibleWidth,
  stripTerminalSequences,
} from "@earendil-works/pi-tui";
import { Heading, Guide, messageKey, concise } from "./ui.ts";
import { installCompatibility } from "./compat.ts";
const OWNER = Symbol.for("agent-sandbox.renderer");
const BUILTIN_TOOLS = new Set([
  "read",
  "bash",
  "powershell",
  "edit",
  "write",
  "grep",
  "find",
  "ls",
]);
const TITLES: Record<string, string> = {
  bash: " Shell",
  powershell: " Shell",
  read: "Read",
  edit: "Edit",
  write: "Write",
  grep: "Search",
  find: "Find",
  ls: "List",
};
const TOOL_STATE = Symbol.for("shared-pi.tool-renderer");
const rowState = (context: any) => (context.state[TOOL_STATE] ??= {});
const TIMING_ENTRY = "agent-sandbox-thought-timing";

export default function renderer(pi: ExtensionAPI): void {
  const globals = globalThis as any;
  globals[OWNER]?.dispose();
  let disposeCompatibility = () => {};
  const times = new Map<
    string,
    Map<number, { start?: number; elapsed?: number }>
  >();
  let receivedBytes = 0;
  let disposed = false;
  const state = {
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeCompatibility();
      times.clear();
      if (globals[OWNER] === state) delete globals[OWNER];
    },
  };
  globals[OWNER] = state;

  if (typeof pi.registerToolRenderer !== "function")
    throw new Error(
      "Pi lacks registerToolRenderer; use the guarded Pi updater.",
    );
  const compatibility: any = { times, ui: undefined, indicator: undefined };
  disposeCompatibility = installCompatibility(compatibility);
  pi.registerToolRenderer((name, next) => {
    const native = next();
    if (!BUILTIN_TOOLS.has(name)) return native;
    return {
      renderShell: "self",
      renderCall(args: any, theme: any, context: any) {
        const row = rowState(context);
        const command =
          typeof args.command === "string" ? args.command : undefined;
        const detail = concise(
          command?.split("\n")[0] ?? args.path ?? args.pattern,
        );
        const commandLines = command?.trimEnd().split("\n").length;
        const heading = new Heading(() => {
          const title = theme.bold(theme.fg("toolTitle", TITLES[name] ?? name));
          const lines =
            commandLines && commandLines > 1
              ? theme.fg("dim", ` · ${commandLines} command lines`)
              : "";
          const status = context.isError
            ? theme.fg("error", " · failed")
            : row.complete
              ? theme.fg(
                  "dim",
                  ` · ${row.outputLines} output ${row.outputLines === 1 ? "line" : "lines"}`,
                )
              : context.executionStarted
                ? theme.fg("dim", " · running")
                : "";
          return (
            title +
            theme.fg("muted", detail ? ` ${detail}` : "") +
            lines +
            status
          );
        }, context.outputPad);
        if (!context.expanded || command === undefined) return heading;
        const content = new Container();
        content.addChild(heading);
        content.addChild(
          new Guide(
            new Text(theme.fg("muted", command), 0, 0),
            theme,
            context.outputPad,
          ),
        );
        return content;
      },
      renderResult(result: any, options: any, theme: any, context: any) {
        const text = result.content
          .filter((block: any) => block.type === "text")
          .map((block: any) => block.text)
          .join("\n")
          .trimEnd();
        rowState(context).outputLines = text ? text.split("\n").length : 0;
        rowState(context).complete = !options.isPartial;
        if (!options.expanded && !context.isError)
          return { render: () => [], invalidate() {} };
        if (!options.expanded)
          return new Guide(
            new Text(
              theme.fg("error", text.split("\n").slice(0, 3).join("\n")),
              0,
              0,
            ),
            theme,
            context.outputPad,
          );
        const body = native?.renderResult
          ? native.renderResult(result, options, theme, context)
          : new Text(text, 0, 0);
        return new Guide(body, theme, context.outputPad);
      },
    };
  });

  pi.on("session_start", (_event, ctx) => {
    compatibility.ui = ctx.ui;
    ctx.ui.setWorkingIndicator({ frames: ["◎", "◉"], intervalMs: 500 });
    ctx.ui.setFooter((tui, _theme, data) => {
      const unsubscribe = data.onBranchChange(() => tui.requestRender());
      return {
        invalidate() {},
        dispose: unsubscribe,
        render(width: number): string[] {
          if (width <= 0) return [""];
          const theme = ctx.ui.theme;
          const separator = theme.fg("borderMuted", "  ");
          const activeIndicator = compatibility.indicator;
          const working = !!activeIndicator;
          const available = Math.max(0, width - 2);
          const model = theme.fg(
            "warning",
            concise(ctx.model?.id ?? "no model"),
          );
          const thinking = ctx.model?.reasoning
            ? theme.fg("muted", ` · ${pi.getThinkingLevel()}`)
            : "";
          const usage = ctx.getContextUsage();
          const percentage = usage?.percent;
          const context =
            percentage === undefined || percentage === null
              ? ""
              : separator +
                theme.fg(
                  percentage > 90
                    ? "error"
                    : percentage > 70
                      ? "warning"
                      : "dim",
                  `${Math.round(percentage)}% ctx`,
                );
          const minLeft = working ? 28 : 12;
          const right =
            [model + thinking + context, model + thinking, model].find(
              (candidate) => visibleWidth(candidate) + minLeft + 2 <= available,
            ) ?? "";
          const leftWidth = Math.max(
            0,
            available - visibleWidth(right) - (right ? 2 : 0),
          );
          const statuses = [...data.getExtensionStatuses().entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, value]) => concise(stripTerminalSequences(value)))
            .filter(Boolean);
          let left: string;
          if (working) {
            const label = concise(
              stripTerminalSequences(activeIndicator.message ?? "Working"),
            ).replace(/\s*\([^)]*to (?:interrupt|cancel)\)$/, "");
            const ring =
              activeIndicator.kind === "working"
                ? stripTerminalSequences(
                    activeIndicator.getRenderedIndicator(),
                  ) || "◎"
                : "◎";
            const color =
              activeIndicator.kind === "working"
                ? "customMessageLabel"
                : "warning";
            const size =
              receivedBytes > 0 && activeIndicator.kind === "working"
                ? theme.fg("dim", ` · ${(receivedBytes / 1024).toFixed(1)} KiB`)
                : "";
            const status =
              theme.fg(color, `${ring} ${label}`) +
              size +
              (statuses.length
                ? separator + theme.fg("dim", statuses.join(" · "))
                : "");
            const shortcut = keyText("app.interrupt").replace(
              /\bescape\b/g,
              "esc",
            );
            const action =
              activeIndicator.kind === "working" ? "interrupt" : "cancel";
            const hint = shortcut
              ? theme.fg("muted", ` ${shortcut} ${action}`)
              : "";
            const hintWidth = visibleWidth(hint);
            left =
              leftWidth > hintWidth + 8
                ? truncateToWidth(status, leftWidth - hintWidth) + hint
                : truncateToWidth(status + hint, leftWidth);
          } else {
            const cwd = concise(ctx.sessionManager.getCwd());
            const home = process.env.HOME;
            const path =
              home && (cwd === home || cwd.startsWith(home + "/"))
                ? "~" + cwd.slice(home.length)
                : cwd;
            const branch = concise(data.getGitBranch());
            const location =
              theme.fg("muted", " ") +
              theme.fg("muted", path) +
              (branch ? separator + theme.fg("muted", ` ${branch}`) : "");
            left = truncateToWidth(
              (statuses.length
                ? theme.fg("accent", statuses.join(" · ")) + separator
                : "") + location,
              leftWidth,
            );
          }
          const gap = right
            ? " ".repeat(
                Math.max(
                  2,
                  available - visibleWidth(left) - visibleWidth(right),
                ),
              )
            : "";
          return [truncateToWidth(" " + left + gap + right, width)];
        },
      };
    });
    times.clear();
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "custom" && entry.customType === TIMING_ENTRY) {
        const data = entry.data as any;
        if (data?.key && Array.isArray(data.blocks))
          times.set(data.key, new Map(data.blocks));
      }
    }
  });
  pi.on("agent_start", () => {
    receivedBytes = 0;
  });
  pi.on("message_update", (event) => {
    if (event.message.role !== "assistant") return;
    const stream = event.assistantMessageEvent;
    if ("delta" in stream && typeof stream.delta === "string")
      receivedBytes += Buffer.byteLength(stream.delta, "utf8");
    if (stream.type !== "thinking_start" && stream.type !== "thinking_end")
      return;
    const key = messageKey(event.message);
    const blocks = times.get(key) ?? new Map();
    times.set(key, blocks);
    if (stream.type === "thinking_start")
      blocks.set(stream.contentIndex, { start: Date.now() });
    else {
      const record = blocks.get(stream.contentIndex);
      if (record?.start !== undefined)
        record.elapsed = Date.now() - record.start;
    }
  });
  pi.on("message_end", (event, ctx) => {
    if (event.message.role !== "assistant") return;
    const key = messageKey(event.message);
    const blocks = times.get(key);
    if (!blocks) return;
    for (const record of blocks.values()) {
      if (record.start !== undefined && record.elapsed === undefined)
        record.elapsed = Date.now() - record.start;
    }
    pi.appendEntry(TIMING_ENTRY, {
      key,
      blocks: [...blocks].map(([index, record]) => [
        index,
        { elapsed: record.elapsed },
      ]),
    });
    ctx.ui.setHiddenThinkingLabel("Thoughts");
  });
  pi.on("session_shutdown", (_event, ctx) => {
    state.dispose();
    ctx.ui.setFooter(undefined);
    ctx.ui.setWorkingIndicator();
  });
}
