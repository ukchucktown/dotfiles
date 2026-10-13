import {
  AssistantMessageComponent,
  ToolExecutionComponent,
  CustomEditor,
  InteractiveMode,
  ExtensionSelectorComponent,
} from "@earendil-works/pi-coding-agent";
import {
  Container,
  MouseRegion,
  Text,
  TuiAltScreen,
  truncateToWidth,
  SelectList,
  SettingsList,
} from "@earendil-works/pi-tui";
import { PickerLayout, pickerRows, selectedRow, promptRow } from "./menus.ts";
import { ANCHOR, Heading, Guide, messageKey, thinkingRuns } from "./ui.ts";

// Pi has no public hooks for these exact layout and scrolling behaviors.
// Keep all access to those internals here, and restore it on reload/shutdown.
export function installCompatibility(state: any): () => void {
  const restorers: Array<() => void> = [];
  const slashLists = new WeakSet<object>();
  const settingsLayouts = new WeakMap<
    object,
    { map: Array<number | undefined>; height: number }
  >();
  const extensionLayouts = new WeakMap<
    object,
    { map: Array<number | undefined>; height: number }
  >();
  const editorPadding = new WeakMap<object, number>();
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
      InteractiveMode.prototype,
      "showSelector",
      (original) =>
        function (this: any, create: any) {
          if (!state.ui) return original.call(this, create);
          return original.call(this, (done: any) => {
            const created = create(done);
            return {
              ...created,
              component: new PickerLayout(
                created.component,
                () => state.ui.theme,
              ),
            };
          });
        },
    );
    // Extension dialogs do not use InteractiveMode.showSelector.
    patch(
      ExtensionSelectorComponent.prototype,
      "render",
      (original) =>
        function (this: any, width: number) {
          const native = original.call(this, width);
          if (!state.ui) return native;
          const layout = pickerRows(native, width, state.ui.theme);
          extensionLayouts.set(this, {
            map: layout.map,
            height: native.length,
          });
          return layout.rows;
        },
    );
    patch(
      ExtensionSelectorComponent.prototype,
      "handleMouse",
      (original) =>
        function (this: any, event: any) {
          const layout = extensionLayouts.get(this);
          if (!layout) return original.call(this, event);
          const y = layout.map[event.y];
          if (y === undefined) return undefined;
          return original.call(this, { ...event, y, height: layout.height });
        },
    );
    patch(
      SelectList.prototype,
      "renderItem",
      (original) =>
        function (
          this: any,
          item: any,
          selected: boolean,
          width: number,
          description: string,
          primaryWidth: number,
        ) {
          const display = slashLists.has(this)
            ? {
                ...item,
                label: "/" + (item.label || item.value).replace(/^\//, ""),
              }
            : item;
          const line = original.call(
            this,
            display,
            selected,
            width,
            description,
            primaryWidth,
          );
          return selected && state.ui
            ? selectedRow(line, width, state.ui.theme)
            : line;
        },
    );
    patch(
      SettingsList.prototype,
      "render",
      (original) =>
        function (this: any, width: number) {
          const native = original.call(this, width);
          if (!state.ui) return native;
          const search =
            !this.submenuComponent && this.searchEnabled && this.searchInput
              ? 0
              : -1;
          const layout = pickerRows(native, width, state.ui.theme, search);
          settingsLayouts.set(this, { map: layout.map, height: native.length });
          return layout.rows;
        },
    );
    patch(
      SettingsList.prototype,
      "handleMouse",
      (original) =>
        function (this: any, event: any) {
          const layout = settingsLayouts.get(this);
          if (!layout) return original.call(this, event);
          const y = layout.map[event.y];
          if (y === undefined) return undefined;
          return original.call(this, { ...event, y, height: layout.height });
        },
    );
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
          const nativePadding = this.paddingX;
          this.paddingX = Math.max(2, nativePadding);
          editorPadding.set(this, this.paddingX);
          const autocomplete = this.autocompleteState;
          const slashMenu =
            autocomplete &&
            this.autocompleteList &&
            this.getText().trimStart().startsWith("/");
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
            this.paddingX = nativePadding;
          }
          const activeTheme = state.ui?.theme;
          if (!activeTheme) return prompt;
          const promptHeight = this.renderedVisibleLineCount + 2;
          const actualPadding = Math.min(
            editorPadding.get(this)!,
            Math.max(0, Math.floor((width - 1) / 2)),
          );
          prompt = prompt.map((line, index) => {
            if (index >= promptHeight) return line;
            if (index === 0 || index === promptHeight - 1) {
              // Preserve native hidden-line counters for long multiline input.
              const counter = line.match(/[↑↓] \d+ more/)?.[0] ?? "";
              return promptRow(counter, width, activeTheme);
            }
            if (actualPadding >= 2 && index === 1)
              line = activeTheme.fg("accent", "› ") + line.slice(2);
            return promptRow(line, width, activeTheme);
          });
          if (!slashMenu) return prompt;
          const commandName = !this.getText().trimStart().includes(" ");
          if (commandName) slashLists.add(this.autocompleteList);
          else slashLists.delete(this.autocompleteList);
          this.autocompleteList.layout = {
            ...this.autocompleteList.layout,
            minPrimaryColumnWidth: 24,
            maxPrimaryColumnWidth: 32,
          };
          const padding = Math.min(
            Math.max(1, editorPadding.get(this)!),
            Math.max(0, Math.floor((width - 1) / 2)),
          );
          const contentWidth = Math.max(1, width - padding * 2);
          const menu = this.autocompleteList
            .render(contentWidth)
            .map((line: string) =>
              /^\s*[→›❯] /.test(line.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""))
                ? selectedRow(" ".repeat(padding) + line, width, activeTheme)
                : truncateToWidth(" ".repeat(padding) + line, width),
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
          const nativePadding = this.paddingX;
          const dispatch = (mapped: any) => {
            this.paddingX = editorPadding.get(this) ?? nativePadding;
            try {
              return original.call(this, mapped);
            } finally {
              this.paddingX = nativePadding;
            }
          };
          const menu = commandMenus.get(this);
          if (!menu || !this.autocompleteState || !this.autocompleteList)
            return dispatch(event);
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
          return dispatch({ ...event, y: event.y - menu.offset });
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
