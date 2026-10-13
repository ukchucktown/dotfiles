import {
  AssistantMessageComponent,
  ToolExecutionComponent,
  CustomEditor,
} from "@earendil-works/pi-coding-agent";
import {
  Container,
  MouseRegion,
  Text,
  TuiAltScreen,
  truncateToWidth,
} from "@earendil-works/pi-tui";
import { ANCHOR, Heading, Guide, messageKey, thinkingRuns } from "./ui.ts";

// Pi has no public hooks for these exact layout and scrolling behaviors.
// Keep all access to those internals here, and restore it on reload/shutdown.
export function installCompatibility(state: any): () => void {
  const restorers: Array<() => void> = [];
  const commandMenus = new WeakMap<
    object,
    { offset: number; padding: number; height: number }
  >();
  const dispose = () => {
    for (const restore of restorers.splice(0).reverse()) restore();
  };
  function patch(
    prototype: any,
    name: string,
    decorate: (original: any) => any,
  ): void {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    const original = prototype[name];
    if (typeof original !== "function")
      throw new Error(`Pi renderer requires UI method ${name}`);
    const replacement = decorate(original);
    Object.defineProperty(prototype, name, {
      configurable: true,
      writable: true,
      ...descriptor,
      value: replacement,
    });
    restorers.push(() => {
      if (prototype[name] !== replacement) return;
      if (descriptor) Object.defineProperty(prototype, name, descriptor);
      else delete prototype[name];
    });
  }

  function compact(component: any): boolean {
    return (
      new Set([
        "read",
        "bash",
        "powershell",
        "edit",
        "write",
        "grep",
        "find",
        "ls",
      ]).has(component.toolName) && !!component.toolDefinition
    );
  }
  try {
    patch(
      TuiAltScreen.prototype,
      "compositeScrollToEndIndicator",
      () =>
        function (this: any, screen: string[]) {
          // Remove both the popup and its click target without changing scrolling.
          this.scrollToEndIndicatorRect = undefined;
          return screen;
        },
    );
    // Freeze the transcript's top row after a native expansion click. Otherwise
    // follow-end scrolls to the new bottom and moves the clicked heading upward.
    patch(
      TuiAltScreen.prototype,
      "applyMouseDispatchResult",
      (original) =>
        function (this: any, event: any, result: any) {
          if (
            event.type === "click" &&
            event.button === "left" &&
            result.target?.component[ANCHOR]
          ) {
            const scroll = this.getPrimaryScrollView();
            scroll.scrollTo(scroll.scrollTop, { disableFollow: true });
          }
          return original.call(this, event, result);
        },
    );
    patch(
      CustomEditor.prototype,
      "setWorkingStatusIndicator",
      (original) =>
        function (this: any, indicator: any) {
          original.call(this, indicator);
          if (this.embedWorkingStatus) state.indicator = indicator;
        },
    );
    patch(
      CustomEditor.prototype,
      "render",
      (original) =>
        function (this: any, width: number) {
          state.indicator = this.embedWorkingStatus
            ? this.workingStatusIndicator
            : undefined;
          const embedded = this.embedWorkingStatus;
          const autocomplete = this.autocompleteState;
          const slashMenu =
            autocomplete &&
            this.autocompleteList &&
            this.autocompletePrefix.startsWith("/");
          commandMenus.delete(this);
          this.embedWorkingStatus = false;
          // Render the native prompt separately so its cursor and wrapping stay intact.
          if (slashMenu) this.autocompleteState = null;
          let prompt: string[];
          try {
            prompt = original.call(this, width);
          } finally {
            this.embedWorkingStatus = embedded;
            this.autocompleteState = autocomplete;
          }
          if (!slashMenu) return prompt;
          const padding = Math.min(
            Math.max(1, this.paddingX),
            Math.max(0, Math.floor((width - 1) / 2)),
          );
          const contentWidth = Math.max(1, width - padding * 2);
          const menu = this.autocompleteList
            .render(contentWidth)
            .map((line: string) =>
              truncateToWidth(" ".repeat(padding) + line, width),
            );
          this.renderedAutocompleteHeight = menu.length;
          commandMenus.set(this, {
            offset: menu.length + 1,
            padding,
            height: menu.length,
          });
          return ["", ...menu, ...prompt];
        },
    );
    patch(
      CustomEditor.prototype,
      "handleMouse",
      (original) =>
        function (this: any, event: any) {
          const menu = commandMenus.get(this);
          if (!menu || !this.autocompleteState || !this.autocompleteList)
            return original.call(this, event);
          if (event.y >= 1 && event.y < menu.offset) {
            const result = this.autocompleteList.handleMouse?.({
              ...event,
              x: event.x - menu.padding,
              y: event.y - 1,
              width: Math.max(1, event.width - menu.padding * 2),
              height: menu.height,
            });
            return result ? { ...result, focus: true } : undefined;
          }
          if (
            event.y < menu.offset ||
            event.y >= menu.offset + this.renderedVisibleLineCount + 2
          )
            return undefined;
          return original.call(this, { ...event, y: event.y - menu.offset });
        },
    );
    patch(
      ToolExecutionComponent.prototype,
      "createResultRegion",
      (original) =>
        function (this: any, component: any) {
          const region = original.call(this, component);
          if (compact(this)) region[ANCHOR] = true;
          return region;
        },
    );
    patch(
      AssistantMessageComponent.prototype,
      "updateContent",
      (original) =>
        function (this: any, message: any, ...args: any[]) {
          original.call(this, message, ...args);
          const activeTheme = state.ui?.theme;
          if (!activeTheme || !this.contentContainer) return;
          const runs = thinkingRuns(message);
          let index = 0;
          for (const region of this.contentContainer.children) {
            if (!(region instanceof MouseRegion)) continue;
            (region as any)[ANCHOR] = true;
            const run = runs[index];
            const hidden =
              this.thinkingVisibilityOverrides.get(index) ??
              this.hideThinkingBlock;
            index++;
            if (!run) continue;
            const timings = state.times.get(messageKey(message));
            const records = run.map((i) => timings?.get(i));
            const running = records.some(
              (record) =>
                record?.start !== undefined && record.elapsed === undefined,
            );
            const complete = records.some(
              (record) => record?.elapsed !== undefined,
            );
            const elapsed = records.reduce(
              (sum, record) => sum + (record?.elapsed ?? 0),
              0,
            );
            const label = running
              ? "Thinking…"
              : complete
                ? `Thought for ${Math.max(1, Math.round(elapsed / 1000))}s`
                : "Thoughts";
            const content = new Container();
            content.addChild(
              new Heading(
                activeTheme.italic(
                  activeTheme.fg(
                    "thinkingText",
                    `${hidden ? "❯" : "⌄"} ${label}`,
                  ),
                ),
                this.outputPad,
              ),
            );
            if (!hidden)
              content.addChild(
                new Guide(region.child, activeTheme, this.outputPad, 0),
              );
            region.child = content;
          }
        },
    );
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
