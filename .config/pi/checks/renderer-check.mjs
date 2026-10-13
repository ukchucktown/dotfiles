import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
const packageRoot = process.env.PI_PACKAGE_ROOT;
assert.ok(packageRoot, "PI_PACKAGE_ROOT is required");
const load = (relative) =>
  import(pathToFileURL(path.join(packageRoot, relative)).href);
const {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  initTheme,
  ToolExecutionComponent,
  AssistantMessageComponent,
  CustomEditor,
} = await load("dist/index.js");
const require = createRequire(path.join(packageRoot, "package.json"));
const {
  visibleWidth,
  TuiAltScreen,
  Container,
  Text,
  setKeybindings,
  CombinedAutocompleteProvider,
  CURSOR_MARKER,
} = await import(require.resolve("@earendil-works/pi-tui"));
const { KeybindingsManager } = await load("dist/core/keybindings.js");
const keybindings = new KeybindingsManager();
setKeybindings(keybindings);
const { getEditorTheme } = await load("dist/modes/interactive/theme/theme.js");
const { WorkingStatusIndicator } = await load(
  "dist/modes/interactive/components/status-indicator.js",
);
const originalEditorStatus = CustomEditor.prototype.setWorkingStatusIndicator;
let footerFactory;
let workingIndicatorOptions;
const originalEditorRender = CustomEditor.prototype.render;
const originalEditorMouse = CustomEditor.prototype.handleMouse;
const editorHadOwnMouse = Object.hasOwn(CustomEditor.prototype, "handleMouse");
const editorHadOwnRender = Object.hasOwn(CustomEditor.prototype, "render");
const originalMouseDispatch = TuiAltScreen.prototype.applyMouseDispatchResult;
const originalJumpIndicator =
  TuiAltScreen.prototype.compositeScrollToEndIndicator;
const { createInteractiveTui } = await load(
  "dist/modes/interactive/tui-renderer.js",
);
const source =
  process.env.PI_RENDERER_SOURCE ??
  path.resolve(import.meta.dirname, "../extensions/renderer.ts");
initTheme("dark", false);
const originalAssistant = AssistantMessageComponent.prototype.updateContent;
const originalShell = ToolExecutionComponent.prototype.getRenderShell;
const agentDir = mkdtempSync("/tmp/pi-renderer-check-");
const loader = new DefaultResourceLoader({
  cwd: "/tmp",
  agentDir,
  noExtensions: true,
  noSkills: true,
  noContextFiles: true,
  noPromptTemplates: true,
  additionalExtensionPaths: [source],
});
await loader.reload();
const { session, extensionsResult } = await createAgentSession({
  cwd: "/tmp",
  resourceLoader: loader,
  agentDir,
  sessionManager: SessionManager.inMemory("/tmp"),
  model: {
    id: "renderer-fixture",
    name: "Renderer fixture",
    provider: "fixture",
    api: "openai-responses",
    baseUrl: "http://unused.invalid",
    reasoning: true,
    input: ["text"],
    contextWindow: 100000,
    maxTokens: 1000,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
});
const plain = (lines) =>
  lines
    .join("\n")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07]*\x07/g, "");
const mouse = (y) => ({
  type: "click",
  button: "left",
  x: 2,
  y,
  width: 100,
  modifiers: { shift: false, alt: false, ctrl: false },
});
try {
  assert.deepEqual(extensionsResult.errors, []);
  const extension = extensionsResult.extensions.find(
    (e) => e.resolvedPath === source,
  );
  assert.ok(extension);
  assert.equal(
    extension.tools.size,
    0,
    "Presentation extension must not replace native tools",
  );
  assert.equal(
    extension.toolRenderers.length,
    1,
    "Tool formatting uses the public renderer resolver",
  );
  assert.equal(
    ToolExecutionComponent.prototype.getRenderShell,
    originalShell,
    "Tool shell selection is not patched",
  );
  const ui = {
    ...session.extensionRunner.createContext().ui,
    setFooter: (factory) => {
      footerFactory = factory;
    },
    setWorkingIndicator: (options) => {
      workingIndicatorOptions = options;
    },
  };
  await session.bindExtensions({ uiContext: ui });
  assert.equal(typeof footerFactory, "function");
  assert.deepEqual(workingIndicatorOptions.frames, ["◎", "◉"]);
  session.setThinkingLevel("high");
  const bash = session.agent.state.tools.find((t) => t.name === "bash");
  const result = await bash.execute(
    "runtime-check",
    {
      command:
        'printf "%s\\n" "$PI_MODEL" "$PI_PROVIDER" "$PI_REASONING_LEVEL" "$PI_SESSION_ID"',
    },
    AbortSignal.timeout(10000),
  );
  const values = result.content
    .find((c) => c.type === "text")
    .text.trim()
    .split("\n");
  assert.deepEqual(values.slice(0, 3), [
    session.model.id,
    session.model.provider,
    "high",
  ]);
  assert.ok(values[3], "Native shell keeps its session identifier");
  const args = {
    command: "printf first\\n\nprintf second\\n\nprintf third\\n",
  };
  const output = {
    content: [{ type: "text", text: "first\nsecond\nthird\n" }],
    isError: false,
  };
  const unchanged = structuredClone({ args, output });
  const component = new ToolExecutionComponent(
    "bash",
    "render-check",
    args,
    { showImages: false },
    session.extensionRunner.resolveToolRenderers("bash", () =>
      session.getToolDefinition("bash"),
    ),
    { requestRender() {} },
    "/tmp",
  );
  component.markExecutionStarted();
  component.setArgsComplete();
  component.updateResult(output);
  let lines = component.render(100);
  assert.match(
    plain(lines),
    / Shell printf first.*3 command lines.*3 output lines/,
  );
  assert.doesNotMatch(
    plain(lines),
    /❯|⌄/,
    "Collapsed tool headings have no chevron",
  );
  assert.doesNotMatch(plain(lines), /printf second|│/);
  assert.equal(component.handleMouse(mouse(1))?.handled, true);
  lines = component.render(100);
  assert.match(plain(lines), / Shell/);
  assert.doesNotMatch(
    plain(lines),
    /❯|⌄/,
    "Expanded tool headings have no chevron",
  );
  assert.match(plain(lines), /│ printf second/);
  assert.match(plain(lines), /│ .*third/);
  assert.deepEqual({ args, output }, unchanged);
  component.handleMouse(mouse(1));
  assert.doesNotMatch(plain(component.render(100)), /printf second/);
  component.setExpanded(true);
  const fullOutput = {
    content: [
      {
        type: "text",
        text: Array.from({ length: 25 }, (_, i) => `output-${i + 1}`).join(
          "\n",
        ),
      },
    ],
    isError: false,
  };
  component.updateResult(fullOutput);
  assert.match(plain(component.render(100)), /output-25/);
  assert.equal(fullOutput.content[0].text.split("\n").length, 25);
  for (const width of [1, 2, 8, 40])
    assert.ok(
      component.render(width).every((line) => visibleWidth(line) <= width),
      `Tool width ${width}`,
    );
  component.updateResult({
    content: [
      { type: "text", text: "Permission denied\ntry a different path" },
    ],
    isError: true,
  });
  component.setExpanded(false);
  assert.match(plain(component.render(100)), /failed[\s\S]*Permission denied/);
  const message = {
    role: "assistant",
    provider: "github-copilot",
    model: "gpt-5.4",
    timestamp: 123456,
    content: [
      { type: "thinking", thinking: "Check the native runtime context." },
      { type: "text", text: "The model is available." },
    ],
    stopReason: "stop",
  };
  const originalMessage = structuredClone(message);
  const emit = async (name, event) => {
    for (const handler of extension.handlers.get(name) ?? [])
      await handler(event, session.extensionRunner.createContext());
  };
  const realNow = Date.now;
  try {
    Date.now = () => 10000;
    await emit("message_update", {
      message,
      assistantMessageEvent: { type: "thinking_start", contentIndex: 0 },
    });
    Date.now = () => 12000;
    await emit("message_update", {
      message,
      assistantMessageEvent: { type: "thinking_end", contentIndex: 0 },
    });
    await emit("message_end", { message });
  } finally {
    Date.now = realNow;
  }
  let thought = new AssistantMessageComponent(message);
  assert.match(
    thought.render(100).join("\n"),
    /\x1b\[3m/,
    "Thought heading and body use italic styling",
  );
  assert.match(
    plain(thought.render(100)),
    /⌄ Thought for 2s[\s\S]*│.*Check the native runtime context/,
  );
  assert.equal(thought.handleMouse(mouse(1))?.handled, true);
  assert.match(plain(thought.render(100)), /❯ Thought for 2s/);
  assert.doesNotMatch(
    plain(thought.render(100)),
    /Check the native runtime context/,
  );
  thought.handleMouse(mouse(1));
  assert.match(plain(thought.render(100)), /Check the native runtime context/);
  thought.setHideThinkingBlock(true);
  assert.doesNotMatch(
    plain(thought.render(100)),
    /Check the native runtime context/,
  );
  assert.deepEqual(message, originalMessage);
  // Exercise native fullscreen mouse dispatch, not only component toggles.
  for (const [kind, expandable] of [
    [
      "tool",
      (() => {
        const tool = new ToolExecutionComponent(
          "bash",
          "anchor-check",
          args,
          { showImages: false },
          session.extensionRunner.resolveToolRenderers("bash", () =>
            session.getToolDefinition("bash"),
          ),
          { requestRender() {} },
          "/tmp",
        );
        tool.setArgsComplete();
        tool.updateResult(fullOutput);
        return tool;
      })(),
    ],
    ["thought", new AssistantMessageComponent(message, true)],
  ]) {
    const terminal = new Proxy(
      { columns: 100, rows: 12 },
      {
        get(target, key) {
          return key in target ? target[key] : () => {};
        },
      },
    );
    const tui = createInteractiveTui({
      tuiMode: "fullscreen",
      terminal,
      showHardwareCursor: false,
      logDirectory: "/tmp",
    });
    const document = new Container();
    document.addChild(
      new Text(
        Array.from({ length: 20 }, (_, i) => `earlier-${i}`).join("\n"),
        0,
        0,
      ),
    );
    document.addChild(expandable);
    document.addChild(new Text("trailing-1\ntrailing-2\ntrailing-3", 0, 0));
    tui.addChild(document);
    tui.start();
    try {
      tui.renderNow();
      const headingRow = () =>
        tui
          .getScreenLines()
          .findIndex((line) =>
            plain([line]).includes(
              kind === "tool" ? "Shell" : "Thought for 2s",
            ),
          );
      const beforeRow = headingRow();
      assert.ok(beforeRow >= 0);
      const beforeTop = tui.viewportTop;
      tui.handleMouseEvent({ button: 0, x: 2, y: beforeRow, release: false });
      tui.handleMouseEvent({ button: 0, x: 2, y: beforeRow, release: true });
      tui.renderNow();
      assert.equal(
        headingRow(),
        beforeRow,
        `${kind} heading must remain on the clicked row`,
      );
      assert.equal(
        tui.viewportTop,
        beforeTop,
        `${kind} must open downward instead of following the new bottom`,
      );
      assert.equal(tui.isFollowingOutput, false);
      assert.doesNotMatch(
        plain(tui.getScreenLines()),
        /Jump to latest message/,
      );
      assert.equal(
        tui.scrollToEndIndicatorRect,
        undefined,
        "Hidden popup has no invisible click target",
      );
      assert.equal(
        tui.handleViewportInput("\x1b[1;5F")?.consume,
        true,
        "Ctrl+End retains native navigation",
      );
      tui.renderNow();
      assert.equal(
        tui.isFollowingOutput,
        true,
        "Jump to bottom restores output following",
      );
    } finally {
      tui.stop();
    }
  }
  // Use Pi's native completion provider and list, including command submission.
  const commandEditor = new CustomEditor(
    { requestRender() {}, terminal: { rows: 30 } },
    getEditorTheme(),
    keybindings,
    { paddingX: 1 },
  );
  commandEditor.focused = true;
  commandEditor.setAutocompleteProvider(
    new CombinedAutocompleteProvider(
      [
        { name: "settings", description: "Open settings menu" },
        { name: "model", description: "Select model" },
        { name: "tree", description: "Navigate session tree" },
        { name: "thinking", description: "Set thinking level" },
        { name: "scoped-models", description: "Choose models" },
        { name: "reload", description: "Reload extensions" },
      ],
      "/tmp",
    ),
  );
  const openCommands = async (text = "/") => {
    commandEditor.setText(text);
    commandEditor.requestAutocomplete({
      force: text === "@",
      explicitTab: false,
    });
    await commandEditor.autocompleteRequestTask;
    assert.equal(commandEditor.isShowingAutocomplete(), true);
  };
  await openCommands();
  let commands = commandEditor.render(100);
  let commandsPlain = commands.map((line) => plain([line]));
  const promptBorder = commandsPlain.findIndex((line) => line.includes("─"));
  assert.ok(
    promptBorder > commandsPlain.findIndex((line) => line.includes("settings")),
  );
  assert.equal(commandsPlain[0], "", "Menu has a blank row above it");
  assert.match(
    commandsPlain[1],
    /^ → settings/,
    "Menu retains native selection and side padding",
  );
  assert.ok(
    commandsPlain
      .slice(0, promptBorder)
      .some((line) => line.includes("Open settings menu")),
  );
  assert.equal(
    commands.filter((line) => line.includes(CURSOR_MARKER)).length,
    1,
  );
  assert.equal(
    commands.findIndex((line) => line.includes(CURSOR_MARKER)),
    promptBorder + 1,
    "Cursor remains inside the prompt",
  );
  assert.equal(
    commandEditor.handleMouse({ ...mouse(0), type: "wheel", wheelDelta: 1 }),
    undefined,
    "Blank padding is not a command hit",
  );
  commandEditor.handleInput("\x1b[B");
  assert.match(plain(commandEditor.render(100)), /→ model/);
  commandEditor.handleInput("\t");
  assert.equal(commandEditor.getText(), "/model ");
  assert.equal(commandEditor.isShowingAutocomplete(), false);
  assert.match(plain([commandEditor.render(100)[0]]), /^─/);
  await openCommands();
  commandEditor.render(100);
  assert.equal(
    commandEditor.handleMouse({ ...mouse(2), type: "press" })?.handled,
    true,
  );
  assert.equal(commandEditor.handleMouse(mouse(2))?.handled, true);
  assert.equal(
    commandEditor.getText(),
    "/model ",
    "Moved menu clicks apply native completion",
  );
  await openCommands();
  commands = commandEditor.render(100);
  const inputRow = commands.findIndex((line) => line.includes(CURSOR_MARKER));
  commandEditor.handleMouse({ ...mouse(inputRow), x: 1 });
  assert.deepEqual(
    commandEditor.getCursor(),
    { line: 0, col: 0 },
    "Moved prompt clicks still position the cursor",
  );
  await openCommands();
  commandEditor.render(100);
  commandEditor.handleMouse({ ...mouse(1), type: "wheel", wheelDelta: 1 });
  assert.equal(
    commandEditor.autocompleteList.getSelectedItem().value,
    "model",
    "Wheel scrolls the moved menu",
  );
  let submitted;
  commandEditor.onSubmit = (text) => {
    submitted = text;
  };
  commandEditor.handleInput("\r");
  assert.equal(submitted, "/model");
  await openCommands();
  commandEditor.handleInput("\x1b");
  assert.equal(commandEditor.isShowingAutocomplete(), false);
  assert.equal(commandEditor.getText(), "/");
  await openCommands();
  const menuTerminal = new Proxy(
    { columns: 100, rows: 20 },
    {
      get(target, key) {
        return key in target ? target[key] : () => {};
      },
    },
  );
  const menuTui = new TuiAltScreen(menuTerminal);
  menuTui.addChild(commandEditor);
  menuTui.setFocus(commandEditor);
  menuTui.start();
  try {
    menuTui.renderNow();
    const screen = menuTui.getScreenLines().map((line) => plain([line]));
    const selectedRow = screen.findIndex((line) => line.includes("→ settings"));
    const modelRow = screen.findIndex((line) => line.includes("Select model"));
    const promptRow = screen.findIndex((line) => line.includes("─"));
    assert.ok(
      selectedRow >= 0 && modelRow > selectedRow && modelRow < promptRow,
    );
    menuTui.handleMouseEvent({ button: 0, x: 4, y: modelRow, release: false });
    menuTui.handleMouseEvent({ button: 0, x: 4, y: modelRow, release: true });
    menuTui.renderNow();
    assert.equal(
      commandEditor.getText(),
      "/model ",
      "Fullscreen press/release selects the command above the prompt",
    );
    assert.equal(commandEditor.isShowingAutocomplete(), false);
  } finally {
    menuTui.stop();
  }
  for (const width of [1, 2, 12, 40, 100]) {
    await openCommands();
    const native = originalEditorRender
      .call(commandEditor, width)
      .slice(0, commandEditor.renderedVisibleLineCount + 2);
    const moved = commandEditor.render(width);
    const menuRows = moved.length - native.length;
    assert.ok(
      moved.slice(0, menuRows).every((line) => visibleWidth(line) <= width),
      `Command menu width ${width}`,
    );
    assert.deepEqual(
      moved.slice(menuRows),
      native,
      "Prompt and cursor retain native rendering at each width",
    );
  }
  // Non-command completion retains Pi's original placement and mouse behavior.
  commandEditor.setAutocompleteProvider({
    getSuggestions: async () => ({
      prefix: "@",
      items: [{ value: "file.txt", label: "file.txt" }],
    }),
    applyCompletion: () => ({
      lines: ["file.txt"],
      cursorLine: 0,
      cursorCol: 8,
    }),
  });
  await openCommands("@");
  commands = commandEditor.render(100);
  assert.match(plain([commands[0]]), /^─/);
  assert.ok(
    commands.findIndex((line) => line.includes("file.txt")) >
      commands.findIndex((line) => line.includes(CURSOR_MARKER)),
  );
  commandEditor.cancelAutocomplete();
  const editor = new CustomEditor(
    { requestRender() {}, terminal: { rows: 30 } },
    getEditorTheme(),
    { matches: () => false },
    { embedWorkingStatus: true },
  );
  const indicator = new WorkingStatusIndicator(
    { requestRender() {} },
    "Working fixture",
    workingIndicatorOptions,
  );
  try {
    editor.setText("input fixture");
    editor.setWorkingStatusIndicator(indicator);
    const editorLines = editor.render(100).map((line) => plain([line]));
    assert.doesNotMatch(
      editorLines.join("\n"),
      /Working fixture/,
      "Working status belongs in the footer, not the prompt",
    );
    assert.equal(editor.embedWorkingStatus, true);
    assert.equal(editor.getText(), "input fixture");
    const statuses = new Map([["plan-mode", "Plan mode\nread-only"]]);
    let unsubscribed = false;
    const footer = footerFactory({ requestRender() {} }, ui.theme, {
      getGitBranch: () => "fixture-branch",
      getExtensionStatuses: () => statuses,
      onBranchChange: () => () => {
        unsubscribed = true;
      },
    });
    await emit("agent_start", {});
    await emit("message_update", {
      message,
      assistantMessageEvent: {
        type: "text_delta",
        contentIndex: 1,
        delta: "∑".repeat(512),
      },
    });
    let footerLines = footer.render(120);
    assert.equal(footerLines.length, 1);
    assert.match(
      plain(footerLines),
      /◎ Working fixture.*1.5 KiB.*esc interrupt.*renderer-fixture.*high/,
    );
    assert.match(plain(footerLines), /Plan mode read-only/);
    keybindings.setUserBindings({ "app.interrupt": "ctrl+x" });
    assert.match(plain(footer.render(120)), /ctrl\+x interrupt/);
    assert.doesNotMatch(plain(footer.render(120)), /esc interrupt/);
    keybindings.setUserBindings({ "app.interrupt": [] });
    assert.doesNotMatch(plain(footer.render(120)), / interrupt/);
    keybindings.setUserBindings({});
    for (const width of [0, 1, 2, 12, 30, 60, 120]) {
      const narrow = footer.render(width);
      assert.equal(narrow.length, 1);
      assert.ok(
        narrow.every((line) => visibleWidth(line) <= width),
        `Footer width ${width}`,
      );
    }
    await emit("agent_start", {});
    assert.doesNotMatch(plain(footer.render(120)), /KiB/);
    editor.setWorkingStatusIndicator(undefined);
    editor.render(120);
    footerLines = footer.render(120);
    assert.equal(footerLines.length, 1);
    assert.match(
      plain(footerLines),
      /Plan mode read-only.*.*\/tmp.* fixture-branch.*renderer-fixture.*high/,
    );
    assert.doesNotMatch(plain(footerLines), /Working fixture|interrupt/);
    session.setThinkingLevel("medium");
    assert.match(plain(footer.render(120)), /renderer-fixture.*medium/);
    session.setThinkingLevel("high");
    const originalModel = session.model;
    try {
      session.agent.state.model = { ...originalModel, id: "another-fixture" };
      assert.match(plain(footer.render(120)), /another-fixture/);
      assert.doesNotMatch(plain(footer.render(120)), /renderer-fixture/);
    } finally {
      session.agent.state.model = originalModel;
    }
    statuses.clear();
    assert.doesNotMatch(plain(footer.render(120)), /Plan mode/);
    const getContextUsage = session.getContextUsage;
    try {
      session.getContextUsage = () => ({
        tokens: 42400,
        contextWindow: 100000,
        percent: 42.4,
      });
      assert.match(plain(footer.render(120)), /42% ctx/);
    } finally {
      session.getContextUsage = getContextUsage;
    }
    footer.dispose();
    assert.equal(unsubscribed, true);
  } finally {
    indicator.dispose();
  }
  await session.reload();
  thought = new AssistantMessageComponent(message);
  const restored = plain(thought.render(100));
  assert.equal(
    (restored.match(/Thought for 2s/g) ?? []).length,
    1,
    "Reload restores duration without duplicate headings",
  );
  assert.equal(
    session.agent.state.tools.filter((t) => t.name === "bash").length,
    1,
  );
  await session.extensionRunner.emit({ type: "session_shutdown" });
  assert.equal(
    AssistantMessageComponent.prototype.updateContent,
    originalAssistant,
  );
  assert.equal(ToolExecutionComponent.prototype.getRenderShell, originalShell);
  assert.equal(CustomEditor.prototype.render, originalEditorRender);
  assert.equal(CustomEditor.prototype.handleMouse, originalEditorMouse);
  assert.equal(
    Object.hasOwn(CustomEditor.prototype, "handleMouse"),
    editorHadOwnMouse,
  );
  assert.equal(
    CustomEditor.prototype.setWorkingStatusIndicator,
    originalEditorStatus,
  );
  assert.equal(footerFactory, undefined);
  assert.equal(workingIndicatorOptions, undefined);
  assert.equal(
    Object.hasOwn(CustomEditor.prototype, "render"),
    editorHadOwnRender,
  );
  assert.equal(
    TuiAltScreen.prototype.applyMouseDispatchResult,
    originalMouseDispatch,
  );
  assert.equal(
    TuiAltScreen.prototype.compositeScrollToEndIndicator,
    originalJumpIndicator,
  );
  const nativeTerminal = new Proxy(
    { columns: 100, rows: 12 },
    {
      get(target, key) {
        return key in target ? target[key] : () => {};
      },
    },
  );
  const nativeTui = createInteractiveTui({
    tuiMode: "fullscreen",
    terminal: nativeTerminal,
    showHardwareCursor: false,
    logDirectory: "/tmp",
  });
  nativeTui.addChild(
    new Text(
      Array.from({ length: 30 }, (_, i) => `line-${i}`).join("\n"),
      0,
      0,
    ),
  );
  nativeTui.start();
  try {
    nativeTui.renderNow();
    nativeTui.scrollBy(-5);
    nativeTui.renderNow();
    assert.match(
      plain(nativeTui.getScreenLines()),
      /Jump to latest message/,
      "Shutdown restores the native popup renderer",
    );
  } finally {
    nativeTui.stop();
  }
  console.log(
    "PASS: native shell context, complete results, command preview, clicks, keyboard expansion, error visibility, measured thoughts, anchored expansion, one-line working and idle footer, reload, and cleanup",
  );
} finally {
  session.dispose();
  rmSync(agentDir, { recursive: true, force: true });
}
process.exit(0);
